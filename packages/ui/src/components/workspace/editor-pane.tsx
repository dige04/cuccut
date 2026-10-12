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
/** 头部与单文件标签同一个样子（原型 home-workspace.css `.home-resource__bar`）。 */
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
/** 编辑器自带页面列表、画布与工具栏，铺满标签的内容区；批注框的锚点按 iframe 视口坐标叠在上面。 */
const stage = style({ position: 'relative', display: 'flex', flexGrow: 1, minHeight: 0, minWidth: 0 });
const frame = style({ display: 'block', flexGrow: 1, minHeight: 0, width: 'full', borderWidth: 0, backgroundColor: 'gray-25' });
const anchor = style({ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' });
/** 批注框（原型 home-slides.css `.home-slides__form`、home-design.css `.home-design__form`）。 */
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

/** 编辑器标签的文案：幻灯片用 `SLIDES`，设计稿用 `DESIGN`，设计系统用 `DESIGN_SYSTEM`，键名相同。 */
export interface EditorPaneCopy {
  paneLabel(name: string): string;
  frameTitle(name: string): string;
  opening: string;
  unavailableTitle: string;
  unavailableBody: string;
  openFailed(reason: string): string;
}

/** 标注的文案（幻灯片 `SLIDES`、设计稿 `DESIGN`、设计系统 `DESIGN_SYSTEM`）。 */
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

/** 打开的结果里标签要用的几样：编辑器地址、这台机器有没有编辑器、标题与「N 页」「N 个画板」这类计数。 */
export interface EditorOpened {
  url: string;
  editorAvailable: boolean;
  title: string;
  count: number | null;
  /** 加载时另加在地址上的查询参数（设计系统的 `path`，docs/design/canvas §10.4）；打开那一刻算好，之后不随别的数据重新载入。 */
  params?: Readonly<Record<string, string>>;
}

/** 批注框收下的一条（编辑器经 `editor:compose` 给的位置）。 */
export interface EditorCompose {
  anchor: string;
  label: string;
  detail?: string;
  area?: boolean;
  /** 设计系统里目标所在的章节（docs/design/canvas §10.6）。 */
  section?: string;
}

/**
 * 标注那几样（幻灯片 docs/design/slides §8.2、设计稿 docs/design/canvas §8.2、设计系统 §10.6）。没有这一块的编辑器标签
 * 不显示「标注」开关与批注框，编辑器要弹批注框时回 `opened: false`，也不交编号标记。
 */
export interface EditorAnnotations {
  copy: EditorAnnotationCopy;
  /** 批注框里与存下的位置标签：编辑器给的 `label` 前面加上是哪份文档（设计系统写「设计系统「X」 › …」）；不给时照编辑器的。 */
  label?(label: string, title: string): string;
  /** 批注的字数上限。 */
  textLimit: number;
  /** 草稿里属于这份文档的编号标记（订阅这个会话的草稿；每种标签的 spec 不变，hook 的顺序也不变）。 */
  useThreads(conversationId: Id | null, target: FileTarget): EditorThread[];
  /** 收下一条批注；加不进去时返回要提示的话。成功时返回 null。 */
  add(conversationId: Id, target: FileTarget, compose: EditorCompose, text: string): string | null;
  /** 加进去之后这个会话草稿里的条数（提示里写）。 */
  draftCount(conversationId: Id): number;
}

/** 这一种编辑器标签各自的部分；其余（iframe、消息往来、发送前保存、跳转、批注框）都在 `EditorPane` 里。 */
export interface EditorPaneKind {
  kind: EditorKind;
  icon: ReactNode;
  copy: EditorPaneCopy;
  open(runtime: RuntimeSession, target: FileTarget): Promise<EditorOpened>;
  /** Space 条目里记着的计数（还没打开完时先显示）；没有计数的（设计系统）不写这两样。 */
  entryCount?(entry: SpaceEntry): number | null;
  countText?(n: number): string;
  /**
   * 放进 iframe 的地址：`opened.url` 加上界面语言。返回 null 表示这里放不了（设计稿在 Web 端换不到另一个回环主机名，
   * docs/design/canvas §6.2），标签显示 `blocked` 的说明。
   */
  frameUrl?(address: string): string | null;
  blocked?: { title: string; body: string };
  /** 标注；没有这一项的标签不能标注。 */
  annotations?: EditorAnnotations;
  /**
   * 整份导出（设计稿 docs/design/canvas §8.3）：经运行时自己的 frame 协议问它能导出哪些格式，头部显示「导出」菜单；
   * 编辑器交来的文件（`editor:save-file`）也只有这种标签保存。没有这一项的标签回 `failed`。
   */
  exports?: EditorExportCopy;
}

type Opened = { key: string; result: EditorOpened } | { key: string; error: string };

/** 编辑器载入后报的状态；`url` 对不上当前地址的是上一次载入的，作废。 */
interface EditorState {
  url: string;
  canEdit: boolean;
  /** 标注模式开着没有（以编辑器报的为准）。 */
  mode: boolean;
}

/** 编辑器请父窗口弹出的批注框。 */
interface Compose extends EditorCompose {
  requestId: string;
  point: EditorPoint;
}

/** 发送前等编辑器保存完的上限；过了算没保存成（发送照常，由调用方提示）。 */
const FLUSH_TIMEOUT_MS = 10_000;
/** 跳到已发送的一条前，编辑器收下临时那条标注要的时间（运行时下一次渲染后才认得它）。 */
const REVEAL_DELAY_MS = 200;

/** 菜单里一种格式的名字。 */
const EXPORT_LABEL: Record<DesignExportFormat, (copy: EditorExportCopy) => string> = {
  html: (copy) => copy.exportHtml,
  pdf: (copy) => copy.exportPdf,
  png: (copy) => copy.exportPng,
};

/** 没有标注的标签用的编号标记：一直是空的。 */
const NO_THREADS: EditorThread[] = [];
const useNoThreads = (): EditorThread[] => NO_THREADS;

/** 编辑器地址带上打开结果给的查询参数（`params`）与界面语言（`?lang=`）：编辑器按语言写标注位置标签。 */
export function editorUrl(address: string, locale: Locale, params?: Readonly<Record<string, string>>): string {
  const url = new URL(address, window.location.href);
  for (const [name, value] of Object.entries(params ?? {})) url.searchParams.set(name, value);
  url.searchParams.set(EDITOR_LOCALE_PARAM, locale);
  return url.href;
}

/**
 * 功能区的编辑器标签（幻灯片 docs/design/slides §8.1、设计稿 docs/design/canvas §8.1）：头部是图标、标题与计数，
 * 「标注」开关、「在 Space 中显示」与「在文件夹中显示」；内容是编辑器的 iframe，地址来自 `slides.open` / `design.open`。
 * 地址里的 grant 只在 Runtime 的内存里，所以每次挂上都重新打开，每次连上（`connectionId` 变了，含没收到断开信号就重连上的）
 * 也重新打开（Runtime 重启后地址会变，iframe 跟着重新载入；没重启时还是同一个地址，不重载）。
 * 这台机器没有构建编辑器时说明不可用，不加载地址。地址上带打开时的界面语言（`?lang=`），编辑器按它写标注位置标签。
 * 设计系统标签（docs/design/canvas §10）也用这里，地址另带 `?path=`；它的标注（§10.6）多带一个章节（`section`）。
 *
 * 标注（§8.2）经 postMessage 与编辑器往来（`@cuccut/slides/editor-messages`，两种编辑器同一套）：编辑器里点一个元素或框一块区域，
 * 这里在那个位置弹出批注框，「添加到对话」进这个会话的草稿；草稿里属于这份文档的交回编辑器画编号标记。
 * 编辑器里「让智能体修好」的提示经 `editor:suggest-prompt` 放进这个会话的输入框。
 * 发送消息前经 `registerEditorFlush` 让编辑器保存完；已发送消息里点一条，经 `useEditorReveal` 跳到那个位置。
 */
export function EditorPane({ spec, target, conversationId, active }: { spec: EditorPaneKind; target: FileTarget; conversationId: Id | null; active: boolean }) {
  const runtime = useRuntime();
  const { copy, annotations: notes, exports: exportCopy } = spec;
  // 每次连上（含断开后很快重连、界面没来得及显示断开的）都重新打开：Runtime 重启后 grant 与地址都换了
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target 按 key 比较：同一份文档换了对象不重开
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

  // —— 与编辑器的往来（§8.2）——
  // 地址带上打开时的界面语言，标注位置标签按它写；之后换语言不重新载入（会丢掉还没保存的改动），下次打开时跟上。
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
  // spec 不变，所以这里调的 hook 也不变
  const useThreads = notes?.useThreads ?? useNoThreads;
  const threads = useThreads(conversationId, target);
  const threadsKey = threads.map((t) => `${t.id}@${t.n}`).join(' ');
  const reveal = useEditorReveal((s) => s.reveals[key]);
  /** 等编辑器回 `editor:flushed` 的那几次。 */
  const flushes = useRef(new Map<string, (saved: boolean) => void>());
  /** 跳到已发送的那条时临时交给编辑器的一条：`n` 为 0，编辑器不画它的标记。 */
  const extra = useRef<EditorThread | null>(null);
  /** 运行时报的能导出的格式（§8.3）；`url` 对不上当前地址的是上一次载入的。 */
  const [exportState, setExportState] = useState<{ url: string; options: DesignExportOption[] } | null>(null);
  const exportOptions = ready && exportCopy && exportState?.url === url ? exportState.options : [];

  const post = (message: HostToEditorMessage | typeof FRAME_CHROME_POKE | ReturnType<typeof exportCommand>) => {
    if (origin) frameRef.current?.contentWindow?.postMessage(message, origin);
  };
  /** 请运行时导出一种格式：多画板时它在编辑器里先让人挑，做好后经 `editor:save-file` 交回来保存。 */
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

  /** 收到编辑器的一条消息；每次渲染换成最新的，监听只挂一次。 */
  const receive = useRef<(message: EditorToHostMessage) => void>(() => {});
  receive.current = (message) => {
    if (!url) return;
    switch (message.type) {
      case 'editor:ready':
        setEditor({ url, canEdit: message.canEdit, mode: false });
        setCompose(null);
        // 运行时的 hello 可能早于父窗口的监听，载入后再碰一次，让它报能导出的格式
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
        // 同一时间只开一个批注框：上一个当作关了
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
        // 编辑器自己重新载入，这里不用管
        return;
      case 'editor:suggest-prompt': {
        // 「让智能体修好」等（§4）：提示放进这个会话的输入框，接在已有的话后面，由用户自己发送。
        // 标签页不属于会话时回 false，编辑器改为把提示复制到剪贴板。
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

  /** 运行时自己的 frame 协议（§8.3）：hello 时碰一下，之后它报能导出的格式。只有能导出的标签理会。 */
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

  // 草稿里属于这份文档的标注交给编辑器画编号标记；编辑器每次载入后都要重新给
  const latestThreads = useRef(threads);
  latestThreads.current = threads;
  useEffect(() => {
    if (ready && notes) postThreads(latestThreads.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 按编号与 id 比较，草稿里别的会话、别的文档变了不重发
  }, [ready, editor, threadsKey]);

  // 发送消息前让编辑器把改动保存完（只读的编辑器没有要保存的）；没保存成时提示里写这份文档的名字
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- post 只随地址变
  }, [canEdit, key, url]);

  // 已发送消息里点了一条：编辑器只认得手上的标注，不在草稿里的先临时交给它，下一次渲染后再跳
  useEffect(() => {
    if (!ready || !reveal) return;
    useEditorReveal.getState().take(key, reveal.seq);
    const known = latestThreads.current.some((t) => t.id === reveal.id);
    extra.current = known ? null : { id: reveal.id, anchor: reveal.anchor, n: 0, ...(reveal.section ? { section: reveal.section } : {}) };
    postThreads(latestThreads.current);
    // 不在清理里取消：`take` 之后 reveal 变了会触发清理；标签卸下时 iframe 没了，post 自然落空
    window.setTimeout(() => {
      post({ type: 'editor:reveal', id: reveal.id });
      if (extra.current?.id !== reveal.id) return;
      extra.current = null;
      postThreads(latestThreads.current);
    }, REVEAL_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在要求来了、编辑器载入后跳一次
  }, [ready, reveal]);

  // 标签切走时关掉批注框
  useEffect(() => {
    if (!active) closeCompose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只看切走
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
 * 批注框（§8.2 第 3 步，移植自原型 home-slides.jsx `SlideNoteForm`、home-design.jsx `DesignNoteForm`）：
 * 上面是位置，一个输入框，「取消」与「添加到对话」；⌘/Ctrl+Enter 添加。
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
