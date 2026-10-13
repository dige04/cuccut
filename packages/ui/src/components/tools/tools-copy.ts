import { defineMessages, intlLocale, live } from '@cuccut/protocol';
import { revealLabel } from '../../copy.ts';
import { zhHans } from './tools-copy.zh-Hans.ts';
import { zhHant } from './tools-copy.zh-Hant.ts';
import { ja } from './tools-copy.ja.ts';
import { ko } from './tools-copy.ko.ts';
import { es } from './tools-copy.es.ts';
import { fr } from './tools-copy.fr.ts';
import { de } from './tools-copy.de.ts';
import { nl } from './tools-copy.nl.ts';
import { ptBR } from './tools-copy.pt-BR.ts';
import { it } from './tools-copy.it.ts';
import { ru } from './tools-copy.ru.ts';
import { pl } from './tools-copy.pl.ts';
import { tr } from './tools-copy.tr.ts';
import { vi } from './tools-copy.vi.ts';

/**
 * Copy for the tool pages (taken verbatim from design files page-tools.jsx, tool-transcribe.jsx, tool-tts.jsx, tool-image.jsx, image-gen.jsx and tool-llm.jsx;
 * the demo lines in the design files, such as “交互原型：…” (Interactive prototype: …) and “交互演示播放的是示例音频” (The interactive demo plays a sample audio), are not carried over). Like models-copy.ts for the models page, it is kept in a separate file
 * and not crowded into copy.ts.
 *
 * The English is written here (the source of the keys and types); the translations are in `tools-copy.<language>.ts`. Each group is still given as the named export it was before (`GALLERY_COPY` etc.),
 * and the current language is picked when a property is read.
 */
const en = {
  gallery: {
    title: 'Tools',
    lede: 'Give it a file or some text and a model processes it directly; results are saved to the Library. No Agent connection needed.',
    /** Results of generation jobs are listed automatically in the Space by the Runtime (runtime-core space/space-derive.ts), and can also be downloaded and saved elsewhere. */
    ledeNote: 'Results are listed in the Library automatically (stored on this computer), and you can download a copy too.',
    planned: 'Coming soon',
    foot: 'More tools are on the way: format conversion, audio extraction, clipping, batch subtitles and more.',
    loading: 'Loading model status…',
    open: (name: string) => `Open ${name}`,
  },

  page: {
    back: 'Tools',
    hotkey: '⌘↵',
  },

  planned: {
    title: 'Coming soon',
    body: (reason: string) => `${reason}. This tool's page opens once the capability is in place.`,
    back: 'Back to all tools',
  },

  /** “在 Space 中查看” (View in Space) in the record column header: goes to this kind in the Space. */
  save: {
    view: 'View in the Library',
  },

  /** Output row (design file tool-frame.jsx `ToolOutputRow` / `ToolOutputs`): shared by the result page, job details and generation records. */
  output: {
    title: 'Outputs',
    savedIn: (dir: string) => `Saved in ${dir}`,
    movie: 'Written to video',
    open: 'Open in Editor',
    inSpace: 'View in the Library',
    get reveal() {
      return revealLabel();
    },
    revealFailed: (message: string) => `Couldn't show in folder: ${message}`,
    handover: 'Hand off to Agent',
    handedOver: (created: boolean, name: string, title: string) =>
      created
        ? `Started a new session with “${name}” attached: edit the message, then send it`
        : `Back in “${title}” with “${name}” attached: edit the message, then send it`,
    handoverFailed: (message: string) => `Couldn't hand off to Agent: ${message}`,
    untitled: 'Untitled session',
    nextLabel: 'Use next',
    newMovieNote: 'Assets stay where they are; the new video links to them instead of copying files.',
    newMovieGo: 'Create and open',
    newMovieCancel: 'Cancel',
    newMovieDone: (name: string) => `Created a new video from ${name}`,
    newMovieEmpty: (reason: string) => `The video was created, but the asset couldn't be added: ${reason}`,
    newMovieFailed: (message: string) => `Couldn't create the video: ${message}`,
  },

  /** The tool-related items in the Space viewer (design file space-viewer.jsx): process with a tool…, the tool that made it, do it again, and location. */
  entryTool: {
    menu: 'Process with a tool…',
    menuLabel: (name: string) => `Process “${name}” with a tool`,
    factTool: 'Tool',
    factPlace: 'Location',
    saveDir: '(default save location)',
    rerunHint: 'Back to the tool page with the settings filled in; change them or not, as you like.',
  },

  record: {
    more: 'More',
    reuse: 'Bring back to edit another take',
    copyText: 'Copy text',
    copyPrompt: 'Copy prompt',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    task: 'View in Background tasks',
    remove: 'Delete this record',
    removed: (name: string) => `Deleted ${name}`,
    removeNote: 'Only hidden from this page; it stays in Background tasks',
    cancel: 'Cancel',
    cancelFailed: (message: string) => `Couldn't cancel: ${message}`,
    requeue: 'Queue again',
    retry: 'Try again',
    retried: 'Resubmitted',
    reconcile: 'Resolve',
    reconcileNote: 'The outcome of this one is unknown: decide whether to try again or give up. It can’t be deleted until then.',
    // The estimate used when the Runtime has not yet said what it is waiting for (the concurrency limit can be adjusted on the models page, so the number of items is not hard-coded here).
    ahead: (n: number) => (n ? `Queued · ${n} ahead` : 'Queued'),
    download: (ext: string) => `Download ${ext}`,
    downloadFailed: (message: string) => `Download failed: ${message}`,
    openFailed: (message: string) => `Couldn't open this result: ${message}`,
    loadingMedia: 'Loading…',
    noFile: 'No file was generated',
    live: (n: number) => `${n} in progress`,
    count: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
    /** Accessible name of the progress bar for an item in progress: which item and which step it has reached. */
    progressLabel: (title: string, phase: string) => `“${title}” ${phase}`,
    play: (title: string) => `Play “${title}”`,
    /** For an item with an unknown result: “要你决定” (Needs your decision) follows the failure reason. */
    unsettled: (failure: string) =>
      `${failure}. The outcome of this one is unknown: decide whether to try again or give up. It can’t be deleted until then.`,
  },

  tts: {
    title: 'Generate speech',
    submit: 'Generate speech',
    textLabel: 'Text to read',
    textPlaceholder: (max: number) => `Enter the text to read. It's split at periods, question marks and line breaks; up to ${max} characters at a time.`,
    clear: 'Clear',
    sample: 'Fill in a sample',
    model: 'Model',
    manage: 'Manage speech models…',
    modelPicker: 'Speech synthesis model',
    noModel: 'No speech synthesis model available yet',
    noModelBody: 'Connect a provider (enter its key) in Settings › Models › Speech synthesis › Cloud models, then pick its models here.',
    goConnect: 'Connect',
    voice: 'Voice',
    voiceLabel: 'Voice',
    customVoice: 'Voice ID',
    customVoicePlaceholder: 'Voice ID from your provider account',
    style: 'Style',
    stylePlaceholder: 'Optional · describe the tone in a sentence, e.g. a bit slower, like late-night radio',
    styleLabel: 'Style description',
    roll: 'Shuffle',
    speed: 'Speed',
    speedRange: (provider: string, min: number, max: number, instruct: boolean) =>
      `${provider} accepts ${min}–${max}×${instruct ? ' · you can also put it in the style' : ''}`,
    noSpeed: (provider: string) => `${provider} has no numeric speed · describe pace in the style`,
    resetSpeed: 'Reset to default',
    options: 'Language and details',
    language: 'Language',
    languageNote: (provider: string, langs: string, auto: boolean) =>
      `${provider} speaks ${langs}${auto ? ' · Auto detects from the text' : ''}`,
    format: 'Format',
    seed: 'Seed',
    seedPlaceholder: 'Leave empty for random',
    seedNote: 'The provider tries to reproduce results but doesn’t guarantee it · the same text may vary slightly each time',
    noSeed: 'Cloud services don’t guarantee reproducible results and take no seed · the same text may vary slightly each time',
    local: 'Synthesized on this computer',
    side: 'History',
    empty: 'Nothing generated yet',
    emptyBody: 'Write the text, pick a voice, then press “Generate speech”.',
    sideFoot:
      'Generated audio is stored in the save location and listed under “Audio” in the Library; “Download” saves a copy wherever you choose. Cloud synthesis goes through the provider’s API and is billed by their rules.',
    reused: (name: string) => `Brought back the text and settings of ${name}`,
    submitted: 'Generation started',
    submitFailed: (message: string) => `Didn't start: ${message}`,
  },

  /** The rows of the common tool page skeleton (design file tool-frame.jsx). */
  frame: {
    model: 'Model',
    goSettings: 'Go to Settings',
    speechNoun: 'speech synthesis model',
    imageNoun: 'image model',
    textNoun: 'text model',
    saveTitle: 'Save location',
    saveTo: 'Save to ',
    defaultDir: 'Default save location',
    settingDir: 'Save location from Settings',
    backToDefault: 'Back to default',
    change: 'Change…',
    pickTitle: 'Choose a save location for this run',
    pickFailed: (message: string) => `Couldn't choose a folder: ${message}`,
    saveNote: 'Results appear as Library items and the files are saved in this folder; name clashes get a number and existing files are never overwritten.',
    /** The sentence below the save location: a note (default `saveNote`), a reminder when changing it for this time only, and where to change the default location. */
    saveFoot: (note: string, once: boolean) =>
      `${note} ${once ? 'This applies to this run only; change' : 'Change'} the default location in Settings › General.`,
  },

  gate: {
    connected: 'Connected',
    installed: 'Installed',
    localGroup: 'On this computer · offline',
    localWhere: (why: string) => `${why} · Settings › Models › Local models`,
    download: (name: string) => `Download ${name} first`,
    downloadBody:
      'Downloading doesn’t use the task queue; once installed, this page’s main button works. Generation shares one heavy-work slot with local speech models, so only one runs at a time.',
    downloadButton: 'Download…',
    downloading: (pct: number | null) => (pct === null ? 'Downloading…' : `Downloading · ${pct}%`),
    /** Gate-card note when a download has stopped halfway: `downloadBody` plus one more sentence about resuming. */
    downloadBodyPaused:
      'Downloading doesn’t use the task queue; once installed, this page’s main button works. Generation shares one heavy-work slot with local speech models, so only one runs at a time. The download stopped partway; resuming continues from there.',
    resume: 'Resume download…',
    manageLocal: 'Manage local models…',
    localUnavailable: (name: string) => `${name} isn't available on this computer`,
    localUnavailableBody: (why: string) => `${why}. You can switch to an available cloud model.`,
    connect: (provider: string) => `Connect ${provider} first`,
    ttsBody:
      'Enter this provider’s key in Settings › Models › Speech synthesis › Cloud models; the same key is shared by speech recognition, text generation and image generation.',
    imageBody:
      'Enter this provider’s key in Settings › Models › Image generation › Cloud models; the same key is shared by speech recognition, text generation and speech synthesis.',
    textBody:
      'Enter this provider’s key in Settings › Models › Text generation › Cloud models; the same key is shared by speech recognition, speech synthesis and image generation.',
    unavailable: (provider: string) => `${provider} isn't available right now`,
    goConnect: 'Connect',
    switchTo: (name: string) => `Switch to ${name}`,
    /** The download button on a gate card includes the size (“下载 {size}” (Download {size}) in design files tool-tts.jsx and image-gen.jsx). */
    downloadSize: (size: string) => `Download ${size}`,
    /** When the selected local speech model is not installed, switch to one that is installed (design file tool-tts.jsx “换用已装的 X” (Switch to installed X)). */
    switchToInstalled: (name: string) => `Switch to installed ${name}`,
    /** Download-card note for the speech synthesis page (design file panel-tts.jsx `TtsModelGate`); `Paused` adds one more sentence about resuming. */
    ttsDownloadBody: 'Downloading doesn’t use the task queue; once installed, this page’s main button works.',
    ttsDownloadBodyPaused:
      'Downloading doesn’t use the task queue; once installed, this page’s main button works. The download stopped partway; resuming continues from there.',
  },

  image: {
    title: 'Generate image',
    submit: 'Generate image',
    promptLabel: 'What to draw',
    promptPlaceholder: 'Describe the picture: subject, scene, style, lighting, composition. The more specific, the closer it gets.',
    clear: 'Clear',
    sample: 'Fill in a sample',
    refs: 'Reference images',
    pickRefs: 'Choose reference images',
    refsNote: 'This version of the generation API doesn’t take reference images yet',
    model: 'Model',
    manage: 'Manage image models…',
    modelPicker: 'Image model',
    noModel: 'No image model available yet',
    noModelBody: 'Connect a provider (enter its key) in Settings › Models › Image generation › Cloud models, then pick its models here.',
    localNote: 'Other computers on your local network aren’t supported in this version; Codex image generation works inside sessions.',
    aspect: 'Aspect ratio',
    aspectAuto: 'This model doesn’t let you pick a size; the provider decides',
    count: 'Count',
    countNote: (max: number) => `Up to ${max} per run`,
    advanced: 'Advanced',
    expand: 'Expand',
    collapse: 'Collapse',
    seed: 'Seed',
    seedPlaceholder: 'Leave empty for random',
    seedNote: 'Cloud results aren’t guaranteed to be reproducible',
    seedNoteLocal: 'Same seed and weights reproduce the result',
    steps: 'Steps',
    stepsNote: (def: number) => `Default ${def} · more is slower`,
    side: 'History',
    empty: 'Nothing generated yet',
    emptyBody: 'Describe the picture, pick a model, then press “Generate image”.',
    sideFoot:
      'Generated images are stored in the save location and listed under “Images” in the Library; “Download” saves a copy wherever you choose. Cloud providers may keep a copy of images they generate.',
    again: 'Another take',
    againDone: 'Brought back this take’s prompt and settings · seed left empty for a new random one',
    failed: (message: string) => `Nothing generated · ${message}`,
    retry: 'Try again',
    drop: 'Discard',
    retried: 'Resubmitted',
    cancelled: 'Cancelled',
    submitted: 'Generation started',
    submitFailed: (message: string) => `Didn't start: ${message}`,
    /** Character count below the prompt box (the limit is shown when there is one). */
    chars: (n: number, max: number | null) => {
      const count = n.toLocaleString(intlLocale());
      return max ? `${count} / ${max.toLocaleString(intlLocale())} characters` : `${count} ${n === 1 ? 'character' : 'characters'}`;
    },
    /** Alt text of a generated image: the file name and the prompt. */
    alt: (name: string, prompt: string) => `${name}: ${prompt}`,
  },

  /** Text generation (taken verbatim from design file tool-llm.jsx `LlmToolPage kind='text'`; demo phrasing such as “交互原型：…” (Interactive prototype: …) and “示例 · 已保存到 Space” (Example · saved to Space) is not carried over). */
  text: {
    title: 'Text generation',
    submit: 'Generate text',
    lede: 'Enter content and instructions to call a text model directly; generated documents are saved to the Library automatically.',
    inputLabel: 'Instructions',
    material: 'Attached material',
    materialAdd: 'Attach from the Library…',
    materialRemove: 'Remove',
    materialNote: 'You can attach a document or subtitles from the Library; its text is sent to the model after your instructions.',
    materialPicked: (name: string) => `Attaching the text of “${name}”`,
    inputPlaceholder: 'Describe what to generate, or paste source text and say how to rewrite or summarize it',
    sample: 'Fill in a sample',
    clear: 'Clear',
    model: 'Text model',
    manage: 'Manage text models',
    modelPicker: 'Text model',
    noModel: 'No text model available yet',
    noModelBody: 'Connect a provider (enter its key) in Settings › Models › Text generation › Cloud models, then pick its models here.',
    side: 'History',
    viewInSpace: 'View in the Library',
    empty: 'No results yet',
    emptyBody: 'Results are saved to the Library automatically when done.',
    sideFoot:
      'The full text is stored on this computer and listed under “Documents” in the Library (named “Generated text-date-time”); “Download” saves a copy wherever you choose. Cloud calls go through the provider’s API and are billed per token.',
    waiting: 'Waiting for the model…',
    copy: 'Copy',
    download: 'Download',
    copyFailed: (message: string) => `Copy failed: ${message}`,
    previewCut: (shown: number, total: number) =>
      `Only the first ${shown.toLocaleString(intlLocale())} characters are shown here; Copy and Download use the full text (${total.toLocaleString(intlLocale())} characters).`,
    truncated: 'This model hit its output limit for a single response; the rest was cut off.',
    failed: (message: string) => `Nothing generated · ${message}`,
    retry: 'Try again',
    drop: 'Discard',
    retried: 'Resubmitted',
    cancelled: 'Cancelled',
    againDone: 'Brought back this one’s instructions and model',
    submitted: 'Generation started',
    submitFailed: (message: string) => `Didn't start: ${message}`,
  },

  transcribe: {
    title: 'Transcribe',
    submit: 'Start transcribing',
    /** The second half of the design sentence is 「完成后自动保存在 Space。」 (Saved automatically in Space when done). This version cannot transcribe files directly yet, so it does not state things it cannot do. */
    lede: 'Turn video or audio into an editable transcript and subtitles.',
    drop: 'Drop video or audio here',
    pick: 'Choose file',
    change: 'Change file',
    clearFile: 'Remove',
    notMedia: 'Choose a video or audio file',
    noPath: 'Can’t get this file’s path on disk (files dragged from a web page or another app don’t work); use “Choose file” instead.',
    mode: 'Transcription method',
    local: 'Local model',
    cloud: 'Cloud API',
    model: 'Speech model',
    noModels: 'No models to choose from',
    language: 'Language',
    manageLocal: 'Manage speech models',
    manageCloud: 'Manage API connections',
    side: 'Transcription history',
    empty: 'No transcripts yet',
    /** The design says 「选一份素材开始，完成后可以继续创建视频。」 (Choose a material to start; when complete, you can go on to create a video). This version can neither submit nor create a video, so the plain truth is written instead. */
    emptyBody: 'Once files can be transcribed directly, results will be listed here.',
  },

  /**
   * Compress video and merge video (design files tool-video.jsx and tool-video-merge.jsx). Items in the design that the Runtime cannot do (by size, frame rate, GPU encoding,
   * removing the audio track, installing / upgrading ffmpeg, the compatibility banner before submission, choosing between fast and re-encode, playback, adding to a video) are not written; the notes describe the actual behavior.
   */
  transcode: {
    compressTitle: 'Compress video',
    mergeTitle: 'Merge videos',
    extractTitle: 'Extract audio',
    /** The switcher at the top of the page (design file tool-video.jsx `ACTIONS`): the three tools share one page, and switching is a route change. */
    switchLabel: 'Video file tools',
    switchCompress: 'Compress',
    switchMerge: 'Merge',
    switchExtract: 'Extract audio',
    extractLede:
      'Drop the picture and keep the audio track: AAC, MP3, Opus and FLAC are copied as-is into .m4a, .mp3, .ogg and .flac; anything else is re-encoded to AAC (.m4a). Each file you pick gets its own copy; the originals are untouched.',
    extractSubmit: 'Extract audio',
    filesExtract: 'Video or audio files',
    dropExtract: 'Drop videos here',
    dropExtractSub: 'Or choose from your computer. The sound is saved as an audio file; each file you pick gets its own.',
    extractAudio: 'When re-encoding is needed',
    extractAudioHint: 'Audio tracks that don’t fit a common container are re-encoded to AAC at this bitrate.',
    compressLede: 'Re-encode videos to make them smaller before sending or uploading. Each file you pick gets its own copy; the originals are untouched.',
    mergeLede:
      'Join several clips end to end into one file, no video needed. If the clips match, they’re stream-copied: fast and lossless. If not, they’re re-encoded.',
    chip: 'Encoded with ffmpeg on this computer · nothing uploaded',
    compressSubmit: 'Compress video',
    mergeSubmit: 'Merge videos',
    filesCompress: 'Video files',
    filesMerge: 'Clips · joined in this order',
    dropCompress: 'Drop videos here',
    dropCompressSub: 'Or choose from your computer. Supports common formats like mp4, mov, mkv and webm; each file you pick gets its own copy.',
    dropMerge: 'Drop the videos to join here',
    dropMergeSub: 'At least two clips. They’re joined in this order, and you can drag to reorder later.',
    pick: 'Choose videos…',
    add: 'Add videos…',
    dropMore: 'You can keep dropping more',
    dragLabel: (name: string) => `Drag to reorder “${name}”`,
    clearAll: 'Remove all',
    sortByName: 'Sort by file name',
    pathLabel: 'Or paste the file’s full path',
    pathPlaceholder: '/Users/…/clip.mp4',
    pathAdd: 'Add',
    spaceAdd: 'Add from the Library…',
    spaceDone: 'Hide the Library',
    spaceItem: (kind: string) => `Library · ${kind}`,
    spaceGone: 'This item is no longer in the Library',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    listLabel: 'Selected videos',
    dragHint: 'Drag rows to reorder (or focus a row and press Return to drag), or use the arrows at the end of each row.',
    files: (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`,
    clips: (n: number) => `${n} ${n === 1 ? 'clip' : 'clips'}`,
    noPath: 'Can’t get this file’s path on disk (files dragged from a web page or another app don’t work); use “Choose videos…” or paste the path.',
    rateTitle: 'How small',
    byQuality: 'By quality',
    byBitrate: 'By bitrate',
    quality: 'Quality',
    videoKbps: 'Video bitrate',
    bitrateHint: 'Size ≈ bitrate × duration. The app can’t read the source duration, so it can’t work out a bitrate for a target size.',
    more: 'More settings',
    expand: 'Expand',
    collapse: 'Collapse',
    height: 'Resolution',
    heightHint: 'Caps the picture height and only scales down; portrait videos are capped by height too.',
    codec: 'Codec',
    audio: 'Audio',
    audioHint: 'Audio is always re-encoded to AAC.',
    saveNote: 'Results appear as Library items and the files are saved in this folder; existing files are never overwritten, and name clashes get a number (-2, -3).',
    mergeHow: 'How clips are joined',
    mergeHowBody:
      'Runtime reads every clip before deciding: if codec, resolution, frame rate, pixel format, audio tracks, sample rate and channels all match, the clips are stream-copied and the settings below don’t apply. Otherwise everything is re-encoded to match the first clip’s picture, other clips are scaled and padded to fit, and clips without sound get silence of the same length. Which way was used, and why, is written in the record on the right.',
    reencodeTitle: 'When re-encoding is needed',
    ffmpegChecking: 'Checking ffmpeg…',
    ffmpegCheckFailed: (message: string) => `Couldn't check ffmpeg: ${message}`,
    recheck: 'Check again',
    unavailable: 'Not available right now',
    submitted: 'Processing started',
    submitFailed: (message: string) => `Couldn't start: ${message}`,
    side: 'History',
    loading: 'Loading history…',
    empty: 'Nothing processed yet',
    emptyBody: 'Pick files and press the button; progress shows up here.',
    sideFoot:
      'Compress, merge and extract-audio records are listed together. Results go to the save location without overwriting existing files; deleting a record here doesn’t delete files, and it stays in Background tasks.',
    get reveal() {
      return revealLabel();
    },
    revealFailed: (message: string) => `Couldn't show in folder: ${message}`,
    copyCommand: 'Copy ffmpeg command',
    commandNote: 'Paths are trimmed to file names',
    again: 'Bring back to run again',
    againDone: 'Brought back this one’s files and settings',
    cancelledLine: 'Cancelled · no output file',
    requeue: 'Queue again',
    retry: 'Try again',
    retried: 'Resubmitted',
    drop: 'Discard',
    failed: (message: string) => `Didn't finish · ${message}`,
    raw: 'ffmpeg output',
    noOutput: 'No output file',
  },

  // ---- Video tools (product design §2.7; design files page-tools.jsx, tool-video-picker.jsx, tool-run-view.jsx, 2026-10-03) ----

  /** Catalog page: grouped into three by the object processed (speech and subtitles, text and images, video files); each card has one more row, “结果” (Results). */
  toolsHome: {
    lede: 'Do one specific thing directly, without a session or an Agent connection. Results are saved to the default save location and appear as Library items, ready for another tool, a new video, or handing off to Agent.',
    foot: 'Library items can go straight into a tool too: open an item in the Library and choose “Process with a tool…”.',
    statusFailed: (message: string) => `Couldn't read tool status; the cards may be out of date: ${message}`,
  },

  picker: {
    label: 'Choose a video',
    spaceLabel: 'Choose from the Library',
    countKinds: (kinds: string, n: number) => `Accepts ${kinds} · ${n} available`,
    emptySpaceTitle: 'Nothing in the Library can be used',
    emptySpaceBody: (kinds: string) => `This tool accepts ${kinds}. Try a different search, or start from a file on this computer.`,
    search: 'Search the Library',
    searchPlaceholder: 'Search by name',
    countTranscript: (n: number) => `${n} with a transcript available; the rest are dimmed`,
    count: (n: number) => `${n} available`,
    noProject: 'No project',
    minutes: (n: number) => `${n} min`,
    emptyTitle: 'No matching videos',
    emptyBody: 'Try a different search, or create one in the Library first.',
    loading: 'Loading videos…',
    failed: (message: string) => `Couldn't load the video list: ${message}`,
    pending: (n: number) => `${n} ${n === 1 ? 'video hasn’t' : 'videos haven’t'} finished loading; transcripts may be missing from the list`,
    scanning: 'The Library is still doing its first scan; the list may be incomplete',
    shown: (shown: number, total: number) => `Showing ${shown} of ${total}`,
    more: (n: number) => `Show ${n} more`,
  },

  source: { label: 'Start from' },

  project: {
    label: 'Project',
    noneBody: 'A new video needs a project, and there isn’t one yet. Create one on Home first, then come back.',
  },

  /** On-the-spot authorization card (§2.7, “授权在当场完成” (authorization is completed on the spot)). The Runtime records the authorization, which can be viewed and revoked in Settings › Privacy. */
  grant: {
    label: 'Confirm before sending to an online service',
    title: 'This sends data to an online service',
    to: (recipient: string) => `To ${recipient}`,
    what: (what: string) => `Content: ${what}`,
    cost: (cost: string) => `Estimated cost: ${cost}`,
    remember: 'Agree once and you won’t be asked again for the same service and kind of data; you can revoke it in Settings › Privacy.',
    agree: 'Agree and continue',
    hintLocal: 'If you’d rather not send it, switch to a local model; local models send no data.',
    hintCloud: 'If you’d rather not send it, skip this for now: only an online service can do this step.',
  },

  /** Run and result page, run records. */
  run: {
    run: 'Run',
    side: 'Run history',
    loading: 'Loading history…',
    empty: 'No runs yet',
    emptyBody: 'Once started, progress and results show up here and in Background tasks.',
    olderInTasks: (n: number) => `${n} earlier ${n === 1 ? 'run is' : 'runs are'} in Background tasks`,
    steps: 'Steps',
    progress: (title: string) => `${title} progress`,
    attempt: (n: number) => ` · attempt ${n}`,
    background: 'This run is also in Background tasks and keeps going if you leave this page.',
    cancel: 'Cancel',
    unknown: 'No reason given',
    failedBody: (error: string, keepsVideo: boolean) =>
      `${error.replace(/[。.]$/, '')}. Completed steps${keepsVideo ? ' and the video already created' : ''} are kept; retrying starts from this step.`,
    cancelledBody: 'Completed steps are kept; retrying starts from the step where it stopped.',
    retry: 'Retry from this step',
    retried: 'Restarted from the step where it stopped',
    retryFailed: (message: string) => `Couldn't retry: ${message}`,
    open: 'Open in Editor',
    noVideo: 'This video isn’t in the Library yet; check back in a moment.',
    noOutputs: 'This run’s outputs aren’t listed in the Library yet; check back in a moment.',
    again: 'Run again',
    backToForm: 'Back to settings',
    inTasks: 'View in Background tasks',
    waiting: 'Submitted; waiting for Background tasks to list this run…',
    started: 'Started; progress is on this page and in Background tasks',
    submitFailed: (message: string) => `Didn't start: ${message}`,
    ambiguousTitle: 'The main track of this video has several assets',
    ambiguousBody: 'Pick the asset to transcribe and start again with it. Only asset IDs are available here; match names in the Editor’s asset panel.',
    asset: (i: number, id: string) => `Asset ${i} · ${id}`,
    useAsset: 'Start again with this asset',
  },

  /** The line under the form that explains why the button cannot be pressed (shared by the four video tools). */
  form: {
    loading: 'Loading tool status…',
    needFile: 'Choose a video or audio file first',
    needUrl: 'Paste a link starting with http:// or https:// first',
    needVideo: 'Choose a video first',
    needEntry: 'Choose an item from the Library first',
    needProject: 'Choose a project first',
    needLang: 'Choose a target language first',
    sameLang: 'The target language is the same as the source; pick another',
    needTool: 'The video download tool isn’t ready; set it up in the card below first',
    toolUpdating: 'Updating the video download tool; start once it finishes',
    needGrant: 'Confirm the data to send below first',
    ready: 'Ready',
    noPicker: 'This environment can’t open a file dialog; drag the file in instead.',
    /** This tool is not in `tools.list` (the Runtime version is older). */
    notInRuntime: 'This version of Runtime doesn’t include this tool, so it can’t be used yet',
  },

  /** Tools › Transcribe (design file tool-transcribe.jsx). The sentences in the old `TRANSCRIBE_COPY` that said 「还不能直接转录」 (cannot transcribe directly yet) are no longer used. */
  transcribeTool: {
    lede: 'Turn video or audio into a transcript and subtitles. By default you get one transcript and one subtitle file in the save location; you can also create a new video, or write into an existing video in the Library.',
    targetTitle: 'Result',
    targetNone:
      'The transcript (.txt) and subtitles (.srt) are saved to the location below, each as a Library item you can later translate, turn into speech, or make into a new video.',
    createFile:
      'Assets stay where they are; the video links to them instead of copying files. The result is a new video in this project, with a transcript and an editable subtitle layer.',
    /** Downloading a video with transcription does not create a subtitle layer (the remote §14 records it as not implemented), so it is not promised. */
    createLink:
      'The media is downloaded to the save location and the video links to it instead of copying it again. The result is a new video in this project, named after the page title, with a transcript.',
    linkNote:
      'Starting from a link, “Download video” downloads it and creates a new video before transcribing; this path doesn’t create a subtitle layer, which you can generate later in the Editor’s subtitles panel. Downloading doesn’t grant permission to use the content; confirm you have the rights before publishing.',
    asrTitle: 'Recognition model',
    mode: 'Transcription method',
    local: 'Local model',
    cloud: 'Online service',
    model: 'Speech model',
    language: 'Transcription language',
    noModels: 'No models to choose from yet',
    statusCloud: (ok: boolean, provider: string) => `${ok ? 'Connected' : 'Not connected'} · ${provider} · audio is sent to this service`,
    statusLocal: (ok: boolean): string => (ok ? 'Installed · recognized on this computer, no data sent' : 'Model not installed yet'),
    noCloud: 'No online speech recognition service yet',
    noLocal: 'No speech recognition model on this computer yet',
    manageCloud: 'Manage connections',
    manageLocal: 'Manage speech models',
    linkAsr: 'Starting from a link uses the default speech recognition model and auto-detects the language: “Download video” can’t pick a model or language yet.',
    modelNotReady: 'The selected speech model can’t be used right now',
    more: 'More options',
    speakers: 'Identify speakers',
    downloadPack: 'Download',
    resumePack: 'Resume download',
    needSpeakers: 'Download “Speaker diarization” first, or turn off “Identify speakers”',
    submit: 'Start transcribing',
    submitLink: 'Download and transcribe',
    /** The “自动” (Auto) item in the language dropdown. */
    autoDetect: 'Auto-detect',
  },

  /** Tools › Translate subtitles (design file tool-translate.jsx). */
  translate: {
    title: 'Translate subtitles',
    ledeVideo: 'Add a translation and a subtitle layer in the target language to a transcribed video; the original stays as it is.',
    ledeFile: 'Translate a subtitle file, keeping the cue count and timecodes; the translated file goes to the save location without overwriting existing files.',
    from: (name: string, lang: string) => `Translating from the ${lang} transcript of “${name}”.`,
    fromPending: 'This video’s content hasn’t finished loading: Runtime will pick the transcript when you start (if there’s only one, it uses that).',
    document: 'Transcript',
    target: 'Translate into',
    hasTranslation: 'Translation exists · a new one will be added',
    bilingual: 'Bilingual (original and translation on two lines)',
    fileDrop: 'Drop an SRT or VTT subtitle file here',
    filePick: 'Choose subtitle file',
    fileChange: 'Change file',
    fileClear: 'Remove',
    fileFormats: 'Supports SRT and WebVTT · timecodes are kept',
    notSubtitle: 'Choose an SRT or VTT subtitle file',
    model: 'Text model',
    manageModels: 'Manage text models',
    grantHint: 'Translation only works with online text models; if you’d rather not send it, skip translating and the content stays on this computer.',
    submit: 'Start translating',
    /** The type name in the file-picker dialog. */
    subtitleFiles: 'Subtitle files',
    /** The secondary line of each item in the transcript dropdown: which language the transcript is in. */
    docLang: (lang: string) => `${lang} transcript`,
  },

  /** Tools › Translate and dub (design file tool-dub.jsx). */
  dub: {
    title: 'Translated voice-over',
    lede: 'Give a transcribed video a new set of voices from a translation. The result is written into this video; existing voice-overs are kept.',
    translation: 'Translation',
    newTranslation: 'Translate into another language first',
    stale: (n: number) => `${n} source ${n === 1 ? 'line was' : 'lines were'} edited; ${n === 1 ? 'its translation is' : 'their translations are'} empty`,
    pending: 'This video’s content hasn’t finished loading, so existing translations can’t be listed; you can translate one first.',
    target: 'Translate into',
    engine: 'Voice-over engine',
    engineLine: (langs: string) => `Online service · speaks ${langs}`,
    notSpeak: (name: string, lang: string) => `${name} doesn't speak ${lang}; switch to an engine that does.`,
    manageEngines: 'Manage voice-over engines',
    original: 'Original audio',
    originalOptions: { duck: 'Lower original audio', mute: 'Mute original audio', keep: 'Keep original audio' },
    /** In this version the dubbing engine lists only online services (as with translate-and-dub in the editor). */
    grantHint: 'If you’d rather not send it, skip the voice-over for now; in this version both the voice-over engine and the translation text model are online services.',
    submit: 'Start voice-over',
  },

  /** Tools › Download video (design file tool-link.jsx). */
  linkTool: {
    title: 'Download video',
    lede: 'Paste a video link to download it to this computer. If you need a transcript, it can be transcribed automatically once the download finishes.',
    sourceNote: 'Supports single video pages and direct media links. Download progress and results stay in Background tasks.',
    submit: 'Start download',
    submitTranscribe: 'Download and transcribe',
    /** “网站登录” (Website sign-in): which browsers' cookies to read. */
    cookies: 'Website sign-in',
    detecting: 'Detecting…',
    redetect: 'Detect browsers again',
    detectingFirst: 'Detecting browsers on this computer…',
    detectFailed: (error: string | null) =>
      `Couldn't detect browsers on this computer${error ? `: ${error}` : ''}. Only anonymous downloads work for now; click “Detect browsers again” to retry.`,
    detected: (n: number) => (n ? `Found ${n} ${n === 1 ? 'browser' : 'browsers'}` : 'No browser cookies found'),
    browsersLabel: 'Which browsers to read cookies from',
    allBrowsers: 'All browsers',
    transcribe: 'Transcribe after download',
    transcribeNote:
      'Uses the default speech recognition model, auto-detects the language, and saves a TXT transcript and SRT subtitles. If transcription fails, the downloaded video is kept.',
    project: 'Add transcript to project (optional)',
    noProject: 'Don’t add to a project',
    projectNote: 'Only linked to the project; files are still saved in the folder above.',
    /** When a download stops because of a problem, go back to the form to change the link or cookies. */
    editLink: 'Change link or cookie settings',
  },

  /** A video tool run in the background task details (design file tool-run-view.jsx `ToolTaskPanel`). */
  taskRun: {
    stopped: 'Run stopped',
    viewResult: 'View result',
    backToTool: 'Back to tool',
  },
  /** Re-transcription (product design §5.11, §4.4; design file tool-transcribe.jsx `RetargetField` / `ReplaceImpact` / `RetryAlert`). */
  retranscribe: {
    destTitle: 'Destination',
    destLabel: 'Where to write the transcription',
    nameLabel: 'New video name',
    newVideoNote: (project: string | null, video: string) =>
      `The new video goes in ${project ? `“${project}”` : 'the same project'}, linking the same asset without copying files, with the new transcript and an editable subtitle layer; “${video}” and its translations, subtitles and voice-overs stay as they are.`,
    impactTitle: 'What replacing does',
    impactTranslations: 'Translations',
    impactDubs: 'Voice-over',
    impactNone: 'This video has no translations',
    editedTitle: 'You’ve edited this video’s transcript',
    editedBody:
      'Fixed typos, polishing and paragraph breaks live only in the current transcript. Replacing it drops them (Undo brings them back). To keep them, choose “New video” instead.',
    editedAccept: 'Replace anyway',
    retryTitle: 'The last transcription failed',
    retryBody: (error: string | null, model: string | null, ago: string | null) =>
      `${error ?? 'No reason was recorded'}. ${['Last time', model, ago].filter(Boolean).join(' · ')}. The model, language and speaker identification are filled in from last time; change them if you like, then start.`,
    undo: 'Undo',
    refreshStale: 'Refresh outdated translations',
  },
};

export type ToolsMessages = typeof en;

const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

export const GALLERY_COPY = live(() => M.gallery);
export const PAGE_COPY = live(() => M.page);
export const PLANNED_COPY = live(() => M.planned);
export const SAVE_COPY = live(() => M.save);
export const OUTPUT_COPY = live(() => M.output);
export const ENTRY_TOOL_COPY = live(() => M.entryTool);
export const RECORD_COPY = live(() => M.record);
export const TTS_COPY = live(() => M.tts);
export const FRAME_COPY = live(() => M.frame);
export const GATE_COPY = live(() => M.gate);
export const IMAGE_COPY = live(() => M.image);
export const TEXT_COPY = live(() => M.text);
export const TRANSCRIBE_COPY = live(() => M.transcribe);
export const TRANSCODE_COPY = live(() => M.transcode);
export const TOOLS_HOME_COPY = live(() => M.toolsHome);
export const PICKER_COPY = live(() => M.picker);
export const SOURCE_COPY = live(() => M.source);
export const PROJECT_COPY = live(() => M.project);
export const GRANT_COPY = live(() => M.grant);
export const RUN_COPY = live(() => M.run);
export const FORM_COPY = live(() => M.form);
export const TRANSCRIBE_TOOL_COPY = live(() => M.transcribeTool);
export const TRANSLATE_COPY = live(() => M.translate);
export const DUB_COPY = live(() => M.dub);
export const LINK_TOOL_COPY = live(() => M.linkTool);
export const TASK_RUN_COPY = live(() => M.taskRun);
export const RETRANSCRIBE_COPY = live(() => M.retranscribe);
