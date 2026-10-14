// The part of the panel benchmark (`tools/panels-bench.mjs`) that runs in the page: the host bridge (in place of Electron's preload script), the measurement helpers, and the full measurement pass on a fresh load.
// The host bridge and measurement helpers are injected before the page scripts by CDP's `Page.addScriptToEvaluateOnNewDocument` (not subject to the page's CSP `script-src 'self'`);
// each measurement step is sent into the page with `Runtime.evaluate`, which waits inside the page until it finishes before the result is fetched.

/**
 * Host bridge: same shape as `src/preload/index.ts`. The connection uses the isolated Runtime's endpoint and token; picking files, opening URLs and the like are harmless no-op stubs,
 * the update `get` never returns (as with `bench:preview`, updates are not checked), and subscribe returns a no-op unsubscribe function.
 */
export function hostBridgeSource(connection, platform) {
  return `(() => {
  const connection = ${JSON.stringify(connection)};
  const never = () => new Promise(() => {});
  const none = () => {};
  window.cuccut = {
    platform: ${JSON.stringify(platform)},
    getConnection: async () => ({ endpoint: connection.endpoint, token: connection.token }),
    pickDirectory: async () => null,
    pickMediaFiles: async () => [],
    pathForFile: () => '',
    revealPath: async () => {},
    web: {
      create: async () => 'bench-web',
      navigate: async (_id, url) => ({ ok: true, url }),
      back: none, forward: none, reload: none, stop: none, setZoom: none, setBounds: none, setVisible: none, destroy: none,
      onState: () => none,
      clearData: async () => {},
    },
    updates: {
      get: never,
      onState: () => none,
      onNotice: () => none,
      configure: none,
      check: async () => {}, download: async () => {}, cancel: async () => {}, install: async () => {}, openDownloadPage: async () => {},
    },
    openExternal: async () => {},
    pickFiles: async () => [],
    pickSavePath: async () => null,
  };
})();`;
}

/**
 * Measurement helpers (evaluated in the page). The heartbeats all use MessageChannel, so they are not throttled by setTimeout:
 * - `__measure(fn)`: calls fn in a new task, then waits until the main thread has been quiet for 1.5 seconds; longest is the longest longtask (only tasks ≥ 50 ms are reported, 0 if none),
 *   maxGap is the longest stretch of busy time measured by the fine heartbeat (recorded when the interval is > 8 ms; includes layout and paint), and total is the total busy time from the coarse heartbeat (> 50 ms).
 * - `__frames(el, axis, px, frames)`: rAF scrolls px pixels per frame, turns around at the end, and returns the frame intervals.
 * - `__mountedList()` / `__mountedTl()`: how many rows, clips, cut-point bands and elements are mounted in the current list and timeline, plus the viewport size.
 */
export function installHelpers() {
  window.__sleep = (ms) =>
    new Promise((resolve) => {
      const end = performance.now() + ms;
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        if (performance.now() >= end) resolve();
        else ch.port2.postMessage(0);
      };
      ch.port2.postMessage(0);
    });
  window.__lt = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__lt.push(Math.round(entry.duration));
  }).observe({ type: 'longtask' });
  window.__tl = () => document.querySelector('[aria-label="时间线"]');
  window.__key = (key, opts) => {
    window.__tl().dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        code: opts.code,
        metaKey: !!opts.meta,
        altKey: !!opts.alt,
        ctrlKey: !!opts.ctrl,
        shiftKey: !!opts.shift,
        bubbles: true,
        cancelable: true,
      }),
    );
  };
  window.__snap = () => {
    const tl = window.__tl();
    const sc = tl.querySelector('.cc-scroll');
    return {
      nodes: tl.querySelectorAll('*').length,
      clips: tl.querySelectorAll('.cc-clip').length,
      bands: tl.querySelectorAll('.cc-cut-band').length,
      scroll: Math.round(sc.scrollLeft),
      width: sc.scrollWidth,
    };
  };
  window.__task = (fn) =>
    new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        fn();
        resolve();
      };
      ch.port2.postMessage(0);
    });
  // Timeline zoom shortcuts: ⌘⌥1 fit the whole clip in view, ⌘0 back to 100%, ⌘= zoom in one step, ⌘- zoom out one step.
  window.__z = {
    fit: () => window.__key('1', { code: 'Digit1', meta: true, alt: true }),
    z100: () => window.__key('0', { code: 'Digit0', meta: true }),
    zin: () => window.__key('=', { code: 'Equal', meta: true }),
    zout: () => window.__key('-', { code: 'Minus', meta: true }),
  };
  const heartbeat = (threshold) => {
    const gaps = [];
    let prev = performance.now();
    let stop = false;
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      const now = performance.now();
      if (now - prev > threshold) gaps.push(threshold > 8 ? Math.round(now - prev) : now - prev);
      prev = now;
      if (!stop) ch.port2.postMessage(0);
    };
    ch.port2.postMessage(0);
    return {
      gaps,
      end: () => {
        stop = true;
        return gaps;
      },
    };
  };
  // The coarse heartbeat (> 50 ms) is only used to decide that things have gone quiet; the fine heartbeat (> 8 ms) measures the longest stretch of busy time.
  window.__hb = () => heartbeat(50);
  window.__fine = () => heartbeat(8);
  window.__quiet = async (hb) => {
    let quiet = performance.now();
    let n = -1;
    while (performance.now() - quiet < 1500) {
      await window.__sleep(100);
      if (hb.gaps.length !== n) {
        n = hb.gaps.length;
        quiet = performance.now();
      }
    }
    return hb.end();
  };
  window.__run = async (fn) => {
    const hb = window.__hb();
    await window.__sleep(200);
    hb.gaps.length = 0;
    await window.__task(fn);
    const gaps = await window.__quiet(hb);
    return { blocked: gaps, total: gaps.reduce((a, b) => a + b, 0), ...window.__snap() };
  };
  window.__measure = async (fn) => {
    const hb = window.__hb();
    const fine = window.__fine();
    await window.__sleep(200);
    hb.gaps.length = 0;
    fine.gaps.length = 0;
    window.__lt.length = 0;
    await window.__task(fn);
    const gaps = await window.__quiet(hb);
    const f = fine.end();
    return {
      longest: Math.max(0, ...window.__lt),
      maxGap: Math.round(Math.max(0, ...f)),
      total: gaps.reduce((a, b) => a + b, 0),
      tasks: window.__lt.length,
    };
  };
  // Open a video by name in Space (list rows start with the name), and wait for the timeline to appear and the main thread to go quiet.
  window.__open = async (name) => {
    [...document.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === 'Space' || b.textContent.trim() === 'Space')
      ?.click();
    await window.__sleep(1500);
    const row = [...document.querySelectorAll('[role="row"]')].find((r) => r.textContent.startsWith(name));
    if (!row) throw new Error(`No ${name} in Space`);
    row.focus();
    await window.__sleep(300);
    window.__lt.length = 0;
    const hb = window.__hb();
    for (const type of ['keydown', 'keyup'])
      row.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    for (let i = 0; i < 60 && !window.__tl(); i++) await window.__sleep(250);
    const gaps = await window.__quiet(hb);
    return { total: gaps.reduce((a, b) => a + b, 0), lt: [...window.__lt] };
  };
  window.__btn = (label) => {
    const b = [...document.querySelectorAll('button')].find((el) => el.getAttribute('aria-label') === label);
    if (!b) throw new Error(`No button ${label}`);
    return b;
  };
  window.__byText = (text) => {
    const b = [...document.querySelectorAll('[role=radio],button,label')].find((el) => el.textContent.trim() === text);
    if (!b) throw new Error(`No ${text}`);
    return b;
  };
  window.__scroller = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1) return e;
    }
    return null;
  };
  window.__list = () =>
    [...document.querySelectorAll('[role=list]')].find(
      (l) => l.querySelector('[role=listitem][aria-setsize]') && l.getBoundingClientRect().width > 0,
    );
  window.__frames = (el, axis, px, frames) =>
    new Promise((resolve) => {
      const prop = axis === 'x' ? 'scrollLeft' : 'scrollTop';
      const max = axis === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
      let dir = 1;
      const ts = [];
      const step = (t) => {
        ts.push(t);
        if (ts.length > frames) {
          resolve(ts.slice(1).map((v, i) => v - ts[i]));
          return;
        }
        let next = el[prop] + dir * px;
        if (next >= max || next <= 0) {
          dir = -dir;
          next = el[prop] + dir * px;
        }
        el[prop] = next;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  window.__stats = (d) => {
    const s = [...d].sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return {
      n: s.length,
      p50: +q(0.5).toFixed(1),
      p95: +q(0.95).toFixed(1),
      max: +s[s.length - 1].toFixed(1),
      over50: s.filter((v) => v > 50).length,
    };
  };
  window.__mountedList = () => {
    const list = window.__list();
    const sc = window.__scroller(list);
    return {
      rows: list.querySelectorAll('[role=listitem]').length,
      setsize: Number(list.querySelector('[role=listitem]').getAttribute('aria-setsize')),
      elements: list.querySelectorAll('*').length,
      viewportH: sc.clientHeight,
      viewportW: sc.clientWidth,
      scrollH: sc.scrollHeight,
    };
  };
  window.__mountedTl = () => {
    const tl = window.__tl();
    const sc = tl.querySelector('.cc-scroll');
    return {
      clips: tl.querySelectorAll('.cc-clip').length,
      bands: tl.querySelectorAll('.cc-cut-band').length,
      elements: tl.querySelectorAll('*').length,
      viewportW: sc.clientWidth,
      viewportH: sc.clientHeight,
      scrollW: sc.scrollWidth,
    };
  };
  // The total in the "item N of M" count on the find bar; not shown when there are no matches, records 0.
  window.__hits = (find) => {
    let e = find;
    for (let i = 0; i < 5; i++) e = e.parentElement;
    const m = e.innerText.match(/\d+ \/ (\d+)/);
    return m ? Number(m[1]) : 0;
  };
  window.__setInput = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
}

/**
 * A full measurement pass on a fresh load (the page is already navigated, the host bridge and helpers already injected): open a video, warm up, measure tab switching, the frame intervals of continuous scrolling in each list and the timeline,
 * the mounted counts per panel, replacing and undoing all captions, and one timeline zoom step and fit-to-view. `page` provides `ev(expression)` (an async function body run in the page) and `sleep(ms)`.
 */
export async function runSuite(page, { video, px = 40, fast = 200, frames = 240, log = () => {} }) {
  const ev = (body) => page.ev(body);
  const J = async (body) => JSON.parse(await ev(body));
  const result = { px, fast, frames };

  // Open: wait for the UI to appear (Space button), then open a video in Space and wait for the timeline to appear.
  await page.sleep(5000);
  await ev(
    `for (let i = 0; i < 480 && ![...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Space' || b.textContent.trim() === 'Space'); i++) await window.__sleep(250);
     await window.__sleep(1500); return 1`,
  );
  result.open = await J(
    `const r = await window.__open(${JSON.stringify(video)}); for (let i = 0; i < 3000 && !window.__tl(); i++) await window.__sleep(100);
     if (!window.__tl()) throw new Error('Timeline did not appear'); return JSON.stringify({ total: r.total, sheets: document.styleSheets.length })`,
  );
  await page.sleep(3000);

  // Overlays and sidebar: the session overlay is minimized, the Space sidebar is collapsed, and the editing area is wider (both tiers the same).
  await ev(
    `for (const l of ['最小化', '隐藏侧边栏']) [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === l)?.click(); await window.__sleep(1500); return 1`,
  );
  result.window = await J(`return JSON.stringify({ innerW: innerWidth, innerH: innerHeight })`);

  // The sidebar and list modes are radios: clicking one that is already selected collapses the panel, so only click ones that are not selected.
  const rail = (label) => `{ const b = window.__btn(${JSON.stringify(label)}); if (b.getAttribute('aria-checked') !== 'true') b.click(); }`;
  const mode = (text) =>
    `{ const b = window.__byText(${JSON.stringify(text)}); if (b.getAttribute('aria-checked') !== 'true') b.click(); }`;
  const go = (expr) => ev(`${expr}; await window.__sleep(800); return 1`);

  // Warm-up: go through each panel and mode once and scroll each (production builds load their on-demand chunks here, so they finish loading here).
  for (const step of [rail('字幕'), mode('原文 ＋ 译文'), mode('只看原文'), rail('元素'), rail('文稿'), rail('字幕')]) await go(step);
  for (const step of [rail('文稿'), rail('字幕'), mode('原文 ＋ 译文')]) {
    await go(step);
    await ev(
      `const sc = window.__scroller(window.__list()); await window.__frames(sc, 'y', ${px}, 60); sc.scrollTop = 0; await window.__sleep(300); return 1`,
    );
  }
  await go(mode('只看原文'));
  await go(rail('文稿'));

  // Tab switching: the 12 ordered pairs among the four states (script, captions = original text only, translation = original plus translation, elements), two rounds.
  const pairs = [
    ['transcript-to-captions', rail('字幕')],
    ['captions-to-translation', mode('原文 ＋ 译文')],
    ['translation-to-transcript', rail('文稿')],
    ['transcript-to-translation', rail('字幕')],
    ['translation-to-elements', rail('元素')],
    ['elements-to-translation', rail('字幕')],
    ['translation-to-captions', mode('只看原文')],
    ['captions-to-elements', rail('元素')],
    ['elements-to-captions', rail('字幕')],
    ['captions-to-transcript', rail('文稿')],
    ['transcript-to-elements', rail('元素')],
    ['elements-to-transcript', rail('文稿')],
  ];
  result.tabs = {};
  for (let round = 0; round < 2; round++) {
    for (const [name, expr] of pairs) {
      (result.tabs[name] ??= []).push(await J(`return JSON.stringify(await window.__measure(() => ${expr}))`));
      await page.sleep(300);
    }
  }
  log('tab switch');

  // Lists: frame intervals while scrolling continuously (starting at 20%, px pixels per frame, with 60 warm-up frames first; then a fast fling at fast pixels per frame), then scroll to 50% and count the mounted items.
  result.lists = {};
  for (const [name, steps] of [
    ['transcript', [rail('文稿')]],
    ['captions', [rail('字幕'), mode('只看原文')]],
    ['translation', [rail('字幕'), mode('原文 ＋ 译文')]],
  ]) {
    for (const step of steps) await go(step);
    result.lists[name] = await J(
      `const sc = window.__scroller(window.__list()); sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * 0.2; await window.__sleep(800);
       await window.__frames(sc, 'y', ${px}, 60); await window.__sleep(500);
       const d = await window.__frames(sc, 'y', ${px}, ${frames}); await window.__sleep(500);
       const f = await window.__frames(sc, 'y', ${fast}, ${frames}); await window.__sleep(500);
       sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * 0.5; await window.__sleep(1000);
       return JSON.stringify({ scroll: window.__stats(d), fast: window.__stats(f), mounted: window.__mountedList() })`,
    );
  }
  log('list scroll');
  await go(mode('只看原文'));

  // Replacing and undoing all captions: find the markers, replace them with beacon, three rounds (each round undoes back to the original state).
  await go(`window.__btn('查找和替换').click()`);
  result.replace = [];
  for (let i = 0; i < 3; i++) {
    result.replace.push(
      await J(
        `const find = document.querySelector('input[placeholder="在字幕里查找"]'); window.__setInput(find, 'marker'); await window.__sleep(1500);
         const rep = document.querySelector('input[placeholder="替换为"]'); window.__setInput(rep, 'beacon'); await window.__sleep(800);
         const hits = window.__hits(find);
         const before = window.__mountedList().rows;
         const all = await window.__measure(() => window.__byText('全部替换').click()); await window.__sleep(1000);
         const after = window.__hits(find);
         const undo = await window.__measure(() => window.__btn('撤销').click()); await window.__sleep(1500);
         const restored = window.__hits(find);
         return JSON.stringify({ hits, hitsAfterReplace: after, hitsAfterUndo: restored, replaceAll: all, undo, rowsMounted: before })`,
      ),
    );
  }
  log('replace all');

  // Timeline: the mounted count when centered at 100%; one zoom step (100% → ⌘= → ⌘-) and fit-to-view, three times each; the number of steps needed to reach maximum zoom (pressing ⌘= repeatedly until the width stops changing);
  // continuous horizontal scrolling at maximum zoom and at 100% (then scroll to 50% and count the mounted items).
  const z100 = () => ev(`await window.__run(window.__z.z100); await window.__sleep(800); return 1`);
  const zoomStep = (fn) =>
    J(
      `const sc = window.__tl().querySelector('.cc-scroll'); const w0 = sc.scrollWidth; const r = await window.__measure(window.__z.${fn});
       return JSON.stringify({ ...r, w0, w1: sc.scrollWidth, clips: window.__mountedTl().clips })`,
    );
  await ev(
    `await window.__run(window.__z.z100); const sc = window.__tl().querySelector('.cc-scroll'); sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; await window.__sleep(1500); return 1`,
  );
  result.timeline = { mounted100: await J(`return JSON.stringify(window.__mountedTl())`), zoomIn: [], zoomOut: [], fit: [] };
  for (let i = 0; i < 3; i++) {
    await z100();
    result.timeline.zoomIn.push(await zoomStep('zin'));
    await page.sleep(800);
    result.timeline.zoomOut.push(await zoomStep('zout'));
    await page.sleep(800);
    result.timeline.fit.push(
      await J(`const r = await window.__measure(window.__z.fit); return JSON.stringify({ ...r, ...window.__mountedTl() })`),
    );
    await page.sleep(800);
  }
  log('zoom and fit whole clip');
  await z100();
  result.timeline.maxSteps = await J(
    `const sc = window.__tl().querySelector('.cc-scroll'); let n = 0;
     for (; n < 20; n++) { const w = sc.scrollWidth; await window.__run(window.__z.zin); if (sc.scrollWidth === w) break; }
     return JSON.stringify(n)`,
  );
  for (const [name, back100] of [
    ['max', false],
    ['100%', true],
  ]) {
    if (back100) await z100();
    result.timeline[`scroll ${name}`] = await J(
      `const sc = window.__tl().querySelector('.cc-scroll'); sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * 0.3; await window.__sleep(1000);
       await window.__frames(sc, 'x', ${px}, 60); await window.__sleep(500);
       const d = await window.__frames(sc, 'x', ${px}, ${frames}); await window.__sleep(500);
       const f = await window.__frames(sc, 'x', ${fast}, ${frames}); await window.__sleep(800);
       sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * 0.5; await window.__sleep(1500);
       return JSON.stringify({ scroll: window.__stats(d), fast: window.__stats(f), mounted: window.__mountedTl() })`,
    );
  }
  log('timeline scroll');
  return result;
}
