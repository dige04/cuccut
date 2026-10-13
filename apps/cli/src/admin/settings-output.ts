import { SETTING_DESCRIPTIONS, SETTING_KEYS, isSettingKey, type SettingKey, type SettingsSnapshot } from '@cuccut/protocol';
import { M } from './settings-copy.ts';

/**
 * Arguments and output of `cuccut settings` (Architecture design §5.10). Split out of main.ts so it can be tested on its own.
 * Whether a value is valid is decided by the Runtime (`settings.set` validates the whole batch). Here we only recognize key names and give readable usage errors.
 */

export type SettingsCommand =
  | { kind: 'list' }
  | { kind: 'get'; key: SettingKey }
  | { kind: 'set'; key: SettingKey; value: unknown }
  | { kind: 'reset'; key: SettingKey };

function requireKey(key: string | undefined): SettingKey {
  if (!key) throw new Error(M.usage);
  if (!isSettingKey(key)) throw new Error(M.unknownKey(key, SETTING_KEYS));
  return key;
}

export function parseSettingsArgs(args: string[]): SettingsCommand {
  const [action, key, ...values] = args;
  if (action === undefined || action === 'list') {
    if (key !== undefined) throw new Error(M.usage);
    return { kind: 'list' };
  }
  if (action === 'get' || action === 'reset') {
    if (values.length > 0) throw new Error(M.usage);
    return { kind: action, key: requireKey(key) };
  }
  if (action === 'set') {
    const checked = requireKey(key);
    if (values.length !== 1) throw new Error(M.setUsage);
    return { kind: 'set', key: checked, value: parseSettingValue(values[0]!) };
  }
  throw new Error(M.usage);
}

/** Values are parsed as JSON (`true`, `20`, `null`, `{"cjk":18,"other":40}`). If they cannot be parsed, they are treated as strings (`authorized`, `/Users/me/Downloads`). */
export function parseSettingValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A value as text: JSON, with object keys sorted alphabetically. */
export function formatSettingValue(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
  );
}

export function isDefaultValue(view: SettingsSnapshot, key: SettingKey): boolean {
  return formatSettingValue(view.settings[key]) === formatSettingValue(view.defaults[key]);
}

/** One line: `key  current value  default`, or `key  current value  modified (default …)`. */
export function formatSettingLine(view: SettingsSnapshot, key: SettingKey, width = key.length): string {
  const marker = isDefaultValue(view, key) ? M.isDefault : M.modified(formatSettingValue(view.defaults[key]));
  return `${key.padEnd(width)}  ${formatSettingValue(view.settings[key])}  ${marker}`;
}

/** `cuccut settings`: all keys, in the order of the registry, with a description line under each key. */
export function formatSettings(view: SettingsSnapshot): string[] {
  const width = Math.max(...SETTING_KEYS.map((key) => key.length));
  return SETTING_KEYS.flatMap((key) => [formatSettingLine(view, key, width), `  ${SETTING_DESCRIPTIONS[key]}`]);
}
