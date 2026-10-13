import { TopicLog, type Logger } from '@cuccut/harness';
import { processLanguageTags, resolveLanguage, setLocale, type SettingsEvent, type SettingsSnapshot } from '@cuccut/protocol';
import { SettingsStore, type RuntimeHome } from '@cuccut/runtime-storage';

export interface RuntimeSettings {
  store: SettingsStore;
  /** `settings` topic: the snapshot holds the effective and default values of all keys. `settings.updated` is sent when effective values change (architecture design §5.10). */
  topic: TopicLog<SettingsSnapshot, SettingsEvent>;
}

/** Reads the preference file and attaches it to the topic. If the file is not valid JSON or is unrecognized, it is renamed and kept, and all values fall back to defaults (`store-file.ts`). Throws when it cannot be read. */
export async function openSettings(home: RuntimeHome, log?: Logger): Promise<RuntimeSettings> {
  const store = new SettingsStore(home.settingsFile, log ? { log: log.child('settings') } : {});
  await store.load();
  const topic = new TopicLog<SettingsSnapshot, SettingsEvent>(() => store.snapshotAll(), '0');
  // Human-readable text from the Runtime follows the UI language (`ui.language`). When following the system, it uses this computer's system language.
  const applyLocale = () => setLocale(resolveLanguage(store.get('ui.language'), processLanguageTags()));
  applyLocale();
  store.onChange((changed) => {
    if ('ui.language' in changed) applyLocale();
    topic.publish({ type: 'settings.updated', changed });
  });
  return { store, topic };
}
