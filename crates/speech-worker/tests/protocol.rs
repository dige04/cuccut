//! Protocol tests: start a real speech-worker process and play the Runtime, answering `llm.request` (a fake model: it replies in Chinese according to the carrier's structure, with no networking).

use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{Receiver, RecvTimeoutError, channel};
use std::time::Duration;

use serde_json::{Value, json};
use speech_doc::sentence::derive_sentences;
use speech_doc_bridge::{MediaFacts, V3Documents, to_transcript_doc};
use video_model::speech::SpeechBody;
use video_model::translation::TranslationBody;

const TIMEOUT: Duration = Duration::from_secs(60);

struct Worker {
    child: Child,
    stdin: Option<ChildStdin>,
    lines: Receiver<Value>,
    next_id: u64,
}

impl Worker {
    fn start() -> Worker {
        let mut child = Command::new(env!("CARGO_BIN_EXE_speech-worker"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("speech-worker can start");
        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let Ok(line) = line else { break };
                let value: Value = serde_json::from_str(&line).unwrap_or_else(|_| panic!("stdout is not a JSON line: {line}"));
                if tx.send(value).is_err() {
                    break;
                }
            }
        });
        Worker {
            stdin: child.stdin.take(),
            child,
            lines: rx,
            next_id: 1,
        }
    }

    fn send(&mut self, method: &str, params: Value) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        let stdin = self.stdin.as_mut().expect("stdin is still open");
        writeln!(stdin, "{}", json!({ "id": id, "method": method, "params": params })).unwrap();
        stdin.flush().unwrap();
        id
    }

    fn recv(&self) -> Value {
        match self.lines.recv_timeout(TIMEOUT) {
            Ok(value) => value,
            Err(RecvTimeoutError::Timeout) => panic!("Worker did not respond"),
            Err(RecvTimeoutError::Disconnected) => panic!("Worker stdout closed"),
        }
    }

    /// Waits for the response with `id`. Events received along the way are collected into `events`, and model requests are handed to `on_request` to decide how to answer.
    fn drive(&mut self, id: u64, events: &mut Vec<Value>, on_request: &mut dyn FnMut(&Value, &mut Worker) -> Answer) -> Value {
        loop {
            let message = self.recv();
            if message.get("id").and_then(Value::as_u64) == Some(id) {
                return message;
            }
            if message.get("id").is_some() {
                // Acknowledgement for llm.reply / cancel.
                assert!(message.get("result").is_some(), "the receipt should succeed: {message}");
                continue;
            }
            let name = message["event"].as_str().unwrap_or_default().to_owned();
            events.push(message.clone());
            if name != "llm.request" {
                continue;
            }
            let request_id = message["params"]["requestId"].as_u64().unwrap();
            match on_request(&message["params"], self) {
                Answer::Text(text) => {
                    self.send("llm.reply", json!({ "requestId": request_id, "text": text }));
                }
                Answer::Error(error) => {
                    self.send("llm.reply", json!({ "requestId": request_id, "error": error }));
                }
                Answer::Cancel => {
                    self.send("cancel", json!({}));
                }
                Answer::Close => {
                    self.stdin = None;
                    return Value::Null;
                }
            }
        }
    }

    fn translate(&mut self, job: &Job, events: &mut Vec<Value>, on_request: &mut dyn FnMut(&Value, &mut Worker) -> Answer) -> Value {
        let id = self.send(
            "translate",
            json!({ "input": job.input.to_str().unwrap(), "staging": job.staging.to_str().unwrap() }),
        );
        self.drive(id, events, on_request)
    }

    fn wait_exit(mut self) -> std::process::ExitStatus {
        for _ in 0..600 {
            if let Some(status) = self.child.try_wait().unwrap() {
                return status;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        let _ = self.child.kill();
        panic!("Worker did not exit on its own");
    }
}

impl Drop for Worker {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

enum Answer {
    Text(String),
    Error(Value),
    Cancel,
    Close,
}

/// Fake model: for translate pages it replies in Chinese sentence by sentence, and sentences carrying `data-align-groups` write line spans group by group (matching the rows contract).
/// Other kinds (brief, alignment) return an invalid answer, so the core takes its own degradation and fallback path.
fn fake_answer(params: &Value) -> String {
    let kind = params["kind"].as_str().unwrap();
    let user = params["user"].as_str().unwrap();
    if kind != "translate" {
        return "<article></article>".into();
    }
    let mut out = String::from("<article>");
    for section in split_tags(user, "section") {
        let section_id = attr(&section.open, "id").unwrap();
        out.push_str(&format!("<section id=\"{section_id}\">"));
        for p in split_tags(&section.inner, "p") {
            if attr(&p.open, "data-editable") == Some("false".into()) {
                continue;
            }
            let id = attr(&p.open, "id").unwrap();
            out.push_str(&format!("<p id=\"{id}\">"));
            if let Some(groups) = attr(&p.open, "data-align-groups") {
                for (index, group) in groups.split(';').enumerate() {
                    let range = group.split('@').next().unwrap();
                    out.push_str(&format!("<span data-src=\"{range}\">第{}行</span>", index + 1));
                }
            } else if let Some(words) = attr(&p.open, "data-align-words") {
                let count = words.matches('[').count();
                out.push_str(&format!("<span data-src=\"1-{count}\">好的</span>"));
            } else {
                out.push_str("好的。");
            }
            out.push_str("</p>");
        }
        out.push_str("</section>");
    }
    out.push_str("</article>");
    out
}

struct Tag {
    open: String,
    inner: String,
}

fn split_tags(html: &str, name: &str) -> Vec<Tag> {
    let mut out = Vec::new();
    let open_pat = format!("<{name} ");
    let close_pat = format!("</{name}>");
    let mut rest = html;
    while let Some(start) = rest.find(&open_pat) {
        let after = &rest[start..];
        let open_end = after.find('>').unwrap();
        let close = after.find(&close_pat).unwrap_or_else(|| panic!("no {close_pat}: {after}"));
        out.push(Tag {
            open: after[..open_end].to_owned(),
            inner: after[open_end + 1..close].to_owned(),
        });
        rest = &after[close + close_pat.len()..];
    }
    out
}

fn attr(open: &str, name: &str) -> Option<String> {
    let pat = format!(" {name}=\"");
    let start = open.find(&pat)? + pat.len();
    let end = open[start..].find('"')? + start;
    Some(open[start..end].replace("&quot;", "\"").replace("&amp;", "&"))
}

/// The sentences to translate: the ids of all editable `<p>` elements in the request.
fn requested_sentences(params: &Value) -> Vec<String> {
    if params["kind"] != "translate" {
        return Vec::new();
    }
    let user = params["user"].as_str().unwrap();
    split_tags(user, "section")
        .into_iter()
        .flat_map(|section| split_tags(&section.inner, "p"))
        .filter(|p| attr(&p.open, "data-editable") != Some("false".into()))
        .filter_map(|p| attr(&p.open, "id"))
        .collect()
}

struct Job {
    _dir: tempfile::TempDir,
    input: PathBuf,
    staging: PathBuf,
    speech: Value,
    duration_us: i64,
}

/// Synthesizes an English transcript: `sentences` sentences, `words` words each, with punctuation at the end of each sentence and a 0.4-second pause between sentences.
fn job(sentences: usize, words: usize) -> Job {
    let mut list = Vec::new();
    let mut clock = 0_i64;
    for s in 0..sentences {
        for w in 0..words {
            let text = if w + 1 == words { format!("word{w}.") } else { format!("word{w}") };
            list.push(json!({ "id": format!("w-{s}-{w}"), "start": clock, "end": clock + 280_000, "text": if w == 0 { text } else { format!(" {text}") }, "speaker": "s1" }));
            clock += 300_000;
        }
        clock += 400_000;
    }
    let speech = json!({
        "schema": "cuccut.speech/1",
        "clock": "source-asset",
        "timescale": 1_000_000,
        "speakers": [{ "id": "s1", "name": "说话人 1" }],
        "words": list,
        "sentences": null,
    });
    let dir = tempfile::tempdir().unwrap();
    let staging = dir.path().join("staging");
    let input = dir.path().join("input.json");
    let duration_us = clock + 1_000_000;
    let value = json!({
        "schema": "cuccut.speech-worker.translate/1",
        "media": { "assetId": "asset-1", "contentHash": "sha256:00", "duration": { "ticks": duration_us.to_string(), "timescale": 1_000_000 } },
        "sourceLanguage": "en",
        "speechRef": { "id": "doc-speech", "revision": "rev-1" },
        "sequenceId": "seq-root",
        "speech": speech,
        "targetLanguage": "zh-Hans",
        "glossary": [{ "source": "word1", "target": "词一" }],
        "glossaryRef": { "entries": [], "inline": { "contentHash": "sha256:11", "count": 1 }, "terms": [] },
        "params": { "instructions": "口语化", "backoffScale": 0 },
    });
    std::fs::write(&input, serde_json::to_vec(&value).unwrap()).unwrap();
    Job {
        _dir: dir,
        input,
        staging,
        speech: value["speech"].clone(),
        duration_us,
    }
}

/// Sentence IDs derived by the core (one-to-one with the units the Worker writes out).
fn crate_sentence_ids(job: &Job) -> Vec<String> {
    let speech: SpeechBody = serde_json::from_value(job.speech.clone()).unwrap();
    let media = MediaFacts {
        asset_id: Some("asset-1".into()),
        path: None,
        content_hash: "sha256:00".into(),
        duration: editor_semantics::MediaTime {
            ticks: job.duration_us.to_string(),
            timescale: 1_000_000,
        },
        sample_rate: None,
    };
    let doc = to_transcript_doc(&V3Documents {
        media: &media,
        language: Some("en"),
        speech: &speech,
        translations: &[],
    })
    .unwrap();
    derive_sentences(&doc, &[]).into_iter().map(|sentence| sentence.id).collect()
}

fn read(path: &Path) -> Value {
    serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap()
}

fn events_named<'a>(events: &'a [Value], name: &str) -> Vec<&'a Value> {
    events.iter().filter(|event| event["event"] == name).collect()
}

#[test]
fn hello_names_the_protocol() {
    let mut worker = Worker::start();
    let id = worker.send("hello", json!({}));
    let reply = worker.recv();
    assert_eq!(reply["id"], id);
    assert_eq!(reply["result"]["protocol"], "speech-worker/1");
    assert_eq!(reply["result"]["methods"], json!(["translate"]));
    drop(worker.stdin.take());
    assert!(worker.wait_exit().success(), "exits normally after stdin closes");
}

#[test]
fn translates_a_speech_body_into_a_translation_body_and_target_cues() {
    let job = job(6, 6);
    let mut worker = Worker::start();
    let mut events = Vec::new();
    let reply = worker.translate(&job, &mut events, &mut |params, _| Answer::Text(fake_answer(params)));
    assert!(reply.get("error").is_none(), "{reply}");
    let result = &reply["result"];
    assert_eq!(result["translation"], "translation.json");

    // Every llm.request is shaped by the file contract: the inline input envelope and the output cap.
    let requests = events_named(&events, "llm.request");
    assert!(!requests.is_empty());
    for request in &requests {
        let params = &request["params"];
        assert!(params["user"].as_str().unwrap().starts_with("<BEGIN INPUT name=\""));
        assert!(params["maxOutputTokens"].as_u64().unwrap() >= 4096);
        assert!(params["system"].as_str().unwrap().len() > 100);
    }
    // Single page: skip the brief. The first request is the translate page.
    assert_eq!(requests[0]["params"]["kind"], "translate");
    assert!(!events_named(&events, "checkpoint").is_empty());
    assert!(!events_named(&events, "progress").is_empty());

    let body: TranslationBody = serde_json::from_value(read(&job.staging.join("translation.json"))).unwrap();
    assert_eq!(body.schema, "cuccut.translation/2");
    assert_eq!(body.language, "zh-Hans");
    assert_eq!(body.source_basis.speech_ref.id, "doc-speech");
    assert_eq!(body.source_basis.speech_ref.revision, "rev-1");
    assert_eq!(body.source_basis.sequence_id, "seq-root");
    assert!(body.source_basis.edit_view_hash.starts_with("sha256:"));
    assert_eq!(body.glossary_ref.as_ref().unwrap()["inline"]["count"], 1);
    let ids = crate_sentence_ids(&job);
    assert_eq!(
        body.units.iter().map(|unit| unit.source_sentence_id.clone()).collect::<Vec<_>>(),
        ids
    );
    for unit in &body.units {
        assert_eq!(unit.id, format!("t-{}", unit.source_sentence_id));
        assert!(!unit.natural_text.trim().is_empty());
        // The core's fingerprint: `<word count>:<first word>:<last word>:<digest>` (video format spec §5.3).
        assert_eq!(unit.source_fingerprint.split(':').count(), 4, "{}", unit.source_fingerprint);
    }

    let cues = read(&job.staging.join("cues.json"));
    assert_eq!(cues["schema"], "cuccut.speech-worker.cues/1");
    assert_eq!(cues["timescale"], 1_000_000);
    let list = cues["cues"].as_array().unwrap();
    assert!(list.len() >= body.units.len());
    let mut previous_end = 0;
    for cue in list {
        let (start, end) = (cue["start"].as_i64().unwrap(), cue["end"].as_i64().unwrap());
        assert!(start >= previous_end && start < end && end <= job.duration_us, "{cue}");
        previous_end = end;
        assert!(body.units.iter().any(|unit| Some(unit.id.as_str()) == cue["unitId"].as_str()));
        assert!(!cue["text"].as_str().unwrap().is_empty());
    }
    let report = read(&job.staging.join("report.json"));
    assert_eq!(report["totalSentences"], ids.len());
    assert_eq!(report["brief"], "skipped");
    assert_eq!(report["llmCalls"], requests.len());
}

#[test]
fn a_terminal_error_stops_and_a_restart_does_not_redo_finished_pages() {
    // More than two pages: 12 words per sentence, 100 sentences = 1200 words, which exceeds the translation page budget (800 words).
    let job = job(100, 12);
    let mut worker = Worker::start();
    let mut events = Vec::new();
    let mut translated_first: Vec<String> = Vec::new();
    let mut pages_answered = 0;
    let reply = worker.translate(&job, &mut events, &mut |params, _| {
        if params["kind"] == "translate" {
            if pages_answered == 1 {
                return Answer::Error(json!({ "code": "BUDGET_EXCEEDED", "message": "task budget is used up", "class": "terminal" }));
            }
            pages_answered += 1;
            translated_first.extend(requested_sentences(params));
        }
        Answer::Text(fake_answer(params))
    });
    assert_eq!(reply["error"]["code"], "BUDGET_EXCEEDED", "{reply}");
    assert_eq!(reply["error"]["details"]["phase"], "translating");
    let done = reply["error"]["details"]["translatedSentences"].as_u64().unwrap() as usize;
    assert!(done > 0 && done == translated_first.len(), "{reply}");
    assert!(job.staging.join("checkpoint.json").exists());
    assert!(!job.staging.join("translation.json").exists(), "no half-finished translation");
    // Terminal failures are not retried: the second page was sent only once.
    let second_page_requests = events_named(&events, "llm.request")
        .iter()
        .filter(|request| request["params"]["kind"] == "translate")
        .count();
    assert_eq!(second_page_requests, 2);
    drop(worker);

    // Start a new process to resume: it reports `resumed` first, and sentences already finished are not sent for translation again.
    let mut worker = Worker::start();
    let mut events = Vec::new();
    let mut translated_second: Vec<String> = Vec::new();
    let reply = worker.translate(&job, &mut events, &mut |params, _| {
        translated_second.extend(requested_sentences(params));
        Answer::Text(fake_answer(params))
    });
    assert!(reply.get("error").is_none(), "{reply}");
    let resumed = events_named(&events, "resumed");
    assert_eq!(resumed.len(), 1);
    assert_eq!(resumed[0]["params"]["translatedSentences"], done);
    assert!(!translated_second.is_empty());
    for id in &translated_second {
        assert!(!translated_first.contains(id), "already-finished sentence {id} was sent for translation again");
    }
    // The brief was settled the first time, so resumed runs make no further request for it.
    assert!(
        events_named(&events, "llm.request")
            .iter()
            .all(|request| request["params"]["kind"] != "translate-brief")
    );
    let body: TranslationBody = serde_json::from_value(read(&job.staging.join("translation.json"))).unwrap();
    assert_eq!(body.units.len(), crate_sentence_ids(&job).len());
    assert_eq!(translated_first.len() + translated_second.len(), body.units.len());
}

#[test]
fn a_refresh_retranslates_only_the_named_sentence_onto_the_existing_translation() {
    // First translate the whole thing once, as the base draft.
    let first = job(6, 6);
    let mut worker = Worker::start();
    let reply = worker.translate(&first, &mut Vec::new(), &mut |params, _| Answer::Text(fake_answer(params)));
    assert!(reply.get("error").is_none(), "{reply}");
    drop(worker);
    let mut base = read(&first.staging.join("translation.json"));
    // The first sentence is marked as reviewed: it stays as it is when other sentences are refreshed.
    base["units"][0]["status"] = json!("reviewed");

    // Change one word in the third sentence (the fingerprint changes), so only this sentence is re-translated.
    let second = job(6, 6);
    let mut input = read(&second.input);
    let words = input["speech"]["words"].as_array_mut().unwrap();
    let word = words.iter_mut().find(|word| word["id"] == "w-2-1").unwrap();
    word["text"] = json!(" changed");
    let target = "s-w-2-0";
    input["speechRef"]["revision"] = json!("rev-2");
    input["translation"] = base.clone();
    input["sentences"] = json!([target]);
    std::fs::write(&second.input, serde_json::to_vec(&input).unwrap()).unwrap();

    let mut worker = Worker::start();
    let mut events = Vec::new();
    let mut requested = Vec::new();
    let reply = worker.translate(&second, &mut events, &mut |params, _| {
        requested.extend(requested_sentences(params));
        Answer::Text(fake_answer(params).replace("好的", "新的").replace("第", "新"))
    });
    assert!(reply.get("error").is_none(), "{reply}");
    assert_eq!(requested, vec![target.to_owned()], "only the named sentence is sent for translation");
    assert!(
        events_named(&events, "llm.request")
            .iter()
            .all(|request| request["params"]["kind"] != "translate-brief"),
        "a refresh does not make a brief"
    );

    let body = read(&second.staging.join("translation.json"));
    assert_eq!(body["sourceBasis"]["speechRef"]["revision"], "rev-2", "sourceBasis is replaced with this run's source text");
    assert_eq!(body["glossaryRef"], base["glossaryRef"], "glossaryRef is kept from the base draft");
    let units = body["units"].as_array().unwrap();
    let base_units = base["units"].as_array().unwrap();
    assert_eq!(units.len(), base_units.len());
    for (unit, prior) in units.iter().zip(base_units) {
        assert_eq!(unit["id"], prior["id"], "unit IDs and order are unchanged");
        if unit["sourceSentenceId"] == target {
            assert!(unit["naturalText"].as_str().unwrap().contains('新'), "{unit}");
            assert_ne!(unit["sourceFingerprint"], prior["sourceFingerprint"], "the fingerprint is replaced with the edited sentence's");
            assert_eq!(unit["status"], "draft");
        } else {
            assert_eq!(unit, prior, "other units are unchanged word for word");
        }
    }
    let report = read(&second.staging.join("report.json"));
    assert_eq!(report["mode"], "refresh");
    assert_eq!(report["targetSentences"], 1);
}

#[test]
fn a_refresh_translates_a_sentence_that_has_no_unit_yet() {
    let first = job(6, 6);
    let mut worker = Worker::start();
    let reply = worker.translate(&first, &mut Vec::new(), &mut |params, _| Answer::Text(fake_answer(params)));
    assert!(reply.get("error").is_none(), "{reply}");
    drop(worker);
    let base = read(&first.staging.join("translation.json"));

    // Hide the first word of the third sentence: this sentence's ID becomes `s-w-2-1`, and the base draft has no unit for it.
    let second = job(6, 6);
    let mut input = read(&second.input);
    let words = input["speech"]["words"].as_array_mut().unwrap();
    words.iter_mut().find(|word| word["id"] == "w-2-0").unwrap()["hidden"] = json!(true);
    let target = "s-w-2-1";
    input["speechRef"]["revision"] = json!("rev-2");
    input["translation"] = base.clone();
    input["sentences"] = json!([target]);
    std::fs::write(&second.input, serde_json::to_vec(&input).unwrap()).unwrap();

    let mut worker = Worker::start();
    let mut requested = Vec::new();
    let reply = worker.translate(&second, &mut Vec::new(), &mut |params, _| {
        requested.extend(requested_sentences(params));
        Answer::Text(fake_answer(params))
    });
    assert!(reply.get("error").is_none(), "{reply}");
    assert_eq!(requested, vec![target.to_owned()]);
    let body = read(&second.staging.join("translation.json"));
    let fresh = body["units"]
        .as_array()
        .unwrap()
        .iter()
        .find(|unit| unit["sourceSentenceId"] == target)
        .unwrap_or_else(|| panic!("new sentences need units: {body}"));
    assert!(!fresh["naturalText"].as_str().unwrap().trim().is_empty(), "{fresh}");
    assert!(fresh["sourceFingerprint"].as_str().unwrap().starts_with("5:w-2-1:"), "{fresh}");
    let cues = read(&second.staging.join("cues.json"));
    assert!(
        cues["cues"].as_array().unwrap().iter().any(|cue| cue["unitId"] == fresh["id"]),
        "the new unit has a subtitle cue"
    );
}

#[test]
fn long_sentences_come_back_as_aligned_rows() {
    let job = job(6, 30);
    let mut worker = Worker::start();
    let mut events = Vec::new();
    let reply = worker.translate(&job, &mut events, &mut |params, _| Answer::Text(fake_answer(params)));
    assert!(reply.get("error").is_none(), "{reply}");
    let report = read(&job.staging.join("report.json"));
    // The line-partition draft returned along with the translate page is accepted directly, without sending a separate alignment request.
    assert_eq!(report["align"]["prealignedSentences"], 6);
    assert_eq!(report["llmCalls"], 1);
    let body: TranslationBody = serde_json::from_value(read(&job.staging.join("translation.json"))).unwrap();
    let cues = read(&job.staging.join("cues.json"));
    let list = cues["cues"].as_array().unwrap();
    assert!(
        list.len() > body.units.len(),
        "long sentences split into lines: {} cues, {} units",
        list.len(),
        body.units.len()
    );
    assert!(
        body.units
            .iter()
            .any(|unit| unit.alignment.as_ref().is_some_and(|a| a.split.is_some()))
    );
    let mut previous_end = 0;
    for cue in list {
        let (start, end) = (cue["start"].as_i64().unwrap(), cue["end"].as_i64().unwrap());
        assert!(start >= previous_end && start < end && end <= job.duration_us, "{cue}");
        previous_end = end;
    }
}

#[test]
fn retryable_errors_are_retried_by_the_core() {
    let job = job(4, 5);
    let mut worker = Worker::start();
    let mut events = Vec::new();
    let mut failed = false;
    let reply = worker.translate(&job, &mut events, &mut |params, _| {
        if !failed {
            failed = true;
            return Answer::Error(json!({ "code": "PROVIDER_UNAVAILABLE", "message": "503", "class": "retryable", "status": 503 }));
        }
        Answer::Text(fake_answer(params))
    });
    assert!(reply.get("error").is_none(), "{reply}");
    let requests = events_named(&events, "llm.request");
    assert_eq!(requests[0]["params"]["kind"], "translate");
    assert_eq!(requests[1]["params"]["kind"], "translate");
}

#[test]
fn cancel_ends_the_job_and_keeps_the_checkpoint() {
    let job = job(100, 12);
    let mut worker = Worker::start();
    let mut events = Vec::new();
    let mut pages = 0;
    let reply = worker.translate(&job, &mut events, &mut |params, _| {
        if params["kind"] == "translate" {
            pages += 1;
            if pages == 2 {
                return Answer::Cancel;
            }
        }
        Answer::Text(fake_answer(params))
    });
    assert_eq!(reply["error"]["code"], "CANCELLED", "{reply}");
    assert!(reply["error"]["details"]["translatedSentences"].as_u64().unwrap() > 0);
    let checkpoint = read(&job.staging.join("checkpoint.json"));
    assert_eq!(checkpoint["custom"]["phase"], "translating");
    // After a cancel the process is still alive and can keep being used. It exits after stdin is closed.
    let id = worker.send("hello", json!({}));
    assert_eq!(worker.recv()["id"], id);
    drop(worker.stdin.take());
    assert!(worker.wait_exit().success());
}

#[test]
fn closing_stdin_mid_request_exits_the_process() {
    let job = job(100, 12);
    let mut worker = Worker::start();
    let mut events = Vec::new();
    let mut pages = 0;
    worker.translate(&job, &mut events, &mut |params, _| {
        if params["kind"] == "translate" {
            pages += 1;
            if pages == 2 {
                return Answer::Close;
            }
        }
        Answer::Text(fake_answer(params))
    });
    assert!(worker.wait_exit().success(), "exits on its own after the parent lets go");
    let checkpoint = read(&job.staging.join("checkpoint.json"));
    assert!(!checkpoint["custom"]["trans"].as_object().unwrap().is_empty());
}

#[test]
fn bad_input_is_an_error_not_a_crash() {
    let dir = tempfile::tempdir().unwrap();
    let input = dir.path().join("input.json");
    std::fs::write(&input, b"{\"schema\":\"nope\"}").unwrap();
    let mut worker = Worker::start();
    let id = worker.send(
        "translate",
        json!({ "input": input.to_str().unwrap(), "staging": dir.path().join("s").to_str().unwrap() }),
    );
    let reply = worker.recv();
    assert_eq!(reply["id"], id);
    assert_eq!(reply["error"]["code"], "INPUT_UNREADABLE");
    let id = worker.send("translate", json!({}));
    let reply = worker.recv();
    assert_eq!(reply["id"], id);
    assert_eq!(reply["error"]["code"], "INVALID_PARAMS");
}
