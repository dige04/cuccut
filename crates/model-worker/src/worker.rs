//! The Worker's state machine and its two threads.
//!
//! - **stdin thread** (main thread) reads requests and makes state transitions under a shared lock. It answers immediately whatever it can (`worker.hello`, `worker.status`, `job.cancel` and the various state errors) and hands the rest to the inference thread.
//! - **Inference thread** exclusively owns the loaded model (MLX arrays are not `Send`) and runs `model.load`, `model.unload` and `job.run` in turn. Events and responses are written straight to stdout. The stdin thread never touches MLX: the in-memory snapshot for `worker.status` is cached by the inference thread after each segment (for synthesis, after each job).
//!
//! Recognition, synthesis, separation and text-to-image share this threading model. When a model bundle carries the `tts` component, what gets loaded is a TTS engine ([`Loaded::Synthesis`]). With a `separator` component it is a separation model ([`Loaded::Separation`]), and with an `image` component it is an image engine ([`Loaded::Image`]). With only `segmentation` and `speaker`, it is speaker diarization ([`Loaded::Diarization`]). `job.run` dispatches by `capability` to [`transcribe::run`], [`synthesize::job::run`], [`separate::job::run`], [`image::job::run`] or [`diarize::run`].

use std::io::{BufWriter, Stdout, Write};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::JoinHandle;
use std::time::{SystemTime, UNIX_EPOCH};

use model_runtime::backend::{self, Loaded, ModelPhase};
use model_runtime::bundle::{self, VerifiedBundle};
use model_runtime::diarize;
use model_runtime::image;
use model_runtime::priority;
use model_runtime::protocol::{
    self, CancelParams, DiarizeRunParams, EmptyParams, ErrorBody, HelloParams, ImageRunParams, JobRunParams, LoadParams, MemorySnapshot,
    SeparateRunParams, SynthesizeRunParams, codes, parse_params, run_capability,
};
use model_runtime::separate;
use model_runtime::synthesize;
use model_runtime::transcribe::{self, JobSink};
use model_runtime::{CONTRACT_VERSION, WORKER_VERSION};
use serde_json::{Value, json};

/// Stack of the inference thread: MLX graph construction and Metal compilation go fairly deep.
const INFERENCE_STACK_BYTES: usize = 16 * 1024 * 1024;

// ---- Output -------------------------------------------------------------------------------------

/// stdout: shared by both threads, one lock per line. If the write fails, exit (the Runtime is no longer reading).
#[derive(Clone)]
pub struct Output(Arc<Mutex<BufWriter<Stdout>>>);

impl Output {
    pub fn stdout() -> Self {
        Self(Arc::new(Mutex::new(BufWriter::new(std::io::stdout()))))
    }

    fn lock(&self) -> MutexGuard<'_, BufWriter<Stdout>> {
        self.0.lock().unwrap_or_else(|poison| poison.into_inner())
    }

    pub fn send(&self, value: &Value) {
        let mut out = self.lock();
        let ok = serde_json::to_writer(&mut *out, value).is_ok() && out.write_all(b"\n").is_ok() && out.flush().is_ok();
        if !ok {
            drop(out);
            eprintln!("[model-worker] stdout is closed; exiting");
            hard_exit(0);
        }
    }

    pub fn respond(&self, id: &Value, outcome: Result<Value, ErrorBody>) {
        let line = match outcome {
            Ok(result) => json!({ "id": id, "result": result }),
            Err(error) => json!({ "id": id, "error": error }),
        };
        self.send(&line);
    }

    pub fn event(&self, name: &str, params: Value) {
        self.send(&protocol::event(name, params));
    }

    pub fn flush(&self) {
        let _ = self.lock().flush();
    }
}

/// Exit the process immediately without running destructors. The inference thread may be holding MLX arrays and a Metal command buffer, and the global destructors on a normal exit would race with it.
pub fn hard_exit(code: i32) -> ! {
    // SAFETY: _exit does not return and does not touch any Rust state.
    unsafe { libc::_exit(code) }
}

// ---- Shared state ---------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Empty,
    Loading,
    Ready,
    Busy,
    Unloading,
}

impl State {
    fn as_str(self) -> &'static str {
        match self {
            Self::Empty => "empty",
            Self::Loading => "loading",
            Self::Ready => "ready",
            Self::Busy => "busy",
            Self::Unloading => "unloading",
        }
    }
}

#[derive(Debug, Clone)]
struct JobInfo {
    job_id: String,
    phase: String,
    started_at: String,
}

#[derive(Debug)]
struct Status {
    state: State,
    bundle_id: Option<String>,
    job: Option<JobInfo>,
    memory: Option<MemorySnapshot>,
}

pub struct Shared {
    status: Mutex<Status>,
    cancel: AtomicBool,
}

impl Shared {
    fn status(&self) -> MutexGuard<'_, Status> {
        self.status.lock().unwrap_or_else(|poison| poison.into_inner())
    }

    /// Inference is still in progress (loading, job, unloading): exiting now must go through [`hard_exit`].
    pub fn in_flight(&self) -> bool {
        matches!(self.status().state, State::Loading | State::Busy | State::Unloading)
    }
}

// ---- Inference thread ---------------------------------------------------------------------------------

enum Work {
    Load { id: Value, bundle: Box<VerifiedBundle> },
    Unload { id: Value },
    Run { id: Value, params: Box<JobRunParams> },
    Synthesize { id: Value, params: Box<SynthesizeRunParams> },
    Separate { id: Value, params: Box<SeparateRunParams> },
    Image { id: Value, params: Box<ImageRunParams> },
    Diarize { id: Value, params: Box<DiarizeRunParams> },
}

struct Inference {
    output: Output,
    shared: Arc<Shared>,
    model: Option<Loaded>,
    bundle: Option<VerifiedBundle>,
}

impl Inference {
    fn serve(mut self, work: Receiver<Work>) {
        while let Ok(item) = work.recv() {
            let (id, method) = match &item {
                Work::Load { id, .. } => (id.clone(), "model.load"),
                Work::Unload { id } => (id.clone(), "model.unload"),
                Work::Run { id, .. }
                | Work::Synthesize { id, .. }
                | Work::Separate { id, .. }
                | Work::Image { id, .. }
                | Work::Diarize { id, .. } => (id.clone(), "job.run"),
            };
            if catch_unwind(AssertUnwindSafe(|| self.handle(item))).is_err() {
                panic_exit(&self.output, &id, method);
            }
        }
        // Channel closed (stdin EOF and no work in progress): the model is dropped here, and the guard synchronizes the GPU and clears the cache.
        drop(self.model.take());
    }

    fn handle(&mut self, work: Work) {
        match work {
            Work::Load { id, bundle } => {
                let output = self.output.clone();
                let mut phase = |phase: ModelPhase, detail: Option<&str>| {
                    let mut params = json!({ "phase": phase.as_str() });
                    if let Some(detail) = detail {
                        params["detail"] = json!(detail);
                    }
                    output.event("model.phase", params);
                };
                let loaded = backend::load(&bundle, &mut phase);
                let response = match loaded {
                    Ok(model) => {
                        let result = json!({ "loaded": true, "residentBytes": model.resident_bytes(), "warmupMs": model.warmup_ms() });
                        let memory = model.memory();
                        self.model = Some(model);
                        self.bundle = Some(*bundle);
                        let mut status = self.shared.status();
                        status.state = State::Ready;
                        status.memory = memory;
                        Ok(result)
                    }
                    Err(error) => {
                        let mut status = self.shared.status();
                        status.state = State::Empty;
                        status.bundle_id = None;
                        Err(error)
                    }
                };
                self.output.respond(&id, response);
            }
            Work::Unload { id } => {
                drop(self.model.take());
                self.bundle = None;
                {
                    let mut status = self.shared.status();
                    status.state = State::Empty;
                    status.bundle_id = None;
                    status.memory = None;
                }
                self.output.respond(&id, Ok(json!({ "unloaded": true })));
            }
            Work::Run { id, params } => {
                let mut sink = Sink {
                    output: &self.output,
                    shared: &self.shared,
                };
                let response = match (self.model.as_mut(), self.bundle.as_ref()) {
                    (Some(Loaded::Transcription(model)), Some(bundle)) => {
                        transcribe::run(model.as_mut(), bundle, &params, &self.shared.cancel, &mut sink)
                            .and_then(|result| serde_json::to_value(result).map_err(serialize_failed))
                    }
                    (Some(Loaded::Synthesis(_) | Loaded::Separation(_) | Loaded::Image(_) | Loaded::Diarization(_)), _) => {
                        Err(capability_not_loaded("transcribe"))
                    }
                    _ => Err(ErrorBody::new(codes::WORKER_BUSY, "no model is loaded")),
                };
                self.finish_job(&id, response);
            }
            Work::Synthesize { id, params } => {
                let mut sink = Sink {
                    output: &self.output,
                    shared: &self.shared,
                };
                let response = match self.model.as_mut() {
                    Some(Loaded::Synthesis(synthesis)) => {
                        let result = synthesize::job::run(synthesis.engine.as_mut(), &params, &self.shared.cancel, &mut sink);
                        if let Some(snapshot) = (synthesis.memory)() {
                            sink.memory(snapshot);
                        }
                        result.and_then(|result| serde_json::to_value(result).map_err(serialize_failed))
                    }
                    Some(Loaded::Transcription(_) | Loaded::Separation(_) | Loaded::Image(_) | Loaded::Diarization(_)) => {
                        Err(capability_not_loaded("synthesize"))
                    }
                    None => Err(ErrorBody::new(codes::WORKER_BUSY, "no model is loaded")),
                };
                self.finish_job(&id, response);
            }
            Work::Separate { id, params } => {
                let mut sink = Sink {
                    output: &self.output,
                    shared: &self.shared,
                };
                let response = match self.model.as_mut() {
                    Some(Loaded::Separation(separation)) => {
                        let result = separate::job::run(separation.separator.as_mut(), &params, &self.shared.cancel, &mut sink);
                        if let Some(snapshot) = (separation.memory)() {
                            sink.memory(snapshot);
                        }
                        result.and_then(|result| serde_json::to_value(result).map_err(serialize_failed))
                    }
                    Some(Loaded::Transcription(_) | Loaded::Synthesis(_) | Loaded::Image(_) | Loaded::Diarization(_)) => {
                        Err(capability_not_loaded("separate"))
                    }
                    None => Err(ErrorBody::new(codes::WORKER_BUSY, "no model is loaded")),
                };
                self.finish_job(&id, response);
            }
            Work::Image { id, params } => {
                let mut sink = Sink {
                    output: &self.output,
                    shared: &self.shared,
                };
                let response = match self.model.as_mut() {
                    Some(Loaded::Image(loaded)) => {
                        let result = image::job::run(loaded.engine.as_mut(), &params, &self.shared.cancel, &mut sink);
                        if let Some(snapshot) = (loaded.memory)() {
                            sink.memory(snapshot);
                        }
                        result.and_then(|result| serde_json::to_value(result).map_err(serialize_failed))
                    }
                    Some(Loaded::Transcription(_) | Loaded::Synthesis(_) | Loaded::Separation(_) | Loaded::Diarization(_)) => {
                        Err(capability_not_loaded("image"))
                    }
                    None => Err(ErrorBody::new(codes::WORKER_BUSY, "no model is loaded")),
                };
                self.finish_job(&id, response);
            }
            Work::Diarize { id, params } => {
                let mut sink = Sink {
                    output: &self.output,
                    shared: &self.shared,
                };
                let response = match (self.model.as_mut(), self.bundle.as_ref()) {
                    (Some(Loaded::Diarization(loaded)), Some(bundle)) => {
                        let result = diarize::run(loaded.diarizer.as_mut(), bundle, &params, &self.shared.cancel, &mut sink);
                        if let Some(snapshot) = (loaded.memory)() {
                            sink.memory(snapshot);
                        }
                        result.and_then(|result| serde_json::to_value(result).map_err(serialize_failed))
                    }
                    (Some(Loaded::Transcription(_) | Loaded::Synthesis(_) | Loaded::Separation(_) | Loaded::Image(_)), _) => {
                        Err(capability_not_loaded("diarize"))
                    }
                    _ => Err(ErrorBody::new(codes::WORKER_BUSY, "no model is loaded")),
                };
                self.finish_job(&id, response);
            }
        }
    }

    /// Job terminated: go back to ready (the model is still loaded), clear the job and the cancel flag, then send the response.
    fn finish_job(&self, id: &Value, response: Result<Value, ErrorBody>) {
        {
            let mut status = self.shared.status();
            status.state = if self.model.is_some() { State::Ready } else { State::Empty };
            status.job = None;
            self.shared.cancel.store(false, Ordering::SeqCst);
        }
        self.output.respond(id, response);
    }
}

fn serialize_failed(error: serde_json::Error) -> ErrorBody {
    ErrorBody::new(codes::INFERENCE_FAILED, error.to_string())
}

/// The loaded model bundle cannot do this kind of job (running synthesis on a recognition bundle, image generation on a synthesis bundle, and so on). It is reported as `MODEL_UNSUPPORTED`, the same as the other cases where the model cannot do the job.
fn capability_not_loaded(capability: &str) -> ErrorBody {
    ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("the loaded model bundle cannot {capability}"))
        .with_details(json!({ "capability": capability, "reason": "capability-not-loaded" }))
}

/// Job events are written straight to stdout. `job.phase` also updates the phase in `worker.status`.
struct Sink<'a> {
    output: &'a Output,
    shared: &'a Shared,
}

impl JobSink for Sink<'_> {
    fn event(&mut self, name: &str, params: Value) {
        if name == "job.phase"
            && let Some(phase) = params.get("phase").and_then(Value::as_str)
            && let Some(job) = self.shared.status().job.as_mut()
        {
            job.phase = phase.to_owned();
        }
        self.output.event(name, params);
    }

    fn memory(&mut self, snapshot: MemorySnapshot) {
        self.shared.status().memory = Some(snapshot);
    }
}

/// Panic: reply to that request with `WORKER_PANIC`, then exit (protocol spec §1).
fn panic_exit(output: &Output, id: &Value, method: &str) -> ! {
    eprintln!("[model-worker] panic while handling {method}; exiting");
    output.respond(
        id,
        Err(ErrorBody::new(
            codes::WORKER_PANIC,
            format!("the worker crashed while handling {method}"),
        )),
    );
    output.flush();
    hard_exit(1)
}

// ---- stdin side ---------------------------------------------------------------------------------

pub struct Worker {
    output: Output,
    shared: Arc<Shared>,
    work: Option<Sender<Work>>,
    inference: Option<JoinHandle<()>>,
}

impl Worker {
    pub fn start(output: Output) -> std::io::Result<Self> {
        let shared = Arc::new(Shared {
            status: Mutex::new(Status {
                state: State::Empty,
                bundle_id: None,
                job: None,
                memory: None,
            }),
            cancel: AtomicBool::new(false),
        });
        let (sender, receiver) = std::sync::mpsc::channel();
        let (thread_output, thread_shared) = (output.clone(), shared.clone());
        // The model is not Send: the inference thread creates it and holds it itself.
        let handle = std::thread::Builder::new()
            .name("inference".into())
            .stack_size(INFERENCE_STACK_BYTES)
            .spawn(move || {
                // Inference runs at utility QoS so it does not compete with the foreground (architecture design §6.5). It applies to this thread only.
                priority::lower_current_thread();
                Inference {
                    output: thread_output,
                    shared: thread_shared,
                    model: None,
                    bundle: None,
                }
                .serve(receiver)
            })?;
        Ok(Self {
            output,
            shared,
            work: Some(sender),
            inference: Some(handle),
        })
    }

    /// Handle one line of request.
    pub fn handle_line(&mut self, line: &[u8]) {
        let request: Value = match serde_json::from_slice(line) {
            Ok(value) => value,
            Err(error) => {
                eprintln!("[model-worker] cannot parse request: {error}");
                return;
            }
        };
        let id = request.get("id").cloned().unwrap_or(Value::Null);
        let method = request.get("method").and_then(Value::as_str).unwrap_or("").to_owned();
        let params = request.get("params").cloned().unwrap_or_else(|| json!({}));
        match catch_unwind(AssertUnwindSafe(|| self.dispatch(&id, &method, params))) {
            Ok(Some(response)) => self.output.respond(&id, response),
            Ok(None) => {}
            Err(_) => panic_exit(&self.output, &id, &method),
        }
    }

    /// `None`: the response is given later by the inference thread.
    fn dispatch(&mut self, id: &Value, method: &str, params: Value) -> Option<Result<Value, ErrorBody>> {
        match method {
            "worker.hello" => Some(self.hello(params)),
            "worker.status" => Some(parse_params::<EmptyParams>(params).map(|_| self.status_value())),
            "job.cancel" => Some(self.cancel(params)),
            "model.load" => self.load(id, params).err().map(Err),
            "model.unload" => self.unload(id, params),
            "job.run" => self.run(id, params).err().map(Err),
            _ => Some(Err(ErrorBody::new(codes::UNKNOWN_METHOD, format!("unknown method: {method}")))),
        }
    }

    fn hello(&self, params: Value) -> Result<Value, ErrorBody> {
        let hello: HelloParams = parse_params(params)?;
        if hello.contract_version != CONTRACT_VERSION {
            return Err(ErrorBody::new(codes::CONTRACT_MISMATCH, "contract version mismatch")
                .with_details(json!({ "expected": CONTRACT_VERSION, "actual": hello.contract_version })));
        }
        // Recognition, synthesis and text-to-image are declared per model family. `transcribeFamilies` / `synthesizeFamilies` / `imageFamilies` are the `asr` / `tts` / `image` families whose loaders this build has wired up. The `transcribe` / `synthesize` / `image` capabilities are declared only when the list is non-empty (protocol spec §2.1).
        // Families that are not wired up yet are judged `capability-missing` by the Runtime, not treated as a broken bundle.
        let transcribe_families = backend::transcribe_families();
        let synthesize_families = synthesize::available_families();
        let image_families = image::available_families();
        let mut capabilities = Vec::new();
        if !transcribe_families.is_empty() {
            capabilities.push("transcribe");
        }
        // `align` requires the model bundle to carry the optional `aligner` component. Here we only declare that this build has the aligner wired up (§2.5.1).
        if backend::aligner_available() {
            capabilities.push("align");
        }
        // `diarize` likewise requires the model bundle to carry the speaker-diarization components (`segmentation` + `speaker`). Here we only declare that this build has them wired up (§2.5.1).
        if backend::diarizer_available() {
            capabilities.push("diarize");
        }
        if !synthesize_families.is_empty() {
            capabilities.push("synthesize");
        }
        // Separation is also declared per model family: `separateFamilies` is the `separator` families this build can load (§2.5.4).
        let separate_families = separate::available_families();
        if !separate_families.is_empty() {
            capabilities.push("separate");
        }
        if !image_families.is_empty() {
            capabilities.push("image");
        }
        Ok(json!({
            "workerVersion": WORKER_VERSION,
            "contractVersion": CONTRACT_VERSION,
            "pid": std::process::id(),
            "backends": backend::statuses(),
            "capabilities": capabilities,
            "transcribeFamilies": transcribe_families,
            "synthesizeFamilies": synthesize_families,
            "separateFamilies": separate_families,
            "imageFamilies": image_families,
        }))
    }

    fn status_value(&self) -> Value {
        let status = self.shared.status();
        json!({
            "state": status.state.as_str(),
            "bundleId": status.bundle_id,
            "job": status.job.as_ref().map(|job| json!({ "jobId": job.job_id, "phase": job.phase, "startedAt": job.started_at })),
            "memory": status.memory,
        })
    }

    fn cancel(&self, params: Value) -> Result<Value, ErrorBody> {
        let cancel: CancelParams = parse_params(params)?;
        let status = self.shared.status();
        match &status.job {
            Some(job) if job.job_id == cancel.job_id => {
                self.shared.cancel.store(true, Ordering::SeqCst);
                Ok(json!({ "acknowledged": true }))
            }
            _ => Err(ErrorBody::new(codes::NOT_FOUND, "no running job with this jobId")),
        }
    }

    fn load(&self, id: &Value, params: Value) -> Result<(), ErrorBody> {
        let load: LoadParams = parse_params(params)?;
        let mut status = self.shared.status();
        match status.state {
            State::Empty => {}
            State::Unloading => return Err(state_error(codes::WORKER_BUSY, "the worker is unloading", status.state)),
            state => return Err(state_error(codes::ALREADY_LOADED, "a model bundle is already loaded", state)),
        }
        let verified = bundle::verify(&load.bundle)?;
        status.state = State::Loading;
        status.bundle_id = Some(verified.bundle_id.clone());
        drop(status);
        self.forward(Work::Load {
            id: id.clone(),
            bundle: Box::new(verified),
        });
        Ok(())
    }

    fn unload(&self, id: &Value, params: Value) -> Option<Result<Value, ErrorBody>> {
        if let Err(error) = parse_params::<EmptyParams>(params) {
            return Some(Err(error));
        }
        let mut status = self.shared.status();
        match status.state {
            State::Empty => Some(Ok(json!({ "unloaded": true }))),
            State::Ready => {
                status.state = State::Unloading;
                drop(status);
                self.forward(Work::Unload { id: id.clone() });
                None
            }
            state => Some(Err(state_error(codes::WORKER_BUSY, "the worker is busy", state))),
        }
    }

    /// `job.run`: parameters are checked for shape first (`INVALID_PARAMS`), then state (`WORKER_BUSY`), and then handed to the inference thread.
    /// Parameters for `capability: "synthesize"` are [`SynthesizeRunParams`] (protocol spec §2.5.2), for `"image"` they are [`ImageRunParams`] (§2.5.3), for `"separate"` they are [`SeparateRunParams`] (§2.5.4), and for `"diarize"` they are [`DiarizeRunParams`] (§2.5.5).
    fn run(&self, id: &Value, params: Value) -> Result<(), ErrorBody> {
        let capability = run_capability(&params);
        let (job_id, work) = if capability == Some("synthesize") {
            let run: SynthesizeRunParams = parse_params(params)?;
            run.validate()?;
            (
                run.job_id.clone(),
                Work::Synthesize {
                    id: id.clone(),
                    params: Box::new(run),
                },
            )
        } else if capability == Some("separate") {
            let run: SeparateRunParams = parse_params(params)?;
            run.validate()?;
            (
                run.job_id.clone(),
                Work::Separate {
                    id: id.clone(),
                    params: Box::new(run),
                },
            )
        } else if capability == Some("diarize") {
            let run: DiarizeRunParams = parse_params(params)?;
            run.validate()?;
            (
                run.job_id.clone(),
                Work::Diarize {
                    id: id.clone(),
                    params: Box::new(run),
                },
            )
        } else if capability == Some("image") {
            let run: ImageRunParams = parse_params(params)?;
            run.validate()?;
            (
                run.job_id.clone(),
                Work::Image {
                    id: id.clone(),
                    params: Box::new(run),
                },
            )
        } else {
            let run: JobRunParams = parse_params(params)?;
            (
                run.job_id.clone(),
                Work::Run {
                    id: id.clone(),
                    params: Box::new(run),
                },
            )
        };
        let mut status = self.shared.status();
        if status.state != State::Ready {
            return Err(state_error(codes::WORKER_BUSY, "the worker is not ready for a job", status.state));
        }
        status.state = State::Busy;
        status.job = Some(JobInfo {
            job_id,
            phase: "starting".into(),
            started_at: utc_now(),
        });
        self.shared.cancel.store(false, Ordering::SeqCst);
        drop(status);
        self.forward(work);
        Ok(())
    }

    fn forward(&self, work: Work) {
        let sent = self.work.as_ref().is_some_and(|sender| sender.send(work).is_ok());
        if !sent {
            // The inference thread is already gone (this can only happen while it is exiting after a panic).
            eprintln!("[model-worker] the inference thread is gone; exiting");
            self.output.flush();
            hard_exit(1);
        }
    }

    /// stdin closed or protocol error: if no inference is in progress, finish cleanly (letting the model drop). Otherwise, exit immediately.
    pub fn shutdown(mut self, code: i32) -> ! {
        if self.shared.in_flight() {
            self.output.flush();
            hard_exit(code);
        }
        drop(self.work.take());
        if let Some(handle) = self.inference.take() {
            let _ = handle.join();
        }
        self.output.flush();
        std::process::exit(code)
    }
}

fn state_error(code: &str, message: &str, state: State) -> ErrorBody {
    ErrorBody::new(code, message).with_details(json!({ "state": state.as_str() }))
}

/// Current UTC time in ISO 8601 (`2026-10-02T14:03:07.123Z`).
fn utc_now() -> String {
    let elapsed = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format_utc(elapsed.as_secs(), elapsed.subsec_millis())
}

fn format_utc(seconds: u64, millis: u32) -> String {
    let days = (seconds / 86_400) as i64;
    let rest = seconds % 86_400;
    // Howard Hinnant's civil_from_days.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        rest / 3_600,
        rest % 3_600 / 60,
        rest % 60
    )
}

#[cfg(test)]
mod tests {
    use super::format_utc;

    #[test]
    fn formats_iso_utc() {
        assert_eq!(format_utc(0, 0), "1970-01-01T00:00:00.000Z");
        assert_eq!(format_utc(951_782_400, 5), "2000-02-29T00:00:00.005Z");
        assert_eq!(format_utc(1_791_036_187, 123), "2026-10-03T14:03:07.123Z");
    }
}
