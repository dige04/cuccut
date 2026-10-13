/**
 * postMessage protocol between the editor page (the host shim in the iframe) and the CucCut UI (the parent window) (docs/design/slides §5, §8.2).
 * The slides and design canvas editors use the same messages (docs/design/canvas §5); the parent window tells them apart by which iframe the message came from.
 * Both sides accept only the message types listed here. Messages carry only the positions and text that annotations need, not the contents of the deck or design canvas file.
 * The exception is the file exported by the design canvas editor (`editor:save-file`): the runtime's `downloads` capability hands the export to the parent window for saving (docs/design/canvas §4, §8.3).
 *
 * - iframe → parent window uses `targetOrigin: "*"` (on desktop the parent page is file://, so its origin is null); the parent window checks messages by `event.source === iframe.contentWindow`. Parent window → iframe uses the origin of the editor address; the shim checks messages by `event.source === window.parent`.
 * - This file depends on neither the DOM nor Node, so both the UI and the editor can import it (`@cuccut/slides/editor-messages`).
 */

/** Position needed next to the comment box: coordinates in the iframe viewport (CSS pixels). */
export interface EditorPoint {
  x: number;
  y: number;
}

/**
 * Description the runtime gives for one annotation. `label` is for people, `detail` is for the model, and `area` marks a box-selected region.
 * `section` is the id of the section containing the target in the design system editor (docs/design/canvas §10.6). Sections are mounted on demand, so going back has to open that section first. Decks and design canvases do not give it.
 */
export interface AnchorDescription {
  label: string;
  detail?: string;
  area?: boolean;
  section?: string;
}

/** One annotation used to draw a numbered marker in the editor: `n` is its index in the whole draft (matching the composer list); `section` is the same as in `AnchorDescription`. */
export interface EditorThread {
  id: string;
  anchor: string;
  n: number;
  section?: string;
}

/** iframe → parent window. */
export type EditorToHostMessage =
  /** The runtime has started; when `canEdit` is false the editor is read-only (the web service's read-only mode). */
  | { type: 'editor:ready'; canEdit: boolean }
  /** Annotation mode changed (the runtime's own button, shortcut C, or the parent's `editor:set-mode`). */
  | { type: 'editor:mode'; on: boolean }
  /** The user clicked an element or box-selected an area: the parent window opens a comment box next to `point` and replies with `editor:compose-result`. */
  | ({ type: 'editor:compose'; requestId: string; anchor: string; point: EditorPoint } & AnchorDescription)
  /** Reply to `editor:flush`: all unsaved changes have been published (`saved` false means some changes could not be saved). */
  | { type: 'editor:flushed'; requestId: string; saved: boolean }
  /** The deck was changed by something other than the editor, so the editor must reload it. */
  | { type: 'editor:external-change'; paths: string[] }
  /** The runtime asks the parent window to put a prompt into this session's input box, such as “让智能体修好这页” (“have the agent fix this page”); the parent replies with `editor:suggest-prompt-result`. */
  | { type: 'editor:suggest-prompt'; requestId: string; prompt: string }
  /** The design canvas editor exported a file and asks the parent window to save it (on web it goes to the browser download; on desktop it opens a save dialog); the parent replies with `editor:save-file-result`. */
  | { type: 'editor:save-file'; requestId: string; filename: string; data: ArrayBuffer | Blob };

/** Parent window → iframe. */
export type HostToEditorMessage =
  /** Annotations in the current session draft that belong to this deck; the editor uses them to draw numbered markers. */
  | { type: 'editor:threads'; threads: EditorThread[] }
  /** Whether the comment box is open (when it is closed, the runtime clears the selection). */
  | { type: 'editor:compose-result'; requestId: string; opened: boolean }
  /** The comment box was closed (added or cancelled); the runtime ends this annotation. */
  | { type: 'editor:composer-closed'; requestId: string }
  /** Jump to the page where this annotation is. */
  | { type: 'editor:reveal'; id: string }
  /** Turn annotation mode on or off (the annotation switch on the tab bar). */
  | { type: 'editor:set-mode'; on: boolean }
  /** Before sending a message: publish the unsaved changes in the editor, then reply with `editor:flushed`. */
  | { type: 'editor:flush'; requestId: string }
  /** Reply to `editor:suggest-prompt`: whether the prompt was put in the input box (false when the tab does not belong to the session; the runtime then copies it to the clipboard instead). */
  | { type: 'editor:suggest-prompt-result'; requestId: string; ok: boolean }
  /** Reply to `editor:save-file`: `saved` means it was handed off, `declined` means the user cancelled in the save dialog, `failed` means it could not be saved. */
  | { type: 'editor:save-file-result'; requestId: string; outcome: SaveFileOutcome };

/** The parent window's result for saving an exported file (`editor:save-file-result`). */
export type SaveFileOutcome = 'saved' | 'declined' | 'failed';

const EDITOR_TYPES = new Set<EditorToHostMessage['type']>([
  'editor:ready',
  'editor:mode',
  'editor:compose',
  'editor:flushed',
  'editor:external-change',
  'editor:suggest-prompt',
  'editor:save-file',
]);
const HOST_TYPES = new Set<HostToEditorMessage['type']>([
  'editor:threads',
  'editor:compose-result',
  'editor:composer-closed',
  'editor:reveal',
  'editor:set-mode',
  'editor:flush',
  'editor:suggest-prompt-result',
  'editor:save-file-result',
]);
const SAVE_FILE_OUTCOMES = new Set<SaveFileOutcome>(['saved', 'declined', 'failed']);

/** Maximum number of characters in an `editor:suggest-prompt` prompt (the runtime's fix prompts are much shorter than this). */
export const SUGGESTED_PROMPT_MAX = 20_000;

/** Maximum size in bytes of an `editor:save-file` file (a whole design canvas's HTML, with the inlined canvas runtime and assets, is much smaller than this). */
export const SAVE_FILE_MAX_BYTES = 512 * 1024 * 1024;

/**
 * File extensions the parent window will save, with their file types: those the design canvas runtime is allowed to hand to the host for saving (packages/design-runtime/src/export/downloads.tsx).
 * The rest of the file name is cleaned up by the parent window (`saveFileName`). Browser downloads assign the type by extension, and the type the runtime hands over may not be correct.
 */
export const SAVE_FILE_TYPES: Readonly<Record<string, string>> = {
  gif: 'image/gif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain',
  json: 'application/json',
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  epub: 'application/epub+zip',
  csv: 'text/csv',
  ttf: 'font/ttf',
  html: 'text/html',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

/** Removes characters that cannot appear in a local file name (path separators, Windows reserved characters, control characters), and leading and trailing whitespace and dots. Returns null when the extension is not in the allowed set. */
export function saveFileName(name: string): string | null {
  // eslint-disable-next-line no-control-regex -- strip control characters
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '');
  const dot = cleaned.lastIndexOf('.');
  if (dot <= 0 || !Object.hasOwn(SAVE_FILE_TYPES, cleaned.slice(dot + 1).toLowerCase())) return null;
  return cleaned.length <= 255 ? cleaned : null;
}

const isFileData = (value: unknown): value is ArrayBuffer | Blob =>
  value instanceof ArrayBuffer ? value.byteLength <= SAVE_FILE_MAX_BYTES : typeof Blob === 'function' && value instanceof Blob && value.size <= SAVE_FILE_MAX_BYTES;

/** The editor address carries a query parameter with CucCut's UI language (the value is a `Locale`, such as `zh-Hans`); annotation position labels are written in that language (editor/comment-labels.ts). */
export const EDITOR_LOCALE_PARAM = 'lang';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.length <= max;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** Maximum length of a design system section id (the built-in sections and `family-<name>`). */
const SECTION_MAX = 200;
const isSection = (value: unknown): value is string | undefined => value === undefined || isString(value, SECTION_MAX);

/** Whether data received by the parent window is a valid editor message (field types and lengths are checked; the iframe is not trusted). */
export function readEditorMessage(data: unknown): EditorToHostMessage | null {
  if (!isRecord(data) || !EDITOR_TYPES.has(data.type as EditorToHostMessage['type'])) return null;
  switch (data.type) {
    case 'editor:ready':
      return typeof data.canEdit === 'boolean' ? { type: data.type, canEdit: data.canEdit } : null;
    case 'editor:mode':
      return typeof data.on === 'boolean' ? { type: data.type, on: data.on } : null;
    case 'editor:compose': {
      const point = data.point;
      if (!isString(data.requestId, 100) || !isString(data.anchor) || !isString(data.label, 1000)) return null;
      if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;
      if (data.detail !== undefined && !isString(data.detail)) return null;
      if (data.area !== undefined && typeof data.area !== 'boolean') return null;
      if (!isSection(data.section)) return null;
      return {
        type: data.type,
        requestId: data.requestId,
        anchor: data.anchor,
        point: { x: point.x, y: point.y },
        label: data.label,
        ...(data.detail !== undefined ? { detail: data.detail as string } : {}),
        ...(data.area === true ? { area: true } : {}),
        ...(data.section ? { section: data.section } : {}),
      };
    }
    case 'editor:flushed':
      return isString(data.requestId, 100) && typeof data.saved === 'boolean' ? { type: data.type, requestId: data.requestId, saved: data.saved } : null;
    case 'editor:external-change':
      return Array.isArray(data.paths) && data.paths.length <= 1000 && data.paths.every(p => isString(p, 1000))
        ? { type: data.type, paths: data.paths as string[] }
        : null;
    case 'editor:suggest-prompt':
      return isString(data.requestId, 100) && isString(data.prompt, SUGGESTED_PROMPT_MAX) && data.prompt.trim() !== ''
        ? { type: data.type, requestId: data.requestId, prompt: data.prompt }
        : null;
    case 'editor:save-file':
      return isString(data.requestId, 100) && isString(data.filename, 1000) && data.filename.trim() !== '' && isFileData(data.data)
        ? { type: data.type, requestId: data.requestId, filename: data.filename, data: data.data }
        : null;
    default:
      return null;
  }
}

/** Whether data received by the editor is a valid parent window message. */
export function readHostMessage(data: unknown): HostToEditorMessage | null {
  if (!isRecord(data) || !HOST_TYPES.has(data.type as HostToEditorMessage['type'])) return null;
  switch (data.type) {
    case 'editor:threads':
      return Array.isArray(data.threads) &&
        data.threads.every(t => isRecord(t) && isString(t.id, 100) && isString(t.anchor) && isFiniteNumber(t.n) && isSection(t.section))
        ? {
            type: data.type,
            threads: (data.threads as EditorThread[]).map(t => ({ id: t.id, anchor: t.anchor, n: t.n, ...(t.section ? { section: t.section } : {}) })),
          }
        : null;
    case 'editor:compose-result':
      return isString(data.requestId, 100) && typeof data.opened === 'boolean' ? { type: data.type, requestId: data.requestId, opened: data.opened } : null;
    case 'editor:composer-closed':
    case 'editor:flush':
      return isString(data.requestId, 100) ? { type: data.type, requestId: data.requestId } : null;
    case 'editor:reveal':
      return isString(data.id, 100) ? { type: data.type, id: data.id } : null;
    case 'editor:set-mode':
      return typeof data.on === 'boolean' ? { type: data.type, on: data.on } : null;
    case 'editor:suggest-prompt-result':
      return isString(data.requestId, 100) && typeof data.ok === 'boolean' ? { type: data.type, requestId: data.requestId, ok: data.ok } : null;
    case 'editor:save-file-result':
      return isString(data.requestId, 100) && SAVE_FILE_OUTCOMES.has(data.outcome as SaveFileOutcome)
        ? { type: data.type, requestId: data.requestId, outcome: data.outcome as SaveFileOutcome }
        : null;
    default:
      return null;
  }
}
