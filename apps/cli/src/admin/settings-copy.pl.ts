import type { SettingsMessages } from './settings-copy.ts';

export const pl: SettingsMessages = {
  help: "Użycie:\n  cuccut settings                  Lista wszystkich preferencji: klucz, obecna wartość, czy jest domyślna oraz krótki opis\n  cuccut settings get <key>        Wyświetl obecną wartość ustawienia (JSON)\n  cuccut settings set <key> <value>\n                                   Zmień ustawienie; wartość jest analizowana jako JSON (true, 20,\n                                   {\"cjk\":18,\"other\":40}), lub jako ciąg, jeśli analiza nie jest możliwa.\n                                   Nieznane klucze i nieprawidłowe wartości są odrzucane, nic nie jest zapisywane\n  cuccut settings reset <key>      Przywróć wartość domyślną",
  usage: "Użycie: cuccut settings [get <key> | set <key> <value> | reset <key>]",
  setUsage: "Użycie: cuccut settings set <key> <value> (wartość jest analizowana jako JSON; wszystko inne traktowane jest jako ciąg; wartości ze spacjami ujmij w cudzysłowy)",
  unknownKey: (key: string, keys: readonly string[]) => `Nieznane ustawienie: ${key}. Dostępne: ${keys.join(", ")}`,
  isDefault: "domyślne",
  modified: (defaultValue: string) => `zmienione (domyślnie ${defaultValue})`,
  settingRejected: (key, value, description) => `${key} nie akceptuje ${value}: ${description}`,
};
