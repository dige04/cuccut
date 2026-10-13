import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { intlLocale } from '@cuccut/protocol';
import { RcWeb } from '@cuccut/protocol/messages/runtime-core';
import { mimeTypeOf, resolveInside } from '../media.ts';

/**
 * Static pages of the web service (architecture design §4.8, §12.8): the web client's build output, the login page shown when not logged in, and the security headers carried by every response.
 */

/**
 * Finds the web client's build-output directory (the one containing `index.html`). It checks the `CUCCUT_WEB_DIST` environment variable. In the packaged app it is `<resources>/web`.
 * In development, it walks up from this module to find `apps/web/dist` in the repository. Null if none is found.
 */
export function resolveWebDist(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CUCCUT_WEB_DIST) return env.CUCCUT_WEB_DIST;
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = path.join(resources, 'web');
    if (fs.existsSync(path.join(bundled, 'index.html'))) return bundled;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const built = path.join(dir, 'apps', 'web', 'dist');
    if (fs.existsSync(path.join(built, 'index.html'))) return built;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Headers carried by every response: no MIME sniffing, no Referer, cannot be embedded, and no sharing of windows and resources with other origins. */
export function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}

/**
 * CSP of the web client page: own origin only. The exceptions are needed by the build output and match the desktop renderer process:
 * `'wasm-unsafe-eval'` compiles WebAssembly for previews (it does not allow eval), and `style-src 'unsafe-inline'` is for React Spectrum's inline styles.
 * Fonts may be loaded from Typekit. Connections go only to this service's own WebSocket.
 */
export function appCsp(port: number): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    // The design draft editor is on another loopback hostname of this service (docs/design/canvas §6.2).
    `frame-src 'self' blob: http://127.0.0.1:${port} http://localhost:${port}`,
    "font-src 'self' blob: data: https://use.typekit.net",
    `connect-src 'self' blob: ws://127.0.0.1:${port} ws://localhost:${port}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const LOGIN_CSP =
  "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The login page (current language). Commands in the text are wrapped in `<code>`. They are assembled here and then passed to the text as arguments. */
function loginHtml(): string {
  const t = (message: { text: string }) => escapeHtml(message.text);
  const launch = '<code>cuccut web open --launch</code>';
  const open = '<code>cuccut web open</code>';
  return `<!doctype html>
<html lang="${escapeHtml(intlLocale())}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="no-referrer" />
    <title>CucCut</title>
    <style>
      body { margin: 0; font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif; background: #f5f5f4; color: #1c1917; }
      main { max-width: 520px; margin: 18vh auto 0; padding: 0 24px; }
      h1 { font-size: 22px; margin: 0 0 12px; }
      code { background: #e7e5e4; padding: 2px 6px; border-radius: 4px; }
      form { display: flex; gap: 8px; margin-top: 20px; }
      input { flex: 1; min-width: 0; font: inherit; font-family: ui-monospace, Menlo, monospace; padding: 6px 10px; border: 1px solid #a8a29e; border-radius: 6px; background: #fff; color: inherit; }
      button { font: inherit; padding: 6px 16px; border: 0; border-radius: 6px; background: #1c1917; color: #f5f5f4; cursor: pointer; }
      button:disabled { opacity: 0.5; cursor: default; }
      #status { margin-top: 16px; color: #57534e; min-height: 1.6em; }
      @media (prefers-color-scheme: dark) {
        body { background: #1c1917; color: #f5f5f4; } code { background: #292524; } #status { color: #a8a29e; }
        input { background: #292524; border-color: #57534e; } button { background: #f5f5f4; color: #1c1917; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${t(RcWeb.loginTitle())}</h1>
      <p>${loginInstructions(launch, open)}</p>
      <p>${t(RcWeb.loginCodeOnce())}</p>
      <form id="login" autocomplete="off">
        <input id="code" name="code" type="text" autocomplete="one-time-code" aria-label="${t(RcWeb.accessCode())}" placeholder="${t(RcWeb.accessCode())}" spellcheck="false" autocapitalize="off" required />
        <button id="submit" type="submit">${t(RcWeb.signIn())}</button>
      </form>
      <p id="status" role="status"></p>
    </main>
    <script src="/_auth/login.js"></script>
  </body>
</html>
`;
}

/** The explanation contains two HTML fragments (`<code>…</code>`). Text is first taken via placeholders and escaped, then the HTML is swapped back in. */
function loginInstructions(launch: string, open: string): string {
  const text = escapeHtml(RcWeb.loginInstructions({ launch: '\u0000launch\u0000', open: '\u0000open\u0000' }).text);
  return text.replace('\u0000launch\u0000', launch).replace('\u0000open\u0000', open);
}

/**
 * The login page's script. The access code comes from the link's fragment (which is removed from the address bar right away), or the user pastes it into the input box. `cuccut web open --launch`
 * opens the address without a code, and the code is printed only in the terminal. The script uses it to exchange for the session cookie, and then loads the client. The form is not submitted (the CSP is `form-action 'none'`).
 * The script sends the request.
 */
function loginJs(): string {
  const text = {
    signingIn: RcWeb.signingIn().text,
    rejected: RcWeb.codeRejected().text,
    unreachable: RcWeb.cannotReach().text,
    malformed: RcWeb.codeMalformed().text,
  };
  return `(() => {
  const TEXT = ${JSON.stringify(text)};
  const status = document.getElementById('status');
  const form = document.getElementById('login');
  const input = document.getElementById('code');
  const submit = document.getElementById('submit');
  const CODE = /^[A-Za-z0-9_-]{16,128}$/;
  const fromHash = /(?:^|&)code=([A-Za-z0-9_-]{16,128})(?:&|$)/.exec(location.hash.slice(1));
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  let busy = false;
  const exchange = (code) => {
    if (busy) return;
    busy = true;
    submit.disabled = true;
    status.textContent = TEXT.signingIn;
    fetch('/_auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(
        (response) => {
          // Return to the access link path and query so the client opens the requested video.
          if (response.ok) return location.replace(location.pathname + location.search);
          status.textContent = TEXT.rejected;
        },
        () => {
          status.textContent = TEXT.unreachable;
        },
      )
      .finally(() => {
        busy = false;
        submit.disabled = false;
        input.value = '';
      });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // Also accept a whole access link: take the code out of it.
    const text = input.value.trim();
    const code = (/(?:#|&)code=([A-Za-z0-9_-]+)/.exec(text) || [null, text])[1];
    if (!CODE.test(code)) {
      status.textContent = TEXT.malformed;
      return;
    }
    exchange(code);
  });

  if (fromHash) exchange(fromHash[1]);
  else input.focus();
})();
`;
}

export function sendLoginPage(request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': LOGIN_CSP,
    'Cache-Control': 'no-store',
  });
  response.end(request.method === 'HEAD' ? undefined : loginHtml());
}

export function sendLoginScript(request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : loginJs());
}

const STATIC_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  wasm: 'application/wasm',
  map: 'application/json; charset=utf-8',
  ico: 'image/x-icon',
  woff: 'font/woff',
};

function staticType(file: string): string {
  return STATIC_TYPES[path.extname(file).slice(1).toLowerCase()] ?? mimeTypeOf(file);
}

/** A file in the build output. Only regular files inside the directory (by real path). Returns 404 if absent. HTML carries the client's CSP. */
export async function sendStatic(
  dist: string,
  pathname: string,
  port: number,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  let relative: string;
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (relative === '') relative = 'index.html';
  // Hidden files and `..` are not served. Everything else is confirmed to be inside the directory by real path, via resolveInside.
  const hidden = relative.split(/[/\\]/).some((part) => part.startsWith('.'));
  const found = hidden ? null : await resolveInside(dist, relative).catch(() => null);
  if (!found) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(RcWeb.fileNotFound().text);
    return;
  }
  const type = staticType(found.realPath);
  const html = type.startsWith('text/html');
  const body = request.method === 'HEAD' ? null : await fsp.readFile(found.realPath);
  response.writeHead(200, {
    'Content-Type': type,
    'Content-Length': found.size,
    'Cache-Control': html ? 'no-store' : 'private, no-cache',
    ...(html ? { 'Content-Security-Policy': appCsp(port) } : {}),
  });
  response.end(body ?? undefined);
}
