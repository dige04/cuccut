import type { SettingsMessages } from './settings-copy.ts';

export const ru: SettingsMessages = {
  help: "Использование:\n  cuccut settings                  Список всех параметров: ключ, текущее значение, признак значения по умолчанию и краткое описание\n  cuccut settings get <key>        Вывести текущее значение настройки (JSON)\n  cuccut settings set <key> <value>\n                                   Изменить настройку; значение разбирается как JSON (true, 20,\n                                   {\"cjk\":18,\"other\":40}), а если разбор невозможен — как строка.\n                                   Неизвестные ключи и недопустимые значения отклоняются, ничего не сохраняется\n  cuccut settings reset <key>      Вернуть значение по умолчанию",
  usage: "Использование: cuccut settings [get <key> | set <key> <value> | reset <key>]",
  setUsage: "Использование: cuccut settings set <key> <value> (значение разбирается как JSON; всё, что не JSON, считается строкой; значения с пробелами заключайте в кавычки)",
  unknownKey: (key: string, keys: readonly string[]) => `Неизвестная настройка: ${key}. Доступны: ${keys.join(", ")}`,
  isDefault: "по умолчанию",
  modified: (defaultValue: string) => `изменено (по умолчанию ${defaultValue})`,
  settingRejected: (key, value, description) => `${key} не принимает ${value}: ${description}`,
};
