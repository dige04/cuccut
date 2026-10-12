<p align="center">
  <img src="apps/desktop/build/icon.png" alt="CucCut" width="128">
</p>

<h1 align="center">CucCut</h1>

<p align="center">
  <strong>An agentic video editor for your desktop.</strong><br>
  Describe the video you want. Your agent cuts, captions, translates, dubs and animates it, and every result lands
  in a timeline you can keep editing, together.
</p>

---

## What you can do

**Create a video**

- Start from a sentence, your footage, a link or an empty canvas of the shape you want (9:16, 4:5, 1:1, 16:9).
- Pick a scene template (explainers, product launches, trailers, tutorials, data stories, kinetic typography…)
  or let the agent choose.
- Narration first: the agent writes the script, synthesizes the voice and cuts the picture to it.
- Motion graphics as code: lower thirds, big numbers, callouts and stingers rendered from HTML compositions.
- Generate stills and music when a shot needs them.

**Clip a long video**

- Turn a stream, podcast or long recording into shorts: the agent reads the transcript, scores candidate clips and
  lays them out as rows you can keep or drop.

**Edit together**

- Transcribe with local models (Whisper, Qwen3-ASR, MOSS with speaker diarization) or online APIs, with word timing.
- Subtitles in the original language, translated or bilingual; caption styles remembered per project.
- Dub into another language: translate, separate the voice from the background, synthesize per sentence with a
  cloned or preset voice.
- Cut talking heads: filler words, long pauses, retakes and false starts, without touching the original media.
- Chapters, summaries, titles and posts written from the timed transcript.
- You and the agent edit through the same commands, the same transactions and the same undo stack.

**Keep your style and publish**

- Tell CucCut who you are and what you make once; your preferences, glossary and rules reach every agent.
- Packs bundle templates, rules and skills so a style travels between machines.
- Export MP4 with burned-in or sidecar subtitles, SRT / WebVTT, transcripts, audio stems or a portable bundle.

## Bring your own agent and models

CucCut drives the agent you already use: Claude Code and Codex CLI, plus GitHub Copilot CLI, OpenCode, Pi and any
Agent Client Protocol agent (Gemini CLI, Cursor Agent, …). Capabilities (transcribe, speak, generate image, generate
text, separate audio) are decoupled from providers: run local models on Apple Silicon (MLX, Core ML) or point a
capability at OpenAI, Anthropic, Google, ElevenLabs, DeepSeek, Qwen, OpenRouter or any OpenAI-compatible endpoint.

The same local Runtime serves the desktop app, a CLI, an MCP server for external agents and a browser client.

## Your work stays on your computer

Projects, media and exports live locally (`~/CucCut` for projects, `~/.cuccut` for app data). Your agent sends
prompts, transcripts and sampled frames to its own AI provider; online models receive only what you send them.

## Run from source (macOS, Apple Silicon)

Requirements: Node.js 22.12+, Rust (`rustup default stable && rustup target add wasm32-unknown-unknown`), CMake,
full Xcode with the Metal compiler (`xcrun --find metal`), and `ffmpeg`/`ffprobe` on PATH.

```sh
npm ci
npm run doctor   # checks the toolchain
npm run dev      # builds native workers and WASM, then starts the desktop app
```

`npm run dev:lite` starts the UI without the Rust builds (no preview, export or local inference).
`npm run package:mac -- --local` builds an unsigned app bundle, DMG and ZIP.

Other commands: `npm test` (vitest), `npm run typecheck`, `npm run cli -- status` (the CLI against the running
Runtime), `node tools/qc-shot.mjs --out <dir> /home` (screenshots of the UI through the browser client).

## License

CucCut is distributed under the terms in [LICENSE](LICENSE); see [NOTICE](NOTICE) for attributions and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled third-party components.
