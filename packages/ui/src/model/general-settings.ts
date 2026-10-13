import { defineMessages, live, localizeToolStatus, SETTING_DEFAULTS, type CaptionLineLength, type ExternalToolSource, type ExternalToolStatus } from '@cuccut/protocol';
import { zhHans } from './general-settings.zh-Hans.ts';
import { zhHant } from './general-settings.zh-Hant.ts';
import { ja } from './general-settings.ja.ts';
import { ko } from './general-settings.ko.ts';
import { es } from './general-settings.es.ts';
import { fr } from './general-settings.fr.ts';
import { de } from './general-settings.de.ts';
import { nl } from './general-settings.nl.ts';
import { ptBR } from './general-settings.pt-BR.ts';
import { it } from './general-settings.it.ts';
import { ru } from './general-settings.ru.ts';
import { pl } from './general-settings.pl.ts';
import { tr } from './general-settings.tr.ts';
import { vi } from './general-settings.vi.ts';

/** Copy for the General settings model layer (the English is the source of keys and types; translations are in `general-settings.zh-Hans.ts`). */
const en = {
  lineShort: 'Short',
  lineMedium: 'Medium',
  lineLong: 'Long',
  lineLength: (cjk: number, other: number) => `CJK text: ${cjk} characters per line · Other text: ${other} characters per line`,
  endpointTooLong: (max: number) => `Too long: up to ${max} characters`,
  endpointNotUrl: 'Not a web address: it should start with http:// or https://',
  endpointScheme: 'Only addresses starting with http:// or https:// are supported',
  endpointCredentials: 'The address can’t include a user name or password',
  endpointQuery: 'The address can’t include query parameters (the part after ?)',
  endpointHash: 'The address can’t include a fragment (the part after #)',
  saveDir: {
    label: 'Default save location',
    desc: 'Tool results, downloaded videos, and files handed over by the Agent are saved here. The default is your Downloads folder.',
    systemDefault: 'Downloads folder',
    isDefault: 'Default',
    change: 'Change…',
    reset: 'Reset to default',
    pickTitle: 'Choose default save location',
    changed: 'Default save location changed',
    resetDone: 'Reset to the Downloads folder',
    pickFailed: (message: string) => `Couldn’t choose a folder: ${message}`,
    webNote: 'A browser can’t choose a folder on this computer. Set this in the CucCut desktop app.',
  },
  source: {
    system: 'Installed on the system',
    user: 'Location you chose',
    managed: 'Downloaded by CucCut',
    bundled: 'Bundled with CucCut',
    env: 'Set by an environment variable',
  } as Record<ExternalToolSource, string>,
  notInstalled: 'Not installed',
  missingDesc: 'yt-dlp isn’t installed yet. When the Agent imports from a link, it will first ask you to agree to download it (showing the source, version, size, and license).',
  consentRevoked: 'Consent withdrawn',
  revokedDesc: (facts: string) => `${facts}. You withdrew consent to use it, so importing from a link will ask you again first.`,
  available: 'Available',
  needsUpdate: 'Update needed',
  cannotRun: 'Can’t run',
  factsWhy: (facts: string, why: string) => `${facts}. ${why}`,
};
export type GeneralSettingsModelMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/*
 * Pure logic for Settings › General (design mockup page-settings.jsx `GeneralSection`, settings-update.jsx `AppUpdateAutoRow`, import-panel.jsx
 * `DownloaderSettings`): the three caption line-length levels, validation of download sources, wording for the download folder and trash retention days, and the one-line video download tool entry.
 * Value shapes and ranges follow the contract (packages/protocol/src/settings.ts, schemas.ts); components only handle drawing.
 */

// ---- Caption line length (`captions.maxLineLength`) ----

export type LineLengthKey = 'short' | 'medium' | 'long';

/**
 * The design mockup's three levels “短 / 中 / 长” (short / medium / long). “中” (medium) is the contract's default; “短” (short) and “长” (long) each differ by 4 CJK characters and 10 other characters (the mockup gives no numbers; they are set here).
 * All are within the contract's range (cjk 4–60, other 10–120).
 */
export const LINE_LENGTH_PRESETS: readonly { key: LineLengthKey; label: string; value: CaptionLineLength }[] = [
  { key: 'short', get label() { return M.lineShort; }, value: { cjk: 12, other: 32 } },
  { key: 'medium', get label() { return M.lineMedium; }, value: SETTING_DEFAULTS['captions.maxLineLength'] },
  { key: 'long', get label() { return M.lineLong; }, value: { cjk: 20, other: 52 } },
];

/** Which level the stored line length falls into; when a different number was set from the command line, it falls into no level (null). */
export function lineLengthKey(value: CaptionLineLength | null): LineLengthKey | null {
  if (!value) return null;
  return LINE_LENGTH_PRESETS.find((p) => p.value.cjk === value.cjk && p.value.other === value.other)?.key ?? null;
}

/** One line describing the stored line length: “中日韩文字每行 16 字 · 其他文字每行 42 个字符” (16 CJK characters per line · 42 other characters per line). */
export function lineLengthText(value: CaptionLineLength): string {
  return M.lineLength(value.cjk, value.other);
}

// ---- Download sources (`models.downloadEndpoint`, `tools.downloadEndpoint`) ----

export const ENDPOINT_MAX_LENGTH = 500;

/** Input text → value to store: trims leading and trailing whitespace; empty becomes null (restores the default source). */
export function endpointValue(text: string): string | null {
  const value = text.trim();
  return value === '' ? null : value;
}

/**
 * What is wrong with the download source; null when it can be saved (including when left empty). The rules match the contract's validation (schemas.ts `isDownloadEndpoint`): a base address starting with `http(s)://`, with no username, password, query parameters or fragment (credentials must not appear in the URL), at most 500 characters long.
 */
export function endpointProblem(text: string): string | null {
  const value = endpointValue(text);
  if (value === null) return null;
  if (value.length > ENDPOINT_MAX_LENGTH) return M.endpointTooLong(ENDPOINT_MAX_LENGTH);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return M.endpointNotUrl;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return M.endpointScheme;
  if (url.username || url.password) return M.endpointCredentials;
  if (url.search) return M.endpointQuery;
  if (url.hash) return M.endpointHash;
  return null;
}

// ---- Default save location (`downloads.directory`, key name unchanged) ----

/**
 * Settings › General › Default save location (product design §2.7, last paragraph of the “页面” (Pages) section; architecture design §5.10 and §7.9 “保存位置” (Save location); design mockup page-settings.jsx `SaveDirRow`):
 * results of tools without a video, downloaded videos and files handed over by the Agent are all saved here; when unset, it is the system Downloads folder of the computer running the Runtime. The tool page's “更改…” (Change…) changes only that one time.
 */
export const SAVE_DIR_ROW: GeneralSettingsModelMessages['saveDir'] = live(() => M.saveDir);

// ---- Auto-update (`updates.autoCheck`, `updates.autoDownload`) ----

/** The design mockup has a single row “自动检查并下载更新” (Automatically check and download updates); the contract has two keys, and the feature counts as on only when both are on. Defaults apply when the snapshot has not arrived. */
export function autoUpdateOn(check: boolean | null, download: boolean | null): boolean {
  return (check ?? SETTING_DEFAULTS['updates.autoCheck']) && (download ?? SETTING_DEFAULTS['updates.autoDownload']);
}

// ---- Trash retention days (`space.trashRetentionDays`) ----

export const TRASH_DAYS = { min: 1, max: 3650 } as const;

/** Number field value → value to store: cleared (NaN) becomes null (restores the default of 30 days); otherwise the value is rounded to an integer and clamped to 1–3650. */
export function trashDaysValue(input: number): number | null {
  if (!Number.isFinite(input)) return null;
  return Math.min(TRASH_DAYS.max, Math.max(TRASH_DAYS.min, Math.round(input)));
}

// ---- Video download tool (the yt-dlp entry in `externalTools.list`) ----

const SOURCE_LABEL: Record<ExternalToolSource, string> = live(() => M.source);

export interface DownloaderLine {
  /** The status word at the end of the row. */
  status: string;
  tone: 'positive' | 'notice' | 'negative' | 'neutral';
  /** The note under the row: version and source; when it is unusable, the reason and the remedy. */
  desc: string;
}

/**
 * How the yt-dlp row is written (the design mockup `DownloaderSettings` status chip and “yt-dlp · 版本 · 来源” (yt-dlp · version · source)). When it is missing from the registry (null), it is written as not installed.
 * The mockup's install, update and “安装范围” (install scope) are not implemented here: CucCut downloads it only after the Agent imports from a link and you agree (link-import-tools.ts).
 */
export function downloaderLine(probed: ExternalToolStatus | null): DownloaderLine {
  const status = probed && localizeToolStatus(probed);
  if (!status || status.state === 'missing') {
    return { status: M.notInstalled, tone: 'neutral', desc: M.missingDesc };
  }
  const facts = ['yt-dlp', status.version, status.source ? SOURCE_LABEL[status.source] : null].filter(Boolean).join(' · ');
  const why = status.remedy ?? status.reason;
  switch (status.state) {
    case 'installed': {
      const revoked = status.consentRequired && status.consent?.state === 'revoked';
      return revoked
        ? { status: M.consentRevoked, tone: 'notice', desc: M.revokedDesc(facts) }
        : { status: M.available, tone: 'positive', desc: facts };
    }
    case 'outdated':
      return { status: M.needsUpdate, tone: 'notice', desc: why ? M.factsWhy(facts, why) : facts };
    case 'unavailable':
      return { status: M.cannotRun, tone: 'negative', desc: why ? M.factsWhy(facts, why) : facts };
  }
}
