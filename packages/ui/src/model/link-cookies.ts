import { defineMessages, intlLocale, onLocaleChange, type CookieBrowserInfo, type LinkCookieBrowser } from '@cuccut/protocol';
import { zhHans } from './link-cookies.zh-Hans.ts';
import { zhHant } from './link-cookies.zh-Hant.ts';
import { ja } from './link-cookies.ja.ts';
import { ko } from './link-cookies.ko.ts';
import { es } from './link-cookies.es.ts';
import { fr } from './link-cookies.fr.ts';
import { de } from './link-cookies.de.ts';
import { nl } from './link-cookies.nl.ts';
import { ptBR } from './link-cookies.pt-BR.ts';
import { it } from './link-cookies.it.ts';
import { ru } from './link-cookies.ru.ts';
import { pl } from './link-cookies.pl.ts';
import { tr } from './link-cookies.tr.ts';
import { vi } from './link-cookies.vi.ts';

const andList = (names: readonly string[]) => new Intl.ListFormat(intlLocale('en'), { type: 'conjunction' }).format(names);

/** Copy for “website login” (English is the source for keys and types; translations are in `link-cookies.zh-Hans.ts`). */
const en = {
  noneChecked: 'Leave them all unchecked to download anonymously. If the site asks you to sign in or verify, sign in to it in a browser first, then check that browser.',
  oneChecked: (name: string) => `Uses ${name} cookies to access the site.`,
  manyChecked: (names: readonly string[]) =>
    `Tries ${names.join(' → ')} in that order: if a browser’s cookies can’t be read or the site still asks you to sign in, it moves on to the next one and stops at the first that works. The result says which one was used.`,
  privacy: 'Only the browsers you check are read. yt-dlp reads the cookies on this computer and uses them only to access the site; CucCut remembers only the browser names, never the cookies.',
  keychain: (names: readonly string[]) =>
    `macOS will ask for Keychain access once for ${names.length > 1 ? `each of ${andList(names)}` : names[0]}. Choose “Always Allow” and it won’t ask again.`,
  safariAccess: 'To read Safari cookies, first allow CucCut in System Settings › Privacy & Security › Full Disk Access.',
  chromiumLocked: (names: readonly string[]) =>
    names.length > 1
      ? `While ${andList(names)} are open, their cookie databases are locked and can’t be read. Quit these browsers completely before downloading, including any running in the background.`
      : `While ${names[0]} is open, its cookie database is locked and can’t be read. Quit this browser completely before downloading, including if it’s running in the background.`,
  appBound: (names: readonly string[]) =>
    `On Windows, ${andList(names)} usually ${names.length > 1 ? 'protect' : 'protects'} cookies with App-Bound Encryption, which yt-dlp may not be able to read, even after you quit the browser.`,
  /** Attaches to the end of the previous sentence (the English form has a leading space). */
  firefoxTip: ' If you need to sign in, sign in to the site in Firefox and check Firefox instead.',
  noBrowsers: 'No browser cookies were found on this computer, so downloads can only be anonymous. After you sign in to the site in a browser, click “Detect browsers again”.',
  used: (name: string) => `Used ${name} cookies`,
};
export type LinkCookiesMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The “website login” option for downloading videos (product design §2.7 “下载视频”, architecture design §7.9 Cookies and §12.9 “本机浏览器”; design draft model-tool-cookies.js).
 *
 * - Lists only the browsers for which the Runtime detected a cookie store (`externalTools.cookieBrowsers`), most recently used first.
 * - Ticked browsers are tried one by one in the listed order (not the order in which they were clicked): when a cookie cannot be read, or the site still asks for login, the next one is tried; it stops at the first that works.
 * - “all browsers” is not a value: ticking it selects all detected browsers, and what is submitted is still the browser list; when only some are ticked it shows the partial state. Ticking none means an anonymous download.
 * - System authorization prompts follow the platform of the host the Runtime runs on (the `platform` carried in the detection result), not the platform this interface runs on.
 */

export const COOKIE_BROWSER_LABEL: Readonly<Record<LinkCookieBrowser, string>> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
  brave: 'Brave',
  chromium: 'Chromium',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
  whale: 'Whale',
};

/** Chromium-based browsers: on macOS, cookies are encrypted with a key in the Keychain, and reading them prompts for authorization; on Windows, the cookie store is locked while the browser is open (yt-dlp #7271). */
const CHROMIUM: readonly LinkCookieBrowser[] = ['chrome', 'edge', 'brave', 'chromium', 'opera', 'vivaldi', 'whale'];

/**
 * On Windows, cookies protected by App-Bound Encryption, which yt-dlp cannot currently decrypt (yt-dlp #10927, checked 2026-10):
 * Chrome 127 and later when installed system-wide, Edge (always installed system-wide), and Brave when installed system-wide. Opera and Vivaldi do not enable it yet, so they are not listed.
 */
const APP_BOUND: readonly LinkCookieBrowser[] = ['chrome', 'edge', 'brave'];

export const cookieBrowserLabel = (id: LinkCookieBrowser): string => COOKIE_BROWSER_LABEL[id] ?? id;

type Detected = readonly Pick<CookieBrowserInfo, 'id'>[];

/** Ticked browsers are kept in the detected order (which is the try order); after re-detection, any no longer in the list are removed. */
export function orderedBrowsers(checked: readonly LinkCookieBrowser[], detected: Detected): LinkCookieBrowser[] {
  const set = new Set(checked);
  return detected.map((b) => b.id).filter((id) => set.has(id));
}

/** “all browsers”: when every detected browser is ticked it is select-all; when some are ticked it is partial. */
export function allBrowsersState(checked: readonly LinkCookieBrowser[], detected: Detected): { selected: boolean; indeterminate: boolean } {
  const n = orderedBrowsers(checked, detected).length;
  const total = detected.length;
  return { selected: total > 0 && n === total, indeterminate: n > 0 && n < total };
}

/** Clicking “all browsers”: when all are selected it clears; when none or partially selected it selects all. */
export function toggleAllBrowsers(checked: readonly LinkCookieBrowser[], detected: Detected): LinkCookieBrowser[] {
  return allBrowsersState(checked, detected).selected ? [] : detected.map((b) => b.id);
}

/** Ticking or unticking one browser keeps the result in the detected order. */
export function toggleBrowser(checked: readonly LinkCookieBrowser[], id: LinkCookieBrowser, on: boolean, detected: Detected): LinkCookieBrowser[] {
  const rest = checked.filter((x) => x !== id);
  return orderedBrowsers(on ? [...rest, id] : rest, detected);
}

/**
 * The description below the checkboxes: first how the ticks are used, then what is read and what CucCut keeps; then hints based on the host the Runtime runs on and which browsers are ticked:
 * the system authorization on macOS, and on Windows the locked cookie store and app-bound encryption (when Firefox is not ticked, it is suggested instead).
 */
export function cookieNotes(list: readonly LinkCookieBrowser[], platform: string | null): string[] {
  const names = list.map(cookieBrowserLabel);
  const lines = [
    list.length === 0 ? M.noneChecked : list.length === 1 ? M.oneChecked(names[0]!) : M.manyChecked(names),
    M.privacy,
  ];
  if (platform === 'darwin') {
    const keychain = list.filter((id) => CHROMIUM.includes(id)).map(cookieBrowserLabel);
    if (keychain.length) lines.push(M.keychain(keychain));
    if (list.includes('safari')) lines.push(M.safariAccess);
  }
  if (platform === 'win32') {
    const chromium = list.filter((id) => CHROMIUM.includes(id)).map(cookieBrowserLabel);
    const appBound = list.filter((id) => APP_BOUND.includes(id)).map(cookieBrowserLabel);
    if (chromium.length) lines.push(M.chromiumLocked(chromium));
    if (appBound.length) lines.push(M.appBound(appBound));
    if (chromium.length && !list.includes('firefox')) lines[lines.length - 1] += M.firefoxTip;
  }
  return lines;
}

/** The description when no browser is detected at all. */
// The old named string exports: a string cannot be read for the current language, so rewrite this binding when the language changes (ES module imports are live bindings; the whole interface is redrawn when the language changes).
export let NO_COOKIE_BROWSERS: string = M.noBrowsers;
onLocaleChange(() => {
  NO_COOKIE_BROWSERS = M.noBrowsers;
});

/** The result of the run states which browser was used. */
export const usedCookieText = (id: LinkCookieBrowser): string => M.used(cookieBrowserLabel(id));
