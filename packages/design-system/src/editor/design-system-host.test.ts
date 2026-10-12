// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { SlidesHost } from '@cuccut/slides/editor';
import type { DesignSystemHostWindow } from './design-system-host.ts';
import { createDesignSystemHost, installDesignSystemEditorHost, readSessionUserName } from './index.ts';

/** 记录请求、按预设返回响应的假 fetch。 */
function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  };
  return { impl, calls };
}

/** 编辑器宿主对象的替身：记下上传收到的参数。 */
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

/** connectEditorHost 与标注的目标层用到的那几样的假窗口（页面是 happy-dom 的）；framed 时 parent 是另一个对象。 */
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
  it('读 <base>__deck/session 的 userName，只读一次', async () => {
    const { impl, calls } = fakeFetch(() => Response.json({ canEdit: true, userName: 'jim' }));
    const name = readSessionUserName('/design-system/g1/', impl);
    expect(await name()).toBe('jim');
    expect(await name()).toBe('jim');
    expect(calls.map(c => c.url)).toEqual(['/design-system/g1/__deck/session']);
    expect(calls[0]!.init.cache).toBe('no-store');
  });

  it('没有、不是字符串、HTTP 失败或请求失败时为空串', async () => {
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
  it('不带标注、标注标签与 use；文件、用户与会话能力照转', async () => {
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

  it('没有会话（页面单独打开）时不给 chat', () => {
    const { host } = fakeSlidesHost();
    expect('chat' in createDesignSystemHost(host, async () => '')).toBe(false);
  });

  it('上传不用运行时给的文件名，只转交 type', async () => {
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
  it('装上 globalThis.designSystemHost：路由相对页面所在目录，单独打开时没有 chat', async () => {
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

  it('在 CucCut 的 iframe 里时有 chat（提示交给父窗口）；运行时不调 comments，标注交给目标层', async () => {
    const { win, posted, types } = fakeWindow(() => Response.json({ canEdit: true }), true);
    installDesignSystemEditorHost({ win });
    const ds = win.designSystemHost!;
    expect(Object.keys(ds).sort()).toEqual(['artifact', 'assets', 'chat', 'self', 'user']);
    // 目标层（comment-targets.ts）在页面上拦点击、听 C 与 Esc，样式只装一份
    expect(types).toEqual(expect.arrayContaining(['click', 'pointerdown', 'keydown']));
    expect(document.querySelectorAll('#cuccut-comment-targets')).toHaveLength(1);
    void ds.chat!.suggestPrompt('Agent: read the design-system skill').catch(() => {});
    expect(posted).toContainEqual(expect.objectContaining({ type: 'editor:suggest-prompt', prompt: 'Agent: read the design-system skill' }));
    expect(await ds.user.name()).toBe('');
  });
});
