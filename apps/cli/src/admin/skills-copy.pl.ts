import { pluralForm } from '@cuccut/protocol';
import type { SkillsMessages } from './skills-copy.ts';

export const pl: SkillsMessages = {
  skillsHelp: "Użycie:\n  cuccut skills add <folder>       Skopiuj lokalny folder Skill (SKILL.md w głównym folderze)\n                                   do <CUCCUT_HOME>/skills, domyślnie włączony\n  cuccut skills import <source>    Importuj Skill z GitHub: owner/repo, URL repozytorium lub\n                                   …/tree/<branch>/<folder>; domyślnie wyłączony, sprawdź przed włączeniem\n    --id <id>                      Dla add i import: inne id (domyślnie z nazwy folderu;\n                                   istniejące id jest odrzucane, bez nadpisywania)\n  cuccut skills enable|disable <id>\n                                   Włącz / wyłącz Skill: działa od kolejnej nowej sesji agenta\n  cuccut skills remove <id>        Usuń dodany lub importowany Skill (wbudowane można tylko wyłączyć)",
  added: "Dodano",
  imported: "Zaimportowano",
  turnedOn: "Włączono",
  turnedOff: "Wyłączone",
  reviewFirst: (id) => `Najpierw przejrzyj (cuccut skills read ${id}), potem włącz przez cuccut skills enable ${id}`,
  takesEffectNextSession: "Działa od kolejnej nowej sesji agenta; trwające sesje bez zmian",
  removed: (id, path) => `Usunięto: ${id} (${path})`,
  localSource: (path, addedAt) => `folder lokalny ${path} (${addedAt})`,
  remoteSource: (url, ref, commit, importedAt) => `${url} (${ref}@${commit}, ${importedAt})`,
  changed: (verb, id, name, enabled, path, source) => `${verb} ${id} (${name}, ${enabled ? "wł." : "wył."}) → ${path}${source ? `
Źródło: ${source}` : ""}`,
  idFormat: (flag, value) => `${flag} przyjmuje id Skill (małe litery, słowa z łącznikami, zobacz cuccut skills): ${value}`,

  skillHelp: "Użycie:\n  cuccut skill install --agent <claude-code|codex|cursor|gemini> [--dir <folder>] [--link] [--yes]\n                                   Zainstaluj Skill CucCut dla agentów zewnętrznych (używanie CucCut) w cuccut/\n                                   w folderze Skills hosta: Claude Code ~/.claude/skills, Codex ~/.codex/skills,\n                                   Cursor ~/.cursor/skills, Gemini CLI ~/.gemini/skills\n    --dir <folder>                 Inny folder Skills (instalacja w cuccut/ wewnątrz); wymagany bez --agent\n    --link                         Umieść Skill w <CUCCUT_HOME>/agent-skills/cuccut i dowiązanie u hosta:\n                                   kolejna instalacja (dla dowolnego hosta) aktualizuje wszystkich\n    --yes                          Zastąp istniejący cel (dla dowiązania – tylko dowiązanie, nie folder docelowy);\n                                   bez parametru nic nie jest nadpisywane\n  cuccut skill path                Źródło Skill CucCut, lokalizacje instalacji każdego hosta i obecny stan\n                                   instalacji (bez Runtime)",
  targetExists: (target, linkTarget) => `${target} już istnieje (${linkTarget !== null ? `dowiązanie do ${linkTarget}` : "folder lub plik"}); nic nie zmieniono. Dodaj --yes, aby zastąpić`,
  installed: (target, files, linkTo) => pluralForm('pl', files, { one: `Skill CucCut zainstalowano w ${target} (${files} plik${linkTo ? `, dowiązanie do ${linkTo}` : ''})`, few: `Skill CucCut zainstalowano w ${target} (${files} pliki${linkTo ? `, dowiązanie do ${linkTo}` : ''})`, many: `Skill CucCut zainstalowano w ${target} (${files} plików${linkTo ? `, dowiązanie do ${linkTo}` : ''})`, other: `Skill CucCut zainstalowano w ${target} (${files} pliku${linkTo ? `, dowiązanie do ${linkTo}` : ''})` }),
  takesEffect: (host) => (host ? `Działa w nowej sesji ${host}` : "Działa w nowej sesji"),
  pathEscapes: (path) => `Ścieżka w Skill CucCut wykracza poza folder: ${path}`,
  sourceLine: (dir) => `Źródło    ${dir ?? "not found (CucCut isn't installed and this isn't the repository; you can set CUCCUT_AGENT_SKILLS_DIR)"}`,
  notInstalled: "Nie zainstalowano",
  linkState: (target) => `Dowiązanie → ${target}`,
  installedFolder: "Zainstalowane (folder)",
  isFile: "Plik (nie folder Skill)",
};
