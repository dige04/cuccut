import { DEFAULT_AGENT_MODE, type AgentMode } from './access.ts';
import type { Autonomy } from './domain.ts';
import type { LanguagePreference } from './i18n.ts';
import type { ResourceCapacitySetting } from './resources.ts';
import { SETTING_DESCRIPTION_MESSAGES } from './settings-copy.ts';

/**
 * Preferences held by the Runtime (architecture design §5.10): keys, value types, defaults and descriptions are part of the contract.
 *
 * Rules:
 * - Keys are lowercase dotted names; once published, a key is never renamed. Unknown keys are rejected (`invalid-request`), not silently saved.
 * - Values are validated against `settingValueSchemas` in `@cuccut/protocol/schemas`; a batch with any invalid value is rejected as a whole, and none of it is written to disk.
 * - `null` in `settings.set` restores the default. A value equal to the default is not stored separately, so "is the default" and "never changed" are the same thing.
 * - Credentials are not preferences (§6.8): the registry holds no keys, tokens or passwords.
 * - The default provider and model for model capabilities are managed by `models.setDefault` (§6.8), not here.
 *
 * The zod schemas used for validation are in `schemas.ts`: this file ships with the main entry into the UI, without zod.
 */

/** The follow-up action after transcription completes. */
export type TranscribeAfterComplete = 'open-video' | 'notify' | 'nothing';

/** Target line length (in characters) for automatic line breaks, by language class: `cjk` is Chinese, Japanese and Korean script; `other` is the rest, which is split into words by spaces. */
export interface CaptionLineLength {
  cjk: number;
  other: number;
}

export interface SettingValues {
  /** Driver for new sessions; null means the built-in default (`codex`). */
  'agent.defaultDriver': string | null;
  /** Model for new sessions; null means the driver's own default model. */
  'agent.defaultModel': string | null;
  /** Reasoning effort for new sessions; null means the driver's own default. */
  'agent.defaultEffort': string | null;
  /** Used by sessions that have not switched modes yet (architecture design §3.12). Old values (controlled, authorized) are converted to new ones on read and write. */
  'agent.defaultAccessMode': AgentMode;
  /**
   * Interface language: `system` follows the computer's system language (English if there is no matching shipped language); otherwise it is one shipped language. Runtime text shown to people
   * (error reasons, task descriptions) is generated in it; text already stored keeps the language it was generated in. The desktop UI writes its own choice here (architecture design §5.10).
   */
  'ui.language': LanguagePreference;
  'captions.maxLineLength': CaptionLineLength;
  'transcribe.afterComplete': TranscribeAfterComplete;
  /**
   * Default save location: results from tools without a video, media downloaded from links, and files handed over by downloads_save all go here. Absolute path;
   * null means ~/Downloads on the current host, independent of project ownership.
   */
  'downloads.directory': string | null;
  /**
   * Source for downloading local models (base URL, `http(s)://`, no credentials). null is the public model repository (`https://huggingface.co`);
   * `https://www.modelscope.cn` downloads from ModelScope. The environment variable `CUCCUT_MODELS_ENDPOINT` takes precedence over it (architecture design §6.3).
   */
  'models.downloadEndpoint': string | null;
  /**
   * Model directory: absolute path; null is the default `<runtime-home>/models`. The environment variable `CUCCUT_MODELS_DIR` takes precedence over it (in which case this setting has no effect).
   * It is changed only through `models.setDir` (which first checks that no job is using it, unloads Workers, and asks whether to move or only change the location). `settings.set` does not accept this key (architecture design §6.3).
   */
  'models.dir': string | null;
  /**
   * Download source for managed external tools (mirror base URL, `http(s)://`, no credentials): files are fetched from `<base>/<tool>/<version>/<filename>`; null is the tool's
   * official release address. The environment variable `CUCCUT_TOOLS_ENDPOINT` takes precedence over it (architecture design §12.9).
   */
  'tools.downloadEndpoint': string | null;
  /**
   * Font families used for typesetting that are neither bundled with the kernel nor on the machine, but are present in the font directory, are downloaded automatically (for preview and final-render export, architecture design §9.1). When off, rendering falls back to a substitute font with a notice,
   * and the font can be downloaded manually from the font picker list.
   */
  'fonts.autoDownload': boolean;
  /** Base URL of the font CSS API (mirror, `https://`); null is `https://fonts.googleapis.com`. Requests are `<base>/css2?family=…`. */
  'fonts.cssEndpoint': string | null;
  /** Base URL of font files (mirror, `https://`): files are fetched only from under it; null is `https://fonts.gstatic.com`. */
  'fonts.fileEndpoint': string | null;
  /**
   * Retention days for the Space trash (architecture design §5.7): entries moved to the trash more than this many days ago, with no references, are physically deleted at startup and periodically afterwards;
   * deleted videos likewise. Entries with references are kept. Integer 1–3650.
   */
  'space.trashRetentionDays': number;
  /**
   * Total size cap for `cache/` in the Runtime Home (MiB, architecture design §5.1): when exceeded, cache files are deleted oldest-modified first, down to 90% of the cap.
   * The cross-video content index (`cache/content-index/`) is not deleted, but it counts toward the total size. Integer 256–1048576.
   */
  'cache.maxSizeMiB': number;
  /**
   * Machine capacity used by resource scheduling (architecture design §7.6, §7.7): null is auto-detect (memory and CPU threads come from the system; Apple chip GPU memory is estimated as unified memory;
   * on other machines GPU memory is unknown and is not used for admission). When one field is null, that field is still automatic.
   */
  'resources.capacity': ResourceCapacitySetting | null;
  /**
   * Minutes after which a Runtime started by the CLI (architecture design §2.2) exits on its own when idle: no local gateway connection, no queued or running jobs, and no external service turned on.
   * Integer 1–1440. The desktop app and a Runtime started manually are not affected.
   */
  'runtime.idleExitMinutes': number;
  'updates.autoCheck': boolean;
  'updates.autoDownload': boolean;
  'diagnostics.enabled': boolean;
  'offline.strict': boolean;
}

export type SettingKey = keyof SettingValues;

/** The order in the registry is the order in lists and CLI output. */
export const SETTING_KEYS = [
  'agent.defaultDriver',
  'agent.defaultModel',
  'agent.defaultEffort',
  'agent.defaultAccessMode',
  'ui.language',
  'captions.maxLineLength',
  'transcribe.afterComplete',
  'downloads.directory',
  'models.downloadEndpoint',
  'models.dir',
  'tools.downloadEndpoint',
  'fonts.autoDownload',
  'fonts.cssEndpoint',
  'fonts.fileEndpoint',
  'space.trashRetentionDays',
  'cache.maxSizeMiB',
  'resources.capacity',
  'runtime.idleExitMinutes',
  'updates.autoCheck',
  'updates.autoDownload',
  'diagnostics.enabled',
  'offline.strict',
] as const satisfies readonly SettingKey[];

export const SETTING_DEFAULTS: Readonly<SettingValues> = Object.freeze({
  'agent.defaultDriver': null,
  'agent.defaultModel': null,
  'agent.defaultEffort': null,
  'agent.defaultAccessMode': DEFAULT_AGENT_MODE,
  'ui.language': 'system',
  'captions.maxLineLength': Object.freeze({ cjk: 16, other: 42 }),
  'transcribe.afterComplete': 'open-video',
  'downloads.directory': null,
  'models.downloadEndpoint': null,
  'models.dir': null,
  'tools.downloadEndpoint': null,
  'fonts.autoDownload': true,
  'fonts.cssEndpoint': null,
  'fonts.fileEndpoint': null,
  'space.trashRetentionDays': 30,
  'cache.maxSizeMiB': 2048,
  'resources.capacity': null,
  'runtime.idleExitMinutes': 10,
  'updates.autoCheck': true,
  'updates.autoDownload': true,
  'diagnostics.enabled': false,
  'offline.strict': false,
});

/** One-sentence description for people (used by the settings page and `cuccut settings`). Reading the property returns the text in the current language; the copy is in `settings-copy.ts`. */
export const SETTING_DESCRIPTIONS: Readonly<Record<SettingKey, string>> = SETTING_DESCRIPTION_MESSAGES;

/** Description of a key for people (current language). */
export function settingDescription(key: SettingKey): string {
  return SETTING_DESCRIPTION_MESSAGES[key];
}

/** Keys that cannot be changed through `settings.set`: each has a dedicated method (`models.dir` uses `models.setDir`). */
export const SETTING_MANAGED_BY: Readonly<Partial<Record<SettingKey, string>>> = { 'models.dir': 'models.setDir' };

export function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

/** Result of `settings.get` / `settings.set`, and also the snapshot for the `settings` topic: the current effective values and defaults. */
export interface SettingsView {
  settings: Partial<SettingValues>;
  defaults: Partial<SettingValues>;
}

/** The full view (when not filtered by key). */
export interface SettingsSnapshot {
  settings: SettingValues;
  defaults: SettingValues;
}

/** Values `settings.set` can write: the access mode also accepts old values (§3.12). */
export type SettingInputValues = Omit<SettingValues, 'agent.defaultAccessMode'> & {
  'agent.defaultAccessMode': AgentMode | Autonomy;
};

/** Sent when effective values change, carrying only the changed keys and their new effective values (the default values when restored to default). */
export type SettingsEvent = { type: 'settings.updated'; changed: Partial<SettingValues> };

/** Where a value came from: set by the user, or the default. */
export type SettingSource = 'user' | 'default';

/**
 * A set of values frozen when a task is created (§5.10 "tasks freeze the values they use at creation"): later changes to settings do not affect it.
 */
export interface FrozenSettings<K extends SettingKey> {
  values: Pick<SettingValues, K>;
  sources: Record<K, SettingSource>;
}

/** The party that can freeze values (the Runtime's settings store). The Harness depends only on this shape. */
export interface SettingsReader {
  snapshot<K extends SettingKey>(keys: readonly K[]): FrozenSettings<K>;
}

/** When there is no settings store (tests, or the Harness used on its own), values are frozen to the defaults. */
export function defaultSettingsSnapshot<K extends SettingKey>(keys: readonly K[]): FrozenSettings<K> {
  const values = {} as Pick<SettingValues, K>;
  const sources = {} as Record<K, SettingSource>;
  for (const key of keys) {
    values[key] = SETTING_DEFAULTS[key];
    sources[key] = 'default';
  }
  return { values, sources };
}
