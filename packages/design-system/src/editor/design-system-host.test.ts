// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { SlidesHost } from '@cuccut/slides/editor';
import type { DesignSystemHostWindow } from './design-system-host.ts';
import { createDesignSystemHost, installDesignSystemEditorHost, readSessionUserName } from './index.ts';

/** Fake fetch that records requests and returns preset responses. */
function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  };
  return { impl, calls };
}

/** Stand-in for the editor host object: records the arguments the upload received. */
function fakeSlidesHost(extra: Partial<SlidesHost> = {}) {
  const uploads: unknown[][] = [];
  const publish = vi.fn(async () => ({ version: 'v1', seq: 1, shas: {} }));
  const host: SlidesHost = {
    artifact: { publish },
    self: { publish },
    user: { id: async () => 'user_local', canEdit: async () => true, can: async () => true, profiles: async () => ({}) },
    assets: {
      upload: async (...args) => {
        uploads.push(args);
        return { id: 'a'.repeat(32), url: '/_blob/' + 'a'.repeat(32) };
      },
    },
    ...extra,
  };
  return { host, uploads, publish };
}

/** Fake window for the few things connectEditorHost and the annotation target layer use (the page is happy-dom); when framed, parent is a different object. */
function fakeWindow(respond: (url: string) => Response, framed = false) {
  const { impl, calls } = fakeFetch(respond);
  const posted: unknown[] = [];
  const listeners: ((event: MessageEvent) => void)[] = [];
  const types: string[] = [];
  const win = {
    location: { href: 'http://127.0.0.1:24321/design-system/g1/?path=brand%2Facme&lang=en', search: '?path=brand%2Facme&lang=en' },
    fetch: impl,
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      types.push(type);
      if (type === 'message') listeners.push(listener);
    },
    removeEventListener: () => {},
    document,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  } as unknown as DesignSystemHostWindow;
  (win as unknown as { parent: unknown }).parent = framed ? { postMessage: (message: unknown) => posted.push(message) } : win;
  return { win, calls, posted, listeners, types };
}

describe('readSessionUserName', () => {
  it('reads userName from <base>__deck/session, reads it only once', async () => {
    const { impl, calls } = fakeFetch(() => Response.json({ canEdit: true, userName: 'jim' }));
    const name = readSessionUserName('/design-system/g1/', impl);
    expect(await name()).toBe('jim');
    expect(await name()).toBe('jim');
    expect(calls.map(c => c.url)).toEqual(['/design-system/g1/__deck/session']);
    expect(calls[0]!.init.cache).toBe('no-store');
  });

  it('empty string when missing, not a string, HTTP failure or request failure', async () => {
    for (const respond of [
      () => Response.json({ canEdit: true }),
      () => Response.json({ userName: 42 }),
      () => Response.json(null),
      () => new Response('nope', { status: 500 }),
      () => Promise.reject(new Error('offline')),
    ]) {
      const { impl } = fakeFetch(respond);
      expect(await readSessionUserName('/', impl)()).toBe('');
    }
  });
});

describe('createDesignSystemHost', () => {
  it('no annotations, annotation labels and use; file, user and session capabilities are passed through', async () => {
    const chat = { suggestPrompt: async () => {} };
    const { host, publish } = fakeSlidesHost({
      chat,
      comments: { customAnchors: async () => ({}) as never },
      commentLabels: {} as never,
      use: async () => null,
    });
    const ds = createDesignSystemHost(host, async () => 'jim');
    expect(Object.keys(ds).sort()).toEqual(['artifact', 'assets', 'chat', 'self', 'user']);
    expect(ds.chat).toBe(chat);
    await ds.self.publish({});
    await ds.artifact.publish({});
    expect(publish).toHaveBeenCalledTimes(2);
    expect(await ds.user.id()).toBe('user_local');
    expect(await ds.user.canEdit()).toBe(true);
    expect(await ds.user.can('files.write')).toBe(true);
    expect(await ds.user.name()).toBe('jim');
  });

  it('no chat when there is no session (page opened on its own)', () => {
    const { host } = fakeSlidesHost();
    expect('chat' in createDesignSystemHost(host, async () => '')).toBe(false);
  });

  it('upload does not use the filename given by the runtime, only passes type', async () => {
    const { host, uploads } = fakeSlidesHost();
    const ds = createDesignSystemHost(host, async () => '');
    const file = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    expect(await ds.assets.upload(file, { type: 'image/svg+xml', name: 'logo.svg' })).toEqual({
      id: 'a'.repeat(32),
      url: '/_blob/' + 'a'.repeat(32),
    });
    await ds.assets.upload(file, { name: 'logo.svg' });
    await ds.assets.upload(file);
    expect(uploads).toEqual([
      [file, { type: 'image/svg+xml' }],
      [file, undefined],
      [file, undefined],
    ]);
  });
});

describe('installDesignSystemEditorHost', () => {
  it('installs globalThis.designSystemHost: routes are relative to the page\'s directory; no chat when opened on its own', async () => {
    const { win, calls } = fakeWindow(url =>
      url.endsWith('__deck/session') ? Response.json({ canEdit: false, userName: 'jim' }) : Response.json({ version: 'v1', seq: 1, shas: {} }),
    );
    installDesignSystemEditorHost({ win });
    const ds = win.designSystemHost!;
    expect(Object.keys(ds).sort()).toEqual(['artifact', 'assets', 'self', 'user']);
    expect(await ds.user.canEdit()).toBe(false);
    expect(await ds.user.name()).toBe('jim');
    await ds.self.publish({ 'project/README.md': { content: '# Acme', contentType: 'text/markdown' } });
    const base = 'http://127.0.0.1:24321/design-system/g1/';
    expect(calls.map(c => c.url)).toEqual([base + '__deck/session', base + '__deck/session', base + '__deck/publish']);
  });

  it('inside CucCut\'s iframe there is chat (the prompt is handed to the parent window); the runtime does not call comments, annotations go to the target layer', async () => {
    const { win, posted, types } = fakeWindow(() => Response.json({ canEdit: true }), true);
    installDesignSystemEditorHost({ win });
    const ds = win.designSystemHost!;
    expect(Object.keys(ds).sort()).toEqual(['artifact', 'assets', 'chat', 'self', 'user']);
    // The target layer (comment-targets.ts) intercepts clicks on the page and listens for C and Esc; the styles are installed only once
    expect(types).toEqual(expect.arrayContaining(['click', 'pointerdown', 'keydown']));
    expect(document.querySelectorAll('#cuccut-comment-targets')).toHaveLength(1);
    void ds.chat!.suggestPrompt('Agent: read the design-system skill').catch(() => {});
    expect(posted).toContainEqual(expect.objectContaining({ type: 'editor:suggest-prompt', prompt: 'Agent: read the design-system skill' }));
    expect(await ds.user.name()).toBe('');
  });
});
