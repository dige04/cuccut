/**
 * Bridge for annotations (docs/design/slides §8.2). The runtime's `comments.customAnchors` runs in the iframe, while the composer and drafts live in the parent window.
 *
 * 1. The user turns on annotation mode in the editor (the runtime's button, the C shortcut, or the parent's `editor:set-mode`), then clicks an element or drags out an area;
 * 2. The runtime calls `compose(anchor, point, { label, detail, area })`, which is forwarded here as `editor:compose` to the parent window;
 * 3. The parent window opens the composer at the matching position and replies with `editor:compose-result`; when it closes, it replies with `editor:composer-closed`;
 * 4. The parent window sends back the annotations in its drafts that belong to this deck via `editor:threads`; the runtime computes their positions (`placed`), and here the numbered markers are drawn.
 *
 * Markers are display only and do not take clicks: in annotation mode, the runtime treats a press outside the container as leaving annotation mode.
 */
import type { EditorPoint, EditorThread, EditorToHostMessage, HostToEditorMessage } from '../editor-messages.ts';
import { readHostMessage } from '../editor-messages.ts';
import type { HostCommentsCapability, CommentAnchorController, CommentAnchorHandlers } from './slides-host.ts';

/** Channel to the parent window. */
export interface ParentLink {
  post(message: EditorToHostMessage): void;
  onMessage(listener: (message: HostToEditorMessage) => void): () => void;
}

/** Connects to the parent window when running inside an iframe; null when the page is opened on its own (not in an iframe). */
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

/** Layer that draws the numbered markers. */
export interface PinLayer {
  /** `positions` are document coordinates. Only threads that have a number in `threads` are drawn (those with `n` not greater than 0 are temporary ones the parent window provides for jumping, and are not drawn). */
  render(positions: Record<string, EditorPoint>, threads: readonly EditorThread[]): void;
  clear(): void;
}

/** A layer of absolutely positioned numbered markers in the document (S2 white-on-blue circles). */
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
  /** Whether annotation mode is on. */
  readonly mode: boolean;
  /** Stops listening to messages from the parent window. */
  dispose(): void;
}

/** How long to wait for the composer to respond before treating it as not opened. */
const COMPOSE_TIMEOUT_MS = 10_000;

export function createCommentsBridge(link: ParentLink, pins: PinLayer, newId: () => string = () => crypto.randomUUID()): CommentsBridge {
  let handlers: CommentAnchorHandlers | null = null;
  let mode = false;
  let threads: EditorThread[] = [];
  let lastPositions: Record<string, EditorPoint> = {};
  /** The compose call whose composer is currently open. */
  let composing: string | null = null;
  const pending = new Map<string, (result: { opened: boolean }) => void>();

  const feedThreads = () =>
    handlers?.threads(threads.map(t => ({ id: t.id, anchor: t.anchor, active: false, ...(t.section ? { section: t.section } : {}) })));
  const setMode = (on: boolean) => {
    if (mode === on) return;
    mode = on;
    handlers?.mode(on);
    // When the runtime turns off annotation mode it clears the annotations it holds, so they must be given again when it is turned back on
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
        // Handled by editor-host
        return;
      case 'editor:suggest-prompt-result':
        // Handled by chat-bridge
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
          // If one is still open, close it first: the parent window only opens one composer at a time
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
