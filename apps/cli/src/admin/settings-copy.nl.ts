import type { SettingsMessages } from './settings-copy.ts';
export const nl: SettingsMessages = {
 help: `Gebruik:
  cuccut settings                  Alle voorkeuren tonen: sleutel, huidige waarde, of dit de standaard is en een korte beschrijving
  cuccut settings get <key>        De huidige waarde van een instelling afdrukken (JSON)
  cuccut settings set <key> <value>
                                   Een instelling wijzigen; de waarde wordt als JSON gelezen (true, 20,
                                   {"cjk":18,"other":40}), of als tekst als dit niet lukt.
                                   Onbekende sleutels en ongeldige waarden worden geweigerd; er wordt niets opgeslagen
  cuccut settings reset <key>      De standaardwaarde herstellen`,
 usage: 'Gebruik: cuccut settings [get <key> | set <key> <value> | reset <key>]', setUsage: 'Gebruik: cuccut settings set <key> <value> (de waarde wordt als JSON gelezen; alles wat geen JSON is wordt tekst; zet waarden met spaties tussen aanhalingstekens)', unknownKey: (key, keys) => `Onbekende instelling: ${key}. Beschikbaar: ${keys.join(', ')}`, isDefault: 'standaard', modified: (defaultValue) => `gewijzigd (standaard ${defaultValue})`, settingRejected: (key, value, description) => `${key} accepteert ${value} niet: ${description}`,
};
