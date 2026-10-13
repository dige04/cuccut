import { live, TOOL_CATEGORIES, type SpaceEntryKind, type ToolCategory, type ToolInputKind } from '@cuccut/protocol';
import { M } from './tool-catalog-copy.ts';

/**
 * Tool catalog (product design §2.1, §2.7; design file model-tools.js `GROUPS`): standalone capability entry points not attached to a project; they do not enter agent turns.
 * Tools are grouped by what they process (`category` in `tools.list`): speech and captions, text and images, video files. By default a result is an item in Space, saved to the save location. A result is a video only when an editable video in Space is selected (or “New video” is chosen).
 *
 * Each tool declares which kinds of input it accepts (`inputs`, each with its result `output`) and its default result (`output`; `artifacts` are the kinds of items produced when starting from a file, link, or text). The catalog cards, the sidebar, and the input-source switch are all derived from this declaration; components do not write their own. `needs`: what a video input requires the video to already have (`transcript`, i.e. transcribed). `accept`: the file extensions a file input accepts. `targets`: the ways to choose where the result lands; the first is the default.
 *
 * IDs use the Runtime tool registry IDs (`tools.list`). Short names from the old UI (`translate`, `tts`, …) map to the new IDs via `toolIdOf`, so old links and stored routes still open. The order is the order on the page and the sidebar. Whether a tool can be used right now is not decided here: `tools.list` is authoritative.
 */

export const TOOL_IDS = [
  'transcribe',
  'translate-subtitles',
  'dub',
  'synthesize-speech',
  'generate-text',
  'generate-image',
  'generate-music',
  'link-import',
  'compress-video',
  'merge-video',
  'extract-audio',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

/**
 * Video tools (transcribe, translate captions, translate dubbing, download video): they share the video picker, the run page, and in-place authorization. This is a class defined by page mechanism; it is independent of the catalog grouping (`group`).
 */
export const VIDEO_TOOL_IDS = ['transcribe', 'translate-subtitles', 'dub', 'link-import'] as const;
export type VideoToolId = (typeof VIDEO_TOOL_IDS)[number];

/** Compress, merge, and extract audio: they share one page (toggle at the top of the page), and each keeps its own tool ID. */
export const FILE_VIDEO_TOOL_IDS = ['compress-video', 'merge-video', 'extract-audio'] as const;
export type FileVideoToolId = (typeof FILE_VIDEO_TOOL_IDS)[number];

export type ToolIcon = 'transcript' | 'translate' | 'microphone' | 'import' | 'wave' | 'image' | 'music' | 'text' | 'film' | 'layers';
export type ToolGroupKey = ToolCategory;
export type ToolOutput = 'video' | 'artifact';
export type ToolArtifact = 'audio' | 'image' | 'doc' | 'final' | 'subtitle';
export type ToolTargetKey = 'create' | 'video' | 'none';

/**
 * Input sources in the UI: the input kinds from the catalog (`tools.list`), plus `space`, which means picking an item from Space. On submit, an item is converted by its kind to `video` (an editable video), `file` (a file item, with parameters `{ entryId }`), or `document` (material for a direct task). See `inputKindOf` in model/tool-space-input.ts.
 */
export type ToolSourceKind = ToolInputKind | 'space';

export interface ToolInput {
  kind: ToolSourceKind;
  /** The item kinds `space` accepts (`video` is an editable video); a `video` input accepts only videos. */
  kinds?: readonly SpaceEntryKind[];
  /** Attached material (text generation attaches a document or captions); not one of the source-switch options. */
  attach?: boolean;
  output: ToolOutput;
  /** A separate name for this input within this tool (the file input of translate captions is called “caption file”); when not given, `INPUT_LABELS` is used. */
  label?: string;
  accept?: readonly string[];
  needs?: 'transcript';
  fallback?: ToolOutput;
  /** This kind of input is run by another tool’s flow (its availability also depends on that tool’s status in `tools.list`). */
  via?: ToolId;
}

export interface ToolTarget {
  key: ToolTargetKey;
  label: string;
  output: ToolOutput;
}

export interface ToolInfo {
  id: ToolId;
  group: ToolGroupKey;
  name: string;
  icon: ToolIcon;
  desc: string;
  /** Default result: `video` writes only into the video you chose (dubbing translation); `artifact` is an item in Space. */
  output: ToolOutput;
  /** The kinds of items produced when starting from a file, link, or text (transcription gives two: document and caption). Empty for tools that only write into a video. */
  artifacts: readonly ToolArtifact[];
  inputs: readonly ToolInput[];
  targets?: readonly ToolTarget[];
  /** Not built yet; the card is greyed out with “Coming soon”. None are in the catalog at the moment. */
  planned?: boolean;
}

export interface ToolGroup {
  key: ToolGroupKey;
  label: string;
  desc: string;
  tools: readonly ToolInfo[];
}

export const INPUT_LABELS: Record<ToolSourceKind, string> = live(() => M.inputLabels);
export const OUTPUT_LABELS: Record<ToolOutput, string> = live(() => M.outputLabels);
export const ARTIFACT_LABELS: Record<ToolArtifact, string> = live(() => M.artifactLabels);

type ToolDecl = Omit<ToolInfo, 'group'>;

/** Names and descriptions are read in the current language at read time. */
function tool(decl: Omit<ToolDecl, 'name' | 'desc'>): ToolDecl {
  return Object.defineProperties(decl as ToolDecl, {
    name: { enumerable: true, get: () => M.tools[decl.id].name },
    desc: { enumerable: true, get: () => M.tools[decl.id].desc },
  });
}

const SPEECH_TOOLS: readonly ToolDecl[] = [
  tool({
    id: 'transcribe',
    icon: 'transcript',
    output: 'artifact',
    artifacts: ['doc', 'subtitle'],
    // Media in Space is converted as a file (`file` with `{ entryId }`), and editable videos are written into it. Link sources are run by the “download video” flow (with `transcribe: true`).
    inputs: [
      { kind: 'file', output: 'artifact' },
      { kind: 'space', kinds: ['video', 'video-file', 'export', 'audio'], output: 'artifact' },
      { kind: 'link', output: 'artifact', via: 'link-import' },
    ],
    targets: [
      {
        key: 'none',
        get label() {
          return M.targetNone;
        },
        output: 'artifact',
      },
      {
        key: 'create',
        get label() {
          return M.targetCreate;
        },
        output: 'video',
      },
    ],
  }),
  tool({
    id: 'translate-subtitles',
    icon: 'translate',
    output: 'artifact',
    artifacts: ['subtitle'],
    inputs: [
      { kind: 'space', kinds: ['video', 'subtitle'], needs: 'transcript', output: 'artifact' },
      {
        kind: 'file',
        get label() {
          return M.subtitleFile;
        },
        accept: ['.srt', '.vtt'],
        output: 'artifact',
      },
    ],
  }),
  tool({
    id: 'dub',
    icon: 'microphone',
    output: 'video',
    artifacts: [],
    inputs: [{ kind: 'video', kinds: ['video'], needs: 'transcript', output: 'video' }],
  }),
  tool({
    id: 'synthesize-speech',
    icon: 'wave',
    output: 'artifact',
    artifacts: ['audio'],
    inputs: [
      { kind: 'text', output: 'artifact' },
      { kind: 'space', kinds: ['document', 'subtitle'], output: 'artifact' },
    ],
  }),
];

const TEXT_IMAGE_TOOLS: readonly ToolDecl[] = [
  tool({
    id: 'generate-text',
    icon: 'text',
    output: 'artifact',
    artifacts: ['doc'],
    inputs: [
      { kind: 'text', output: 'artifact' },
      { kind: 'space', kinds: ['document', 'subtitle'], attach: true, output: 'artifact' },
    ],
  }),
  tool({
    id: 'generate-image',
    icon: 'image',
    output: 'artifact',
    artifacts: ['image'],
    inputs: [{ kind: 'text', output: 'artifact' }],
  }),
];

const MUSIC_TOOLS: readonly ToolDecl[] = [
  tool({
    id: 'generate-music',
    icon: 'music',
    output: 'artifact',
    artifacts: ['audio'],
    inputs: [{ kind: 'text', output: 'artifact' }],
  }),
];

const VIDEO_FILE_TOOLS: readonly ToolDecl[] = [
  tool({
    id: 'link-import',
    icon: 'import',
    output: 'artifact',
    artifacts: ['final'],
    inputs: [{ kind: 'link', output: 'artifact' }],
    targets: [],
  }),
  tool({
    id: 'compress-video',
    icon: 'film',
    output: 'artifact',
    artifacts: ['final'],
    inputs: [
      { kind: 'file', output: 'artifact' },
      { kind: 'space', kinds: ['video-file', 'export'], output: 'artifact' },
    ],
  }),
  tool({
    id: 'merge-video',
    icon: 'layers',
    output: 'artifact',
    artifacts: ['final'],
    inputs: [
      { kind: 'file', output: 'artifact' },
      { kind: 'space', kinds: ['video-file', 'export'], output: 'artifact' },
    ],
  }),
  tool({
    id: 'extract-audio',
    icon: 'wave',
    output: 'artifact',
    artifacts: ['audio'],
    inputs: [
      { kind: 'file', output: 'artifact' },
      { kind: 'space', kinds: ['video-file', 'export', 'audio'], output: 'artifact' },
    ],
  }),
];

/** Which tools are in each of the three groups (design file model-tools.js `GROUPS`). Order follows `TOOL_CATEGORIES`; names and descriptions are in the copy catalog. */
const GROUP_TOOLS: Record<ToolGroupKey, readonly ToolDecl[]> = {
  speech: SPEECH_TOOLS,
  'text-image': TEXT_IMAGE_TOOLS,
  music: MUSIC_TOOLS,
  'video-file': VIDEO_FILE_TOOLS,
};

export const TOOL_GROUPS: readonly ToolGroup[] = TOOL_CATEGORIES.map((key) => ({
  key,
  get label() {
    return M.groups[key].label;
  },
  get desc() {
    return M.groups[key].desc;
  },
  // Not expanded (expanding would freeze the names and descriptions in the language loaded at that time): copy the property descriptions as they are; names and descriptions are still read at read time.
  tools: GROUP_TOOLS[key].map((t) => Object.defineProperties({ group: key }, Object.getOwnPropertyDescriptors(t)) as ToolInfo),
}));

export const TOOLS: readonly ToolInfo[] = TOOL_GROUPS.flatMap((g) => g.tools);

/** Old-UI tool short names → registry IDs (old links, stored routes, home-page buttons). */
const LEGACY_IDS: Record<string, ToolId> = {
  translate: 'translate-subtitles',
  link: 'link-import',
  tts: 'synthesize-speech',
  image: 'generate-image',
  music: 'generate-music',
  text: 'generate-text',
  compress: 'compress-video',
  merge: 'merge-video',
  extract: 'extract-audio',
};

export function isToolId(value: string | undefined): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value ?? '');
}

/** Route tool name → tool ID: registry IDs pass through unchanged; old short names are swapped for the new ones. null when not recognized. */
export function toolIdOf(value: string | undefined | null): ToolId | null {
  if (!value) return null;
  if (isToolId(value)) return value;
  return Object.hasOwn(LEGACY_IDS, value) ? LEGACY_IDS[value]! : null;
}

export function toolById(id: string | undefined | null): ToolInfo | null {
  const key = toolIdOf(id);
  return key ? (TOOLS.find((t) => t.id === key) ?? null) : null;
}

export function isVideoTool(id: ToolId): id is VideoToolId {
  return (VIDEO_TOOL_IDS as readonly string[]).includes(id);
}

export function isFileVideoTool(id: ToolId): id is FileVideoToolId {
  return (FILE_VIDEO_TOOL_IDS as readonly string[]).includes(id);
}

/** Route tool → a tool that can be opened. Unknown or not-yet-shipped tools fall back to the catalog (null). */
export function openable(id: string | undefined | null): ToolInfo | null {
  const t = toolById(id);
  return t && !t.planned ? t : null;
}

export interface InputOption {
  key: ToolSourceKind;
  label: string;
  output: ToolOutput;
  needs: 'transcript' | null;
  accept: readonly string[] | null;
  /** The tool that executes it; null when it is this tool itself. */
  via: ToolId | null;
}

/** Options for the input source (the source switch in the UI), in declared order. Attached material does not count as a source. */
export function inputOptions(id: string | undefined | null): InputOption[] {
  const t = toolById(id);
  return t
    ? t.inputs.filter((i) => !i.attach).map((i) => ({
        key: i.kind,
        label: i.label ?? INPUT_LABELS[i.kind],
        output: i.output,
        needs: i.needs ?? null,
        accept: i.accept ?? null,
        via: i.via ?? null,
      }))
    : [];
}

/** Options for where the result lands (download video: new / add to existing / download only). The first is the default. Empty for tools without this question. */
export function targetOptions(id: string | undefined | null): ToolTarget[] {
  const t = toolById(id);
  return t?.targets ? t.targets.map((x) => ({ ...x })) : [];
}

/** What the result is when this tool starts from this kind of input. null when it does not accept this kind of input. */
export function outputOf(id: string | undefined | null, kind: ToolSourceKind): ToolOutput | null {
  return toolById(id)?.inputs.find((i) => i.kind === kind)?.output ?? null;
}

/** How output items are named: “document and caption items”, “audio items”. */
export function artifactText(artifacts: readonly ToolArtifact[]): string {
  return M.artifactItems(artifacts);
}

/** The kinds of items this tool accepts from Space (both the source and the attached material count), in declared order. Empty if none. */
export function spaceKindsOf(id: string | undefined | null): SpaceEntryKind[] {
  const kinds: SpaceEntryKind[] = [];
  for (const i of toolById(id)?.inputs ?? []) for (const k of i.kinds ?? []) if (!kinds.includes(k)) kinds.push(k);
  return kinds;
}

/** The “result” line on a card (design file `resultLine`): what items the tool produces by default. A tool that can switch to a new video, or write into the chosen video, gets a separate sentence for that. */
export function resultLine(id: string | undefined | null): string {
  const t = toolById(id);
  if (!t) return '';
  if (t.output === 'video') return M.resultWritesVideo;
  const parts = [M.resultInSpace(artifactText(t.artifacts))];
  if ((t.targets ?? []).some((x) => x.key === 'create')) parts.push(M.resultAlsoCreate);
  if (t.inputs.some((i) => i.kind === 'space' && i.kinds?.includes('video'))) parts.push(M.resultWritesEditable);
  return M.joinResult(parts);
}
