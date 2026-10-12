/**
 * 设计系统标注的目标层（docs/design/canvas §10.6）：设计系统运行时不画批注层，只在 DOM 上标目标——
 * `data-comment-target` 标可点的那一块，`data-id`（它自己或最近的祖先）是锚点，`data-comment-name` 是原名
 * （editor/comment-anchors.ts，原名是 CucCut 加的），`data-uncommentable` 标不收批注的区域。原版的批注层归宿主；
 * 在 CucCut 里宿主的这一半在 iframe 里（父窗口跨源，读不到 DOM），就是这里。
 *
 * 这里扮演幻灯片运行时在标注桥（@cuccut/slides 的 comments-bridge.ts）另一头的角色：经 `comments.customAnchors`
 * 拿到控制器，消息、批注框的超时与编号标记的图层都用桥的。
 *
 * - 标注模式：父窗口的开关（`editor:set-mode`），或按 C（焦点不在输入框、对话框里，不带修饰键）开关，Esc 退出。
 *   开着时目标上是十字光标与虚线框，目标里面的控件不接指针（点组件预览里的按钮也是在标注那个组件）。
 * - 点一个目标：在点的位置弹批注框（`compose`），给人看的位置是「章节 › 种类 “名字”」，给模型看的带种类、名字、章节、
 *   所在文件与锚点；章节 id 另带上（`section`），跳回去时要先到那一章。不在目标上、或在不收批注的区域里的点击照常交给页面。
 * - 编号标记：标注模式开着时画在目标的右上角，随滚动、尺寸与内容变化重算；目标不在页面上、或被滚出了它的滚动容器就不画。
 * - 跳回一处（`reveal`）：派发 `cuccut:reveal-comment-target`，运行时照搜索里选中一条的路去那一章、等目标出现、滚到它并闪一下
 *   （files/ui/design-system-app.tsx 里 `CucCut:` 那段）。
 */
import type { EditorPoint } from '@cuccut/slides/editor-messages';
import type { CommentAnchorController, CommentAnchorHandlers, HostCommentsCapability } from '@cuccut/slides/editor';
import type { DesignSystemCommentLabels } from './comment-labels.ts';

/** 跳回一处时派发给运行时的事件（files/ui/design-system-app.tsx 监听）。`detail` 是 `{ target, section?, label? }`。 */
export const REVEAL_COMMENT_TARGET_EVENT = 'cuccut:reveal-comment-target';
/** 章节的 `data-testid` 前缀（files/ui/design-system-app.tsx：`ds-section-<章节 id>`，`aria-label` 是章节名）。 */
const SECTION_TEST_ID_PREFIX = 'ds-section-';
/** 位置标签里引用名字的长度；给模型的定位里长一些。 */
const LABEL_QUOTE_MAX = 40;
const DETAIL_QUOTE_MAX = 80;
/** 编号标记离目标右上角的距离（CSS 像素）。 */
const PIN_INSET = 14;
/** 标注模式开着时 `<html>` 上的属性，与点中的目标上的属性（样式见 `STYLE`）。 */
const MODE_ATTR = 'data-cuccut-annotating';
const PICKED_ATTR = 'data-cuccut-picked';
const STYLE_ID = 'cuccut-comment-targets';
/** 标注模式的样式；颜色与编号标记同一个 S2 蓝（comments-bridge.ts 的 domPinLayer）。嵌套的目标只框最里面那个。 */
const STYLE = `
html[${MODE_ATTR}] [data-comment-target] { cursor: crosshair; }
html[${MODE_ATTR}] [data-comment-target] * { pointer-events: none; }
html[${MODE_ATTR}] [data-comment-target] [data-comment-target] { pointer-events: auto; }
html[${MODE_ATTR}] [data-uncommentable], html[${MODE_ATTR}] [data-uncommentable] * { cursor: auto; }
html[${MODE_ATTR}] [data-comment-target]:hover:not(:has([data-comment-target]:hover)) { outline: 2px dashed #3B63FB; outline-offset: 2px; }
[${PICKED_ATTR}] { outline: 2px solid #3B63FB !important; outline-offset: 2px; }
`;

/** 给模型看的种类（英文），按前缀；`ds` 按名字。 */
const KINDS_EN: Readonly<Record<string, string>> = {
  token: 'Token',
  cgroup: 'Color group',
  tset: 'Type set',
  style: 'Text style',
  font: 'Font',
  knob: 'Style setting',
  editor: 'Style editor',
  picker: 'Color picker',
  prop: 'Component prop',
  props: 'Component props',
  cell: 'Color value',
  agroup: 'Asset group',
  asset: 'Asset',
  comp: 'Component',
  doc: 'Document',
  dialog: 'Dialog',
  lightbox: 'Asset preview',
  note: 'Usage note',
  page: 'Section',
};
const SPECIALS_EN: Readonly<Record<string, string>> = { cover: 'Cover', 'font-files': 'Font files' };

/** 点中的一个目标。`name` 是原名（`data-comment-name`，没有时取看得到的名字）；`section` 与 `sectionLabel` 是它所在的章节。 */
export interface CommentTarget {
  anchor: string;
  prefix: string;
  name: string;
  section?: string;
  sectionLabel?: string;
}

/** 锚点的前缀：第一个 `-` 之前（commentTargetId 拼的是 `<前缀>-<名字或哈希>`，前缀本身不含 `-`）。 */
export function prefixOf(anchor: string): string {
  const cut = anchor.indexOf('-');
  return cut < 0 ? anchor : anchor.slice(0, cut);
}

function quote(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** 章节里的内容写在哪：概览是 README.md，颜色、文字、间距、圆角、阴影与另加的 token 章都在 tokens.json，组件与素材各有目录。 */
function sectionFile(section: string | undefined): string | undefined {
  if (section === undefined) return undefined;
  if (section === 'readme') return 'README.md';
  if (section === 'components') return 'components/';
  if (section === 'assets') return 'assets/';
  if (['colors', 'type', 'spacing', 'corners', 'shadows'].includes(section) || section.startsWith('family-')) return 'tokens.json';
  return undefined;
}

/**
 * 这个目标写在设计系统的哪个文件里（skill design-system 的 references/format.md）：token、颜色组、文字样式、字体与样式设置
 * 都在 tokens.json，组件在 `components/<组件>/`（用法说明在它的 README.md），素材组在 `assets/<组>/`，素材与文档的名字就是
 * 它的路径，封面是 `components/Cover/preview.html`，字体文件在 `fonts/`，章节标题按章节。别的说不准，不写。
 */
export function fileOf(prefix: string, name: string, section?: string): string | undefined {
  switch (prefix) {
    case 'token':
    case 'cgroup':
    case 'cell':
    case 'picker':
    case 'tset':
    case 'style':
    case 'font':
    case 'knob':
    case 'editor':
      return 'tokens.json';
    case 'comp':
    case 'props':
      return name ? `components/${name}/` : undefined;
    case 'prop': {
      const comp = name.split('/')[0];
      return comp ? `components/${comp}/` : undefined;
    }
    case 'note':
      return name.startsWith('comp/') && name.length > 5 ? `components/${name.slice(5)}/README.md` : 'tokens.json';
    case 'agroup':
      return name ? `assets/${name}/` : undefined;
    case 'asset':
    case 'lightbox':
    case 'doc':
      return name || undefined;
    case 'ds':
      return name === 'cover' ? 'components/Cover/preview.html' : name === 'font-files' ? 'fonts/' : undefined;
    case 'page':
      return sectionFile(section);
    default:
      return undefined;
  }
}

/**
 * 一个目标的两种说法：`label` 给人看——「章节 › 种类 “名字”」，章节标题只到章节，`ds` 的几处按名字（封面、字体文件），
 * 不在章节里（弹层、对话框）时没有章节那一段；`detail` 给模型看——英文的种类与名字、章节 id、所在文件与锚点。
 */
export function describeTarget(target: CommentTarget, labels: DesignSystemCommentLabels): { label: string; detail: string } {
  const { anchor, prefix, name, section, sectionLabel } = target;
  const head = sectionLabel || section;
  const said = quote(name, LABEL_QUOTE_MAX);
  const special = prefix === 'ds' ? labels.special(name) : undefined;
  const what = prefix === 'ds' ? (special ?? labels.kind(prefix)) : said ? `${labels.kind(prefix)} ${labels.quote(said)}` : labels.kind(prefix);
  const label = prefix === 'page' && head ? head : head ? `${head} › ${what}` : what;
  const kindEn = prefix === 'ds' ? (SPECIALS_EN[name] ?? 'Design system element') : (KINDS_EN[prefix] ?? 'Element');
  const whatEn = prefix === 'ds' || prefix === 'page' || !name ? kindEn : `${kindEn} "${quote(name, DETAIL_QUOTE_MAX)}"`;
  const file = fileOf(prefix, name, section);
  const where = [section ? `in section ${section}` : null, file ? `(${file})` : null].filter(Boolean).join(' ');
  return { label, detail: `${whatEn}${where ? ` ${where}` : ''} · ${anchor}` };
}

/** 元素上看得到的名字：读屏名称，或里面第一个标题的字。 */
function visibleName(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const heading = el.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]');
  return (heading?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 点中的地方属于哪个目标：最近的 `[data-comment-target]`，锚点是它自己或最近的祖先的 `data-id`；在不收批注的区域里、
 * 或找不到锚点时为 null。名字依次取 `data-comment-name`（目标上、锚点元素上）、看得到的名字（锚点元素的、目标的、
 * 目标里的字）、锚点去掉前缀的部分。
 */
export function readTarget(start: EventTarget | null): CommentTarget | null {
  if (!start || typeof (start as Element).closest !== 'function') return null;
  const from = start as Element;
  const target = from.closest('[data-comment-target]');
  if (!target || from.closest('[data-uncommentable]')) return null;
  const holder = target.closest('[data-id]');
  const anchor = holder?.getAttribute('data-id');
  if (!holder || !anchor) return null;
  const prefix = prefixOf(anchor);
  const name =
    target.getAttribute('data-comment-name') ??
    holder.getAttribute('data-comment-name') ??
    (visibleName(holder) ||
      visibleName(target) ||
      (target.textContent ?? '').replace(/\s+/g, ' ').trim() ||
      anchor.slice(prefix.length + 1));
  const sectionEl = target.closest(`section[data-testid^="${SECTION_TEST_ID_PREFIX}"]`);
  const section = sectionEl?.getAttribute('data-testid')?.slice(SECTION_TEST_ID_PREFIX.length);
  const sectionLabel = sectionEl?.getAttribute('aria-label')?.trim();
  return { anchor, prefix, name, ...(section ? { section } : {}), ...(sectionLabel ? { sectionLabel } : {}) };
}

/** 页面上锚点为 `anchor` 的目标：带 `data-id` 的元素自己是目标就是它，否则是它里面锚点归它的第一个目标（分组卡片的标题行）。 */
export function findTarget(doc: Document, anchor: string): Element | null {
  for (const holder of doc.querySelectorAll('[data-id]')) {
    if (holder.getAttribute('data-id') !== anchor) continue;
    if (holder.hasAttribute('data-comment-target')) return holder;
    for (const inner of holder.querySelectorAll('[data-comment-target]')) if (inner.closest('[data-id]') === holder) return inner;
  }
  return null;
}

const clips = (overflow: string) => overflow !== '' && overflow !== 'visible';

/** 编号标记的位置（视口坐标）：目标的右上角往里一点；目标没有大小、或这一点被滚出视口或某一层滚动容器时为 null。 */
export function pinPoint(el: Element, win: Window & typeof globalThis): EditorPoint | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 && r.height <= 0) return null;
  const x = r.right - Math.min(PIN_INSET, r.width / 2);
  const y = r.top + Math.min(PIN_INSET, r.height / 2);
  if (x < 0 || y < 0 || x > win.innerWidth || y > win.innerHeight) return null;
  for (let up = el.parentElement; up && up !== el.ownerDocument.documentElement; up = up.parentElement) {
    const style = win.getComputedStyle(up);
    if (!clips(style.overflowX) && !clips(style.overflowY)) continue;
    const box = up.getBoundingClientRect();
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) return null;
  }
  return { x, y };
}

/** 键盘事件是不是在输入框、可编辑区域或对话框、菜单里（这些地方的 C 与 Esc 归它们）。 */
function inField(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (!el || typeof el.closest !== 'function') return false;
  if ((el as HTMLElement).isContentEditable) return true;
  return !!el.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]');
}

export interface CommentTargetsOptions {
  win: Window & typeof globalThis;
  comments: HostCommentsCapability;
  labels: DesignSystemCommentLabels;
}

/** 装上目标层；返回卸下的函数。 */
export function installCommentTargets({ win, comments, labels }: CommentTargetsOptions): () => void {
  const doc = win.document;
  let controller: CommentAnchorController | null = null;
  let disposed = false;
  let mode = false;
  let composing = false;
  let threads: { id: string; anchor: string; section?: string }[] = [];
  let picked: Element | null = null;
  let frame = 0;
  let resize: ResizeObserver | null = null;
  let mutations: MutationObserver | null = null;

  const pick = (el: Element | null) => {
    picked?.removeAttribute(PICKED_ATTR);
    picked = el;
    picked?.setAttribute(PICKED_ATTR, '');
  };
  const place = () => {
    frame = 0;
    if (!controller || !mode) return;
    const positions: Record<string, EditorPoint> = {};
    for (const t of threads) {
      const el = findTarget(doc, t.anchor);
      const at = el ? pinPoint(el, win) : null;
      if (at) positions[t.id] = { x: at.x + win.scrollX, y: at.y + win.scrollY };
    }
    controller.placed(positions);
  };
  const schedule = () => {
    if (!frame && !disposed) frame = win.requestAnimationFrame(place);
  };
  const watch = (on: boolean) => {
    if (on) {
      win.addEventListener('scroll', schedule, { capture: true, passive: true });
      win.addEventListener('resize', schedule);
      if (typeof win.ResizeObserver === 'function') {
        resize = new win.ResizeObserver(schedule);
        resize.observe(doc.documentElement);
      }
      if (typeof win.MutationObserver === 'function') {
        mutations = new win.MutationObserver(schedule);
        mutations.observe(doc.body, { childList: true, subtree: true });
      }
      return;
    }
    win.removeEventListener('scroll', schedule, { capture: true });
    win.removeEventListener('resize', schedule);
    resize?.disconnect();
    mutations?.disconnect();
    resize = mutations = null;
  };

  const handlers: CommentAnchorHandlers = {
    mode(on) {
      if (mode === on) return;
      mode = on;
      doc.documentElement.toggleAttribute(MODE_ATTR, on);
      watch(on);
      if (on) schedule();
      else {
        pick(null);
        controller?.placed({});
      }
    },
    threads(list) {
      threads = list.map(t => ({ id: t.id, anchor: t.anchor, ...(t.section ? { section: t.section } : {}) }));
      schedule();
    },
    composing(on) {
      composing = on;
      if (!on) pick(null);
    },
    move: async () => null,
    // C 与 Esc 由这里绑（见下），不让桥另绑
    hotkey: false,
    reveal(id) {
      const thread = threads.find(t => t.id === id);
      if (!thread) return;
      const el = findTarget(doc, thread.anchor);
      const found = el ? readTarget(el) : null;
      const section = thread.section ?? found?.section;
      const detail = { target: thread.anchor, ...(section ? { section } : {}), ...(found?.name ? { label: found.name } : {}) };
      win.dispatchEvent(new win.CustomEvent(REVEAL_COMMENT_TARGET_EVENT, { detail }));
    },
  };

  /** 标注模式下按在目标上：页面不接（按下、抬起、点击都拦），点击时弹批注框。 */
  const press = (event: MouseEvent) => {
    if (!mode || !controller || event.button !== 0) return;
    const target = readTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.type !== 'click') return;
    const el = (event.target as Element).closest('[data-comment-target]');
    pick(el);
    const { label, detail } = describeTarget(target, labels);
    const point = { x: event.clientX + win.scrollX, y: event.clientY + win.scrollY };
    void controller.compose(target.anchor, point, { label, detail, ...(target.section ? { section: target.section } : {}) }).then(({ opened }) => {
      if (!opened && picked === el) pick(null);
    });
  };
  const PRESS_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick'] as const;
  const key = (event: KeyboardEvent) => {
    if (!controller || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || inField(event.target)) return;
    if (event.key === 'Escape' && mode && !composing) controller.exitMode();
    else if ((event.key === 'c' || event.key === 'C') && !event.shiftKey && !composing) {
      if (mode) controller.exitMode();
      else controller.enterMode();
    } else return;
    event.preventDefault();
  };

  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    doc.head.appendChild(style);
  }
  for (const type of PRESS_EVENTS) win.addEventListener(type, press as EventListener, true);
  win.addEventListener('keydown', key);
  void comments.customAnchors(handlers).then(c => {
    if (disposed) c.release();
    else {
      controller = c;
      schedule();
    }
  });

  return () => {
    disposed = true;
    for (const type of PRESS_EVENTS) win.removeEventListener(type, press as EventListener, true);
    win.removeEventListener('keydown', key);
    watch(false);
    if (frame) win.cancelAnimationFrame(frame);
    pick(null);
    doc.documentElement.removeAttribute(MODE_ATTR);
    controller?.release();
    controller = null;
  };
}
