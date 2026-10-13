import type { SkillsMessages } from './skills-copy.ts';



export const de: SkillsMessages = {
  skillsHelp: `Verwendung:
  cuccut skills add <folder>       Lokalen Skill-Ordner (mit SKILL.md im Stamm)
                                   nach <CUCCUT_HOME>/skills kopieren; standardmäßig aktiviert
  cuccut skills import <source>    Skill von GitHub importieren: owner/repo, Repository-URL oder
                                   …/tree/<branch>/<folder>; standardmäßig deaktiviert, vor Aktivierung prüfen
    --id <id>                      Für add und import: Andere ID verwenden (standardmäßig vom Ordnernamen
                                   abgeleitet; vorhandene IDs werden abgelehnt, niemals überschrieben)
  cuccut skills enable|disable <id>
                                   Skill aktivieren/deaktivieren: Wirksam ab der nächsten neuen Agent-Sitzung
  cuccut skills remove <id>        Hinzugefügten oder importierten Skill löschen (integrierte lassen sich nur deaktivieren)`,
  added: "Hinzugefügt",
  imported: "Importiert",
  turnedOn: "Aktiviert",
  turnedOff: "Deaktiviert",
  reviewFirst: (id: string) => `Prüfen Sie ihn zuerst (cuccut skills read ${id}) und aktivieren Sie ihn anschließend mit cuccut skills enable ${id}`,
  takesEffectNextSession: "Wirksam ab der nächsten neuen Agent-Sitzung; laufende Sitzungen sind nicht betroffen",
  removed: (id: string, path: string) => `Gelöscht: ${id} (${path})`,
  localSource: (path: string, addedAt: string) => `lokaler Ordner ${path} (${addedAt})`,
  packSource: (name, version, installedAt) => `From the pack ${name} v${version} (${installedAt})`, remoteSource: (url: string, ref: string, commit: string, importedAt: string) => `${url} (${ref}@${commit}, ${importedAt})`,
  changed: (verb: string, id: string, name: string, enabled: boolean, path: string, source: string | null) =>
    `${verb} ${id} (${name}, ${enabled ? "ein" : "aus"}) → ${path}${source ? `\nQuelle: ${source}` : ""}`,
  idFormat: (flag: string, value: string) => `${flag} erwartet eine Skill-ID (Kleinbuchstaben mit Bindestrichen, siehe cuccut skills): ${value}`,

  skillHelp: `Verwendung:
  cuccut skill install --agent <claude-code|codex|cursor|gemini> [--dir <folder>] [--link] [--yes]
                                   CucCut-Skill für externe Agenten (Anleitung zur Verwendung von CucCut) nach cuccut/
                                   im Skill-Ordner des Hosts installieren: Claude Code ~/.claude/skills, Codex ~/.codex/skills,
                                   Cursor ~/.cursor/skills, Gemini CLI ~/.gemini/skills
    --dir <folder>                 Anderen Skill-Ordner verwenden (Installation dort unter cuccut/); ohne --agent erforderlich
    --link                         Aufbereiteten Skill unter <CUCCUT_HOME>/agent-skills/cuccut speichern und beim Host
                                   einen Link darauf anlegen: Eine erneute Installation (für einen beliebigen Host) aktualisiert alle
    --yes                          Vorhandenes Ziel ersetzen (bei Links nur den Link, nicht den Zielordner);
                                   ohne diese Option wird nichts überschrieben
  cuccut skill path                Quelle des CucCut-Skills, Installationsort jedes Hosts und aktuelle Installation
                                   anzeigen (benötigt keine Runtime)`,
  targetExists: (target: string, linkTarget: string | null) =>
    `${target} existiert bereits (${linkTarget !== null ? `ein Link auf ${linkTarget}` : "ein Ordner oder eine Datei"}); nichts wurde geändert. Fügen Sie --yes hinzu, um es zu ersetzen`,
  installed: (target: string, files: number, linkTo: string | null) =>
    `Der CucCut-Skill wurde installiert in ${target} (${files} ${files === 1 ? "Datei" : "Dateien"}${linkTo ? `, verknüpft mit ${linkTo}` : ""})`,
  takesEffect: (host: string | null) => (host ? `Wirksam in einer neuen ${host}-Sitzung` : "Wirksam in einer neuen Sitzung"),
  pathEscapes: (path: string) => `Ein Pfad im CucCut-Skill verweist außerhalb seines Ordners: ${path}`,
  sourceLine: (dir: string | null) =>
    `Quelle    ${dir ?? "nicht gefunden (CucCut ist nicht installiert und dies ist nicht das Repository; Sie können CUCCUT_AGENT_SKILLS_DIR setzen)"}`,
  notInstalled: "Nicht installiert",
  linkState: (target: string) => `Link → ${target}`,
  installedFolder: "Installiert (Ordner)",
  isFile: "Eine Datei (kein Skill-Ordner)",
};
