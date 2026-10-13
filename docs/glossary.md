# Glossary

Use one term for one concept. When UI copy and the docs use different wording, the UI copy wins and the docs are revised to match.

## Interface

| Term | Definition |
| --- | --- |
| Home | One of the top-level entries. A session-centred three-column interface: project and session list, current session, and the function area. See product design §3 |
| Space | One of the top-level entries. A derived view across all projects: videos, assets and other outputs; also the entry point for secondary editing. See product design §4 |
| Tools | Rail top-level entry, placed below Space. Does not go through a session; calls a model or a fixed flow directly to complete a defined task, without starting the agent loop. See product design §2.7 |
| Background tasks | Rail secondary entry, placed below Services. Shows task status and results across sessions and projects; not the main entry for starting tasks |
| Settings | Global entry at the bottom of the Rail. Manages preferences, defaults, models and agent capability configuration. For the principle behind where entries belong, see product design §2.1 |
| Function area | The third column of Home, beside the session, opened on demand. Each opened object gets its own tab; opening a video shows the full editor, and it is also used to view candidates, outputs and task details. Views are split by session, split view and full view; see product design §3.3 |
| Editor | The editing interface made up of preview, timeline, transcript, inspector and content panels; it opens one video. Home's function area and Space use the same components and the same layout, and both carry the session for this video (in Home it sits on the left; in Space it is a floating session in the bottom-right corner). See product design §5 |
| Space item | A row or a card in Space: one video, one asset, or one output. An item is a view, not a second copy of storage |
| Slides | A presentation the agent makes in a session: a directory in the working folder containing `deck.json`, with one HTML file per page. Previewed, edited and annotated in the Slides tab of the function area; an item in Space. See [slides design](design/slides/slides-design.md) |
| Slide annotation | A comment the user draws around an element or region in the slide editor and writes down; it is sent to the agent with the next message and is a special kind of attachment on the message |
| Design | A visual design the agent makes in a session (interface, web page, poster, chart): a directory in the working folder containing `canvas.json`, with one `.dc.html` file per artboard on the canvas. Previewed, edited and annotated in the Design tab of the function area; an item in Space. See [product design §3.3](product/product-design.md#33-feature-area-ux-07) |
| Artboard | An independent frame on the design canvas, with its own position and size (for example "Hero · Desktop" at 1280 × 800) |
| Design annotation | A comment the user picks on an element or region in the design editor and writes down; it is sent to the agent with the next message. It is the same kind of attachment as a slide annotation, each numbered separately |
| Design system | A reusable set of design rules: a directory in the working folder containing `design-system.json`, with tokens such as colours and fonts, brand notes, component packs and assets. Viewed and edited in the Design system tab of the function area; a design can have it attached. See [`packages/design-system-runtime`](../packages/design-system-runtime/README.md) |
| Design system annotation | A comment the user picks on a token, text style, component, asset or section in the Design system tab and writes down; it is sent to the agent with the next message. It sits alongside design annotations, each numbered separately. See [product design §3.2.3](product/product-design.md#323-input-area) |
| Reference chip | A context reference shown above the input box, for example an object, a sentence, a time span or a version |
| Task card | A structured card in the conversation, driven by real events: goal, stages, candidates, changes, authorisation, questions, delivery and so on |
| Show in Folder | Opens the system file manager with the target file or directory selected. The same wording on every platform; do not write platform-specific names such as "Finder" or "Explorer" |

## English UI terms

The English wording for the interface. English is the default UI language; within English too, one concept uses one term. The Chinese column and the rows above and below each agree.

| Chinese | English | Notes |
| --- | --- | --- |
| 项目 | Project | |
| 视频 | Video | Refers only to the editing object; the exported file is Export |
| 短视频（切出的子视频） | Short | The tool name is Cut into shorts |
| 会话 / 新会话 | Session / New session | |
| 工作目录 | Working folder | |
| 素材 | Asset | |
| 产物 | Output | |
| 成片 | Export | The action is also Export |
| 文稿 | Transcript | |
| 字幕 | Subtitles | |
| 译文 / 翻译 | Translation / Translate | |
| 转录 / 重新转录 | Transcribe / Re-transcribe | |
| 配音 | Voice-over | |
| 音色 | Voice | |
| 语音合成 | Speech synthesis | |
| 说话人 | Speaker | |
| 章节 | Chapter | |
| 幻灯片 / 幻灯片标注 | Slides / Slide annotation | A slide deck is also called Slides; do not write Deck or Presentation |
| 设计稿 / 画板 / 设计稿标注 | Design / Artboard / Design annotation | A design is also called Design; do not write Canvas or Mockup; do not write Frame or Board for artboard |
| 设计系统 / 设计系统标注 | Design system / Design system annotation | Do not write Style guide or UI kit |
| 时间线 / 检查器 / 编辑器 | Timeline / Inspector / Editor | |
| 候选 / 检查点 | Candidate / Checkpoint | |
| 任务 / 后台任务 | Task / Background tasks | |
| 工具 / 服务 / 模型 | Tools / Services / Models | |
| 技能 | Skill | |
| 设置 / 帮助 / 诊断 / 日志 | Settings / Help / Diagnostics / Logs | |
| 术语表 / 品牌库 | Glossary / Brand kit | |
| 在文件夹中显示 | Show in Folder | The same wording on every platform; do not write Finder or Explorer |
| 侧栏 | Sidebar | |
| 标签页 / 打开新标签页 | Tab / New tab | |
| 分屏 / 完整视图 | Split view / Full view | Views of the Home workspace; see product design §3.3 |
| 显示标签页 / 隐藏标签页 / 进入分屏视图 | Show tabs / Hide tabs / Enter split view | The tab button switches wording with its state |
| 会话摘要 | Summary | |
| 新建网页 / 浏览项目文件 | New web page / Browse project files | Tool cards on the new-tab start page |
| 访问模式：先给方案 / 监督 / 自动接受修改 / 自动 / 完全访问 | Plan first / Supervised / Auto-accept edits / Auto / Full access | |
| 外观：跟随系统 / 浅色 / 深色 | System / Light / Dark | |
| 取消 / 重试 / 撤销 / 恢复 / 删除 / 重命名 | Cancel / Try again / Undo / Restore / Delete / Rename | |
| 排队中 / 正在工作 / 已完成 / 失败 / 已取消 | Queued / Working / Done / Failed / Cancelled | |

## Video and editing

| Term | Definition |
| --- | --- |
| Project (Project) | A directory, and also the agent's working directory. It can contain one or more videos, together with their assets and outputs. Sessions hang under the project. Its identity is kept in `.ccut/project.json` inside the directory, so it stays the same project after the directory is moved. Do not use "工程" as a separate term |
| Video (Video) | A subdirectory under a project: one authoritative editing object that can be edited and exported. It contains sequences, asset references, the transcript, the code package and language versions. "视频" on its own refers only to this. The exported file is called Export (成片); imported or generated media files are called video files or video assets; the one on the timeline is called a video instance. In code the entity is `Video` / `videoId`, and the media kind uses the enum value `'video'`. Do not use "视频项目" or "作品" as separate terms |
| Child video, derived (Derived video) | An ordinary video derived from a segment of another video (the parent video); the result of cutting a short video. It is built beside the parent video, copies its timeline and transcript, references the same assets, keeps the regions outside the range as recoverable cut points, and carries a derivation record (the `derivation` document). In Space its source is "派生" (derived); in code it is `origin.source: 'derived'` and `videos.derive`. The UI calls it "短视频" (short video). See product design §2.3 and §5.10 |
| Revision | The committed version number of a video or entity. A non-negative decimal integer string. Videos, sequences and documents each have their own version axis |
| Sequence (Sequence) | A timeline with an editing frame rate and a canvas. A video has one root sequence and may have several sequences |
| Track (Track) | A layer in a sequence that carries instances |
| Instance (Item) | One use of an asset, text, subtitles, a code composition and so on on the timeline. The same asset appearing three times gives three instances |
| Asset (Asset / AssetRevision) | An asset identity and the bytes and metadata of one fixed version of it |
| Working draft | The video's currently committed state |
| Candidate (Candidate) | A proposed option. An unapplied candidate is not the working draft |
| Checkpoint (Checkpoint) | A named historical state |
| Transition (Transition) | A transition between two picture instances that meet end to end on the same track, or at the head or tail of one instance. See video format spec §3.9 |
| handles | Material beyond the source range an instance uses that can still be taken. Transitions on either side use it on both sides of a cut point |
| Effect (Effect, `fx`) | A fixed set of effect fields on a picture instance: filter and effect presets, colour grading, blur, stroke, drop shadow. The order of application is fixed; it is not a stack that can be reordered freely. See video format spec §3.9 |
| Chapter (Chapter) | A marker with `kind: 'chapter'` on a sequence, fixed at a moment on the timeline. See video format spec §3.13 |
| Ducking (Ducking) | Automatically lowers one group of sounds while another group plays, for example lowering background music under a voice. Expanded from intervals on the timeline into a gain envelope. See video format spec §3.9 |
| Variant (Variant) | An explicit derived output configuration, such as a language version or an aspect-ratio version |
| ChangeSet | A group of pending changes with a description of their impact. It can be previewed and cannot evolve on its own |
| Batch pre-check | Validates a batch of changes first and returns their impact before deciding whether to commit. A pre-check is a proposal; it does not reserve success |
| Transaction (Transaction) | A group of editing operations that is validated and then committed atomically |
| Receipt | The result returned after a transaction is persisted successfully: old and new versions, the objects changed, the impact and the scope that can be undone |
| lineage | The source relationship between old and new instances after a split or trim |
| occurrence | One appearance of the same source word or source object on the timeline |
| Protected scope | Objects, properties or ranges that the current task must not modify |
| pin | A result the user fixes by hand, such as a line break or the position of a sound effect. Automatic flows must not overwrite it |
| stale / orphaned / needs-fit | The three pending states of a derived result: the input has changed, the anchor no longer exists, or the voice-over does not fit the target window |

## Time

| Term | Definition |
| --- | --- |
| MediaTime | An exact time value, `ticks / timescale` seconds |
| Rate | A reduced positive rational number, used for frame rates and speeds |
| TimeDomain | The coordinate system a time value belongs to: sequence, source asset, composition-local, audio |
| FrameSpan | The position and length of a visual instance on the sequence's frame grid |
| TimeMap | The unique mapping from instance time to source time |
| Editing frame rate | `Sequence.fps`, the visual editing grid |
| Output frame rate | `ExportSettings.fps`, the export sampling grid. Independent of the editing frame rate |

## Speech, subtitles and voice-over

| Term | Definition |
| --- | --- |
| SpeechDocument | The speech document: word-level text and source times; the source of truth for text and time |
| Sentence | A semantic sentence derived from word anchors and structural rules; the unit of translation |
| AlignmentBlock | A semantic correspondence block between a range of source words and a range of target text |
| Cue | One subtitle time unit shown on screen |
| Line | A line laid out by font, aspect ratio and style. A render projection |
| TranslationDocument | The translated document for one target language |
| Switch transcript | The single undoable transaction that happens when a transcription result replaces the video's current transcript: the same SpeechDocument gets a new version, the video switches to it, and the translation, subtitles and voice-over are carried over. In the UI the entry point is "取代这部视频的文稿" (replace this video's transcript); the other entry point is creating a new video. See product design §5.11 |
| Carry | Carrying the old translation, subtitle pins and voice-over over to the new transcript when switching transcripts; the correspondence between old and new sentences is called a pair. Rules in video format spec §5.3 |
| CaptionProgram | The subtitle display rules: which document it points to, which instances it applies to, and what timing and style it uses |
| EditedSpeechView | The effective word stream derived from the time ranges the current timeline keeps |
| EditorialProposal | A set of spoken-content editing suggestions |
| DubbingPlan | The voice-over plan: script, speakers, timing strategy and result |
| LocalizationSet | The subtitles, voice-over, text overrides and audio routing selected for one language version |
| SoundCueSheet | The event plan for narration, background music and sound effects, compiled into ordinary audio instances |
| NarrationCueSheet | The narration timing sheet: when voice-over drives the picture, it records sentences, word anchors, shot intent and actual times. A controlled input and derived output, not an independent clock |
| CanvasVariant | An aspect-ratio version: references a base sequence, plus overrides for canvas, layout, cropping and parameters |

## Code synthesis and rendering

| Term | Definition |
| --- | --- |
| CodeBundle | An immutable code-synthesis package: source, dependency lock, build output, manifest |
| Code synthesis instance | A timeline instance that references a version of a CodeBundle and carries parameters |
| Adapter | An adapter that connects a class of code runtime to CucCut's frame-fetch and audio-fetch contracts |
| RenderGraph | A derived execution plan compiled from a frozen video |
| FrameTicket | The complete identity of one frame-fetch request |
| Bake | Renders a code-synthesis instance as ordinary media while keeping references back to its source |
| Time dependencies (timeDependencies) | The external time that a code package declares its picture depends on: only local time, placement position, a cue track, or the sequence clock. Undeclared means unknown |
| Three-layer editing | Three kinds of change to a code synthesis: instance, parameters, source. Kept separate at all times in the UI, commands and receipts |
| EvidenceReceipt | A traceable record of one check: which ranges of which version were checked |

## Agents and execution

| Term | Definition |
| --- | --- |
| Conversation | A collaborative record between the user and an agent. It may belong to a project or to none; from a conversation you can open a video under that project |
| AgentSession | A Driver's native session |
| AgentDriver | An adapter that connects one complete agent runtime |
| Turn | One model turn |
| Task | One delegation of a result |
| TaskContract | A task's result agreement: goal, scope, constraints, protections, delivery stage, autonomy level, budget |
| Run | One budgeted execution attempt of a task |
| Job | One computation: recognition, generation, build, render, and so on. In the user-facing UI, the specific step is named |
| Artifact | An immutable result published by a Job |
| Application | The action of applying an artifact to a video; it has its own idempotency key and receipt |
| ModelProvider | An adapter that executes one structured model capability. Registered separately from AgentDriver |
| API provider | One online model-service connection: a model vendor, a relay platform, or a self-hosted compatible endpoint. Corresponds to one online Provider (`providerId`). Formerly called “服务商” (service provider); the settings search still finds it under the old name. Its account (key) is shared across all of its capabilities. Not to be confused with “Agent 提供方” (agent provider) in settings: an agent provider is an agent runtime (Codex, Claude, etc.) that uses its own sign-in, has no account or key list, and does not count as an API provider. Local models and LAN nodes do not count either. The Rail “服务” (service) is the entry point CucCut exposes to outside programs and is unrelated to this. See architecture design §6.4 |
| Account | One key (or one sign-in) under an API provider. A provider may have several accounts, in order; calls use the first enabled account that has a key. The UI shows only a masked value. See architecture design §6.8 |
| Usage | A record of each call made by an API provider or agent: count, tokens, audio duration, characters, image count and cost (as reported by the provider, estimated at list price, or unknown). Not a budget. See architecture design §6.10 |
| CapabilitySnapshot | The current capability snapshot, filtered by subject and video |
| ContextBarrier | A read-then-write barrier before a request is submitted: first settle this request's local edits, then freeze the context |
| Grant | One authorization: data category, recipient, scope, purpose, budget, validity period |
| runGeneration | The execution generation of a Run. Advanced on stop; calls and automatic applications from the old generation are rejected |

## Runtime

| Term | Definition |
| --- | --- |
| Runtime | The product runtime implemented in Node; the only external business entry point |
| Runtime Home | The data root of a Runtime. One Home has one Supervisor |
| Supervisor | The resident process that starts and supervises the Runtime Worker |
| Engine Host | The Rust host process privately managed by the Runtime, which hosts the VideoEngine and VideoStore |
| Model Worker | A Rust inference process the Runtime starts on demand. One process hosts one resident model package and executes one task at a time |
| Remote node | A Runtime on another machine that has sharing turned on. It accepts only capability tasks and never touches video |
| Node service | The LAN-facing listening surface inside the Runtime, which hosts pairing with remote nodes and their capability tasks |
| External services | Managed entry points the Runtime opens to other programs or devices: the MCP service, the model-interface service, the web service and the node service. Each has its own listening surface, authentication and access policy. Off by default |
| Service principal | The trusted identity of an external connection that arrives through an external service. It has no session and no task contract; its permissions are set by that service's access policy |
| ToolCatalog | The single tool list in the Runtime. Each entry states its description, parameters, effect (read-only, write, task, delete), examples, and which surfaces it is exposed on. Three surfaces are derived from it: the in-session agent (tool bridge), the MCP service and the CLI. Their list is not copied elsewhere. The tool implementation is the same; the difference lies only in the calling subject and scope. See architecture design §3.5 |
| Agent surface | The part of the ToolCatalog exposed to external agents: first-level verbs (transcribe, translate, dub, download, export, and other fixed workflows and generation), noun groups (read/write access to objects such as video, documents, edits, subtitles, assets and tasks), and meta-commands (help, `spec`, `status`). First-level verbs and noun groups have the same names on all three surfaces: the MCP tool `a_b` is the CLI command `cuccut a b`. See Agent capability surface design §4 |
| Admin bucket | Local management commands meant for people, available only in the CLI: settings, model services and credentials, external services, adding and toggling skills, and so on. Hand-written, not in the ToolCatalog, and absent from the Agent surface. See Agent capability surface design §7 |
| Agent skill (craft) | A written description of a method: how to judge and carry out polishing, translation, chaptering, trimming spoken narration, and so on. Built-in ones live in the repository at `skills/cuccut/built-in-skills/<id>/`; users can also add their own. The in-session agent reads them on demand; external agents read synced copies through the CucCut skill. Called “技能” (skills) in the UI. See architecture design §3.8 |
| CucCut skill | The instruction manual for “how to use CucCut”: when to use it, how to start it, which tool to use for each kind of task, hard rules, and how to deliver. Lives in the repository at `skills/cuccut/`. One text is rendered per surface: external agents install it in their own host's skills directory and use it through the CLI or MCP; the in-session agent receives the same text in tool-bridge form. It references the Agent skill (craft) and does not copy it. See Agent capability surface design §8 |
| User library | User data reused across videos, stored in the Runtime Home: glossary, voices, brand library. Copied in when entering a video |
| Fixed workflow (Pipeline) | Multi-step work with fixed steps that needs no model planning. The Runtime orchestrates it and creates no agent session. Each step is one Job |
| Generation record | The record left by a generation Job that has no video: artifact, parameters, seed, model and source |
| Managed external tool | An external program that is not shipped with the app, which CucCut detects or downloads as an isolated copy, for example ffmpeg and video download tools |
| VideoEngine | The sole implementation of video-domain validation, time and editing semantics, transactions and receipts |
| VideoStore | The sole persistent writer of videos |
| ownerGeneration | The ownership generation of write rights to a video |
