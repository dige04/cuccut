/**
 * Target layer for design system annotations (docs/design/canvas §10.6). The design system runtime does not draw an annotation layer; it only marks targets on the DOM:
 * `data-comment-target` marks the clickable block, `data-id` (on it or its nearest ancestor) is the anchor, `data-comment-name` is the original name
 * (editor/comment-anchors.ts; the original name was added by CucCut), and `data-uncommentable` marks areas that do not accept annotations. The original's annotation layer belongs to the host;
 * in CucCut the host's half lives in the iframe (the parent window is cross-origin and cannot read the DOM), and this is that half.
 *
 * Here it plays the role on the other end of the annotation bridge from the slide runtime (comments-bridge.ts in @cuccut/slides): it gets the controller via `comments.customAnchors`,
 * and the messages, the comment box timeout and the layer for numbered markers all use the bridge's.
 *
 * - Annotation mode: toggled by the parent window (`editor:set-mode`), or by pressing C (focus not in an input or dialog, no modifier keys); Esc exits.
 *   When on, targets show a crosshair cursor and a dashed outline; controls inside a target do not receive the pointer (clicking a button in a component preview annotates that component).
 * - Clicking a target opens the comment box (`compose`) at the click position. The position label for people is "section › kind “name”"; the model gets the kind, name, section,
 *   file and anchor. The section id is also included (`section`), since jumping back must first go to that chapter. Clicks not on a target, or in an area that accepts no annotations, are passed to the page as usual.
 * - Numbered markers: drawn at the top-right corner of a target while annotation mode is on; recomputed on scroll, size and content changes. Not drawn if the target is not on the page or has been scrolled out of its scroll container.
 * - Jump back (`reveal`): dispatches `cuccut:reveal-comment-target`. The runtime follows the same path as selecting a search result to reach that chapter, waits for the target to appear, scrolls to it and flashes it
 *   (the `CucCut:` section in files/ui/design-system-app.tsx).
 */
import type { EditorPoint } from '@cuccut/slides/editor-messages';
import type { CommentAnchorController, CommentAnchorHandlers, HostCommentsCapability } from '@cuccut/slides/editor';
import type { DesignSystemCommentLabels } from './comment-labels.ts';

/** Event dispatched to the runtime when jumping back to a place (listened to by files/ui/design-system-app.tsx). `detail` is `{ target, section?, label? }`. */
export const REVEAL_COMMENT_TARGET_EVENT = 'cuccut:reveal-comment-target';
/** Prefix of a section's `data-testid` (files/ui/design-system-app.tsx: `ds-section-<section id>`; `aria-label` is the section name). */
const SECTION_TEST_ID_PREFIX = 'ds-section-';
/** Length of the name referenced in a position label; longer in the locator given to the model. */
const LABEL_QUOTE_MAX = 40;
const DETAIL_QUOTE_MAX = 80;
/** Distance of a numbered marker from the target's top-right corner (CSS pixels). */
const PIN_INSET = 14;
/** Attribute on `<html>` while annotation mode is on, and the attribute on the clicked target (styles in `STYLE`). */
const MODE_ATTR = 'data-cuccut-annotating';
const PICKED_ATTR = 'data-cuccut-picked';
const STYLE_ID = 'cuccut-comment-targets';
/** Styles for annotation mode. The color is the same S2 blue as the numbered markers (domPinLayer in comments-bridge.ts). Nested targets outline only the innermost one. */
const STYLE = `
html[${MODE_ATTR}] [data-comment-target] { cursor: crosshair; }
html[${MODE_ATTR}] [data-comment-target] * { pointer-events: none; }
html[${MODE_ATTR}] [data-comment-target] [data-comment-target] { pointer-events: auto; }
html[${MODE_ATTR}] [data-uncommentable], html[${MODE_ATTR}] [data-uncommentable] * { cursor: auto; }
html[${MODE_ATTR}] [data-comment-target]:hover:not(:has([data-comment-target]:hover)) { outline: 2px dashed #3B63FB; outline-offset: 2px; }
[${PICKED_ATTR}] { outline: 2px solid #3B63FB !important; outline-offset: 2px; }
`;

/** Kind shown to the model (English), by prefix; `ds` by name. */
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

/** A clicked target. `name` is the original name (`data-comment-name`; the visible name if missing); `section` and `sectionLabel` are the section it belongs to. */
export interface CommentTarget {
  anchor: string;
  prefix: string;
  name: string;
  section?: string;
  sectionLabel?: string;
}

/** The anchor's prefix: everything before the first `-` (commentTargetId builds `<prefix>-<name or hash>`, and the prefix itself contains no `-`). */
export function prefixOf(anchor: string): string {
  const cut = anchor.indexOf('-');
  return cut < 0 ? anchor : anchor.slice(0, cut);
}

function quote(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Where a section's content is written: the overview is README.md; colors, text, spacing, radius, shadow, and the extra token chapters are all in tokens.json; components and assets each have a directory. */
function sectionFile(section: string | undefined): string | undefined {
  if (section === undefined) return undefined;
  if (section === 'readme') return 'README.md';
  if (section === 'components') return 'components/';
  if (section === 'assets') return 'assets/';
  if (['colors', 'type', 'spacing', 'corners', 'shadows'].includes(section) || section.startsWith('family-')) return 'tokens.json';
  return undefined;
}

/**
 * Which file in the design system this target is written in (skill design-system's references/format.md): tokens, color groups, text styles, fonts and style settings
 * are all in tokens.json; components are in `components/<component>/` (usage notes in its README.md); asset groups are in `assets/<group>/`; asset and document names are
 * their paths; the cover is `components/Cover/preview.html`; font files are in `fonts/`; section titles go by their section. Anything else is not certain, so it is not written.
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
 * Two wordings for a target. `label` is for people: "section › kind “name”", where a section title goes only as far as the chapter. The few `ds` places are looked up by name (cover, font files).
 * When not inside a chapter (popovers, dialogs), the section part is omitted. `detail` is for the model: the kind and name in English, the section id, the file and the anchor.
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

/** The name visible on the element: the screen-reader name, or the text of the first heading inside it. */
function visibleName(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const heading = el.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]');
  return (heading?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Which target the clicked spot belongs to: the nearest `[data-comment-target]`, whose anchor is the `data-id` on itself or its nearest ancestor. Null inside an area that accepts no comments,
 * or when no anchor is found. The name is taken in order from `data-comment-name` (on the target, on the anchor element), the visible name (of the anchor element, of the target,
 * or the text inside the target), and finally the anchor with its prefix removed.
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

/** The target on the page whose anchor is `anchor`: the element itself if it has `data-id` and is a target; otherwise the first target inside it whose anchor belongs to it (the header row of a grouped card). */
export function findTarget(doc: Document, anchor: string): Element | null {
  for (const holder of doc.querySelectorAll('[data-id]')) {
    if (holder.getAttribute('data-id') !== anchor) continue;
    if (holder.hasAttribute('data-comment-target')) return holder;
    for (const inner of holder.querySelectorAll('[data-comment-target]')) if (inner.closest('[data-id]') === holder) return inner;
  }
  return null;
}

const clips = (overflow: string) => overflow !== '' && overflow !== 'visible';

/** Position of a numbered marker (viewport coordinates): slightly inward from the target's top-right corner. Null if the target has no size, or if this point is scrolled out of the viewport or out of some scroll container layer. */
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

/** Whether a keyboard event is inside an input, an editable area, or a dialog or menu (where C and Esc belong to them). */
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

/** Installs the target layer. Returns the function that removes it. */
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
    // C and Esc are bound here (see below), so the bridge does not bind them separately
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

  /** In annotation mode, a press on a target is not passed to the page (press, release and click are all intercepted); a click opens the comment box. */
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
