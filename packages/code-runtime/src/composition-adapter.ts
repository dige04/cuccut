/**
 * The unified frame-fetching script in the page (code bundle spec §4.1, §4.7; architecture design §8.3–§8.4).
 *
 * After the entry page finishes loading, the host injects `COMPOSITION_ADAPTER_SCRIPT` with `webContents.executeJavaScript`, which yields
 * `window.__cuccutAdapter = { ready, seek }`. Neither method throws. Instead, each resolves to an envelope:
 * `{ ok: true, value }` or `{ ok: false, code, message }`, where `code` is taken from `CODE_BUNDLE_ERROR_CODES`.
 * This way, the error codes from the page do not depend on how Electron serializes a rejected Promise.
 *
 * - `hyperframes/1`: polls `window.__timelines[id]`. The root element is `[data-composition-id="id"]`, and size, frame rate and duration are read from the root element's `data-*` attributes.
 *   `seek(seconds)` calls the timeline's `seek` (or `progress` if there is none), then reads back `time()`. When the timeline is shorter than `data-duration`, requests past its end are treated as hold.
 * - `cuccut/1`: polls `window.__cuccutCompositions[id]` (`initialize` / `renderAt(time, params)` / `dispose`).
 *   `renderAt(time, params)` receives a `MediaTime` on a microsecond time base (`ticks = round(seconds × 10⁶)`) and an empty parameter object `{}`.
 *   If it resolves to a number, that is taken as the number of seconds actually sampled. Otherwise, the sample time is the target time.
 *
 * After each seek, it waits for two `requestAnimationFrame` calls so the DOM commits before the screenshot (§8.4: this is only a candidate waiting strategy).
 */

/** The page information resolved by `ready`. Fields the page does not provide are null, and the host fills them in from the manifest. */
export interface AdapterPageInfo {
  compositionId: string;
  width: number | null;
  height: number | null;
  /** The raw text of the root element's `data-fps` (`"30"`, `"30000/1001"`). */
  fps: string | null;
  durationSeconds: number;
}

export interface AdapterSeekResult {
  sampledSeconds: number;
  /** The actual target time evaluated (clamped to `[0, duration]`; when it is past the timeline's own length, the timeline's length is used). */
  targetSeconds: number;
  /** The request exceeded the duration and was clamped to the end. */
  clamped: boolean;
}

/** The context the host passes to `ready` (from the manifest). */
export interface AdapterReadyContext {
  width: number;
  height: number;
  fps: { num: number; den: number };
  durationFrames: number;
}

// i18n-ignore-start: source code of the injected page script, not user-facing text
export const COMPOSITION_ADAPTER_SCRIPT = String.raw`(() => {
  if (window.__cuccutAdapter) return;
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const twoFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const guard = async (fn) => {
    try {
      return { ok: true, value: await fn() };
    } catch (error) {
      const code = error && typeof error.code === 'string' && error.code.indexOf('COMPOSITION_') === 0 ? error.code : 'COMPOSITION_SCRIPT_ERROR';
      return { ok: false, code, message: String((error && error.message) || error) };
    }
  };
  const poll = async (get, timeoutMs, code, message) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = get();
      if (value) return value;
      if (Date.now() >= deadline) throw fail(code, message);
      await sleep(16);
    }
  };
  const findRoot = (id) => {
    const escaped = window.CSS && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"');
    return document.querySelector('[data-composition-id="' + escaped + '"]');
  };
  const numberAttr = (root, name) => {
    const raw = root.getAttribute(name);
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const fontsReady = async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  };
  const readDuration = (tl) => {
    const d = typeof tl.duration === 'function' ? tl.duration() : tl.duration;
    return typeof d === 'number' && Number.isFinite(d) ? d : null;
  };

  let state = null;

  const readyHyperframes = async (id, timeoutMs) => {
    const tl = await poll(
      () => window.__timelines && window.__timelines[id],
      timeoutMs,
      'COMPOSITION_TIMELINE_MISSING',
      'window.__timelines["' + id + '"] was not registered within ' + timeoutMs + ' ms',
    );
    const root = findRoot(id);
    if (!root) throw fail('COMPOSITION_ROOT_MISSING', 'No element with data-composition-id="' + id + '"');
    await fontsReady();
    if (typeof tl.pause === 'function') tl.pause();
    const dataDuration = numberAttr(root, 'data-duration');
    const ownDuration = readDuration(tl);
    const duration = dataDuration !== null ? dataDuration : ownDuration;
    if (!(typeof duration === 'number' && duration > 0)) throw fail('COMPOSITION_TIMELINE_MISSING', 'The timeline has no duration and the root has no data-duration');
    state = { contract: 'hyperframes/1', id, tl, root, duration, ownDuration };
    return {
      compositionId: id,
      width: numberAttr(root, 'data-width'),
      height: numberAttr(root, 'data-height'),
      fps: root.getAttribute('data-fps'),
      durationSeconds: duration,
    };
  };

  const readyNative = async (id, timeoutMs, ctx) => {
    const comp = await poll(
      () => window.__cuccutCompositions && window.__cuccutCompositions[id],
      timeoutMs,
      'COMPOSITION_TIMELINE_MISSING',
      'window.__cuccutCompositions["' + id + '"] was not registered within ' + timeoutMs + ' ms',
    );
    if (typeof comp.renderAt !== 'function') throw fail('COMPOSITION_TIMELINE_MISSING', 'The composition has no renderAt(time, params)');
    const root = findRoot(id);
    if (!root) throw fail('COMPOSITION_ROOT_MISSING', 'No element with data-composition-id="' + id + '"');
    await fontsReady();
    if (typeof comp.initialize === 'function') {
      await comp.initialize({
        compositionId: id,
        target: root,
        width: ctx.width,
        height: ctx.height,
        pixelRatio: 1,
        intrinsicFps: ctx.fps,
        fps: ctx.fps,
        durationFrames: ctx.durationFrames,
        seed: id,
        parameters: {},
        fonts: { ready: fontsReady },
        assets: { resolve: async (assetId) => { throw fail('COMPOSITION_SCRIPT_ERROR', 'Asset ' + assetId + ' is not available'); } },
      });
    }
    const dataDuration = numberAttr(root, 'data-duration');
    const duration = dataDuration !== null ? dataDuration : (ctx.durationFrames * ctx.fps.den) / ctx.fps.num;
    state = { contract: 'cuccut/1', id, comp, root, duration };
    return {
      compositionId: id,
      width: numberAttr(root, 'data-width'),
      height: numberAttr(root, 'data-height'),
      fps: root.getAttribute('data-fps'),
      durationSeconds: duration,
    };
  };

  const seekHyperframes = async (seconds) => {
    const { tl, duration, ownDuration } = state;
    const clamped = seconds > duration;
    let target = Math.min(Math.max(seconds, 0), duration);
    // 时间线比 data-duration 短：越过时间线末尾的部分是 hold。
    if (typeof ownDuration === 'number' && ownDuration > 0 && target > ownDuration) target = ownDuration;
    if (typeof tl.seek === 'function') tl.seek(target);
    else if (typeof tl.progress === 'function') tl.progress(target / (ownDuration || duration));
    else throw fail('COMPOSITION_TIMELINE_MISSING', 'The timeline has neither seek() nor progress()');
    let sampled = target;
    if (typeof tl.time === 'function') sampled = tl.time();
    else if (typeof tl.progress === 'function') sampled = tl.progress() * (ownDuration || duration);
    await twoFrames();
    return { sampledSeconds: Number(sampled), targetSeconds: target, clamped };
  };

  const seekNative = async (seconds) => {
    const { comp, duration } = state;
    const clamped = seconds > duration;
    const target = Math.min(Math.max(seconds, 0), duration);
    const mediaTime = { ticks: String(Math.round(target * 1000000)), timescale: 1000000 };
    const returned = await comp.renderAt(mediaTime, {});
    await twoFrames();
    const sampled = typeof returned === 'number' && Number.isFinite(returned) ? returned : target;
    return { sampledSeconds: sampled, targetSeconds: target, clamped };
  };

  window.__cuccutAdapter = {
    ready: (contract, compositionId, timeoutMs, ctx) =>
      guard(() => {
        if (contract === 'hyperframes/1') return readyHyperframes(compositionId, timeoutMs);
        if (contract === 'cuccut/1') return readyNative(compositionId, timeoutMs, ctx);
        throw fail('COMPOSITION_SCRIPT_ERROR', 'Unknown contract ' + contract);
      }),
    seek: (seconds) =>
      guard(() => {
        if (!state) throw fail('COMPOSITION_TIMELINE_MISSING', 'ready() has not completed');
        return state.contract === 'hyperframes/1' ? seekHyperframes(seconds) : seekNative(seconds);
      }),
    dispose: () =>
      guard(() => {
        if (state && state.comp && typeof state.comp.dispose === 'function') state.comp.dispose();
        state = null;
        return true;
      }),
  };
})();
true;`;
// i18n-ignore-end
