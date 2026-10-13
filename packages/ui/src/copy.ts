import { defineMessages, live, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, type AgentMode, type DriverState, type JobPhase, type ModelTier, type TaskStatus } from '@cuccut/protocol';
import { zhHans } from './copy.zh-Hans.ts';
import { zhHant } from './copy.zh-Hant.ts';
import { ja } from './copy.ja.ts';
import { ko } from './copy.ko.ts';
import { es } from './copy.es.ts';
import { fr } from './copy.fr.ts';
import { de } from './copy.de.ts';
import { nl } from './copy.nl.ts';
import { ptBR } from './copy.pt-BR.ts';
import { it } from './copy.it.ts';
import { ru } from './copy.ru.ts';
import { pl } from './copy.pl.ts';
import { tr } from './copy.tr.ts';
import { vi } from './copy.vi.ts';

/**
 * Copy shared across several places in the UI. English is written here, and translations are in `copy.zh-Hans.ts`; one concept uses only one term, see docs/glossary.md.
 * Read text in the current language at render or call time (`M.x`, `revealLabel()`), not into a constant at module top level.
 * The named exports below (`ACCESS_MODE_LABEL`, `TASK_VIEW_COPY`…) are all `live` wrappers: each property read picks up the current language.
 */
const en = {
  /** Open the system's file manager and select the target. One wording for all platforms; do not write any platform-specific file manager name (docs/glossary.md). */
  reveal: 'Show in Folder',
  untitled: 'New session',
  /** Images already sent above a user message (prototype agent-thread.jsx `UserMsg`). */
  sentAttachments: 'Sent files',
  /** Hint when switching access mode while a task is running (the running branch of prototype model-agent.js `modeToast`). */
  accessModeToast: (label: string) => `The next turn will use “${label}”. This turn keeps its current access mode.`,
  /** Composer footnote (prototype model-agent.js `composerFoot`): where it runs, whose subscription is used (an empty string means there is no account name), whether this level asks you first, and the shortcut. */
  composerFoot: (name: string, account: string, foot: string) =>
    `Runs in ${name} on this computer, ${account ? `using your ${account}` : 'using your own subscription'}. ${foot} Enter to send, Shift+Enter for a new line, @ to reference, / for commands.`,

  /**
   * Access modes (architecture design §3.12, prototype data.js `agent.modes`). The prototype shows only four levels; “Propose a plan first” is a separate level in the protocol, and the input dropdown lists it only when the conversation is already at that level (for example, one switched to via the CLI).
   */
  accessModeLabel: {
    plan: 'Plan first',
    ask: 'Supervised',
    autoAcceptEdits: 'Auto-accept edits',
    auto: 'Auto',
    fullAccess: 'Full access',
  },
  accessModeHint: {
    plan: 'Read-only. Proposes a plan first and never changes files or videos',
    ask: 'Asks before running commands or changing files',
    autoAcceptEdits: 'Approves file changes automatically and asks before anything else',
    auto: 'Approves routine actions automatically; still asks before risky ones',
    fullAccess: 'Runs commands and changes files without asking',
  },
  taskStatusLabel: {
    running: 'Working',
    stopping: 'Stopping',
    completed: 'Done',
    stopped: 'Stopped',
    failed: 'Failed',
  },
  /** Middle part of the composer footnote: whether this level actually asks you (prototype model-agent.js `modeFoot`). */
  accessModeFoot: {
    plan: 'Plans only and won’t change the video.',
    ask: 'Asks you before every write to the video.',
    autoAcceptEdits: 'Video file changes are allowed automatically; other commands still ask you.',
    auto: 'Routine actions are allowed automatically; risky ones still ask you.',
    fullAccess: 'Writes to the video without asking each time.',
  },
  /** Model positioning (prototype model-agent-setup.js `TIERS`). */
  modelTierLabel: { balanced: 'Recommended', max: 'Most capable', fast: 'Fastest' },
  /**
   * Reasoning effort (prototype data.js `agent.efforts`): native id → name and cost. The prototype's `mid` is called `medium` in Claude and Codex.
   * The prototype's secondary text for “medium” is “default”; here it is changed to mark the row that is the model's own default effort (see `effortRows` in agent-choice.ts).
   */
  effort: {
    low: { label: 'Low', sub: 'Fast, good for small changes' },
    medium: { label: 'Medium', sub: null },
    high: { label: 'High', sub: 'Slower, thinks longer' },
  },
  agentPicker: {
    group: 'Coding agent',
    models: 'Models',
    effort: (label: string) => `Reasoning effort · ${label}`,
    agentDefault: 'Agent’s default model',
    agentDefaultSub: 'Chosen by the CLI’s configuration',
    configModelGate: (model: string) => `${model} needs a newer CLI`,
    notListed: 'This model isn’t in the current list',
    defaultMark: 'Default',
    localAccount: 'This computer',
    settings: 'Settings › Agents…',
    settingsSub: 'Coding agent · Subscription · Approval policy',
    /** Once a conversation has a task, the agent is fixed (architecture design §3.11: a native conversation cannot be continued across agents). */
    locked: 'This session has already started, so its agent can’t change. Start a new session to switch.',
    detecting: 'Detecting agents…',
  },
  /** Secondary text for the top-level row when an agent is unavailable (prototype model-agent.js `providerRows`; the status word is taken from model-agent-setup.js `badge`). */
  driverStateReason: {
    disabled: 'Turned off in Settings',
    'not-installed': 'Not installed',
    'signed-out': 'Needs sign-in · Check in Settings',
    outdated: 'Version too old · Check in Settings',
    error: 'Can’t run · Check in Settings',
  },
  /** Names and descriptions of slash commands; the key is the command name without the `/` (`SLASH_COMMANDS`). */
  slash: {
    polish: { label: 'Polish transcript', sub: 'Fix typos, add punctuation, split paragraphs' },
    chapters: { label: 'Generate chapters', sub: 'Split by topic and add titles' },
    speakers: { label: 'Identify speakers', sub: 'Put names on subtitles and the transcript' },
    retranscribe: { label: 'Re-transcribe', sub: 'Rerun the audio with another speech model' },
    clean: { label: 'Find cuttable bits', sub: 'Filler words, long pauses, flubbed takes' },
    translate: { label: 'Translate subtitles', sub: 'Translate into one language and align timecodes' },
    refresh: { label: 'Refresh stale translations', sub: 'Retranslate only lines whose source changed' },
    dub: { label: 'Translated voice-over', sub: 'Make the video speak another language' },
    summary: { label: 'Write a summary', sub: 'A summary plus timestamped key points' },
    blog: { label: 'Write a blog post', sub: 'Rewrite it as an article' },
    title: { label: 'Suggest titles', sub: 'A few candidates from different angles' },
    desc: { label: 'Write a description', sub: 'With chapter timecodes and tags' },
    cover: { label: 'Make a cover', sub: 'A few candidates based on key frames' },
    export: { label: 'Export', sub: 'SRT / MP4 with burned-in subtitles' },
  },
  composerMenu: {
    insert: 'Insert',
    filesAndFolders: 'Files and folders',
    files: 'Files', folders: 'Folders',
    filesMessage: (paths: readonly string[]) => `Files and folders:\n${paths.map(path => JSON.stringify(path)).join('\n')}`,
    pickFailed: (message: string) => `Couldn’t select files: ${message}`,
    webFilesUnsupported: 'Add local files and folders in CucCut desktop. Uploads aren’t available in the Web client yet.',
    /** @ completion keeps video and file references; they are no longer listed again in the + menu. */
    mention: 'Reference a video or file',
    slash: 'Use a tool',
    /** + menu: the unified attachment entry is the first item, and tools are in the next group. */
    attachSection: 'Add',
    referSection: 'References and commands',
    imagesUnsupported: (driverName: string) => `${driverName} doesn’t accept images`,
    noMentionCandidates: 'No videos or files to reference here yet',
  },
  /** The input box's “+ › Use Skill”, the skill marker on the input box, and the marker on conversation messages (product design §3.2.3, §6.9; prototype composer-insert-menu.jsx). */
  skill: {
    use: 'Use a skill',
    manage: 'Manage skills…',
    loading: 'Loading skills…',
    none: 'No skills yet. Add one from a local folder in Settings, or import from GitHub',
    loadFailed: 'Couldn’t load skills',
    token: (name: string) => `Skill: ${name}`,
    remove: (name: string) => `Remove skill: ${name}`,
  },
  /** Attached images (prototype agent-thread.jsx `composerImageFiles` and `addImages`). */
  attachment: {
    tooLarge: `Choose images no larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MiB`,
    tooMany: `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} images`,
    /** The prototype only accepts image/*; the protocol accepts only these four types (limits.ts), so this extra line is added. */
    badType: 'Only PNG, JPEG, GIF, or WebP images can be attached',
    uploadFailed: (message: string) => `Couldn’t upload the image: ${message}`,
    httpFailed: (status: number) => `Upload failed (HTTP ${status})`,
    networkFailed: 'Upload failed: can’t reach the Runtime',
    uploading: 'Uploading images…',
  },
  /** Queued while busy (messages sent while a task is running in the conversation). */
  queue: {
    title: (count: number) => `Queued to send · ${count}`,
    images: (count: number) => (count === 1 ? '1 image' : `${count} images`),
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    remove: 'Delete',
    sendNow: 'Send now',
    editLabel: 'Edit queued message',
    steerUnsupported: 'This agent can’t take messages mid-task. It will be sent when the current task ends',
    skillWaits: 'Messages with a skill can’t join the turn in progress. It will be sent when the turn ends',
    failed: (message: string) => `Couldn’t send the queued message: ${message}`,
    busyPlaceholder: 'The agent is working. Messages you send now are queued until this turn ends',
  },
  /** Recovery area after a task fails (prototype agent-thread.jsx `ErrorMsg`). */
  recovery: {
    authTitle: (name: string) => `${name} needs you to sign in again`,
    authBody: (name: string) =>
      `You sign in inside ${name}’s own window; CucCut never handles your account or password. Come back and resend once you’re signed in.`,
    openLogin: 'Sign in from Terminal',
    loginOpened: (command: string) => `Running ${command} in a terminal · Come back and resend once you’re signed in`,
    loginCopied: 'Couldn’t open a terminal. The sign-in command is copied; paste it into a terminal to run it',
    loginManual: (command: string) => `Couldn’t open a terminal. Run ${command} in a terminal`,
    modelTitle: (model: string | null) => `${model ?? 'This model'} isn’t available right now`,
    modelBody: 'Pick another model and resend. CucCut won’t switch models on its own.',
    pickModel: 'Resend with another model',
    resend: 'Resend',
    retry: 'Try again',
    agentSettings: 'Agent settings',
    nothingToResend: 'Can’t find this turn’s message to resend',
    resendFailed: (message: string) => `Couldn’t resend: ${message}`,
  },
  /** Approval card (prototype agent-thread.jsx `PermissionMsg`; the auto-allow row takes its label from model-agent.js `autoAllowLabel`). */
  approval: {
    title: {
      command: 'The agent wants to run a command',
      'file-change': 'The agent wants to change files',
      tool: 'The agent wants to use a tool',
      highRisk: 'The agent wants to do something risky',
    },
    kind: { command: 'Run command', 'file-change': 'Change files', tool: 'Use tool' },
    projectFiles: 'Files in the project',
    inDir: (dir: string) => `In ${dir}`,
    allow: 'Allow',
    allowAlways: (rule: string) => `Always allow ${rule}`,
    decline: 'Decline',
    accepted: 'Allowed',
    acceptedAlways: (rule: string) => `Allowed · Won’t ask about ${rule} again`,
    declined: 'Declined',
    cancelled: 'Stopped',
    autoRule: (rule: string | null) => (rule ? `Allowed automatically · Rule ${rule}` : 'Allowed automatically · Rule'),
    autoMode: 'Allowed automatically · Access mode',
    input: 'Input summary',
    copyInput: 'Copy input summary',
    failed: (message: string) => `Couldn’t submit: ${message}`,
  },
  /** Undo and restore on the change card (prototype agent-thread.jsx `ReceiptMsg`). */
  change: {
    undone: 'Undone · Changes reverted',
    undo: 'Undo',
    restore: 'Restore',
    openVideo: 'Open video',
    confirmTitle: 'Undo this step?',
    /**
     * “Restore” only appears while this change is still your most recent undo and you have not edited this video since (see change-card.tsx). It does not say “at any time”.
     */
    confirmBody: 'The changes this step wrote to the video will be removed. Until you edit this video again, you can bring them back with Restore.',
    cancel: 'Cancel',
    undoneToast: 'Undone',
    restoredToast: 'Restored',
    alreadyUndone: 'This step was already undone',
    undoFailed: (message: string) => `Couldn’t undo: ${message}`,
    restoreFailed: (message: string) => `Couldn’t restore: ${message}`,
  },
  /**
   * Empty conversation (the empty state of prototype agent-thread.jsx `AgentThread`; suggestions come from data.js `agent.chips`).
   * The prototype's explanatory sentences, “@ can reference chapters, speakers, translations”, “ask you before writing anything”, and “drag a video in”, cannot be done here yet (@ lists only videos and files; whether it asks depends on the access mode; videos cannot be dragged into a conversation), so only the parts that work are kept.
   */
  threadEmpty: {
    greetVideo: (name: string) => `What should we do with “${name}”?`,
    greet: 'What can the agent do for you?',
    subVideo: 'It reads this video first and gives you a plan. Use @ to reference other videos or files.',
    sub: 'Start by describing what you want done. It runs in the coding agent on your computer, using your own subscription.',
    suggestions: 'Try asking',
    chipsVideo: [
      'Remove filler words from this chapter',
      'Give each chapter a shorter title',
      'Find repeated sections that can be cut',
      'Make terms match the glossary',
    ],
    chips: [
      'Add subtitles to this video and translate them into English',
      'Find filler words and long pauses, list them before cutting',
      'Split this episode into chapters with titles',
      'Export bilingual SRT and an MP4 with burned-in subtitles',
    ],
  },
  /** Artifact cards (prototype home-session.jsx `SessionArtifactCard`, `SessionMoviePreview`, `SessionMessageArtifacts`). */
  output: {
    playVideo: (name: string) => `Play video “${name}”`,
    noThumbnail: 'No thumbnail',
    sourceMissing: 'Source file not found',
    openEditor: 'Open editor',
    openVideo: (name: string) => `Open video “${name}”`,
    playHere: 'Play on the right',
    previewHere: 'Preview on the right',
    reveal: 'Show in Folder',
    messageOutputs: 'Message outputs',
  },
  /**
   * Video cards and download cards in the thread (product design §3.2.2, §6.5; prototype home-session.jsx `SessionArtifactCard`, agent-cards.jsx `JobRow` / `DownloadCard`).
   * The status words use the same wording as the video status in Space.
   */
  videoCard: {
    agentTranslating: 'Agent translating line by line',
    sentenceTotal: (n: number) => (n === 1 ? '1 line total' : `${n} lines total`),
    status: { translating: 'Translating', transcribing: 'Transcribing', queued: 'Queued', transcribed: 'Transcribed', failed: 'Failed' },
    rows: 'Work on this video',
    retranscribe: 'Re-transcribe',
    translate: 'Translate',
    linkImport: 'Import from link',
    tail: { queued: 'Queued', done: 'Done', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', unknown: 'Result unknown' },
    elapsed: (clock: string) => `${clock} elapsed`,
    recognized: (done: string, total: string | null) => (total ? `Recognized ${done} / ${total}` : `Recognized ${done}`),
    segments: (done: number, total: number | null) => (total != null ? `Recognized ${done} / ${total} segments` : `Recognized ${done} segments`),
    translated: (done: number, total: number | null) => (total != null ? `Translated ${done} / ${total} lines` : `Translated ${done} lines`),
    downloaded: (text: string) => `Downloaded ${text}`,
    documentWritten: 'Transcript written to the video',
    notFinished: 'This step didn’t finish',
    retrying: 'Retrying automatically after an error',
    play: 'Play',
    reveal: 'Show in Folder',
    cancel: 'Cancel',
    retry: 'Try again',
    warning: {
      'no-speech': 'No speech detected',
      'no-audio-track': 'The video has no audio track',
      'diarization-unavailable': 'This model can’t tell speakers apart',
    } as Record<string, string>,
    download: {
      queued: 'Waiting to download',
      running: 'Downloading video',
      done: 'Download complete',
      failed: 'Download didn’t finish',
      cancelled: 'Download cancelled',
      interrupted: 'Download interrupted',
      fallbackName: 'Video',
    },
    openFailed: (message: string) => `Couldn’t open: ${message}`,
    retryFailed: (message: string) => `Couldn’t try again: ${message}`,
  },
  /** Home start page (product design §3.2.1; prototype page-new.jsx Home, new-agent.jsx). */
  home: {
    templates: 'Video templates',
    quickStart: 'Quick start',
    blankVideo: 'New blank video',
    blankVideoTip: 'No transcription, no queue — straight to the editor',
    blankVideoCreated: 'Blank video created',
    blankVideoFailed: (message: string) => `Couldn’t create a blank video: ${message}`,
    /** When no project is selected, a new blank video first creates a project with this name. */
    blankVideoProject: 'Blank video',
    removeTemplate: 'Remove template',
    templateToken: (title: string) => `Template: ${title}`,
    allTemplates: 'All templates',
    searchTemplates: 'Search templates',
    templateKind: 'Type',
    templateSource: 'Source',
    templateCategories: 'Categories',
    viewTemplate: (title: string) => `View template: ${title}`,
    useExampleLabel: (title: string) => `Use prompt: ${title}`,
    useTemplateLabel: (title: string) => `Use template: ${title}`,
    templatePicked: 'Selected',
    exampleBadge: 'Example',
    templatePage: (page: number, pages: number, total: number) => `Page ${page} of ${pages} · ${total} total`,
    prevPage: 'Previous page',
    nextPage: 'Next page',
    noTemplates: 'No matching templates. Try another word or category.',
    templatesEmpty: 'The template folder has no templates yet.',
    templatesLoading: 'Loading templates…',
    templatesFailed: (message: string) => `Couldn’t read the template folder: ${message}`,
    retryTemplates: 'Try again',
    templatesNote: 'Built-in templates come with the app; templates you put in the template folder show as “Mine”.',
    templatesSkipped: (count: number) => (count === 1 ? '1 template couldn’t be loaded' : `${count} templates couldn’t be loaded`),
    showSkipped: 'Show why',
    hideSkipped: 'Hide',
    pickTemplateHint: 'Pick a template on the left to see its preview and prompt here.',
    templatePrompt: 'Prompt',
    templatePromptLoading: 'Loading prompt…',
    templatePromptFailed: (message: string) => `Couldn’t read the prompt: ${message}`,
    templateSay: 'Try saying',
    /** Template details: “Needs your input” and “Approach: …” (template package spec §5.5, §3.1 `skills`). */
    templateFields: 'To fill in',
    templateSkills: (list: string) => `Approach: ${list}`,
    /** Pending-fields hint below the input box (spec §5.5): how many places are still to fill in and which ones (`labels` is already joined in the current language); it does not block sending. */
    slotsLeft: (count: number, labels: string) => `${count} left to fill in: ${labels} · You can still send; the agent will ask you first`,
    fillNextSlot: 'Fill in next',
    templateBriefNote: 'Once you pick it, the agent first confirms the topic, goal, audience, and materials with you, then starts making it.',
    templateAssets: 'Assets',
    templatePromptOnly: 'Prompt only, no assets',
    useTemplate: 'Use this template',
    keepTemplate: 'Keep using this template',
    useExample: 'Use this prompt',
    promptPlaced: 'Prompt filled in',
    undo: 'Undo',
    playPreview: 'Play preview',
    pausePreview: 'Pause preview',
    placeholder: 'Describe the video you want to make, or drag assets here…',
    templatePlaceholder: 'What’s it about? Add the topic, audience, or your requirements…',
    localFiles: 'Local files',
    addMedia: 'Video or audio',
    addDocument: 'PDF or document',
    addImage: 'Image',
    recentVideos: 'Recent videos',
    /** When the most recent video is selected, the video or audio material that was attached before gives up its slot (the sentence speaks to only one video). */
    recentReplaced: (title: string, removed: string) => `Now working on “${title}”; removed “${removed}”`,
    removeMaterial: (name: string) => `Remove asset: ${name}`,
    materialsFull: (max: number, rejected: number) => `You can add up to ${max} assets at a time; ${rejected} weren’t added`,
    notLocalFile: 'This file isn’t on this computer, so it can’t be given to the agent',
    thisComputer: 'This computer',
    pickProject: 'Choose project',
    pickProjectLabel: (name: string | null) => `Choose project: ${name ?? 'None'}`,
    current: 'Current',
    newProject: 'New project…',
    noProjectOption: 'No project',
    noProject: 'Without a project, videos and files stay in this session’s own folder',
    enableFailed: (message: string) => `Couldn’t turn on: ${message}`,
  },
  /**
   * The four “Quick start” entries on the start page (prototype model-newproject.js `STARTERS`): common tasks on existing video or audio; one click puts the sentence into the input box.
   * The wording avoids words such as “animation”, “explainer” and “chart”, so it is not taken as one particular kind of production. `needs` is the hint “what to drag into the input box next”, and `link` is “or paste what”
   * (a video-site link also works). `trans.prompt` contains exactly one fill-in slot like `{{目标语言}}`; each language writes its own label, and the start page fills in the value entered last time.
   */
  homeStarter: {
    sub: { title: 'Add subtitles', needs: 'a video', link: 'a video link', prompt: 'Add subtitles to this video.' },
    trans: { title: 'Transcribe and translate', needs: 'a video', link: 'a video link', prompt: 'Transcribe this video and translate it into {{target language}} as bilingual subtitles.' },
    clean: {
      title: 'Trim talking-head video',
      needs: 'a video',
      link: 'a video link',
      prompt: 'Transcribe this video and find filler words, long pauses, and retakes. Show me before cutting anything.',
    },
    a2v: { title: 'Audio to video', needs: 'an audio file', link: 'a link', prompt: 'Turn this audio into a video with a background, a waveform, and subtitles.' },
    tip: (needs: string, link: string) => `Fills in the prompt. Then drag ${needs} into the message box, or paste ${link}`,
  },
  /** Display names for template categories (template package spec §3.2; the keys are part of the protocol). Unrecognised keys fall back to showing the key name, handled by model/home-templates.ts. */
  templateCategory: {
    all: 'All',
    marketing: 'Marketing',
    'product-launch': 'Product launch',
    explainer: 'Explainer',
    'news-data': 'News and data',
    editing: 'Editing',
    'creative-short': 'Creative short',
    'motion-design': 'Motion design',
  },
  /** The two kinds of template (spec §1.2). */
  templateKind: { all: 'All', scene: 'Scene templates', example: 'Showcase examples' },
  templateSource: { all: 'All sources', builtin: 'Built-in', user: 'Mine', community: 'Community' },
  /** Kinds of material bundled with a template (spec §3.4). */
  templateAsset: { image: 'Image', svg: 'SVG', audio: 'Audio', video: 'Video' },
  /** Template aspect ratio and duration copy (prototype model-home-templates.js `spec`, `specLine`). */
  templateSpec: {
    allAuto: 'Aspect ratio and duration automatic',
    ratioAuto: 'Aspect ratio automatic',
    lengthAuto: 'Duration automatic',
    sceneDefault: (spec: string) => `${spec} by default; say so in your message to change it`,
    exampleAuto: 'Aspect ratio and duration automatic, decided by the agent from your content',
  },
  /** The create-project dialog on the start page (prototype new-agent.jsx `CreateProjectDialog`). */
  createProject: {
    title: 'Create project',
    close: 'Close create project',
    name: 'Project name',
    placeholder: 'Name your project',
    location: 'Save in folder',
    preview: (path: string) => `The project will be saved in ${path}`,
    cancel: 'Cancel',
    create: 'Create',
    created: (name: string) => `Created project “${name}”`,
    failed: (message: string) => `Couldn’t create the project: ${message}`,
  },
  /** Names of task kinds (prototype page-tasks.jsx `KIND`). The prototype does not list tasks from agent conversations separately; they are called “Agent task”. */
  taskKind: {
    agent: 'Agent task',
    transcribe: 'Transcribe',
    synthesizeSpeech: 'Generate speech',
    generateImage: 'Generate image',
    generateMusic: 'Generate music',
    generateText: 'Generate text',
    export: 'Export',
    pipeline: 'Pipeline',
    'pipeline-step': 'Pipeline step',
    modelInstall: 'Install model',
    modelTest: 'Check model',
    modelsMove: 'Move models folder',
    toolInstall: 'Install tool',
    toolUpdate: 'Update tool',
    fontDownload: 'Download font',
    voiceClone: 'Clone voice',
    agentTranslate: 'Translate',
    legacyImport: 'Import earlier projects',
  },
  /** Job phases (`JobPhase`): the list and the pill show “Recognising · 45%”. */
  jobPhase: {
    queued: 'Queued',
    starting: 'Starting',
    loading: 'Loading model',
    decoding: 'Decoding audio',
    vad: 'Detecting speech',
    transcribing: 'Recognizing',
    aligning: 'Aligning timing',
    diarizing: 'Identifying speakers',
    finalizing: 'Finalizing',
    probing: 'Reading media',
    encoding: 'Encoding',
    downloading: 'Downloading',
    moving: 'Moving',
    generating: 'Generating',
    validating: 'Validating',
    publishing: 'Saving results',
    applying: 'Writing to video',
    done: 'Done',
  },
  /** Background task page, details and sidebar. */
  taskView: {
    queued: 'Queued',
    running: 'In progress',
    awaitingApproval: 'Needs your approval',
    cancelled: 'Cancelled',
    failed: 'Failed',
    completed: 'Done',
    interrupted: 'Interrupted',
    needsReconciliation: 'Result unknown',
    retrying: 'Retrying automatically after an error',
    costCharged: 'Result received; charged once',
    costCancelUnsupported: 'The provider doesn’t support cancelling; the request may still finish remotely and be charged',
    costUnknown: 'Not sure whether the request was sent; it may have been charged',
    costPossible: 'May have been charged',
    chipAgent: 'Agent',
    chipCli: 'CLI',
    byAgent: 'Agent session',
    byCli: 'CLI',
    byApp: 'App',
    byNode: 'Remote node',
    local: 'This computer',
    cloud: 'Cloud',
    node: 'Remote node',
    noProject: 'Not in any project',
    pageTitle: 'All tasks',
    activeSection: 'In progress',
    historySection: 'Done',
    historyGroup: 'History',
    emptyActive: 'No running tasks',
    emptyActiveBody: 'Transcription, translation, and exports show up here.',
    emptyHistory: 'No finished tasks yet',
    openConversation: 'Open session',
    details: 'Details',
    cancel: 'Cancel',
    stop: 'Stop',
    back: 'Background tasks',
    notFound: 'Task not found',
    notFoundBody: 'This task is no longer in the list',
    cancelTask: 'Cancel task',
    cancelExport: 'Cancel export',
    stopTask: 'Stop task',
    cancelExportHint: 'The unfinished file is deleted; the video itself isn’t affected. Once saving has started it can’t be stopped and will finish saving.',
    stopHint: 'The agent stops at the current step; files already written to the project aren’t affected.',
    conversationHint: 'This run was approved in an agent session; the conversation and approvals are in that session.',
    agentTaskHint: 'This task belongs to an agent session; the conversation and approvals are in that session.',
    cancelledBody: 'The video itself isn’t affected.',
    interruptedBody: 'The Runtime stopped or restarted before this run finished. It won’t resume; start it again if you need it.',
    needsReconciliationBody: 'The Runtime restarted before this cloud call replied. It may have been charged and won’t be resent automatically.',
    configHint: 'This is a configuration problem; retrying the same path won’t help. Add the missing component, then run it again.',
    sourceSection: 'Source',
    imagesSection: 'Images',
    outputsSection: 'Outputs',
    factsSection: 'Details',
    reveal: 'Show in Folder',
    open: 'Open',
    copyPrompt: 'Copy prompt',
    promptCopied: 'Prompt copied',
    copyFailed: 'Couldn’t copy. Select the text and copy it manually',
    documentWritten: 'Transcript written to the video',
    importedToVideo: 'Imported to video',
    imageName: (n: number) => `Image ${n}`,
    audioName: (n: number) => `Audio ${n}`,
    videoName: (n: number) => `Export ${n}`,
    fileName: (n: number) => `File ${n}`,
    entries: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
    packageFiles: (n: number) => (n === 1 ? 'Portable package · 1 file' : `Portable package · ${n} files`),
    projectClips: (n: number) => (n === 1 ? 'Project · 1 clip' : `Project · ${n} clips`),
    documentName: 'Transcript',
    stopFailed: (message: string) => `Couldn’t stop: ${message}`,
    cancelFailed: (message: string) => `Couldn’t cancel: ${message}`,
    /** Reconciliation (`jobs.reconcile`): after a restart, tasks whose result is unknown, that were interrupted, or whose result was never written to the video are left for the user to decide. */
    reconcileRetry: 'Try again',
    reconcileDiscard: 'Discard this result',
    reconcileApply: 'Write to video again',
    reconcileRetryHint: (charges: boolean): string =>
      charges ? 'Calls the provider again and may be charged again.' : 'Queues the same task again and runs it from the start.',
    reconcileDiscardHint: 'Marked as cancelled; any charges already incurred aren’t refunded.',
    reconcileApplyHint: 'The output is still there: it will be validated again and written to the video. Open this video first.',
    reconcileFailed: (message: string) => `Couldn’t handle it: ${message}`,
    openFailed: (message: string) => `Couldn’t open: ${message}`,
    remedyInstall: 'Install components',
    remedyCloud: 'Set up cloud models',
    remedyDefault: 'Choose default models',
    remedyNode: 'View remote nodes',
    remedyAgent: 'Open agent settings',
  },
  /** Task pill and hover card (prototype task-pill.jsx, model-task-pill.js). */
  taskPill: {
    count: (n: number) => (n === 1 ? '1 background task' : `${n} background tasks`),
    all: 'All tasks',
    more: (n: number) => (n === 1 ? '1 more task · See all in Background tasks' : `${n} more tasks · See all in Background tasks`),
    mine: 'This video',
    justStarted: 'Just started',
    startedAt: (ago: string) => `Started ${ago}`,
  },
  /**
   * The “Project files” tab in the workspace area (the `__browse__` branch of prototype home-workspace.jsx `WorkspaceFiles`).
   * States the prototype lacks (loading, cannot read, empty directory, only part listed) are added in the same tone.
   */
  projectFiles: {
    region: 'Project files',
    /** For a conversation that does not belong to a project: the root is its own working directory. */
    scratchRoot: 'Session folder',
    searchLabel: 'Find project files',
    searchPlaceholder: 'Find files or videos',
    listLabel: (where: string) => `Files in “${where}”`,
    resultsLabel: 'Search results',
    breadcrumbs: 'Folder path',
    loading: 'Loading files…',
    emptyFolder: 'This folder is empty',
    noMatch: 'No matching files',
    noMatchHint: 'Search matches file names and skips hidden files and dependency folders.',
    failed: 'Couldn’t read the file list',
    retry: 'Try again',
    truncatedList: (count: number) => `Too many files; showing only the first ${count}.`,
    truncatedSearch: 'Too many matches; showing only some. Try a more specific word.',
    inRoot: 'Project root',
  },
  /**
   * The web tab in the workspace area (prototype home-browser.jsx `WorkspaceBrowser`). The prototype uses an iframe; here it is the host's own separate web view (architecture design §12.10), so the sentence at the bottom is changed to explain isolation. Refused addresses (local addresses, non-http/https), the web process exiting, and “This environment cannot embed web pages” are states the prototype does not have.
   */
  webTab: {
    back: 'Back',
    forward: 'Forward',
    stop: 'Stop loading',
    reload: 'Reload page',
    address: 'Web address',
    placeholder: 'Search or enter a URL',
    go: 'Go',
    menu: 'Page options',
    copy: 'Copy page address',
    copied: 'Page address copied',
    copyFailed: 'Couldn’t copy the page address',
    external: 'Open in external browser',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Reset zoom to 100%',
    invalid: 'Enter an http / https URL or search terms. URLs can’t include a username or password.',
    loading: 'Loading page…',
    slow: 'The page is loading slowly. Try again or open it in an external browser.',
    startTitle: 'Search or open a web page',
    startBody: 'Enter a URL or search terms to look things up here and keep the conversation going.',
    enterUrl: 'Enter URL',
    stoppedTitle: 'Loading stopped',
    failedTitle: 'The page couldn’t load',
    failedDetail: (description: string, code: number) => `${description} (${code})`,
    crashedTitle: 'The page quit unexpectedly',
    crashedBody: 'Try reloading it.',
    retry: 'Reload',
    blockedTitle: {
      loopback: 'Local addresses don’t open here',
      scheme: 'Only http / https URLs can be opened',
      'app-origin': 'CucCut’s own pages can’t open in a web tab',
      invalid: 'This URL isn’t valid',
    },
    blockedBody: {
      loopback: 'For safety, embedded pages don’t reach local services (localhost, 127.0.0.1, and so on). Open it in a browser if you need to.',
      scheme: 'Other schemes (files, app links, and so on) don’t open in embedded pages.',
      'app-origin': 'The app’s own pages don’t open in a web tab.',
      invalid: 'Check how the URL is written.',
    },
    backToPage: 'Back to page',
    footer: 'Pages open in a separate environment that can’t reach CucCut or local services; sign-ins are kept apart from your system browser.',
    externalShort: 'Open externally',
    unsupportedTitle: 'Web pages can’t be embedded here',
    unsupportedBody: 'The CucCut desktop app can browse the web directly; for now, open it in a browser.',
    openInBrowser: 'Open in browser',
    toolsTitle: 'Tools',
    newPageTitle: 'New web page',
    newPageBody: 'Create an HTML file in the project and preview it',
    browseFilesTitle: 'Browse project files',
    browseFilesBody: 'View the project folder in this tab',
    newPageFileName: 'New page',
    newPageHint: 'Write the page here, or ask the agent to edit it.',
    newPageFailed: 'Couldn’t create the web page',
  },
  /** Timeline clipboard, context menu and hints with undo (prototype editor-keys.jsx, timeline-menu.jsx; the prototype says “element”, here it is “clip”). */
  timelineEdit: {
    undo: 'Undo',
    /** `verb` is the action name in this directory (`copy`, `cutItem`, `remove`, `duplicate`). */
    pick: (verb: string) => `Select the clips to ${verb.toLowerCase()} first`,
    copied: (n: number) => (n > 1 ? `Copied ${n} clips` : 'Copied clip'),
    cut: (n: number) => (n > 1 ? `Cut ${n} clips` : 'Cut clip'),
    pasted: (n: number) => (n > 1 ? `Pasted ${n} clips` : 'Pasted clip'),
    duplicated: (n: number) => (n > 1 ? `Duplicated ${n} clips` : 'Duplicated clip'),
    deleted: (n: number) => (n > 1 ? `Deleted ${n} clips` : 'Deleted clip'),
    clipboardEmpty: (mod: string) => `The clipboard is empty · Press ${mod}C to copy a clip first`,
    otherVideo: 'The clips on the clipboard come from another video · They can only be pasted back into that video',
    selectedAtPlayhead: (n: number) => (n === 1 ? 'Selected 1 clip' : `Selected ${n} clips`),
    nothingAtPlayhead: 'No clips at the playhead',
    menuLabel: (name: string) => `Clip “${name}”`,
    split: 'Split at playhead',
    splitUnavailable: 'The playhead isn’t inside this clip',
    copy: 'Copy',
    cutItem: 'Cut',
    paste: 'Paste',
    duplicate: 'Duplicate',
    disable: 'Disable this clip',
    enable: 'Enable this clip',
    disableHint: 'Stays on the timeline · Skipped in the picture and exports',
    enableHint: 'Back in the picture and exports',
    remove: 'Delete',
  },
  /** Zoom menu for the transport (prototype data.js `zoomMenu` and the Transport in timeline.jsx). */
  timelineZoom: {
    menu: 'Zoom',
    tip: 'Zoom options',
    in: 'Zoom in',
    out: 'Zoom out',
    '100': '100%',
    fit: 'Fit to window',
    fitClip: 'Fit current clip',
    playhead: 'Zoom to playhead',
    fitSelection: 'Fit selection',
    noClip: 'Move the playhead inside a clip',
    noSelection: 'Select clips on the timeline first',
  },
  /**
   * Editor shortcut list (SHEET in prototype editor-keys.jsx): lists only the keys that actually exist here.
   * The ⌘ in the keys becomes Ctrl+ on Windows and Linux (see shortcut-sheet).
   */
  shortcutSheet: {
    title: 'Keyboard shortcuts',
    done: 'Got it',
    hint: 'While the cursor is in a text field, these keys go to the text field. Full-screen playback has its own shortcut list: press ? in full screen to see it.',
    rows: [
      ['Delete selection (gaps left empty on every track close up)', 'Delete'],
      ['Delete the selected span from all tracks (later content moves up)', '⇧Delete'],
      ['Deselect / close popover', 'Esc'],
      ['Play / pause', 'Space / K'],
      ['Undo / redo', '⌘Z / ⇧⌘Z'],
      ['Copy / cut / paste', '⌘C / ⌘X / ⌘V'],
      ['Duplicate', '⌘D'],
      ['Select all clips under the playhead', '⌘A'],
      ['Playhead back / forward one frame (while playing: 5 seconds)', '← / →'],
      ['Playhead back / forward one second', '⇧← / ⇧→'],
      ['Back / forward 10 seconds', 'J / L'],
      ['While playing: volume +10 / −10 (turning it up unmutes)', '↑ / ↓'],
      ['Mute / unmute', 'M'],
      ['Nudge the selected element on the canvas (click the canvas first)', 'Arrow keys (⇧ moves 5%, ⌥↑ / ⌥↓ moves 0.1%)'],
      ['Nudge the selected clip’s timing (⇧ one second at a time)', '⌥← / ⌥→'],
      ['Timeline zoom in / out / 100%', '⌘= / ⌘− / ⌘0'],
      ['Timeline fit to window / current clip / playhead / selection', '⌥⌘1 / ⌥⌘2 / ⌥⌘3 / ⌥⌘4'],
      ['Split at playhead', 'S / ⌘B'],
      ['Full-screen playback / exit full screen (when nothing is selected on the canvas)', 'F'],
      ['Bring the selected clip to the front / send it to the back', 'F / B'],
      ['Bring the selected clip forward / send it backward one layer', '⌘↑ / ⌘↓'],
      ['Jump to start / end', 'Home / End'],
      ['Open the editor shortcut list', '?'],
    ] as [string, string][],
  },
  /** Home workspace area: tab strip, plus menu, view controls, conversation column and single-file tabs (prototype home-workspace.jsx, shell.jsx). */
  workspace: {
    tablist: 'Workspace tabs',
    tablistHint: 'Drag tabs to reorder them, or press Alt + Shift + Left/Right Arrow.',
    close: (name: string) => `Close tab “${name}”`,
    add: 'New tab',
    dragging: (name: string) => `Dragging “${name}”. Release to drop, Esc to cancel`,
    moved: (name: string) => `Moved “${name}”`,
    dragCancelled: 'Drag cancelled',
    viewGroup: 'Workspace view',
    resize: 'Resize session column',
    conversation: 'Session',
    /** Tooltip and screen reader name for a conversation tab in a narrow window (product design §3.3): `status` is running / awaiting approval; omitted when absent. */
    conversationTabTip: (title: string, status: string | null) =>
      `Session “${title}”${status ? ` · ${status}` : ''} · Pinned first; can't be moved or closed`,
    conversationTabLabel: (title: string, status: string | null) => `Session “${title}”${status ? `, ${status}` : ''}, pinned first`,
    opening: 'Opening video…',
    showInSpace: 'Show in Library',
    reveal: 'Show in Folder',
    fileMissing: 'The file was moved or deleted',
    filesNoConversation: 'Once the session is created, files in its folder are listed here.',
  },
  /** Objects on the stage: selection box, handles, rotate button, the unified multi-select box and in-place text editing (prototype stage-objects.jsx, stage-marquee.jsx). */
  stage: {
    label: 'Objects on canvas',
    textEditor: 'Edit text',
    edgeHeightTip: 'Drag to change height · ⌥ from center',
    edgeWidthTip: 'Drag to change width · ⌥ from center',
    cornerFreeTip: 'Drag to resize · ⇧ unlocks proportions, ⌥ from center',
    cornerScaleTip: 'Scale proportionally · ⌥ from center',
    rotateTip: 'Drag to rotate · Snaps to 15°, ⇧ for free rotation · Double-click to reset',
    groupCornerTip: 'Scale all proportionally',
    picked: (n: number) => `${n} selected`,
    degrees: (n: number) => `${n}°`,
    /** Small badge shown on a segment selected while framing by shot (prototype `shotBadge`): the start and end seconds on the sub-video timeline. */
    shotPiece: (from: number, to: number) => `This part · ${from}–${to}s`,
    applyAll: 'Apply to whole short',
    applyAllTip: 'Use this part’s framing for every part of this video',
    appliedAll: (n: number) => `Applied this framing to all ${n} parts`,
    undo: 'Undo',
  },
  /**
   * Catalogue and start/stop verbs for the four services (prototype model-services.js `SERVICES`); remote compute keeps the term “shared”. The order is the order in the sidebar and overview.
   * In the prototype the model API service is a section on the Web service page (page-services-api.jsx `ApiSection`); the Runtime makes it a separate service (its own port, token and switch; architecture design §4.8), and here it is listed after the Web service.
   */
  service: {
    mcp: {
      name: 'MCP service',
      scope: 'This computer only',
      desc: 'Lets other AI apps read videos and call CucCut tools',
      start: 'Start service',
      stop: 'Stop service',
      starting: 'Starting…',
      stopping: 'Stopping…',
    },
    remote: {
      name: 'Remote compute',
      scope: 'Local network',
      desc: 'Shares this Mac’s compute with other computers on your local network',
      start: 'Start sharing',
      stop: 'Stop sharing',
      starting: 'Starting…',
      stopping: 'Stopping…',
    },
    web: {
      name: 'Web service',
      scope: 'This computer only',
      desc: 'Open CucCut Web in a browser to edit the same videos',
      start: 'Start service',
      stop: 'Stop service',
      starting: 'Starting…',
      stopping: 'Stopping…',
    },
    'model-api': {
      name: 'Model API',
      scope: 'This computer only',
      desc: 'Lets tools that speak the OpenAI API use CucCut’s models to transcribe, voice, make images, and generate text',
      start: 'Start service',
      stop: 'Stop service',
      starting: 'Starting…',
      stopping: 'Stopping…',
    },
  },
  /** Service status words (prototype model-services.js `stateLabel`); `unavailable` is a service this version of the Runtime does not provide. */
  serviceState: {
    share: { starting: 'Starting to share…', stopping: 'Stopping sharing…', error: 'Sharing stopped unexpectedly', on: 'Sharing', off: 'Not sharing' },
    service: { starting: 'Starting…', stopping: 'Stopping…', error: 'Failed to start', on: 'Running', off: 'Not started' },
    unavailable: 'Not available yet',
  },
  servicesPage: {
    title: 'Services',
    overview: 'Services overview',
    lede: 'Services CucCut provides on this Mac for other apps and devices to connect to. All are off by default and stop when you quit CucCut.',
    allOff: 'None running',
    errors: (n: number) => (n === 1 ? '1 error' : `${n} errors`),
    running: (n: number) => `${n} running`,
    open: (name: string) => `Open ${name}`,
    /** `verb` is the service's own start verb (`service.*.start`). */
    restart: (verb: string) => `Re${verb.charAt(0).toLowerCase()}${verb.slice(1)}`,
    railAlert: (text: string) => `Services, ${text}`,
    railApprovals: (n: number) => (n === 1 ? 'Services, 1 request awaiting your approval' : `Services, ${n} requests awaiting your approval`),
    loading: 'Loading status…',
    disconnected: 'Not connected to the CucCut Runtime',
    failed: (message: string) => `That didn’t work: ${message}`,
    /** Services the Runtime lists but this version does not provide (`available: false`): the overview row and the detail page explain clearly why they cannot be started or stopped. */
    unavailableDetail: 'This version of the CucCut Runtime doesn’t provide this service yet',
    unavailableTitle: (name: string) => `${name} isn’t available yet`,
    notRunning: 'The service isn’t running. Start it first',
    mcpRelated: 'Want Claude Code or Codex in your terminal to learn CucCut’s workflows? Install CucCut’s skill for them — no service needed. See',
    mcpRelatedLink: 'Settings › Skills',
  },
  /** CucCut Runtime card (one card from the old services page, now reused by Settings › Diagnostics). */
  runtimeCard: {
    name: 'CucCut Runtime',
    version: 'Version',
    versionValue: (runtime: string, protocol: number | string) => `${runtime} (protocol ${protocol})`,
    pid: 'Process',
    startedAt: 'Started',
    home: 'Data folder',
  },
  /** Remote compute page (prototype page-shell.jsx RemotePage). This version can only share transcription; the other task types are drawn as disabled with the reason given. */
  remote: {
    title: 'Remote compute',
    tabsLabel: 'Remote compute views',
    tabShare: 'Share this Mac',
    tabNodes: 'Use other computers',
    ledeShare: {
      before: 'Share this Mac’s transcription with other computers on your local network. ',
      strong: 'Files stay on your local network',
      after: '; only the results go back — no servers involved.',
    },
    ledeNodes: {
      before: 'Hand transcription to a faster computer on your local network. ',
      strong: 'Files stay on your local network',
      after: '; only the results come back — no servers involved.',
    },

    cardOn: 'Sharing this Mac',
    cardOff: 'Sharing is off',
    subOff: 'Other devices can’t see this Mac.',
    subErrorFallback: 'The node service isn’t listening.',
    errorFix: 'Quit the program using this port, then start sharing again — or stop if you no longer want to share.',
    foot: 'While sharing is on, CucCut resumes sharing the next time it opens.',
    footRight: 'Sharing stops when you quit CucCut.',
    privacy: 'Task inputs travel only on your local network and only results go back; nothing stays on this Mac after a task ends.',
    offHint: 'Once sharing starts, a 6-digit pairing code appears; enter it on the other device to connect.',
    started: 'Started sharing this Mac',
    stopped: 'Stopped sharing',

    nodeName: 'Node name',
    address: 'Address',
    noAddress: 'No local network address available',
    pairingTitle: 'Pairing code',
    pairingHint: (left: string) => `Enter this code on the other device. It expires in ${left}.`,
    pairingLocked: (until: string) => `Too many wrong attempts; pairing is locked until ${until}. Generate a new code to unlock it now.`,
    pairingNone:
      'No pairing code available right now. A code must be generated again after it’s used once, expires, or CucCut reopens. Paired devices aren’t affected.',
    regenerate: 'Regenerate',
    generate: 'Generate pairing code',
    regenerated: 'New pairing code generated',

    tasksTitle: 'Tasks offered to other computers',
    taskSummary: (on: number, total: number) => `Offering ${on} of ${total} task types`,
    taskUnsupported: 'This version can’t share this kind of task yet',
    taskNoModel: (noun: string) => `This Mac has no usable ${noun} installed, so these tasks from other computers will fail`,
    taskSwitch: (name: string) => `Offer ${name.toLowerCase()}`,
    taskOn: (name: string) => `Now offering ${name.toLowerCase()}`,
    taskOff: (name: string) => `Stopped offering ${name.toLowerCase()} · Tasks already accepted will finish`,

    status: 'Status',
    idle: 'Idle',
    jobs: (running: number, queued: number) =>
      [running ? `${running} running` : '', queued ? `${queued} queued` : ''].filter(Boolean).join(' · '),

    clientsTitle: 'Paired devices',
    clientsEmpty: 'No devices are paired with this Mac yet.',
    clientMeta: (paired: string, seen: string | null) => (seen ? `Paired ${paired} · Last seen ${seen}` : `Paired ${paired} · Never connected`),
    revoke: 'Revoke',
    revokeLabel: (name: string) => `Revoke “${name}”`,
    revokeTitle: (name: string) => `Revoke “${name}”?`,
    revokeBody: 'Its token stops working immediately and the tasks it sent to this Mac are cancelled. To use it again, it must enter a pairing code again.',
    revoked: (name: string) => `Revoked “${name}”`,

    paired: 'Paired',
    pairedEmptyTitle: 'No paired nodes yet',
    pairedEmptyBody: 'Turn on “Share this Mac” on another computer, then pair with it here.',
    nearby: 'Nearby',
    nearbyIdle: 'Click “Find nearby computers” to see which computers on your local network are sharing.',
    nearbyNone:
      'No sharing computers found. Make sure “Share this Mac” is on over there and both computers are on the same local network — or add one by address.',
    search: 'Find nearby computers',
    searching: 'Searching…',
    addByAddress: 'Add by address…',
    pair: 'Pair',
    pairLabel: (name: string) => `Pair with “${name}”`,
    online: 'Online',
    offline: 'Offline',
    versionMismatch: 'Incompatible version',
    unpaired: 'Pairing no longer valid',
    checking: 'Checking…',
    more: (name: string) => `More actions for “${name}”`,
    copyAddress: 'Copy address',
    copied: (address: string) => `Copied ${address}`,
    copyFailed: 'Couldn’t copy. Select the text and copy it',
    unpair: 'Unpair',
    unpairTitle: (name: string) => `Unpair from “${name}”?`,
    unpairBody: 'This computer will no longer appear in the transcription model list. You can pair again any time.',
    unpairDone: 'Unpaired',
    /** “Why it cannot be used” on the node card: assembled from `PairedNode.problem` (there is no diagnostic method, so it is not called “Diagnose”). */
    problem: {
      unreachable: 'Can’t reach this computer. Make sure it has CucCut open with “Share this Mac” on, and both computers are on the same local network.',
      version: 'The two computers run incompatible CucCut versions. Update both to the latest version.',
      unpaired: 'The pairing is no longer valid: the other side revoked this computer, or a different computer now uses this address. Unpair, then pair again.',
    },
    transcribeOff: 'Transcription not offered',
    transcribeModels: (n: number) => (n ? `Transcribe ${n}` : 'Transcribe'),

    pairTitle: (name: string) => `Pair with “${name}”`,
    addTitle: 'Add by address',
    pairBody: 'Read the 6-digit pairing code from “Share this Mac” on that computer and enter it here.',
    addressLabel: 'Address',
    addressPlaceholder: '192.168.1.31:47610',
    addressHint: (port: number) => `Host name or IP, optionally followed by a port; ${port} is used if you leave it out.`,
    codeLabel: 'Pairing code',
    codePlaceholder: '481 924',
    cancel: 'Cancel',
    pairing: 'Pairing…',
    pairedToast: 'Paired · It now appears in the transcription model list',
    addressEmpty: 'Enter that computer’s address',
    addressInvalid: 'The address format isn’t right: use 192.168.1.31 or 192.168.1.31:47610',
    portInvalid: 'The port must be a number from 1 to 65535',
    codeInvalid: 'The pairing code is 6 digits',
    pairErrors: {
      'pairing-code-invalid': 'The pairing code is wrong or no longer valid. Ask them to generate a new one and try again.',
      'pairing-locked': 'Too many wrong attempts; that computer has locked pairing for now. Ask them to click “Regenerate” to unlock it.',
      version: 'The two computers run incompatible CucCut versions. Update both to the latest version first.',
      'source-not-allowed': 'That computer doesn’t accept connections from this computer’s address.',
      lost: 'Can’t reach that computer. Check the address and port, and make sure “Share this Mac” is on there.',
    },
    pairFailed: (message: string) => `Pairing didn’t work: ${message}`,
  },
  /** Names of “tasks offered to other computers” (keys in `REMOTE_TASK_COPY`). `noun` is the kind of model named in the missing-model hint. */
  remoteTask: {
    asr: { name: 'Transcription', noun: 'transcription model' },
    tts: { name: 'Voice-over', noun: 'voice-over model' },
    image: { name: 'Image generation', noun: 'image model' },
    separate: { name: 'Vocal separation', noun: 'separation model' },
    download: { name: 'Video download', noun: null },
    export: { name: 'Video export', noun: null },
  },
  /** Help center (prototype help-center.jsx): frame, categories, search, quick start, shortcuts page and entry point. */
  help: {
    title: 'Help Center',
    subtitle: 'Look things up any time and get going',
    close: 'Close Help',
    navLabel: 'Help categories',
    navTitle: 'Using CucCut',
    navNote: ['Read only what you need.', 'Close it to get back to your work.'] as [string, string],
    sections: { start: 'Quick start', guide: 'Guides', keys: 'Keyboard shortcuts', faq: 'FAQ' },
    searchLabel: 'Search Help',
    searchPlaceholder: 'Search for what you want to do, e.g. subtitle style',
    results: 'Search results',
    found: (n: number) => (n === 1 ? 'Found 1 guide' : `Found ${n} guides`),
    emptyTitle: 'No matching guides',
    emptyBody: 'Try “subtitles”, “assets”, “agent”, or “aspect ratio” — or start from Quick start.',
    emptyAction: 'View Quick start',
    welcomeEyebrow: 'New here? Start here',
    welcomeTitle: 'Make your first subtitled video',
    welcomeBody: (steps: number) => `Go from a clip to a subtitled export in ${steps} steps.`,
    welcomeAction: 'Start the getting-started guide',
    welcomeDuration: (steps: number, minutes: number) => `${steps} steps · About ${minutes} min read`,
    pathLabel: (steps: number) => `Getting started in ${steps} steps`,
    pathMinutes: (minutes: number) => `${minutes} min read`,
    moreTitle: 'You might also want to know',
    allGuides: 'All guides',
    keysHintLead: 'Can’t find an action?',
    keysHintLink: 'View keyboard shortcuts',
    keysHintNote: 'Opens the list in the editor',
    keysTitle: 'Fewer clicks, a bit faster',
    keysIntro: 'These shortcuts work in the editor. While you’re typing, keys go to text editing first.',
    keysPlatform: 'Shortcut style',
    mac: 'macOS',
    other: 'Windows / Linux',
    guideTitle: 'Find what you want to do here',
    guideIntro: 'Each guide covers one thing, so you can go back to your video and try it right away.',
    faqTitle: 'Having trouble? Start here',
    faqIntro: 'Start with the most common causes and check step by step.',
    minutes: (minutes: number) => `${minutes} min`,
    readTime: (minutes: number) => `About ${minutes} min read`,
    backToResults: 'Back to search results',
    backTo: (section: string) => `Back to ${section}`,
    pickVideo: 'Choose a video',
    pickVideoNote: 'Open a video first, then follow the guide.',
    ctaNote: 'Opens the feature; you take it from there.',
    backToVideo: 'Back to video',
    backNote: 'Close Help and try it in your video.',
    next: (title: string) => `Read next: ${title}`,
    footer: 'Built-in guides · Available offline',
    entry: 'Help Center · F1',
    entryLabel: 'Help Center',
    settingsEntry: 'Help',
  },
  /** Editor preview listening volume and fullscreen (shortcuts ↑/↓, M, F; prototype editor-keys.jsx borrows the keys of the fullscreen player). It only affects what this window hears and shows; it is not put into the video. */
  previewKeys: {
    volume: (volume: number) => `Preview volume ${volume}`,
    muted: 'Preview muted',
    unmuted: (volume: number) => `Preview unmuted · Volume ${volume}`,
    fullscreenFailed: 'Couldn’t show the preview full screen',
  },
  /** Floating canvas toolbar and multi-select page (prototype stage-toolbar.jsx, stage-toolbar-menu.jsx, panel-elements.jsx MultiSelectPanel). */
  stageToolbar: {
    label: 'Clip toolbar',
    more: 'More',
    back: 'Back',
    unavailable: 'Not available yet',
    textColor: 'Text color',
    fillColor: 'Fill color',
    strokeColor: 'Stroke color',
    strokeWidth: 'Weight',
    muted: 'Muted',
    firstGeometry: (name: string) => `Geometry is read-only and shows the first “${name}”; select only that one to change the values.`,
    align: 'Align',
    alignTo: 'Relative to',
    toSelection: 'Selection',
    toCanvas: 'Canvas',
    alignLeft: 'Align left',
    alignHCenter: 'Center horizontally',
    alignRight: 'Align right',
    alignTop: 'Align top',
    alignVCenter: 'Center vertically',
    alignBottom: 'Align bottom',
    distribute: 'Distribute',
    distributeX: 'Distribute horizontally',
    distributeY: 'Distribute vertically',
    alignNeed: 'Aligning needs at least two movable clips, or one when aligning to the canvas.',
    distributeNeed: 'Distributing evenly needs at least three movable clips.',
    aligned: (n: number) => (n === 1 ? 'Aligned 1 clip' : `Aligned ${n} clips`),
    distributed: (n: number) => (n === 1 ? 'Distributed 1 clip' : `Distributed ${n} clips`),
    inPlace: 'Already in place; no clips to move',
    duplicate: 'Duplicate',
    copy: 'Copy',
    removeAll: (n: number) => (n === 1 ? 'Delete this clip' : `Delete these ${n} clips`),
    skipped: (n: number) =>
      `${n === 1 ? '1 clip isn’t' : `${n} clips aren’t`} included in align and distribute: the main video, audio, and subtitles aren’t placed separately on the canvas, and locked clips don’t move.`,
    dragNote: 'Drag one of them on the canvas to move them together. Select a single clip to change properties one by one.',
    hint: 'Align, distribute, duplicate, and delete each count as a single undo step.',
  },
  /** @ completion group (the this-video group of design-draft model-agent.js `mentionItems`): chapters and speakers in the open video come first. */
  mentionGroups: {
    video: 'This video',
    files: 'Videos and files',
  },
};
export type CopyMessages = typeof en;
export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

export const revealLabel = () => M.reveal;
export const untitled = () => M.untitled;
export const sentAttachmentsLabel = () => M.sentAttachments;

// ---- Named exports: same shape as before; each property read picks up the current language ----

export const ACCESS_MODE_LABEL: Record<AgentMode, string> = live(() => M.accessModeLabel);
export const ACCESS_MODE_HINT: Record<AgentMode, string> = live(() => M.accessModeHint);
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = live(() => M.taskStatusLabel);

// ---- Input area (prototype agent-thread.jsx Composer, model-agent.js, data.js `agent`) ----

export const ACCESS_MODE_FOOT: Record<AgentMode, string> = live(() => M.accessModeFoot);

/** Hint when switching access mode while a task is running (the running branch of prototype model-agent.js `modeToast`). */
export function accessModeToast(mode: AgentMode): string {
  return M.accessModeToast(ACCESS_MODE_LABEL[mode]);
}

/** Composer footnote (prototype model-agent.js `composerFoot`): where it runs, whose subscription is used, whether this level asks you first, and the shortcut. */
export function composerFoot(driverName: string | null, account: string | null, mode: AgentMode): string {
  const name = driverName ?? 'Claude Code';
  const acct = (account ?? '').split(' · ')[0]!.trim();
  return M.composerFoot(name, acct, ACCESS_MODE_FOOT[mode]);
}

export const MODEL_TIER_LABEL: Record<ModelTier, string> = live(() => M.modelTierLabel);
export const EFFORT_COPY: Record<string, { label: string; sub: string | null }> = live(() => M.effort);
export const AGENT_PICKER = live(() => M.agentPicker);
export const DRIVER_STATE_REASON: Record<Exclude<DriverState, 'ready'>, string> = live(() => M.driverStateReason);

type SlashKey = keyof CopyMessages['slash'];
/** One slash command: the command and icon are fixed data; the name and description are read in the current language at read time. */
function slash<C extends `/${SlashKey}`, I extends string>(cmd: C, icon: I) {
  const key = cmd.slice(1) as SlashKey;
  return {
    cmd,
    icon,
    get label(): string {
      return M.slash[key].label;
    },
    get sub(): string {
      return M.slash[key].sub;
    },
  };
}

/**
 * Slash commands (prototype data.js `agent.slash`, product design §5.10): `/` names a tool; selecting it leaves only `/xxx ` in the message body, you keep talking after it, and the agent explains it itself.
 * The prototype's smart trimming and cutting into short videos are not yet connected to the agent flow, so they are not listed.
 */
export const SLASH_COMMANDS = [
  slash('/polish', 'sparkle'),
  slash('/chapters', 'list'),
  slash('/speakers', 'mic'),
  slash('/retranscribe', 'redo'),
  slash('/clean', 'captions'),
  slash('/translate', 'translate'),
  slash('/refresh', 'refresh'),
  slash('/dub', 'wave'),
  slash('/summary', 'transcript'),
  slash('/blog', 'text'),
  slash('/title', 'star'),
  slash('/desc', 'edit'),
  slash('/cover', 'image'),
  slash('/export', 'export'),
] as const;
export type SlashCommand = (typeof SLASH_COMMANDS)[number];

export const COMPOSER_MENU = live(() => M.composerMenu);
export const SKILL_COPY = live(() => M.skill);
export const ATTACHMENT_COPY = live(() => M.attachment);
export const QUEUE_COPY = live(() => M.queue);
export const RECOVERY_COPY = live(() => M.recovery);

// ---- Conversation thread (prototype agent-thread.jsx `PermissionMsg`, `ReceiptMsg`, `UserMsg`, the `AgentThread` empty state; home-session.jsx artifact cards) ----

export const APPROVAL_COPY = live(() => M.approval);
export const CHANGE_COPY = live(() => M.change);
export const THREAD_EMPTY_COPY = live(() => M.threadEmpty);
export const OUTPUT_COPY = live(() => M.output);
export const VIDEO_CARD_COPY = live(() => M.videoCard);
export const HOME_COPY = live(() => M.home);
export const HOME_STARTER_COPY = live(() => M.homeStarter);

/** Keys for filtering template sources (`HomeTemplate.source` in model/home-templates.ts): built-in catalogue and user directory; a manifest that names a community source counts as community. */
export type TemplateSourceKey = 'builtin' | 'user' | 'community';

export const TEMPLATE_CATEGORY_LABEL = live(() => M.templateCategory);
export const TEMPLATE_KIND_LABEL = live(() => M.templateKind);
export const TEMPLATE_SOURCE_LABEL: Record<TemplateSourceKey | 'all', string> = live(() => M.templateSource);
export const TEMPLATE_ASSET_LABEL = live(() => M.templateAsset);
export const TEMPLATE_SPEC_COPY = live(() => M.templateSpec);
export const CREATE_PROJECT_COPY = live(() => M.createProject);

// ---- Unified background-task view and task pill (prototype page-tasks.jsx, model-task-facts.js, task-pill.jsx, model-task-pill.js) ----

export const TASK_KIND_LABEL = live(() => M.taskKind);
export const JOB_PHASE_LABEL: Record<JobPhase, string> = live(() => M.jobPhase);
export const TASK_VIEW_COPY = live(() => M.taskView);
export const TASK_PILL_COPY = live(() => M.taskPill);
export const PROJECT_FILES_COPY = live(() => M.projectFiles);
export const WEB_TAB_COPY = live(() => M.webTab);
export const TIMELINE_EDIT_COPY = live(() => M.timelineEdit);
export const TIMELINE_ZOOM_COPY = live(() => M.timelineZoom);
export const SHORTCUT_SHEET_COPY = live(() => M.shortcutSheet);
export const WORKSPACE_COPY = live(() => M.workspace);
export const STAGE_COPY = live(() => M.stage);

// ---- Services (prototype page-services.jsx, model-services.js, page-shell.jsx RemotePage; product design §2.1) ----

export const SERVICE_COPY = live(() => M.service);
export const SERVICE_STATE_COPY = live(() => M.serviceState);
export const SERVICES_PAGE_COPY = live(() => M.servicesPage);
export const RUNTIME_CARD_COPY = live(() => M.runtimeCard);
export const REMOTE_COPY = live(() => M.remote);

type RemoteTaskKey = keyof CopyMessages['remoteTask'];
/** One kind of task offered to other computers: the key and capability name are fixed data; the name is read in the current language at read time. */
function remoteTask<K extends RemoteTaskKey, C extends string | null>(key: K, capability: C) {
  return {
    key,
    capability,
    get name(): string {
      return M.remoteTask[key].name;
    },
    get noun(): CopyMessages['remoteTask'][K]['noun'] {
      return M.remoteTask[key].noun;
    },
  };
}

/**
 * Catalogue of “tasks offered to other computers” (prototype model-services.js `REMOTE_TASKS`). `capability` is the capability name that can be shared in the node protocol
 * (`NODE_SHAREABLE_CAPABILITIES`); the types whose value is null have no backend in this version and are drawn as disabled.
 */
export const REMOTE_TASK_COPY = [
  remoteTask('asr', 'transcribe'),
  remoteTask('tts', null),
  remoteTask('image', null),
  remoteTask('separate', null),
  remoteTask('download', null),
  remoteTask('export', null),
] as const;

export const HELP_COPY = live(() => M.help);
export const PREVIEW_KEYS_COPY = live(() => M.previewKeys);

// ---- Floating canvas toolbar and multi-select page ----

export const STAGE_TOOLBAR_COPY = live(() => M.stageToolbar);
export const MENTION_GROUPS = live(() => M.mentionGroups);
