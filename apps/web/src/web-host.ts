import type { HostBridge } from '@cuccut/ui';
import { M } from './web-host-copy.ts';

/**
 * Host capabilities in the browser (architecture design §4.8). The desktop preload script provides native capabilities; the browser cannot get local paths, so these capabilities degrade to
 * "unavailable" with an explanation, and the UI otherwise works as normal:
 *
 * - Connection: same-origin `/ws`. The login state is in an HttpOnly cookie; the page cannot read it and does not need a token (the token in the handshake is empty, and the service does not check it).
 * - Choosing a folder, choosing media files, dropping files in: the browser cannot give a file's path on disk, so importing by path is unavailable; session files are handled through a separate same-origin attachment upload channel.
 * - Show in folder: unavailable.
 */

const NOTICE_ID = 'cuccut-web-notice';
const NOTICE_MS = 6000;

let timer: ReturnType<typeof setTimeout> | undefined;

/** A hint at the bottom of the page that disappears after a few seconds. It does not depend on components from the UI package, because the UI package does not know it is running in a browser. */
function notice(text: string): void {
  let node = document.getElementById(NOTICE_ID);
  if (!node) {
    node = document.createElement('div');
    node.id = NOTICE_ID;
    node.setAttribute('role', 'status');
    Object.assign(node.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      maxWidth: 'min(560px, calc(100vw - 32px))',
      padding: '10px 16px',
      borderRadius: '8px',
      background: 'rgba(28, 25, 23, 0.92)',
      color: '#fafaf9',
      font: '14px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      zIndex: '2147483647',
    });
    document.body.append(node);
  }
  node.textContent = text;
  clearTimeout(timer);
  timer = setTimeout(() => node?.remove(), NOTICE_MS);
}

export const webHost: HostBridge = {
  platform: 'web',
  supportsImageAttachments: true,
  supportsFileAttachments: true,
  async getConnection() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    return { endpoint: `${scheme}://${location.host}/ws`, token: '' };
  },
  async pickDirectory(_options?: { title?: string }) {
    notice(M.pickDirectory);
    return null;
  },
  async pickMediaFiles() {
    notice(M.pickMedia);
    return [];
  },
  pathForFile() {
    notice(M.dropFiles);
    return '';
  },
  async revealPath() {
    notice(M.reveal);
  },
};
