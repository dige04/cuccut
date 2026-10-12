import type { SettingsMessages } from './settings-copy.ts';
export const de: SettingsMessages = {
 help: `Verwendung:
  cuccut settings                  Alle Einstellungen mit Schlüssel, aktuellem Wert, Standardstatus und Kurzbeschreibung anzeigen
  cuccut settings get <key>        Aktuellen Wert einer Einstellung als JSON ausgeben
  cuccut settings set <key> <value>
                                   Einstellung ändern. Der Wert wird als JSON gelesen (true, 20,
                                   {"cjk":18,"other":40}) oder bei ungültigem JSON als Zeichenfolge verwendet.
                                   Unbekannte Schlüssel und ungültige Werte werden abgelehnt; nichts wird gespeichert.
  cuccut settings reset <key>      Standardwert wiederherstellen`,
 usage: 'Verwendung: cuccut settings [get <key> | set <key> <value> | reset <key>]', setUsage: 'Verwendung: cuccut settings set <key> <value> (Wert wird als JSON gelesen; anderes als Zeichenfolge. Werte mit Leerzeichen in Anführungszeichen setzen.)', unknownKey: (key, keys) => `Unbekannte Einstellung: ${key}. Verfügbar: ${keys.join(', ')}`, isDefault: 'Standard', modified: (defaultValue) => `geändert (Standard ${defaultValue})`, settingRejected: (key, value, description) => `${key} akzeptiert ${value} nicht: ${description}`,
};
