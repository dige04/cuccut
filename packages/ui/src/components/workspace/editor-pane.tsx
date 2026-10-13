import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getLocale, type FileTarget, type Id, type Locale, type SpaceEntry } from '@cuccut/protocol';
import { EDITOR_LOCALE_PARAM, readEditorMessage, type EditorPoint, type EditorThread, type EditorToHostMessage, type HostToEditorMessage } from '@cuccut/slides/editor-messages';
import {
  ActionButton,
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  ProgressCircle,
  Text,
  TextArea,
  ToastQueue,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Comment from '@react-spectrum/s2/icons/Comment';
import Download from '@react-spectrum/s2/icons/Download';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { WORKSPACE_COPY } from '../../copy.ts';
import { mergeDraft } from '../../model/ai-tools-handoff.ts';
import {
  exportCommand,
  FRAME_CHROME_POKE,
  readFrameChromeMessage,
  type DesignExportFormat,
  type DesignExportOption,
  type FrameChromeMessage,
} from '../../model/design-exports.ts';
import { markdownAbsolutePath } from '../../model/markdown-file-link.ts';
import { entryPath, KIND_LABEL } from '../../model/space.ts';
import { entryOfTarget, itemKey, workspaceTitle, type EditorKind } from '../../model/workspace.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { registerEditorFlush, useEditorReveal } from '../../state/editor-bridge.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { saveEditorFile, type EditorExportCopy } from './editor-save-file.ts';

export type { EditorExportCopy } from './editor-save-file.ts';

const pane = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, minHeight: 0 });
/** The header looks the same as a single-file tab (prototype home-workspace.css `.home-resource__bar`). */
const bar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  minHeight: 56,
  boxSizing: 'border-box',
  paddingX: 16,
  paddingY: 12,
  borderBottomWidth: 2,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-100',
});
const headText = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const name = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900', overflowWrap: 'anywhere' });
const meta = style({ font: 'ui-sm', color: 'gray-600' });
/** The editor brings its own page list, canvas and toolbar, filling the tab's content area; the note box's anchors are overlaid using the iframe's viewport coordinates. */
const stage = style({ position: 'relative', display: 'flex', flexGrow: 1, minHeight: 0, minWidth: 0 });
const frame = style({ display: 'block', flexGrow: 1, minHeight: 0, width: 'full', borderWidth: 0, backgroundColor: 'gray-25' });
const anchor = style({ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' });
/** The note box (prototype home-slides.css `.home-slides__form`, home-design.css `.home-design__form`). */
const form = style({ display: 'flex', flexDirection: 'column', gap: 12, width: 320, maxWidth: 'full' });
const formLabel = style({ font: 'ui-sm', color: 'gray-700', margin: 0, overflowWrap: 'anywhere' });
const formField = style({ width: 'full' });
const formButtons = style({ display: 'flex', justifyContent: 'end', gap: 8 });
const centered = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  flexGrow: 1,
  padding: 24,
  font: 'ui',
  color: 'gray-600',
  textAlign: 'center',
});
const notice = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const footer = style({
  flexShrink: 0,
  paddingX: 16,
  paddingY: 8,
  font: 'ui-xs',
  color: 'gray-600',
  overflowWrap: 'anywhere',
  borderTopWidth: 1,
  borderBottomWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-100',
});

/** Editor tab copy: slides use `SLIDES`, design uses `DESIGN`, the design system uses `DESIGN_SYSTEM`; the key names are the same. */
export interface EditorPaneCopy {
  paneLabel(name: string): string;
  frameTitle(name: string): string;
  opening: string;
  unavailableTitle: string;
  unavailableBody: string;
  openFailed(reason: string): string;
}

/** Annotation copy (slides `SLIDES`, design `DESIGN`, design system `DESIGN_SYSTEM`). */
export interface EditorAnnotationCopy {
  annotate: string;
  noteLabel: string;
  notePlaceholder: string;
  addToChat: string;
  cancel: string;
  token(n: number): string;
  added(token: string): string;
  tooLong(max: number): string;
  noConversation: string;
}

/** What a tab needs from the open result: the editor address, whether this machine has an editor, the title, and counts such as “N pages” and “N artboards”. */
export interface EditorOpened {
  url: string;
  editorAvailable: boolean;
  title: string;
  count: number | null;
  /** Extra query parameters added to the address on load (the design system's `path`, docs/design/canvas §10.4): computed at open time and not reloaded with other data afterwards. */
  params?: Readonly<Record<string, string>>;
}

/** One note received from the editor (the position is given by the editor through `editor:compose`). */
export interface EditorCompose {
  anchor: string;
  label: string;
  detail?: string;
  area?: boolean;
  /** The section where the target is in the design system (docs/design/canvas §10.6). */
  section?: string;
}

/**
 * The annotation pieces (slides docs/design/slides §8.2, design docs/design/canvas §8.2, design system §10.6). An editor tab without this block does not show the “标注” switch or the note box; when the editor asks to show the note box, it replies `opened: false`, and it does not hand over number markers.
 */
export interface EditorAnnotations {
  copy: EditorAnnotationCopy;
  /** In the note box and the saved position label, the editor's `label` with the document name in front (the design system writes 设计系统“X” › …); when not given, the editor's own label is used. */
  label?(label: string, title: string): string;
  /** The character limit for a note. */
  textLimit: number;
  /** The number markers in the draft that belong to this document (subscribes to this session's draft; the spec for each tab kind is unchanged, and so is the hook order). */
  useThreads(conversationId: Id | null, target: FileTarget): EditorThread[];
  /** Accepts one note; when it cannot be added, returns the message to show. Returns null on success. */
  add(conversationId: Id, target: FileTarget, compose: EditorCompose, text: string): string | null;
  /** The number of items in this session's draft after adding (written in the hint). */
  draftCount(conversationId: Id): number;
}

/** The part specific to this kind of editor tab; the rest (iframe, message exchange, saving before sending, jumping, note box) lives in `EditorPane`. */
export interface EditorPaneKind {
  kind: EditorKind;
  icon: ReactNode;
  copy: EditorPaneCopy;
  open(runtime: RuntimeSession, target: FileTarget): Promise<EditorOpened>;
  /** The counts recorded on the Space entry (shown first before the open completes); a tab without counts (design system) does not write these two. */
  entryCount?(entry: SpaceEntry): number | null;
  countText?(n: number): string;
  /**
   * The address put in the iframe: `opened.url` plus the UI language. Returns null when it cannot be placed here (on Web, the design mockup cannot switch to another loopback hostname, docs/design/canvas §6.2); the tab then shows the `blocked` explanation.
   */
  frameUrl?(address: string): string | null;
  blocked?: { title: string; body: string };
  /** Annotation; a tab without this item cannot be annotated. */
  annotations?: EditorAnnotations;
  /**
   * Whole-document export (design mockup docs/design/canvas §8.3): asks the Runtime through its own frame protocol which formats it can export; the header shows an “export” menu. Files the editor hands over (`editor:save-file`) are also saved only by this kind of tab. A tab without this item replies `failed`.
   */
  exports?: EditorExportCopy;
}

type Opened = { key: string; result: EditorOpened } | { key: string; error: string };

/** The status the editor reports after loading; a `url` that does not match the current address is from the previous load and is discarded. */
interface EditorState {
  url: string;
  canEdit: boolean;
  /** Whether annotation mode is on (as the editor reports it). */
  mode: boolean;
}

/** The note box the editor asks the parent window to show. */
interface Compose extends EditorCompose {
  requestId: string;
  point: EditorPoint;
}

/** The upper limit for waiting on the editor to save before sending; once exceeded, it counts as not saved (sending still proceeds, and the caller shows a hint). */
const FLUSH_TIMEOUT_MS = 10_000;
/** Before jumping to a sent item, the time the editor is given to accept the temporary annotation (the Runtime only recognizes it after its next render). */
const REVEAL_DELAY_MS = 200;

/** The name of a format in the menu. */
const EXPORT_LABEL: Record<DesignExportFormat, (copy: EditorExportCopy) => string> = {
  html: (copy) => copy.exportHtml,
  pdf: (copy) => copy.exportPdf,
  png: (copy) => copy.exportPng,
};

/** The number marker for tabs without annotations: always empty. */
const NO_THREADS: EditorThread[] = [];
const useNoThreads = (): EditorThread[] => NO_THREADS;

/** The editor address carries the query parameters from the open result (`params`) and the UI language (`?lang=`); the editor writes annotation position labels in that language. */
export function editorUrl(address: string, locale: Locale, params?: Readonly<Record<string, string>>): string {
  const url = new URL(address, window.location.href);
  for (const [name, value] of Object.entries(params ?? {})) url.searchParams.set(name, value);
  url.searchParams.set(EDITOR_LOCALE_PARAM, locale);
  return url.href;
}

/**
 * The editor tab in the feature pane (slides docs/design/slides §8.1, design docs/design/canvas §8.1): the header is an icon, a title and a count; then the “annotations” switch, “show in Space”, and “show in folder”. The content is the editor's iframe, with its address from `slides.open` / `design.open`.
 * The grant in the address lives only in the Runtime's memory, so it is reopened on every mount, and on every connection (`connectionId` changes, including reconnects where no disconnect signal was received). It is also reopened on each connection: after a Runtime restart the address changes and the iframe reloads; without a restart it is the same address and does not reload.
 * When this machine has no built editor, the tab says it is unavailable and does not load the address. The address carries the UI language at open time (`?lang=`), which the editor uses for annotation position labels.
 * The design-system tab (docs/design/canvas §10) also uses this; its address additionally carries `?path=`, and its annotations (§10.6) carry one extra `section`.
 *
 * Annotations (§8.2) exchange messages with the editor through postMessage (`@cuccut/slides/editor-messages`, the same set for both editors): clicking an element or drawing a box in the editor opens a note box at that position here; “add to conversation” puts it into this session's draft; the draft items that belong to this document are handed back to the editor to draw number markers.
 * The prompt for “let the agent fix it” from the editor is put into this session's input box via `editor:suggest-prompt`.
 * Before a message is sent, `registerEditorFlush` makes the editor save; clicking an item in a sent message jumps to that position via `useEditorReveal`.
 */
export function EditorPane({ spec, target, conversationId, active }: { spec: EditorPaneKind; target: FileTarget; conversationId: Id | null; active: boolean }) {
  const runtime = useRuntime();
  const { copy, annotations: notes, exports: exportCopy } = spec;
  // Reopened on every connection (including quick reconnects where the disconnect was not yet shown): after a Runtime restart the grant and the address both change.
  const connectionId = useConnection((s) => (s.state.status === 'connected' ? s.state.connectionId : null));
  const go = useShell((s) => s.go);
  const entries = useSpace((s) => s.entries);
  const projects = useDirectory((s) => s.projects);
  const conversations = useDirectory((s) => s.conversations);
  const key = itemKey({ kind: spec.kind, target });
  const [opened, setOpened] = useState<Opened | null>(null);

  useEffect(() => {
    if (!connectionId) return;
    let live = true;
    spec.open(runtime, target).then(
      (result) => live && setOpened({ key, result }),
      (error: unknown) => live && setOpened({ key, error: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target is compared by key: swapping in a new object for the same document does not reopen it
  }, [runtime, key, connectionId]);

  const current = opened?.key === key ? opened : null;
  const result = current && 'result' in current ? current.result : null;
  const entry = entryOfTarget(entries, target);
  const title = result?.title || entry?.name || workspaceTitle({ kind: spec.kind, target });
  const count = result?.count ?? (entry && spec.entryCount ? spec.entryCount(entry) : null);
  const metadata = [KIND_LABEL[spec.kind], count === null || !spec.countText ? null : spec.countText(count)].filter(Boolean).join(' · ');
  const conversation = 'conversationId' in target ? conversations.find((c) => c.id === target.conversationId) : undefined;
  const projectId = 'projectId' in target ? target.projectId : (entry?.source.projectId ?? conversation?.projectId ?? null);
  const root = 'projectId' in target ? projects.find((p) => p.id === target.projectId)?.path : conversation?.cwd;
  const absolute = entry ? entryPath(entry, { projects, conversations }) : 'path' in target ? markdownAbsolutePath(target.path, root ?? null) : null;

  // —— Exchanges with the editor (§8.2) ——
  // The address carries the UI language at open time, and annotation position labels are written in it. Changing the language afterwards does not reload (that would lose unsaved edits); the change is picked up the next time it is opened.
  const [locale] = useState(getLocale);
  const address = result?.editorAvailable ? (spec.frameUrl ? spec.frameUrl(result.url) : result.url) : null;
  const url = address ? editorUrl(address, locale, result?.params) : null;
  const blocked = !!result?.editorAvailable && !address;
  const origin = url ? new URL(url, window.location.href).origin : null;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const ready = !!url && editor?.url === url;
  const [compose, setCompose] = useState<(Compose & { url: string }) | null>(null);
  const composing = ready && compose?.url === url ? compose : null;
  // The spec does not change, so the hooks called here do not change either.
  const useThreads = notes?.useThreads ?? useNoThreads;
  const threads = useThreads(conversationId, target);
  const threadsKey = threads.map((t) => `${t.id}@${t.n}`).join(' ');
  const reveal = useEditorReveal((s) => s.reveals[key]);
  /** The times waiting for the editor to reply `editor:flushed`. */
  const flushes = useRef(new Map<string, (saved: boolean) => void>());
  /** A temporary item handed to the editor when jumping to a sent item: `n` is 0, so the editor does not draw its marker. */
  const extra = useRef<EditorThread | null>(null);
  /** The export formats the Runtime reports (§8.3); a `url` that does not match the current address is from the previous load. */
  const [exportState, setExportState] = useState<{ url: string; options: DesignExportOption[] } | null>(null);
  const exportOptions = ready && exportCopy && exportState?.url === url ? exportState.options : [];

  const post = (message: HostToEditorMessage | typeof FRAME_CHROME_POKE | ReturnType<typeof exportCommand>) => {
    if (origin) frameRef.current?.contentWindow?.postMessage(message, origin);
  };
  /** Asks the Runtime to export one format: with several artboards, the editor first lets the user choose; when done, it is handed back through `editor:save-file` to be saved. */
  const requestExport = (format: DesignExportFormat) => {
    const option = exportOptions.find((o) => o.format === format);
    if (option && !option.disabled) post(exportCommand(option, crypto.randomUUID()));
  };
  const postThreads = (list: EditorThread[]) => post({ type: 'editor:threads', threads: extra.current ? [...list, extra.current] : list });
  const closeCompose = () => {
    if (!compose) return;
    setCompose(null);
    post({ type: 'editor:composer-closed', requestId: compose.requestId });
  };

  /** Receives a message from the editor; set to the latest on every render, and the listener is attached only once. */
  const receive = useRef<(message: EditorToHostMessage) => void>(() => {});
  receive.current = (message) => {
    if (!url) return;
    switch (message.type) {
      case 'editor:ready':
        setEditor({ url, canEdit: message.canEdit, mode: false });
        setCompose(null);
        // The Runtime's hello may come before the parent window's listener, so it is poked again after loading to make it report the exportable formats.
        if (exportCopy) post(FRAME_CHROME_POKE);
        return;
      case 'editor:mode':
        setEditor((e) => (e?.url === url ? { ...e, mode: message.on } : e));
        if (!message.on) closeCompose();
        return;
      case 'editor:compose': {
        const { requestId, anchor: at, point, label, detail, area, section } = message;
        if (!notes || !conversationId || !active) {
          if (notes && !conversationId) ToastQueue.negative(notes.copy.noConversation, { timeout: 5000 });
          post({ type: 'editor:compose-result', requestId, opened: false });
          return;
        }
        // Only one note box is open at a time: the previous one counts as closed.
        if (compose) post({ type: 'editor:composer-closed', requestId: compose.requestId });
        setCompose({
          url,
          requestId,
          anchor: at,
          point,
          label: notes.label ? notes.label(label, title) : label,
          ...(detail ? { detail } : {}),
          ...(area ? { area } : {}),
          ...(section ? { section } : {}),
        });
        post({ type: 'editor:compose-result', requestId, opened: true });
        return;
      }
      case 'editor:flushed':
        flushes.current.get(message.requestId)?.(message.saved);
        return;
      case 'editor:external-change':
        // The editor reloads itself; nothing to do here.
        return;
      case 'editor:suggest-prompt': {
        // “let the agent fix it” and similar (§4): the prompt is put into this session's input box, appended after the existing text, for the user to send.
        // When the tab does not belong to a session, returns false; the editor then copies the prompt to the clipboard instead.
        if (conversationId) {
          const shell = useShell.getState();
          shell.setDraft(conversationId, mergeDraft(shell.drafts[conversationId], message.prompt));
        }
        post({ type: 'editor:suggest-prompt-result', requestId: message.requestId, ok: !!conversationId });
        return;
      }
      case 'editor:save-file': {
        const { requestId } = message;
        if (!exportCopy) {
          post({ type: 'editor:save-file-result', requestId, outcome: 'failed' });
          return;
        }
        void saveEditorFile(runtime.host, message, exportCopy).then((outcome) => post({ type: 'editor:save-file-result', requestId, outcome }));
        return;
      }
    }
  };

  /** The Runtime's own frame protocol (§8.3): poked on hello, after which it reports the exportable formats. Only tabs that can export respond. */
  const receiveChrome = useRef<(message: FrameChromeMessage) => void>(() => {});
  receiveChrome.current = (message) => {
    if (!url || !exportCopy) return;
    if (message.kind === 'hello') post(FRAME_CHROME_POKE);
    else setExportState({ url, options: message.exports });
  };

  useEffect(() => {
    if (!url) return;
    const handle = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const message = readEditorMessage(event.data);
      if (message) {
        receive.current(message);
        return;
      }
      const chrome = readFrameChromeMessage(event.data);
      if (chrome) receiveChrome.current(chrome);
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [url]);

  // The annotations in the draft that belong to this document are handed to the editor to draw number markers; the editor must be given them again after each load.
  const latestThreads = useRef(threads);
  latestThreads.current = threads;
  useEffect(() => {
    if (ready && notes) postThreads(latestThreads.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compared by number and id; changes to other sessions or other documents in the draft do not resend
  }, [ready, editor, threadsKey]);

  // Lets the editor save its changes before a message is sent (a read-only editor has nothing to save); when the save fails, the hint names this document.
  const canEdit = ready && editor.canEdit;
  const latestTitle = useRef(title);
  latestTitle.current = title;
  useEffect(() => {
    if (!canEdit) return;
    const pending = flushes.current;
    const unregister = registerEditorFlush(key, {
      flush: () =>
        new Promise<boolean>((resolve) => {
          const requestId = crypto.randomUUID();
          const settle = (saved: boolean) => {
            window.clearTimeout(timer);
            pending.delete(requestId);
            resolve(saved);
          };
          const timer = window.setTimeout(() => settle(false), FLUSH_TIMEOUT_MS);
          pending.set(requestId, settle);
          post({ type: 'editor:flush', requestId });
        }),
      name: () => latestTitle.current,
    });
    return () => {
      unregister();
      for (const settle of [...pending.values()]) settle(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- post changes only with the address
  }, [canEdit, key, url]);

  // When an item in a sent message is clicked: the editor only recognizes the annotations it holds, so one not in the draft is handed to it temporarily, and the jump happens after the next render.
  useEffect(() => {
    if (!ready || !reveal) return;
    useEditorReveal.getState().take(key, reveal.seq);
    const known = latestThreads.current.some((t) => t.id === reveal.id);
    extra.current = known ? null : { id: reveal.id, anchor: reveal.anchor, n: 0, ...(reveal.section ? { section: reveal.section } : {}) };
    postThreads(latestThreads.current);
    // Not cancelled in cleanup: after `take`, a change of reveal triggers cleanup; when the tab is unmounted the iframe is gone, so post simply has no effect.
    window.setTimeout(() => {
      post({ type: 'editor:reveal', id: reveal.id });
      if (extra.current?.id !== reveal.id) return;
      extra.current = null;
      postThreads(latestThreads.current);
    }, REVEAL_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jumps once only, when the request arrives and after the editor has loaded
  }, [ready, reveal]);

  // Closes the note box when the tab is switched away.
  useEffect(() => {
    if (!active) closeCompose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only watches for switching away
  }, [active]);

  const add = (text: string) => {
    if (!notes || !composing || !conversationId) return;
    const { anchor: at, label, detail, area, section } = composing;
    const error = notes.add(
      conversationId,
      target,
      { anchor: at, label, ...(detail ? { detail } : {}), ...(area ? { area } : {}), ...(section ? { section } : {}) },
      text,
    );
    if (error) {
      ToastQueue.negative(error, { timeout: 5000 });
      return;
    }
    closeCompose();
    ToastQueue.positive(notes.copy.added(notes.copy.token(notes.draftCount(conversationId))), { timeout: 4000 });
  };

  return (
    <section className={pane} aria-label={copy.paneLabel(title)}>
      <header className={bar}>
        {spec.icon}
        <div className={headText}>
          <strong className={name}>{title}</strong>
          <span className={meta}>{metadata}</span>
        </div>
        {ready && notes ? (
          <ToggleButton isSelected={editor.mode} onChange={(on) => post({ type: 'editor:set-mode', on })}>
            <Comment />
            <Text>{notes.copy.annotate}</Text>
          </ToggleButton>
        ) : null}
        {exportCopy && exportOptions.length > 0 ? (
          <MenuTrigger>
            <ActionButton>
              <Download />
              <Text>{exportCopy.exportMenu}</Text>
            </ActionButton>
            <Menu
              aria-label={exportCopy.exportMenu}
              disabledKeys={exportOptions.filter((o) => o.disabled).map((o) => o.format)}
              onAction={(key) => requestExport(key as DesignExportFormat)}>
              {exportOptions.map((o) => (
                <MenuItem key={o.format} id={o.format}>
                  {EXPORT_LABEL[o.format](exportCopy)}
                </MenuItem>
              ))}
            </Menu>
          </MenuTrigger>
        ) : null}
        <ActionButton isQuiet onPress={() => go({ tab: 'space', category: 'all', projectId })}>
          {WORKSPACE_COPY.showInSpace}
        </ActionButton>
        {absolute ? (
          <TooltipTrigger>
            <ActionButton isQuiet aria-label={WORKSPACE_COPY.reveal} onPress={() => void runtime.host.revealPath(absolute)}>
              <OpenIn />
            </ActionButton>
            <Tooltip>{WORKSPACE_COPY.reveal}</Tooltip>
          </TooltipTrigger>
        ) : null}
      </header>
      {!current ? (
        <div className={centered}>
          <ProgressCircle isIndeterminate aria-label={copy.opening} />
          <span>{copy.opening}</span>
        </div>
      ) : 'error' in current ? (
        <div className={centered} role="alert">
          <AlertTriangle />
          <span>{copy.openFailed(current.error)}</span>
        </div>
      ) : !current.result.editorAvailable ? (
        <div className={centered}>
          <span className={notice}>{copy.unavailableTitle}</span>
          <span>{copy.unavailableBody}</span>
        </div>
      ) : blocked ? (
        <div className={centered}>
          <span className={notice}>{spec.blocked?.title ?? copy.unavailableTitle}</span>
          <span>{spec.blocked?.body ?? copy.unavailableBody}</span>
        </div>
      ) : (
        <div className={stage}>
          <iframe
            ref={frameRef}
            className={frame}
            src={url ?? undefined}
            title={copy.frameTitle(title)}
            allow="fullscreen; clipboard-read; clipboard-write"
          />
          {notes ? (
            <>
              <span
                ref={anchorRef}
                className={anchor}
                style={{ left: Math.max(0, composing?.point.x ?? 0), top: Math.max(0, composing?.point.y ?? 0) }}
              />
              <Popover
                triggerRef={anchorRef}
                isOpen={!!composing}
                onOpenChange={(open) => {
                  if (!open) closeCompose();
                }}
                placement="bottom"
                padding="default"
                aria-label={notes.copy.noteLabel}>
                {composing ? (
                  <NoteForm key={composing.requestId} copy={notes.copy} limit={notes.textLimit} label={composing.label} onAdd={add} onCancel={closeCompose} />
                ) : null}
              </Popover>
            </>
          ) : null}
        </div>
      )}
      <footer className={footer}>{absolute ?? ('path' in target ? target.path : '')}</footer>
    </section>
  );
}

/**
 * The note box (§8.2 step 3, ported from the prototype's home-slides.jsx `SlideNoteForm` and home-design.jsx `DesignNoteForm`):
 * the position is shown above, with one input box, “cancel” and “add to conversation”; ⌘/Ctrl+Enter adds.
 */
function NoteForm({
  copy,
  limit,
  label,
  onAdd,
  onCancel,
}: {
  copy: EditorAnnotationCopy;
  limit: number;
  label: string;
  onAdd: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const over = text.trim().length > limit;
  const submit = () => {
    if (text.trim() && !over) onAdd(text);
  };
  return (
    <div
      className={form}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          submit();
        }
      }}>
      <p className={formLabel}>{label}</p>
      <TextArea
        aria-label={copy.noteLabel}
        placeholder={copy.notePlaceholder}
        value={text}
        onChange={setText}
        autoFocus
        isInvalid={over}
        errorMessage={copy.tooLong(limit)}
        styles={formField}
      />
      <div className={formButtons}>
        <Button variant="secondary" onPress={onCancel}>
          {copy.cancel}
        </Button>
        <Button variant="accent" isDisabled={!text.trim() || over} onPress={submit}>
          {copy.addToChat}
        </Button>
      </div>
    </div>
  );
}
