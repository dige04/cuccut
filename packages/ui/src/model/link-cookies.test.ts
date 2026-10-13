import { describe, expect, it } from 'vitest';
import { LINK_COOKIE_BROWSERS, type CookieBrowserInfo } from '@cuccut/protocol';
import {
  allBrowsersState,
  COOKIE_BROWSER_LABEL,
  cookieNotes,
  orderedBrowsers,
  toggleAllBrowsers,
  toggleBrowser,
  usedCookieText,
} from './link-cookies.ts';

/** The “website login” option for downloading videos (product design §2.7): the tick order, the select-all and partial state of “all browsers”, and the wording of the descriptions and results. */

const detected: CookieBrowserInfo[] = [
  { id: 'chrome', label: 'Chrome', lastUsedAt: '2026-10-06T09:42:00Z' },
  { id: 'safari', label: 'Safari', lastUsedAt: null },
  { id: 'firefox', label: 'Firefox', lastUsedAt: '2026-09-28T14:03:00Z' },
  { id: 'edge', label: 'Edge', lastUsedAt: '2026-08-17T08:30:00Z' },
];

describe('website sign-in', () => {
  it('checked browsers are ordered by detection order (the try order); undetected ones are removed', () => {
    expect(orderedBrowsers(['edge', 'chrome'], detected)).toEqual(['chrome', 'edge']);
    expect(orderedBrowsers(['brave', 'safari'], detected)).toEqual(['safari']);
    expect(orderedBrowsers(['chrome'], [])).toEqual([]);
    expect(toggleBrowser(['edge'], 'chrome', true, detected)).toEqual(['chrome', 'edge']);
    expect(toggleBrowser(['chrome', 'edge'], 'chrome', false, detected)).toEqual(['edge']);
  });

  it('"所有浏览器": checked, indeterminate and unchecked states; clicking it clears when all are checked, otherwise selects all', () => {
    expect(allBrowsersState([], detected)).toEqual({ selected: false, indeterminate: false });
    expect(allBrowsersState(['safari'], detected)).toEqual({ selected: false, indeterminate: true });
    expect(allBrowsersState(['edge', 'firefox', 'safari', 'chrome'], detected)).toEqual({ selected: true, indeterminate: false });
    expect(allBrowsersState([], [])).toEqual({ selected: false, indeterminate: false });
    expect(toggleAllBrowsers([], detected)).toEqual(['chrome', 'safari', 'firefox', 'edge']);
    expect(toggleAllBrowsers(['safari'], detected)).toEqual(['chrome', 'safari', 'firefox', 'edge']);
    expect(toggleAllBrowsers(['chrome', 'safari', 'firefox', 'edge'], detected)).toEqual([]);
  });

  it('help text: explains usage by how many are checked; the summary says only checked ones are read and cookies are not saved; on macOS the Runtime prompts for Keychain and Safari permissions', () => {
    const none = cookieNotes([], 'darwin');
    expect(none[0]).toMatch(/匿名下载/);
    expect(none[1]).toMatch(/只读取你勾选的浏览器.*不保存 Cookie 内容/);
    expect(none).toHaveLength(2);
    expect(cookieNotes(['firefox'], 'darwin')[0]).toMatch(/用 Firefox 的 Cookie/);
    expect(cookieNotes(['firefox'], 'darwin')).toHaveLength(2);
    const many = cookieNotes(['chrome', 'safari', 'edge'], 'darwin');
    expect(many[0]).toMatch(/按 Chrome → Safari → Edge 的顺序逐个试/);
    expect(many[2]).toMatch(/为 Chrome、Edge 各弹出一次钥匙串授权/);
    expect(many[3]).toMatch(/完全磁盘访问权限/);
    expect(cookieNotes(['edge'], 'darwin')[2]).toMatch(/^macOS 会为 Edge 弹出一次钥匙串授权/);
    expect(cookieNotes(['chrome', 'safari'], 'linux')).toHaveLength(2);
    expect(cookieNotes(['chrome', 'safari'], null)).toHaveLength(2);
  });

  it('Windows: Chromium-based browsers cannot be read while open and must be quit first; Chrome, Edge and Brave may be unreadable due to app-bound encryption; when Firefox is not checked, suggests using it instead', () => {
    const chrome = cookieNotes(['chrome'], 'win32');
    expect(chrome).toHaveLength(4);
    expect(chrome[2]).toMatch(/^Chrome 开着时 Cookie 库被占用.*先完全退出这个浏览器/);
    expect(chrome[3]).toMatch(/^Chrome 在 Windows 上通常用应用绑定加密.*可能读不到.*建议在 Firefox 里登录目标网站后改勾 Firefox。$/);
    expect(chrome.join('')).not.toMatch(/钥匙串|完全磁盘访问权限/);
    // Opera and Vivaldi only have the file-in-use problem; do not mention app-bound encryption for them.
    const opera = cookieNotes(['opera', 'vivaldi'], 'win32');
    expect(opera).toHaveLength(3);
    expect(opera[2]).toMatch(/^Opera、Vivaldi 开着时.*这些浏览器.*改勾 Firefox。$/);
    // Once Firefox is ticked, stop suggesting it.
    const mixed = cookieNotes(['chrome', 'firefox', 'edge', 'brave'], 'win32');
    expect(mixed[3]).toMatch(/^Chrome、Edge、Brave 在 Windows 上通常用应用绑定加密/);
    expect(mixed.join('')).not.toMatch(/改勾 Firefox/);
    expect(cookieNotes(['firefox'], 'win32')).toHaveLength(2);
    expect(cookieNotes([], 'win32')).toHaveLength(2);
  });

  it('the result states which browser was used; every value has a name', () => {
    expect(usedCookieText('chrome')).toBe('用了 Chrome 的 Cookie');
    expect(LINK_COOKIE_BROWSERS.every((id) => !!COOKIE_BROWSER_LABEL[id])).toBe(true);
  });
});
