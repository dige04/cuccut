// Export benchmark (optional check in the dev workflow §2): synthesizes a 1080p fixture with bilingual subtitles, and uses the Render Worker (`export-worker render`) to render the full clip from the same inputs as export and encode it to MP4. It reports wall-clock time, the Worker's self-reported synthesis time (`renderSeconds`), frame count, milliseconds per frame, output frame rate, and load.
// The same picture is run in two placements (`PLACEMENTS`): `cover` is the shape of the old fixture; `contain` is the shape of the main video in a real project
// (`mode: fullscreen`, `fit: contain`, `bg: black`, source and output the same size). Geometrically both are identity, so the frame rates should be close (±10%);
// if `contain` is clearly slower, the path with a background in subtitle-render does extra work (commit 099c1db fixed the identity passthrough; a residual gap remains when captions are burned in).
//
// Fixtures (all in the system temp directory, deleted at the end; `--keep` keeps them):
// - Picture: ffmpeg's `testsrc2`, 1920×1080, 30 fps, H.264 (a keyframe every 2 seconds), 60 seconds by default (`--seconds`); no sound. It measures picture decoding, compositing and encoding, not audio mixing or muxing. Both placements share this clip, each with its own Worker input;
// - Subtitles: one line every 2.5 seconds. The source text is English, with a word-timed transcript (`cuccut.speech/1`; sentences point at transcript words via `words`), drawn with per-word color change. The translation mixes Chinese and English and shares one style document with the source (the two are stacked as a pair). `--mono` burns in only the source; `--no-captions` turns off caption burning (`burnCaptions: false`).
// The Worker input is assembled with the Runtime's `workerInput` (`packages/runtime-core/src/exports/video-export.ts`). The video and document are written by hand in the shape the engine's `exports.plan` returns (taken from the parity fixture `crates/frame-render/tests/fixtures/parity.json`).
//
// Usage: node tools/export-bench.ts [--seconds 60] [--mono | --no-captions] [--style <preset>] [--worker <export-worker>] [--runs 1]
//       [--json <output file>] [--keep]
// `--style` picks a caption style preset. The default is `studio-color` (per-word color change; the picture changes only at sentence and word boundaries, about 1 ms/frame). The others take the path where the caption kernel redraws every frame:
// `studio-transition` (entrance pose plus exit), `studio-wordbox` (pill highlight block that scales and fades in with the word), `designed` (Designed Caption recipe plus per-word emphasis),
// `boxed-reveal` (positioned-box style plus character-by-character reveal, with one box each for source and translation; a word lights up only when it arrives, and the picture changes only at word boundaries), `boxed-motion` (the same boxes, with words moving continuously as they enter).
// `--worker` defaults to `<target>/release/export-worker` (`cargo build --release -p export-worker`; the packaged app uses release). If it is missing, it falls back to debug with a warning. When `--runs` is greater than 1, each placement reports the median and the best run. When the machine is busy, absolute values drift, so check the load in the output.
// Environment: CARGO_TARGET_DIR (to find export-worker), CUCCUT_FFMPEG / CUCCUT_FFPROBE (default to ffmpeg and ffprobe on PATH).

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { cpus, loadavg, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  workerInput,
  type VideoOutput,
  type VideoPlanResult,
} from "../packages/runtime-core/src/exports/video-export.ts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FFMPEG = process.env.CUCCUT_FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.CUCCUT_FFPROBE ?? "ffprobe";
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
/** Interval and length of each subtitle line, in seconds. */
const CUE_EVERY = 2.5;
const CUE_LENGTH = 2.3;

/** Placement of the main video: `cover` is the shape of the old fixture; `contain` is the shape of a real project (fullscreen + contain + black background; source and output the same size). */
const PLACEMENTS = [
  { id: "cover", fit: "cover" },
  { id: "contain", fit: "contain", bg: "black" },
] as const;
type Placement = (typeof PLACEMENTS)[number];

type Captions = "bilingual" | "mono" | "none";

/** Caption style presets (`--style`). Apart from the default `studio-color`, all of them make the caption kernel redraw every frame. */
const STYLES = [
  "studio-color",
  "studio-transition",
  "studio-wordbox",
  "designed",
  "boxed-reveal",
  "boxed-motion",
] as const;
type StyleName = (typeof STYLES)[number];

interface Options {
  seconds: number;
  captions: Captions;
  style: StyleName;
  worker: string | null;
  runs: number;
  json: string | null;
  keep: boolean;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    seconds: 60,
    captions: "bilingual",
    style: "studio-color",
    worker: null,
    runs: 1,
    json: null,
    keep: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seconds") options.seconds = Number(argv[++i]);
    else if (arg === "--mono") options.captions = "mono";
    else if (arg === "--no-captions") options.captions = "none";
    else if (arg === "--style") {
      const name = argv[++i] as StyleName;
      if (!STYLES.includes(name))
        throw new Error(`--style 要是 ${STYLES.join(" / ")} 之一`);
      options.style = name;
    } else if (arg === "--worker") options.worker = resolve(argv[++i]!);
    else if (arg === "--runs") options.runs = Number(argv[++i]);
    else if (arg === "--json") options.json = resolve(argv[++i]!);
    else if (arg === "--keep") options.keep = true;
    else throw new Error(`不认识的参数 ${arg}`);
  }
  if (!Number.isInteger(options.seconds) || options.seconds < 1)
    throw new Error("--seconds 要是正整数");
  if (!Number.isInteger(options.runs) || options.runs < 1)
    throw new Error("--runs 要是正整数");
  return options;
}

/** Worker: use the one given; otherwise use release, falling back to debug if it is missing. */
function findWorker(given: string | null): { path: string; profile: string } {
  if (given) {
    if (!existsSync(given)) throw new Error(`没有 ${given}`);
    return {
      path: given,
      profile: given.includes("/release/")
        ? "release"
        : given.includes("/debug/")
          ? "debug"
          : "custom",
    };
  }
  const target = process.env.CARGO_TARGET_DIR ?? join(ROOT, "target");
  const release = join(target, "release/export-worker");
  if (existsSync(release)) return { path: release, profile: "release" };
  const debug = join(target, "debug/export-worker");
  if (existsSync(debug)) {
    console.warn(
      `警告：没有 ${release}，改用 debug 版（比打包的应用慢得多）；先 cargo build --release -p export-worker`,
    );
    return { path: debug, profile: "debug" };
  }
  throw new Error(
    `没有 export-worker：先 cargo build --release -p export-worker`,
  );
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf8",
  });
  if (result.error)
    throw new Error(`${command} 启动失败：${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} 失败：${result.stderr}`);
}

// ---------- Fixtures ----------

const ORIGINAL = [
  "Today we are going to look at how the export pipeline works",
  "Every frame is planned decoded composited and then encoded",
  "Subtitles are drawn on top of the picture in both languages",
  "The original line follows the speaker word by word",
  "While the translation sits right above it on screen",
  "Long sentences wrap onto a second line when they get too wide for the frame",
  "Short ones stay on a single line",
  "We measure how many frames per second the worker can sustain",
];
const TRANSLATION = [
  "今天我们来看一下 export pipeline 是怎么工作的",
  "每一帧都要先 plan、再解码、合成，最后交给 encoder",
  "字幕用两种语言画在画面上方",
  "原文跟着说话人 word by word 变色",
  "译文就叠在它上面",
  "句子太长、超过画面宽度的时候会自动折到第二行，比如这一句就比较长",
  "短句只占一行",
  "我们量 worker 每秒能稳定画多少帧（FPS）",
];

/** Style document id for the translation line. The Studio styles share `doc_style` across both lines; each positioned-box style has a box of its own. */
const ORIG_STYLE = "doc_style";
const TRANS_STYLE = "doc_style_trans";

const motion = (preset: string, durationSeconds: number, easing: string) => ({
  preset,
  unit: "cue",
  durationSeconds,
  staggerSeconds: 0,
  intensity: 1,
  easing,
});

const studioDocument = (documentId: string, style: unknown) => ({
  documentId,
  kind: "caption-style",
  schema: "cuccut.legacy-studio-style/0.1",
  body: { schema: "cuccut.legacy-studio-style/0.1", style },
});

/** Positioned-box style: the canvas and output are the same size; the source box sits below, and the translation box is stacked on top of it. `animationPresetId: reveal` reveals one character at a time. */
const boxedDocument = (documentId: string, y: number, preset: string) => ({
  documentId,
  kind: "caption-style",
  schema: "cuccut.boxed-caption-style/18",
  body: {
    schema: "cuccut.boxed-caption-style/18",
    canvas: { width: WIDTH, height: HEIGHT },
    box: { x: 0, y, width: 1700, height: 160 },
    style: {
      fontSize: 64,
      color: "#FFFFFF",
      verticalAlign: "center",
      animationPresetId: preset,
    },
  },
});

/** Style documents for the preset: `orig` for the source, `trans` for the translation (defaults to sharing the source's). */
function styleDocuments(style: StyleName): { orig: unknown; trans: unknown } {
  const studio = (extra: Record<string, unknown>) => {
    const doc = studioDocument(ORIG_STYLE, { order: "trans", ...extra });
    return { orig: doc, trans: doc };
  };
  switch (style) {
    case "studio-color":
      // Per-word color change: the picture changes only at sentence and word boundaries.
      return studio({ anim: { name: "Color" } });
    case "studio-transition":
      // Entrance pose (fade-in plus scale) and exit (textMotion.out): redrawn every frame at the start and end of each sentence.
      return studio({
        anim: { name: "Color" },
        transition: { transitionId: "magic-pop", transitionSpeed: 0 },
        textMotion: {
          version: 1,
          in: motion("fade-up", 0.5, "easeOutQuad"),
          out: motion("blur-out", 0.4, "easeInQuad"),
        },
      });
    case "studio-wordbox":
      // Pill highlight: the highlight block scales and fades in following the word's phase.
      return studio({
        wordAnimation: {
          animationName: "Highlight",
          active: {
            boxScale: [
              [0, 0.7],
              [0.4, 1.08],
              [1, 1],
            ],
            boxOpacity: [
              [0, 0],
              [0.3, 1],
              [1, 1],
            ],
            boxEasing: "expoOut",
          },
        },
      });
    case "designed": {
      // Designed Caption: the recipe is resolved every frame; the 3rd word is marked as hero (word id taken from the transcript).
      const doc = studioDocument(ORIG_STYLE, {
        order: "trans",
        captionEmphasis: {
          w0_2: { role: "hero", color: "#00E5FF", emoji: "✨" },
          w1_1: { role: "emphasis", color: "#FFD43B" },
        },
        wordAnimation: {
          animationName: "None",
          caption: {
            schema: 1,
            style: { id: "caption-weight-shift", version: 1 },
            content: "orig",
            palette: { primary: "#FFFFFF", accent: "#FF4D6D" },
            intensity: 72,
            speed: 1.1,
            seed: 31415,
            options: [],
          },
        },
      });
      return { orig: doc, trans: doc };
    }
    case "boxed-reveal":
    case "boxed-motion": {
      // Character-by-character reveal is discrete (a word lights up only when it arrives); `floatInTop` makes each word move continuously while it fades in on entry.
      const preset = style === "boxed-reveal" ? "reveal" : "floatInTop";
      return {
        orig: boxedDocument(ORIG_STYLE, 440, preset),
        trans: boxedDocument(TRANS_STYLE, 270, preset),
      };
    }
  }
}

const MS = (seconds: number) => Math.round(seconds * 1000);
const time = (seconds: number) => ({
  ticks: String(MS(seconds)),
  timescale: 1000,
});

/** Transcript, source and translated subtitles (source media clock, in milliseconds). */
function captionDocuments(seconds: number, assetId: string, style: StyleName) {
  const words: { id: string; text: string; start: number; end: number }[] = [];
  const original: unknown[] = [];
  const translation: unknown[] = [];
  for (let i = 0; i * CUE_EVERY + 0.5 < seconds; i++) {
    const start = i * CUE_EVERY;
    const end = Math.min(start + CUE_LENGTH, seconds);
    const text = ORIGINAL[i % ORIGINAL.length]!;
    const parts = text.split(" ");
    const step = (end - start) / parts.length;
    const ids = parts.map((word, j) => {
      const id = `w${i}_${j}`;
      words.push({
        id,
        text: word,
        start: MS(start + j * step),
        end: MS(start + (j + 1) * step),
      });
      return id;
    });
    original.push({
      id: `o${i}`,
      start: MS(start),
      end: MS(end),
      text,
      words: { first: ids[0], last: ids.at(-1) },
    });
    translation.push({
      id: `t${i}`,
      start: MS(start),
      end: MS(end),
      text: TRANSLATION[i % TRANSLATION.length],
    });
  }
  const caption = (cues: unknown[]) => ({
    schema: "cuccut.caption/1",
    clock: "source-asset",
    timescale: 1000,
    cues,
  });
  return {
    speech: {
      documentId: "doc_speech",
      kind: "speech",
      schema: "cuccut.speech/1",
      sourceAssetId: assetId,
      body: {
        schema: "cuccut.speech/1",
        clock: "source-asset",
        timescale: 1000,
        words,
      },
    },
    original: {
      documentId: "doc_orig",
      kind: "caption",
      schema: "cuccut.caption/1",
      lineKind: "original",
      sourceAssetId: assetId,
      sourceDocumentId: "doc_speech",
      body: caption(original),
    },
    translation: {
      documentId: "doc_trans",
      kind: "caption",
      schema: "cuccut.caption/1",
      lineKind: "translation",
      sourceAssetId: assetId,
      body: caption(translation),
    },
    styles: styleDocuments(style),
  };
}

const base = {
  enabled: true,
  locked: false,
  paintOrder: 0,
  followPolicy: { kind: "sequence-fixed" },
};

function captionItem(
  id: string,
  documentId: string,
  styleDocumentId: string,
  frames: number,
) {
  return {
    ...base,
    id,
    type: "caption",
    trackId: "trk_s1",
    documentId,
    styleDocumentId,
    scopeItemIds: ["clip"],
    span: { fromFrame: 0, durationFrames: frames },
  };
}

/** The `video` plan from the engine's `exports.plan`: one sequence, with one video covering the whole canvas and captions overlaid per `captions`. */
function plan(
  seconds: number,
  captions: Captions,
  style: StyleName,
  placement: Placement,
  bytes: number,
): VideoPlanResult {
  const frames = seconds * FPS;
  const assetId = "a_clip";
  const docs = captionDocuments(seconds, assetId, style);
  const items: unknown[] = [
    {
      ...base,
      id: "clip",
      type: "video",
      trackId: "trk_v1",
      assetRef: { id: assetId, revision: "rev_1" },
      embeddedAudio: { enabled: false, volume: 1 },
      mode: "fullscreen",
      fit: placement.fit,
      ...("bg" in placement ? { bg: placement.bg } : {}),
      place: {},
      span: { fromFrame: 0, durationFrames: frames },
      timeMap: {
        kind: "linear",
        rate: { num: 1, den: 1 },
        sourceIn: { ticks: "0", timescale: 1 },
      },
    },
  ];
  const documents: unknown[] = [];
  if (captions !== "none") {
    items.push(captionItem("cap_orig", "doc_orig", ORIG_STYLE, frames));
    documents.push(docs.speech, docs.original, docs.styles.orig);
  }
  if (captions === "bilingual") {
    const own = docs.styles.trans !== docs.styles.orig;
    items.push(
      captionItem(
        "cap_trans",
        "doc_trans",
        own ? TRANS_STYLE : ORIG_STYLE,
        frames,
      ),
    );
    documents.push(docs.translation);
    if (own) documents.push(docs.styles.trans);
  }
  const track = (id: string, kind: string, order: number) => ({
    id,
    kind,
    order,
    locked: false,
    muted: false,
    visible: true,
    solo: { enabled: false, group: "visual" },
  });
  const sequence = {
    id: "seq",
    name: "bench",
    revision: "1",
    canvas: {
      width: WIDTH,
      height: HEIGHT,
      background: "#000000",
      workingSpace: "srgb",
    },
    fps: { num: FPS, den: 1 },
    durationPolicy: { kind: "derived" },
    tracks: [track("trk_v1", "visual", 0), track("trk_s1", "subtitle", 1)],
    items,
    transitions: [],
    markers: [],
    ducking: [],
    animationBindings: [],
  };
  const asset = {
    id: assetId,
    kind: "video",
    name: "clip.mp4",
    currentRevision: "rev_1",
    revisions: {
      rev_1: {
        revision: "rev_1",
        byteLength: bytes,
        contentHash: `sha256:${assetId}`,
        mediaType: "video/mp4",
        provenance: { origin: "import" },
        storage: { mode: "managed" },
        video: {
          displayWidth: WIDTH,
          displayHeight: HEIGHT,
          frameRate: { kind: "cfr", rate: { num: FPS, den: 1 } },
          hasAlpha: false,
          pixelAspectRatio: { num: 1, den: 1 },
          ptsOrigin: { ticks: "0", timescale: 1 },
          rotation: 0,
        },
      },
    },
  };
  return {
    sequenceId: "seq",
    document: {
      rootSequenceId: "seq",
      sequences: { seq: sequence },
      assets: { [assetId]: asset },
    },
    documents,
    parts: [{ video: { range: { start: time(0), end: time(seconds) } } }],
  } as unknown as VideoPlanResult;
}

interface Fixture {
  dir: string;
  /** One Worker input per placement, all sharing the same picture. */
  inputs: { placement: Placement; inputFile: string }[];
  outputFile: string;
  cues: number;
}

function makeFixture(
  seconds: number,
  captions: Captions,
  style: StyleName,
): Fixture {
  const dir = mkdtempSync(join(tmpdir(), "cuccut-export-bench-"));
  const clip = join(dir, "clip.mp4");
  run(FFMPEG, [
    '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${WIDTH}x${HEIGHT}:rate=${FPS}`, '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'veryfast', '-g', String(FPS * 2), '-pix_fmt', 'yuv420p', '-y', clip,
  ]); // prettier-ignore
  const outputFile = join(dir, "out.mp4");
  const output: VideoOutput = {
    format: "mp4",
    codec: "h264",
    width: WIDTH,
    height: HEIGHT,
    picture: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    fps: { num: FPS, den: 1 },
    crf: null,
    bitrateKbps: null,
    audioBitrateKbps: 192,
  };
  const assets = new Map([
    [
      "a_clip",
      {
        assetId: "a_clip",
        revision: "rev_1",
        path: clip,
        mediaType: "video/mp4",
      },
    ],
  ]);
  const ffmpeg = which(FFMPEG);
  const ffprobe = which(FFPROBE);
  const bytes = statSync(clip).size;
  const inputs = PLACEMENTS.map((placement) => {
    const input = workerInput({
      plan: plan(seconds, captions, style, placement, bytes),
      part: 0,
      assets: assets as never,
      output,
      outputPath: outputFile,
      audioPath: null,
      burnCaptions: captions !== "none",
      onUnsupported: "fail",
      ffmpeg,
      ffprobe,
    });
    const inputFile = join(dir, `${placement.id}.input.json`);
    writeFileSync(inputFile, JSON.stringify(input));
    return { placement, inputFile };
  });
  return {
    dir,
    inputs,
    outputFile,
    cues: Math.ceil((seconds - 0.5) / CUE_EVERY),
  };
}

/** The Worker needs the tool's path: replace the bare name on PATH with an absolute path. */
function which(tool: string): string {
  if (tool.includes("/")) return resolve(tool);
  const found = spawnSync("/usr/bin/env", ["which", tool], {
    encoding: "utf8",
  });
  const path = found.stdout?.trim();
  if (found.status !== 0 || !path) throw new Error(`找不到 ${tool}`);
  return path;
}

// ---------- Run ----------

interface Result {
  /** Placement of the main video (an id from `PLACEMENTS`). */
  placement: Placement["id"];
  captions: Captions;
  style: StyleName;
  worker: string;
  profile: string;
  seconds: number;
  frames: number;
  wallSeconds: number;
  renderSeconds: number;
  /** Wall clock minus the Worker's self-reported synthesis time: reading the input, preflight, starting decode and encode, and finishing the mux. */
  overheadSeconds: number;
  msPerFrame: number;
  fps: number;
  decoderRestarts: number;
  /** The picture codec backend the Worker reports (`done.video`), such as `avfoundation→avfoundation`; with `CUCCUT_EXPORT_NATIVE=0` it is ffmpeg. */
  video: string;
  outputBytes: number;
  loadBefore: number;
  loadAfter: number;
}

/** Runs `export-worker render` once. stdin is kept open: the Worker treats closing stdin as cancel. */
function render(
  worker: string,
  inputFile: string,
  outputFile: string,
): Promise<{ done: any; wallSeconds: number }> {
  rmSync(outputFile, { force: true });
  return new Promise((resolvePromise, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(worker, ["render", inputFile], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.on("error", () => {});
    let buffer = "";
    let stderr = "";
    let final: any = null;
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      buffer += chunk;
      for (
        let newline = buffer.indexOf("\n");
        newline >= 0;
        newline = buffer.indexOf("\n")
      ) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event.event !== "progress") final = event;
        } catch {
          // Lines that are not JSON are ignored.
        }
      }
    });
    child.stderr
      .setEncoding("utf8")
      .on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const wallSeconds = Number(process.hrtime.bigint() - started) / 1e9;
      child.stdin.destroy();
      if (final?.event === "done") resolvePromise({ done: final, wallSeconds });
      else
        reject(
          new Error(
            `Worker 退出码 ${code}：${JSON.stringify(final)}\n${stderr.slice(-2000)}`,
          ),
        );
    });
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round = (value: number, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

function print(
  label: string,
  r: Pick<
    Result,
    | "wallSeconds"
    | "renderSeconds"
    | "overheadSeconds"
    | "frames"
    | "msPerFrame"
    | "fps"
  >,
  extra = "",
): void {
  console.log(
    `${label}: 墙钟 ${round(r.wallSeconds)} s · 合成 ${round(r.renderSeconds)} s · 其余 ${round(r.overheadSeconds)} s · ` +
      `${r.frames} 帧 · ${round(r.msPerFrame)} ms/帧 · ${round(r.fps, 1)} fps${extra}`,
  );
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const worker = findWorker(options.worker);
  const fixture = makeFixture(options.seconds, options.captions, options.style);
  const captionsLabel = {
    bilingual: "双语字幕",
    mono: "单语字幕",
    none: "不烧字幕",
  }[options.captions];
  console.log(
    `夹具：${WIDTH}×${HEIGHT} ${FPS} fps ${options.seconds} s，${captionsLabel}` +
      `${options.captions === "none" ? "" : `（${options.style}，${fixture.cues} 句）`}，目录 ${fixture.dir}`,
  );
  console.log(
    `Worker：${worker.path}（${worker.profile}），${cpus().length} 核 ${cpus()[0]?.model ?? ""}`,
  );
  const results: Result[] = [];
  try {
    for (const { placement, inputFile } of fixture.inputs) {
      const label =
        placement.id === "cover"
          ? "cover（旧夹具）"
          : "contain（真实项目：fullscreen + contain + 黑底）";
      console.log(`摆法 ${label}`);
      const own: Result[] = [];
      for (let i = 0; i < options.runs; i++) {
        const loadBefore = loadavg()[0]!;
        const { done, wallSeconds } = await render(
          worker.path,
          inputFile,
          fixture.outputFile,
        );
        const loadAfter = loadavg()[0]!;
        const frames = Number(done.frames);
        const renderSeconds = Number(done.renderSeconds);
        const result: Result = {
          placement: placement.id,
          captions: options.captions,
          style: options.style,
          worker: worker.path,
          profile: worker.profile,
          seconds: options.seconds,
          frames,
          wallSeconds,
          renderSeconds,
          overheadSeconds: wallSeconds - renderSeconds,
          msPerFrame: (renderSeconds * 1000) / frames,
          fps: frames / renderSeconds,
          decoderRestarts: Number(done.decoderRestarts),
          video: done.video
            ? `${done.video.decoder ?? "-"}→${done.video.encoder}` +
              (done.video.fallbacks.length
                ? `（回落 ${done.video.fallbacks.map((f: { scope: string; reason: string }) => `${f.scope}:${f.reason}`).join("、")}）`
                : "")
            : "未报",
          outputBytes: statSync(fixture.outputFile).size,
          loadBefore,
          loadAfter,
        };
        own.push(result);
        results.push(result);
        const skipped = (done.skipped ?? []).length;
        const warnings = (done.warnings ?? []).length + skipped;
        if (skipped)
          console.warn(
            `警告：Worker 跳过了字幕（样式没画出来）：${JSON.stringify(done.skipped)}`,
          );
        print(
          `  第 ${i + 1} 次`,
          result,
          ` · 解码重开 ${result.decoderRestarts} 次 · 输出 ${round(result.outputBytes / 1e6, 1)} MB · ` +
            `编解码 ${result.video} · ` +
            `负载 ${loadBefore.toFixed(1)}→${loadAfter.toFixed(1)}/${cpus().length}${warnings ? ` · 警告与跳过 ${warnings} 项` : ""}`,
        );
      }
      if (own.length > 1) {
        const pick = (key: keyof Result) => own.map((r) => r[key] as number);
        const summary = {
          wallSeconds: median(pick("wallSeconds")),
          renderSeconds: median(pick("renderSeconds")),
          overheadSeconds: median(pick("overheadSeconds")),
          frames: own[0]!.frames,
          msPerFrame: median(pick("msPerFrame")),
          fps: median(pick("fps")),
        };
        print(`  中位数（${own.length} 次）`, summary);
        const best = own.reduce((a, b) =>
          b.renderSeconds < a.renderSeconds ? b : a,
        );
        print("  最好的一次", best);
      }
    }
    // Both placements use identity geometry, so their frame rates should be close; if contain is clearly slower, the identity passthrough with a background has been lost.
    const fpsOf = (id: Placement["id"]) =>
      median(results.filter((r) => r.placement === id).map((r) => r.fps));
    const cover = fpsOf("cover");
    const contain = fpsOf("contain");
    console.log(
      `对比：cover ${round(cover, 1)} fps · contain ${round(contain, 1)} fps · contain/cover ${round(contain / cover, 2)}` +
        (Math.abs(contain / cover - 1) > 0.1
          ? "（相差超过 10%：查 subtitle-render 里全屏 + contain + bg 的路径，先看 render_media_element 的恒等直通，再看烧字幕时的合成）"
          : ""),
    );
    if (options.json)
      writeFileSync(
        options.json,
        JSON.stringify(
          { fixture: { ...options, cues: fixture.cues }, results },
          null,
          1,
        ),
      );
  } finally {
    if (options.keep) console.log(`保留夹具：${fixture.dir}`);
    else rmSync(fixture.dir, { recursive: true, force: true });
  }
}

await main();
