import { defineMessages, intlLocale } from '@cuccut/protocol';
import { zhHans } from './format.zh-Hans.ts';
import { zhHant } from './format.zh-Hant.ts';
import { ja } from './format.ja.ts';
import { ko } from './format.ko.ts';
import { es } from './format.es.ts';
import { fr } from './format.fr.ts';
import { de } from './format.de.ts';
import { nl } from './format.nl.ts';
import { ptBR } from './format.pt-BR.ts';
import { it } from './format.it.ts';
import { ru } from './format.ru.ts';
import { pl } from './format.pl.ts';
import { tr } from './format.tr.ts';
import { vi } from './format.vi.ts';

/** Copy for durations and relative times (the English is the source of keys and types; translations are in `format.zh-Hans.ts`). */
const en = {
  hoursMinutes: (h: number, m: number) => `${h} hr ${m} min`,
  hours: (h: number) => `${h} hr`,
  minutesSeconds: (m: number, s: number) => `${m} min ${s} sec`,
  minutes: (m: number) => `${m} min`,
  seconds: (s: number) => `${s} sec`,
  justNow: 'Just now',
  minutesAgo: (n: number) => `${n} min ago`,
  hoursAgo: (n: number) => (n === 1 ? '1 hour ago' : `${n} hours ago`),
  yesterday: 'Yesterday',
  dateThisYear: (date: Date) => new Intl.DateTimeFormat(intlLocale('en'), { month: 'short', day: 'numeric' }).format(date),
  dateWithYear: (date: Date) => new Intl.DateTimeFormat(intlLocale('en'), { year: 'numeric', month: 'short', day: 'numeric' }).format(date),
};
export type FormatMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Durations: “8 seconds”, “1 min 5 sec”, “1 hr 2 min” (English: “8 sec”, “1 min 5 sec”, “1 hr 2 min”). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return m ? M.hoursMinutes(h, m) : M.hours(h);
  if (m) return s ? M.minutesSeconds(m, s) : M.minutes(m);
  return M.seconds(s);
}

/** Relative times: “just now”, “5 minutes ago”, “3 hours ago”, “yesterday”, “September 30”. */
export function agoLabel(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  const diff = Math.max(0, now - t);
  const minute = 60_000;
  if (diff < minute) return M.justNow;
  if (diff < 60 * minute) return M.minutesAgo(Math.floor(diff / minute));
  if (diff < 24 * 60 * minute) return M.hoursAgo(Math.floor(diff / (60 * minute)));
  const date = new Date(t);
  const today = new Date(now);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date >= yesterday) return M.yesterday;
  if (date.getFullYear() === today.getFullYear()) return M.dateThisYear(date);
  return M.dateWithYear(date);
}

/**
 * Abbreviates the user's home directory to ~: macOS `/Users/<name>`, Linux `/home/<name>`, Windows `C:\Users\<name>` (any drive letter, case-insensitive).
 * The rest of the path, including separators, is kept as is (`~\CucCut\models`).
 */
export function shortenPath(path: string): string {
  const match = /^\/(?:Users|home)\/[^/]+/.exec(path) ?? /^[A-Za-z]:[\\/]Users[\\/][^\\/]+/i.exec(path);
  return match ? `~${path.slice(match[0].length)}` : path;
}

/**
 * Time in the player: “0:07”, “1:05”, “1:02:03”; with `tenths`, one decimal place is shown, e.g. “1:05.3”; with `hours`, the hour field is written even when under an hour.
 * Truncates downward, so times not yet played are not shown; truncation only affects presentation (product design §5.8).
 */
export function formatClock(seconds: number, options: { tenths?: boolean; hours?: boolean } = {}): string {
  const tenthsTotal = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds * 10 + 1e-6) : 0;
  const whole = Math.floor(tenthsTotal / 10);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const ss = String(whole % 60).padStart(2, '0');
  const base = h || options.hours ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  return options.tenths ? `${base}.${tenthsTotal % 10}` : base;
}

/**
 * Transport timecode: “00:16.1”, “03:26.0”, rolling over to “1:02:03.5” at one hour; `decimals: 0` drops the decimal places (prototype model-time.js `timecode`).
 * Round to the output precision first, then split into hours, minutes and seconds; otherwise 9.999999 would be written as “00:010.0” and 59.99 as “00:60.0” —
 * which is what subtracting two float seconds (22.4 − 12.4) can produce.
 */
export function formatTenths(seconds: number, { decimals = 1 }: { decimals?: 0 | 1 } = {}): string {
  const negative = seconds < 0;
  const tenths = decimals !== 0;
  let s = Math.abs(+seconds || 0);
  s = tenths ? Math.round(s * 10) / 10 : Math.round(s);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const sec = (s < 10 ? '0' : '') + (tenths ? s.toFixed(1) : String(s));
  const mm = String(m).padStart(2, '0');
  return (negative ? '-' : '') + (h > 0 ? `${h}:${mm}:${sec}` : `${mm}:${sec}`);
}
