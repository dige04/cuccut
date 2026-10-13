import { pluralForm } from '@cuccut/protocol';
import type { SkillsMessages } from './skills-copy.ts';

export const ru: SkillsMessages = {
  skillsHelp: "Использование:\n  cuccut skills add <folder>       Скопировать локальную папку Skill (SKILL.md в корне)\n                                   в <CUCCUT_HOME>/skills, по умолчанию включено\n  cuccut skills import <source>    Импортировать Skill из GitHub: owner/repo, URL репозитория или\n                                   …/tree/<branch>/<folder>; по умолчанию отключено, проверьте перед включением\n    --id <id>                      Для add и import: задать другой id (по умолчанию из имени папки;\n                                   если id уже есть — отказ, без перезаписи)\n  cuccut skills enable|disable <id>\n                                   Включить / отключить Skill: применяется со следующей новой сессии агента\n  cuccut skills remove <id>        Удалить добавленный или импортированный Skill (встроенные можно только отключить)",
  added: "Добавлено",
  imported: "Импортировано",
  turnedOn: "Включено",
  turnedOff: "Отключено",
  reviewFirst: (id) => `Сначала проверьте (cuccut skills read ${id}), затем включите через cuccut skills enable ${id}`,
  takesEffectNextSession: "Применяется со следующей новой сессии агента; текущие сессии не затрагиваются",
  removed: (id, path) => `Удалено: ${id} (${path})`,
  localSource: (path, addedAt) => `локальная папка ${path} (${addedAt})`,
  packSource: (name, version, installedAt) => `From the pack ${name} v${version} (${installedAt})`, remoteSource: (url, ref, commit, importedAt) => `${url} (${ref}@${commit}, ${importedAt})`,
  changed: (verb, id, name, enabled, path, source) => `${verb} ${id} (${name}, ${enabled ? "вкл." : "выкл."}) → ${path}${source ? `
Источник: ${source}` : ""}`,
  idFormat: (flag, value) => `${flag} принимает id Skill (строчные буквы, слова через дефис, см. cuccut skills): ${value}`,

  skillHelp: "Использование:\n  cuccut skill install --agent <claude-code|codex|cursor|gemini> [--dir <folder>] [--link] [--yes]\n                                   Установить Skill CucCut для внешних агентов (использование CucCut) в cuccut/\n                                   в папке Skills хоста: Claude Code ~/.claude/skills, Codex ~/.codex/skills,\n                                   Cursor ~/.cursor/skills, Gemini CLI ~/.gemini/skills\n    --dir <folder>                 Другая папка Skills (установка в cuccut/ внутри); обязательна без --agent\n    --link                         Разместить Skill в <CUCCUT_HOME>/agent-skills/cuccut и ссылку у хоста:\n                                   повторная установка (для любого хоста) обновляет всех\n    --yes                          Заменить существующую цель (для ссылки — только ссылку, не папку назначения);\n                                   без параметра ничего не перезаписывается\n  cuccut skill path                Источник Skill CucCut, места установки каждого хоста и текущее состояние\n                                   установки (Runtime не нужен)",
  targetExists: (target, linkTarget) => `${target} уже существует (${linkTarget !== null ? `ссылка на ${linkTarget}` : "папка или файл"}); ничего не изменено. Добавьте --yes для замены`,
  installed: (target, files, linkTo) => pluralForm('ru', files, { one: `Skill CucCut установлен в ${target} (${files} файл${linkTo ? `, ссылка на ${linkTo}` : ''})`, few: `Skill CucCut установлен в ${target} (${files} файла${linkTo ? `, ссылка на ${linkTo}` : ''})`, many: `Skill CucCut установлен в ${target} (${files} файлов${linkTo ? `, ссылка на ${linkTo}` : ''})`, other: `Skill CucCut установлен в ${target} (${files} файла${linkTo ? `, ссылка на ${linkTo}` : ''})` }),
  takesEffect: (host) => (host ? `Применяется в новой сессии ${host}` : "Применяется в новой сессии"),
  pathEscapes: (path) => `Путь в Skill CucCut указывает за пределы папки: ${path}`,
  sourceLine: (dir) => `Источник  ${dir ?? "not found (CucCut isn't installed and this isn't the repository; you can set CUCCUT_AGENT_SKILLS_DIR)"}`,
  notInstalled: "Не установлен",
  linkState: (target) => `Ссылка → ${target}`,
  installedFolder: "Установлено (папка)",
  isFile: "Файл (не папка Skill)",
};
