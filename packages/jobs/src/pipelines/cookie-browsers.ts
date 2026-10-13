import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CookieBrowserInfo, LinkCookieBrowser } from '@cuccut/protocol';

/**
 * Which browsers on this machine have a cookie store (`externalTools.cookieBrowsers`, architecture design §7.9). The “website login” option for video downloads lists only these, so the user cannot pick a browser that is not installed.
 *
 * - Locations follow yt-dlp's lookup rules for `--cookies-from-browser`: for Chromium-based browsers it is `[<Profile>/][Network/]Cookies` under the data directory; for Firefox it is `[<Profile>/|Profiles/<Profile>/]cookies.sqlite` under the config root; Safari (macOS only) is the fixed file `Cookies.binarycookies`. Browsers whose store cannot be found are not listed, because yt-dlp cannot find them either.
 * - Only checks whether the files exist and their modification times (`stat`, and listing the direct children of the data directory). Does not open or read cookies, and does not run the download tool.
 * - The most recently modified come first (the browser most recently used is the most likely to be logged in to the target site). Downloads try them one by one in this order. When times are equal or unreadable, a fixed order applies.
 */

export const COOKIE_BROWSER_LABELS: Readonly<Record<LinkCookieBrowser, string>> = {
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

/** Where to look: the host information used for probing. Tests pass in a temp directory tree. */
export interface CookieHost {
  platform: NodeJS.Platform;
  home: string | null;
  env: { LOCALAPPDATA?: string | undefined; APPDATA?: string | undefined; XDG_CONFIG_HOME?: string | undefined };
}

/** Lookup rule for one browser's cookie store: a Chromium-style data directory, Firefox's config root, or a fixed file. */
export interface CookieDatabaseRule {
  id: LinkCookieBrowser;
  chromium?: string;
  firefox?: string[];
  files?: string[];
}

export function currentCookieHost(): CookieHost {
  return { platform: process.platform, home: os.homedir() || null, env: process.env };
}

/** Lookup rules for each platform. The order is the order used when times are equal. Pure function: it only builds paths and does not touch files. */
export function cookieDatabaseRules(host: CookieHost): CookieDatabaseRule[] {
  const { home, env } = host;
  const at = (base: string | null | undefined, ...segments: string[]) => (base ? path.join(base, ...segments) : undefined);
  const rules: CookieDatabaseRule[] = [];
  const chromium = (id: LinkCookieBrowser, dir: string | undefined) => {
    if (dir) rules.push({ id, chromium: dir });
  };
  const firefox = (roots: Array<string | undefined>) => {
    const found = roots.filter((r): r is string => !!r);
    if (found.length > 0) rules.push({ id: 'firefox', firefox: found });
  };
  if (host.platform === 'darwin') {
    const support = at(home, 'Library', 'Application Support');
    chromium('chrome', at(support, 'Google', 'Chrome'));
    chromium('edge', at(support, 'Microsoft Edge'));
    firefox([at(support, 'Firefox', 'Profiles')]);
    if (home) {
      rules.push({
        id: 'safari',
        files: [
          path.join(home, 'Library', 'Containers', 'com.apple.Safari', 'Data', 'Library', 'Cookies', 'Cookies.binarycookies'),
          path.join(home, 'Library', 'Cookies', 'Cookies.binarycookies'),
        ],
      });
    }
    chromium('brave', at(support, 'BraveSoftware', 'Brave-Browser'));
    chromium('chromium', at(support, 'Chromium'));
    chromium('opera', at(support, 'com.operasoftware.Opera'));
    chromium('vivaldi', at(support, 'Vivaldi'));
    chromium('whale', at(support, 'Naver', 'Whale'));
  } else if (host.platform === 'win32') {
    const local = env.LOCALAPPDATA || undefined;
    const roaming = env.APPDATA || undefined;
    chromium('chrome', at(local, 'Google', 'Chrome', 'User Data'));
    chromium('edge', at(local, 'Microsoft', 'Edge', 'User Data'));
    firefox([
      at(roaming, 'Mozilla', 'Firefox', 'Profiles'),
      at(local, 'Packages', 'Mozilla.Firefox_n80bbvh6b1yt2', 'LocalCache', 'Roaming', 'Mozilla', 'Firefox', 'Profiles'),
    ]);
    chromium('brave', at(local, 'BraveSoftware', 'Brave-Browser', 'User Data'));
    chromium('chromium', at(local, 'Chromium', 'User Data'));
    chromium('opera', at(roaming, 'Opera Software', 'Opera Stable'));
    chromium('vivaldi', at(local, 'Vivaldi', 'User Data'));
    chromium('whale', at(local, 'Naver', 'Naver Whale', 'User Data'));
  } else {
    const config = env.XDG_CONFIG_HOME || at(home, '.config');
    chromium('chrome', at(config, 'google-chrome'));
    chromium('edge', at(config, 'microsoft-edge'));
    firefox([
      at(config, 'mozilla', 'firefox'),
      at(home, '.mozilla', 'firefox'),
      at(home, '.var', 'app', 'org.mozilla.firefox', 'config', 'mozilla', 'firefox'),
      at(home, '.var', 'app', 'org.mozilla.firefox', '.mozilla', 'firefox'),
      at(home, 'snap', 'firefox', 'common', '.mozilla', 'firefox'),
    ]);
    chromium('brave', at(config, 'BraveSoftware', 'Brave-Browser'));
    chromium('chromium', at(config, 'chromium'));
    chromium('opera', at(config, 'opera'));
    chromium('vivaldi', at(config, 'vivaldi'));
    chromium('whale', at(config, 'naver-whale'));
  }
  return rules;
}

/** Browsers on this machine whose cookie store can be found, most recently modified first. */
export async function detectCookieBrowsers(host: CookieHost = currentCookieHost()): Promise<CookieBrowserInfo[]> {
  const rules = cookieDatabaseRules(host);
  const found = await Promise.all(rules.map(async (rule, order) => ({ rule, order, seen: await lastChange(rule) })));
  return found
    .filter((f) => f.seen !== undefined)
    .sort((a, b) => (b.seen ?? -Infinity) - (a.seen ?? -Infinity) || a.order - b.order)
    .map(({ rule, seen }) => ({
      id: rule.id,
      label: COOKIE_BROWSER_LABELS[rule.id],
      lastUsedAt: seen === null || seen === undefined ? null : new Date(seen).toISOString(),
    }));
}

/**
 * The most recent modification time (ms) of the cookie store under this rule. undefined if the store is not found. null if the store is at a fixed location and exists, but there is no permission to look at it (macOS Safari needs “Full Disk Access”): the store exists, but its time is unknown.
 */
async function lastChange(rule: CookieDatabaseRule): Promise<number | null | undefined> {
  const candidates: string[] = [];
  if (rule.chromium) {
    for (const base of [rule.chromium, ...(await childDirectories(rule.chromium))]) {
      candidates.push(path.join(base, 'Cookies'), path.join(base, 'Network', 'Cookies'));
    }
  }
  for (const root of rule.firefox ?? []) {
    for (const base of [root, ...(await childDirectories(root)), ...(await childDirectories(path.join(root, 'Profiles')))]) {
      candidates.push(path.join(base, 'cookies.sqlite'));
    }
  }
  let newest: number | null | undefined;
  for (const file of [...candidates, ...(rule.files ?? [])]) {
    const denied = (error: NodeJS.ErrnoException) => (error.code === 'EPERM' || error.code === 'EACCES') && !!rule.files?.includes(file);
    const stat = await fs.stat(file).catch((error: NodeJS.ErrnoException) => (denied(error) ? null : undefined));
    if (stat === null) newest ??= null;
    else if (stat?.isFile()) newest = Math.max(newest ?? -Infinity, stat.mtimeMs);
  }
  return newest;
}

async function childDirectories(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name)).sort();
}
