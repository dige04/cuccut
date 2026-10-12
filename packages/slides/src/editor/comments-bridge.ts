/**
 * 标注的桥（docs/design/slides §8.2）：运行时的 `comments.customAnchors` 在 iframe 里，批注框与草稿在父窗口。
 *
 * 1. 用户在编辑器里打开标注模式（运行时的按钮、快捷键 C，或父窗口的 `editor:set-mode`），点一个元素或框一块区域；
 * 2. 运行时调 `compose(anchor, point, { label, detail, area })`，这里转成 `editor:compose` 发给父窗口；
 * 3. 父窗口在对应位置弹出批注框，回 `editor:compose-result`；关掉时回 `editor:composer-closed`；
 * 4. 父窗口把草稿里属于这份 deck 的标注经 `editor:threads` 交回来，运行时算出位置（`placed`），这里画编号标记。
 *
 * 标记只是显示，不接收点击：运行时在标注模式下把容器外的按下当作退出标注模式。
 */
import type { EditorPoint, EditorThread, EditorToHostMessage, HostToEditorMessage } from '../editor-messages.ts';
import { readHostMessage } from '../editor-messages.ts';
import type { HostCommentsCapability, CommentAnchorController, CommentAnchorHandlers } from './slides-host.ts';

/** 与父窗口的通道。 */
export interface ParentLink {
  post(message: EditorToHostMessage): void;
  onMessage(listener: (message: HostToEditorMessage) => void): () => void;
}

/** 在 iframe 里时连到父窗口；页面单独打开（不在 iframe 里）时 null。 */
export function windowParentLink(win: Window): ParentLink | null {
  if (win.parent === win) return null;
  return {
    post: message => win.parent.postMessage(message, '*'),
    onMessage: listener => {
      const handle = (event: MessageEvent) => {
        if (event.source !== win.parent) return;
        const message = readHostMessage(event.data);
        if (message) listener(message);
      };
      win.addEventListener('message', handle);
      return () => win.removeEventListener('message', handle);
    },
  };
}

/** 画编号标记的图层。 */
export interface PinLayer {
  /** `positions` 是文档坐标；只画在 `threads` 里有编号的（`n` 不大于 0 的是父窗口为跳转临时给的，不画）。 */
  render(positions: Record<string, EditorPoint>, threads: readonly EditorThread[]): void;
  clear(): void;
}

/** 文档里的一层绝对定位的编号标记（S2 蓝底白字的圆）。 */
export function domPinLayer(doc: Document): PinLayer {
  let layer: HTMLDivElement | null = null;
  const ensure = () => {
    if (layer?.isConnected) return layer;
    layer = doc.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none';
    doc.body.appendChild(layer);
    return layer;
  };
  return {
    render(positions, threads) {
      const root = ensure();
      root.replaceChildren(
        ...threads
          .filter(t => t.n > 0 && positions[t.id])
          .map(t => {
            const { x, y } = positions[t.id]!;
            const pin = doc.createElement('div');
            pin.textContent = String(t.n);
            pin.style.cssText = [
              'position:absolute',
              `left:${x}px`,
              `top:${y}px`,
              'transform:translate(-50%,-50%)',
              'min-width:24px',
              'height:24px',
              'padding:0 6px',
              'box-sizing:border-box',
              'border-radius:999px',
              'background:#3B63FB',
              'color:#FFFFFF',
              'font:700 12px/24px system-ui,sans-serif',
              'text-align:center',
              'box-shadow:0 1px 4px rgba(0,0,0,.3)',
            ].join(';');
            return pin;
          }),
      );
    },
    clear() {
      layer?.replaceChildren();
    },
  };
}

export interface CommentsBridge {
  capability: HostCommentsCapability;
  /** 标注模式开着没有。 */
  readonly mode: boolean;
  /** 停止收父窗口的消息。 */
  dispose(): void;
}

/** 批注框没回应时多久算没打开。 */
const COMPOSE_TIMEOUT_MS = 10_000;

export function createCommentsBridge(link: ParentLink, pins: PinLayer, newId: () => string = () => crypto.randomUUID()): CommentsBridge {
  let handlers: CommentAnchorHandlers | null = null;
  let mode = false;
  let threads: EditorThread[] = [];
  let lastPositions: Record<string, EditorPoint> = {};
  /** 正开着批注框的那次 compose。 */
  let composing: string | null = null;
  const pending = new Map<string, (result: { opened: boolean }) => void>();

  const feedThreads = () =>
    handlers?.threads(threads.map(t => ({ id: t.id, anchor: t.anchor, active: false, ...(t.section ? { section: t.section } : {}) })));
  const setMode = (on: boolean) => {
    if (mode === on) return;
    mode = on;
    handlers?.mode(on);
    // 运行时关标注模式时会清空它手上的标注，再打开要重新给
    if (on) feedThreads();
    else pins.clear();
    link.post({ type: 'editor:mode', on });
  };
  const settle = (requestId: string, opened: boolean) => {
    const resolve = pending.get(requestId);
    if (!resolve) return;
    pending.delete(requestId);
    if (!opened && composing === requestId) {
      composing = null;
      handlers?.composing(false);
    }
    resolve({ opened });
  };

  const stop = link.onMessage(message => {
    switch (message.type) {
      case 'editor:threads':
        threads = message.threads;
        feedThreads();
        pins.render(lastPositions, threads);
        return;
      case 'editor:compose-result':
        settle(message.requestId, message.opened);
        return;
      case 'editor:composer-closed':
        if (composing === message.requestId) {
          composing = null;
          handlers?.composing(false);
        }
        return;
      case 'editor:reveal':
        handlers?.reveal(message.id);
        return;
      case 'editor:set-mode':
        setMode(message.on);
        return;
      case 'editor:flush':
        // 由 editor-host 处理
        return;
      case 'editor:suggest-prompt-result':
        // 由 chat-bridge 处理
        return;
    }
  });

  const capability: HostCommentsCapability = {
    async customAnchors(next) {
      handlers = next;
      if (mode) next.mode(true);
      feedThreads();
      const controller: CommentAnchorController = {
        areas: true,
        compose(anchor, point, description) {
          const requestId = newId();
          // 上一次还开着就先当它关了：父窗口同一时间只开一个批注框
          if (composing !== null) settle(composing, false);
          composing = requestId;
          handlers?.composing(true);
          const result = new Promise<{ opened: boolean }>(resolve => {
            pending.set(requestId, resolve);
            setTimeout(() => settle(requestId, false), COMPOSE_TIMEOUT_MS);
          });
          const scroll = { x: globalThis.scrollX ?? 0, y: globalThis.scrollY ?? 0 };
          link.post({
            type: 'editor:compose',
            requestId,
            anchor,
            point: { x: point.x - scroll.x, y: point.y - scroll.y },
            label: description.label,
            ...(description.detail ? { detail: description.detail } : {}),
            ...(description.area ? { area: true } : {}),
            ...(description.section ? { section: description.section } : {}),
          });
          return result;
        },
        placed(positions) {
          lastPositions = positions;
          pins.render(positions, threads);
        },
        enterMode: () => setMode(true),
        exitMode: () => setMode(false),
        release() {
          if (handlers === next) handlers = null;
          pins.clear();
        },
      };
      return controller;
    },
  };

  return {
    capability,
    get mode() {
      return mode;
    },
    dispose() {
      stop();
      for (const id of [...pending.keys()]) settle(id, false);
      pins.clear();
    },
  };
}
