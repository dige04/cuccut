// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale } from '@cuccut/protocol/i18n';
import type { EditorPoint, EditorThread, EditorToHostMessage, HostToEditorMessage } from '@cuccut/slides/editor-messages';
import { createCommentsBridge, type ParentLink, type PinLayer } from '@cuccut/slides/editor';
import { createCommentLabels } from './comment-labels.ts';
import { describeTarget, fileOf, findTarget, installCommentTargets, pinPoint, prefixOf, readTarget, REVEAL_COMMENT_TARGET_EVENT } from './comment-targets.ts';

/** 设计系统标注的目标层（docs/design/canvas §10.6）：DOM 上标的目标、位置标签、标注模式与编号标记。 */

const win = window as unknown as Window & typeof globalThis;

beforeEach(() => {
  // 测试进程钉在简体中文（vitest.config.ts 的 CUCCUT_LOCALE）；这里要按参数换语言
  vi.stubEnv('CUCCUT_LOCALE', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-cuccut-annotating');
});

/** 一页设计系统：Colors 一章里一个颜色组（标题行是目标、组上是锚点）与一个 token，Components 一章里一个组件，另有一个弹层。 */
function page() {
  document.body.innerHTML = `
    <main>
      <section data-testid="ds-section-colors" aria-label="Colors">
        <h1 data-id="page-colors" data-comment-target="" data-comment-name="colors">Colors</h1>
        <p data-uncommentable=""><span id="note">Brand palette</span></p>
        <section data-id="cgroup-Brand-colors-0a1b2c3" aria-label="Brand colors">
          <div id="ghead" data-comment-target=""><button id="gbtn">Add</button></div>
          <div id="tok" data-id="token-accent-background-default" data-comment-target="" data-comment-name="accent-background-default">
            <span id="tokname">accent-background-default</span>
          </div>
        </section>
      </section>
      <section data-testid="ds-section-components" aria-label="Components">
        <article id="comp" data-id="comp-Button" data-comment-target="" data-comment-name="Button"><button id="inner">Preview</button></article>
        <div id="cover" data-id="ds-cover" data-comment-target="" data-comment-name="cover"></div>
      </section>
      <div id="plain">not a target</div>
    </main>
    <div role="presentation"><div id="picker" data-id="picker-accent-a1b2c3d" data-comment-target="" data-comment-name="accent:light"></div></div>
    <input id="field" />`;
}
const $ = (id: string) => document.getElementById(id)!;

describe('位置的说法', () => {
  it('前缀是第一个「-」之前；文件按格式（tokens.json、components/<组件>/、素材的路径）', () => {
    expect(prefixOf('token-accent-background-default')).toBe('token');
    expect(prefixOf('ds-cover')).toBe('ds');
    expect(prefixOf('page')).toBe('page');
    expect(fileOf('token', 'accent')).toBe('tokens.json');
    expect(fileOf('style', 'Heading 1')).toBe('tokens.json');
    expect(fileOf('comp', 'Button')).toBe('components/Button/');
    expect(fileOf('prop', 'Button/size')).toBe('components/Button/');
    expect(fileOf('agroup', 'Icons')).toBe('assets/Icons/');
    expect(fileOf('asset', 'assets/Icons/add.svg')).toBe('assets/Icons/add.svg');
    expect(fileOf('note', 'comp/Button')).toBe('components/Button/README.md');
    expect(fileOf('note', 'color/accent')).toBe('tokens.json');
    expect(fileOf('ds', 'cover')).toBe('components/Cover/preview.html');
    expect(fileOf('ds', 'font-files')).toBe('fonts/');
    expect(fileOf('page', 'colors', 'colors')).toBe('tokens.json');
    expect(fileOf('page', 'readme', 'readme')).toBe('README.md');
    expect(fileOf('page', 'family-motion', 'family-motion')).toBe('tokens.json');
    expect(fileOf('page', 'x', 'doc-guides')).toBeUndefined();
    expect(fileOf('zzz', 'a')).toBeUndefined();
  });

  it('给人看的是「章节 › 种类 “名字”」，章节标题只到章节，封面按名字；给模型看的是英文的种类、章节、文件与锚点', () => {
    const zh = createCommentLabels('zh-Hans');
    const token = { anchor: 'token-accent', prefix: 'token', name: 'accent', section: 'colors', sectionLabel: 'Colors' };
    expect(describeTarget(token, zh)).toEqual({
      label: 'Colors › token “accent”',
      detail: 'Token "accent" in section colors (tokens.json) · token-accent',
    });
    expect(describeTarget({ anchor: 'comp-Button', prefix: 'comp', name: 'Button', section: 'components', sectionLabel: 'Components' }, zh).label).toBe(
      'Components › 组件 “Button”',
    );
    expect(describeTarget({ anchor: 'page-colors', prefix: 'page', name: 'colors', section: 'colors', sectionLabel: 'Colors' }, zh)).toEqual({
      label: 'Colors',
      detail: 'Section in section colors (tokens.json) · page-colors',
    });
    expect(describeTarget({ anchor: 'ds-cover', prefix: 'ds', name: 'cover', section: 'readme', sectionLabel: 'Overview' }, zh)).toEqual({
      label: 'Overview › 封面',
      detail: 'Cover in section readme (components/Cover/preview.html) · ds-cover',
    });
    // 弹层里的目标不在章节里；名字太长时截短
    const long = { anchor: 'picker-x', prefix: 'picker', name: 'x'.repeat(50) };
    expect(describeTarget(long, zh)).toEqual({ label: `取色器 “${'x'.repeat(40)}…”`, detail: `Color picker "${'x'.repeat(50)}" (tokens.json) · picker-x` });
    expect(describeTarget({ anchor: 'zzz-a', prefix: 'zzz', name: '' }, zh)).toEqual({ label: '元素', detail: 'Element · zzz-a' });
    const en = createCommentLabels(null);
    expect(describeTarget(token, en).label).toBe('Colors › Token “accent”');
    expect(describeTarget(token, createCommentLabels('fr')).label).toBe('Colors › Jeton « accent »');
  });

  it.each(LOCALES)('%s 的每个种类都有译文', (locale) => {
    const labels = createCommentLabels(locale);
    for (const prefix of ['token', 'cgroup', 'tset', 'style', 'font', 'knob', 'editor', 'picker', 'prop', 'props', 'cell', 'agroup', 'asset', 'comp', 'doc', 'dialog', 'lightbox', 'note', 'page']) {
      expect(labels.kind(prefix).trim()).not.toBe('');
    }
    expect(labels.special('cover')?.trim()).toBeTruthy();
    expect(labels.special('font-files')?.trim()).toBeTruthy();
    expect(labels.special('constructor')).toBeUndefined();
    expect(labels.kind('constructor')).toBe(labels.kind('nope'));
    expect(labels.quote('x')).toContain('x');
  });
});

describe('点中的目标', () => {
  it('取最近的目标，锚点是它自己或祖先的 data-id，带章节；名字取 data-comment-name，没有时取看得到的名字', () => {
    page();
    expect(readTarget($('tokname'))).toEqual({
      anchor: 'token-accent-background-default',
      prefix: 'token',
      name: 'accent-background-default',
      section: 'colors',
      sectionLabel: 'Colors',
    });
    expect(readTarget($('gbtn'))).toEqual({ anchor: 'cgroup-Brand-colors-0a1b2c3', prefix: 'cgroup', name: 'Brand colors', section: 'colors', sectionLabel: 'Colors' });
    expect(readTarget($('inner'))?.anchor).toBe('comp-Button');
    expect(readTarget($('picker'))).toEqual({ anchor: 'picker-accent-a1b2c3d', prefix: 'picker', name: 'accent:light' });
    expect(readTarget($('note'))).toBeNull();
    expect(readTarget($('plain'))).toBeNull();
    expect(readTarget(document)).toBeNull();
    expect(readTarget(null)).toBeNull();
  });

  it('按锚点找回目标：带 data-id 的元素自己是目标就是它，否则是锚点归它的那个标题行', () => {
    page();
    expect(findTarget(document, 'token-accent-background-default')).toBe($('tok'));
    expect(findTarget(document, 'cgroup-Brand-colors-0a1b2c3')).toBe($('ghead'));
    expect(findTarget(document, 'nope')).toBeNull();
  });

  it('编号标记在目标右上角往里一点；没有大小、出了视口或被滚动容器裁掉时不画', () => {
    page();
    const tok = $('tok');
    tok.getBoundingClientRect = () => ({ left: 100, top: 200, right: 300, bottom: 240, width: 200, height: 40, x: 100, y: 200 }) as DOMRect;
    expect(pinPoint(tok, win)).toEqual({ x: 286, y: 214 });
    tok.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }) as DOMRect;
    expect(pinPoint(tok, win)).toBeNull();
    tok.getBoundingClientRect = () => ({ left: 100, top: -80, right: 300, bottom: -40, width: 200, height: 40, x: 100, y: -80 }) as DOMRect;
    expect(pinPoint(tok, win)).toBeNull();
    const main = document.querySelector('main')!;
    // 设计系统滚的是里面的容器（overflow-y: auto），不是窗口
    main.style.overflowY = 'auto';
    main.getBoundingClientRect = () => ({ left: 0, top: 300, right: 800, bottom: 700, width: 800, height: 400, x: 0, y: 300 }) as DOMRect;
    tok.getBoundingClientRect = () => ({ left: 100, top: 200, right: 300, bottom: 240, width: 200, height: 40, x: 100, y: 200 }) as DOMRect;
    expect(pinPoint(tok, win)).toBeNull();
  });
});

/** 假的父窗口通道与编号标记图层：记下 iframe 发出的消息与画的标记。 */
function fakeParent() {
  const sent: EditorToHostMessage[] = [];
  const listeners = new Set<(message: HostToEditorMessage) => void>();
  const link: ParentLink = {
    post: (message) => sent.push(message),
    onMessage: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const renders: { positions: Record<string, EditorPoint>; threads: readonly EditorThread[] }[] = [];
  const pins: PinLayer = { render: (positions, threads) => renders.push({ positions, threads }), clear: () => {} };
  return { link, pins, sent, renders, deliver: (message: HostToEditorMessage) => listeners.forEach((l) => l(message)) };
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 40));

async function setup() {
  page();
  const parent = fakeParent();
  let n = 0;
  const bridge = createCommentsBridge(parent.link, parent.pins, () => `r${++n}`);
  const dispose = installCommentTargets({ win, comments: bridge.capability, labels: createCommentLabels('zh-Hans') });
  await frame();
  return { parent, dispose };
}

const click = (el: Element, init: MouseEventInit = {}) => {
  const opts = { bubbles: true, cancelable: true, button: 0, clientX: 120, clientY: 210, ...init };
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, opts) : new MouseEvent(type, opts));
  }
};
const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));

describe('installCommentTargets', () => {
  it('父窗口打开标注模式：页面带上模式属性，回 editor:mode；点目标弹批注框，页面收不到这次点击', async () => {
    const { parent, dispose } = await setup();
    const pageClicks = vi.fn();
    $('inner').addEventListener('click', pageClicks);
    $('plain').addEventListener('click', pageClicks);
    parent.deliver({ type: 'editor:set-mode', on: true });
    expect(document.documentElement.hasAttribute('data-cuccut-annotating')).toBe(true);
    expect(parent.sent).toContainEqual({ type: 'editor:mode', on: true });

    click($('inner'));
    expect(pageClicks).not.toHaveBeenCalled();
    expect(parent.sent.at(-1)).toEqual({
      type: 'editor:compose',
      requestId: 'r1',
      anchor: 'comp-Button',
      point: { x: 120, y: 210 },
      label: 'Components › 组件 “Button”',
      detail: 'Component "Button" in section components (components/Button/) · comp-Button',
      section: 'components',
    });
    expect($('comp').hasAttribute('data-cuccut-picked')).toBe(true);
    parent.deliver({ type: 'editor:compose-result', requestId: 'r1', opened: true });
    parent.deliver({ type: 'editor:composer-closed', requestId: 'r1' });
    expect($('comp').hasAttribute('data-cuccut-picked')).toBe(false);

    // 不在目标上的、不收批注区域里的点击照常交给页面
    const sent = parent.sent.length;
    click($('plain'));
    click($('note'));
    expect(pageClicks).toHaveBeenCalledTimes(1);
    expect(parent.sent.length).toBe(sent);
    dispose();
  });

  it('标注模式关着时点击照常交给页面', async () => {
    const { parent, dispose } = await setup();
    const pageClicks = vi.fn();
    $('inner').addEventListener('click', pageClicks);
    click($('inner'));
    expect(pageClicks).toHaveBeenCalledTimes(1);
    expect(parent.sent.some((m) => m.type === 'editor:compose')).toBe(false);
    dispose();
  });

  it('C 开关标注模式、Esc 退出；在输入框里、带修饰键时不算', async () => {
    const { parent, dispose } = await setup();
    key($('field'), 'c');
    key(document.body, 'c', { metaKey: true });
    expect(parent.sent.filter((m) => m.type === 'editor:mode')).toEqual([]);
    key(document.body, 'c');
    expect(parent.sent.at(-1)).toEqual({ type: 'editor:mode', on: true });
    key(document.body, 'Escape');
    expect(parent.sent.at(-1)).toEqual({ type: 'editor:mode', on: false });
    expect(document.documentElement.hasAttribute('data-cuccut-annotating')).toBe(false);
    key(document.body, 'C');
    key(document.body, 'c');
    expect(parent.sent.filter((m) => m.type === 'editor:mode').map((m) => (m as { on: boolean }).on)).toEqual([true, false, true, false]);
    dispose();
  });

  it('标注模式开着时按草稿画编号标记，关掉时清空', async () => {
    const { parent, dispose } = await setup();
    $('tok').getBoundingClientRect = () => ({ left: 100, top: 200, right: 300, bottom: 240, width: 200, height: 40, x: 100, y: 200 }) as DOMRect;
    parent.deliver({ type: 'editor:threads', threads: [{ id: 'a', anchor: 'token-accent-background-default', n: 2, section: 'colors' }, { id: 'b', anchor: 'gone', n: 3 }] });
    parent.deliver({ type: 'editor:set-mode', on: true });
    await frame();
    expect(parent.renders.at(-1)?.positions).toEqual({ a: { x: 286, y: 214 } });
    parent.deliver({ type: 'editor:set-mode', on: false });
    await frame();
    expect(parent.renders.at(-1)?.positions).toEqual({});
    dispose();
  });

  it('跳回一处：把锚点、章节与名字交给运行时', async () => {
    const { parent, dispose } = await setup();
    const reveals: unknown[] = [];
    const listen = (event: Event) => reveals.push((event as CustomEvent).detail);
    window.addEventListener(REVEAL_COMMENT_TARGET_EVENT, listen);
    parent.deliver({
      type: 'editor:threads',
      threads: [
        { id: 'a', anchor: 'comp-Button', n: 1, section: 'components' },
        { id: 'b', anchor: 'token-not-mounted', n: 0, section: 'colors' },
      ],
    });
    parent.deliver({ type: 'editor:reveal', id: 'a' });
    parent.deliver({ type: 'editor:reveal', id: 'b' });
    parent.deliver({ type: 'editor:reveal', id: 'unknown' });
    expect(reveals).toEqual([
      { target: 'comp-Button', section: 'components', label: 'Button' },
      { target: 'token-not-mounted', section: 'colors' },
    ]);
    window.removeEventListener(REVEAL_COMMENT_TARGET_EVENT, listen);
    dispose();
  });

  it('卸下后不再拦点击，模式属性去掉', async () => {
    const { parent, dispose } = await setup();
    parent.deliver({ type: 'editor:set-mode', on: true });
    dispose();
    expect(document.documentElement.hasAttribute('data-cuccut-annotating')).toBe(false);
    const pageClicks = vi.fn();
    $('inner').addEventListener('click', pageClicks);
    click($('inner'));
    expect(pageClicks).toHaveBeenCalledTimes(1);
  });
});
