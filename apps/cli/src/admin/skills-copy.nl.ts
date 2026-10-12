import type { SkillsMessages } from './skills-copy.ts';
import { pluralForm } from '@cuccut/protocol';
export const nl: SkillsMessages = {
 skillsHelp: `Gebruik:
  cuccut skills add <folder>       Een lokale Skill-map (met SKILL.md in de hoofdmap) kopiëren
                                   naar <CUCCUT_HOME>/skills, standaard ingeschakeld
  cuccut skills import <source>    Een Skill van GitHub importeren: owner/repo, een repository-URL, of
                                   …/tree/<branch>/<folder>; standaard uit, kijk deze na voordat je deze inschakelt
    --id <id>                      Voor add en import: een ander id gebruiken (standaard afgeleid van de mapnaam;
                                   geweigerd als het id bestaat, nooit overschreven)
  cuccut skills enable|disable <id>
                                   Een Skill in- of uitschakelen: geldt vanaf de volgende nieuwe agentsessie
  cuccut skills remove <id>        Een toegevoegde of geïmporteerde Skill verwijderen (ingebouwde alleen uitschakelen)`,
 added: 'Toegevoegd', imported: 'Geïmporteerd', turnedOn: 'Ingeschakeld', turnedOff: 'Uitgeschakeld', reviewFirst: (id) => `Kijk deze eerst na (cuccut skills read ${id}) en schakel deze daarna in met cuccut skills enable ${id}`, takesEffectNextSession: 'Geldt vanaf de volgende nieuwe agentsessie; lopende sessies blijven ongewijzigd', removed: (id, path) => `${id} verwijderd (${path})`, localSource: (path, addedAt) => `lokale map ${path} (${addedAt})`, remoteSource: (url, ref, commit, importedAt) => `${url} (${ref}@${commit}, ${importedAt})`, changed: (verb, id, name, enabled, path, source) => `${verb} ${id} (${name}, ${enabled ? 'aan' : 'uit'}) → ${path}${source ? `\nBron: ${source}` : ''}`, idFormat: (flag, value) => `${flag} accepteert een Skill-id (kleine letters, met koppeltekens, zie cuccut skills): ${value}`,
 skillHelp: `Gebruik:
  cuccut skill install --agent <claude-code|codex|cursor|gemini> [--dir <folder>] [--link] [--yes]
                                   De CucCut-Skill voor externe agents (hoe CucCut te gebruiken) installeren in cuccut/
                                   in de Skill-map van de agent: Claude Code ~/.claude/skills, Codex ~/.codex/skills,
                                   Cursor ~/.cursor/skills, Gemini CLI ~/.gemini/skills
    --dir <folder>                 Een andere Skill-map gebruiken (installeert in cuccut/ daaronder); vereist zonder --agent
    --link                         De gerenderde Skill plaatsen in <CUCCUT_HOME>/agent-skills/cuccut en een link in de
                                   agent: later opnieuw installeren (voor elke agent) werkt ze allemaal bij
    --yes                          Het bestaande doel vervangen (bij een link alleen de link, niet de map
                                   waarnaar deze wijst); zonder deze optie wordt niets overschreven
  cuccut skill path                De bron van de CucCut-Skill, de installatiemap van elke agent en wat
                                   nu is geïnstalleerd (de Runtime is niet nodig)`,
 targetExists: (target, linkTarget) => `${target} bestaat al (${linkTarget !== null ? `een link naar ${linkTarget}` : 'een map of bestand'}); niets gewijzigd. Voeg --yes toe om dit te vervangen`, installed: (target, files, linkTo) => `CucCut-Skill geïnstalleerd in ${target} (${files} ${pluralForm('nl', files, { one: 'bestand', other: 'bestanden' })}${linkTo ? `, gekoppeld aan ${linkTo}` : ''})`, takesEffect: (host) => host ? `Geldt in een nieuwe ${host}-sessie` : 'Geldt in een nieuwe sessie', pathEscapes: (path) => `Een pad in de CucCut-Skill wijst buiten de map: ${path}`, sourceLine: (dir) => `Bron    ${dir ?? 'niet gevonden (CucCut is niet geïnstalleerd en dit is niet de repository; je kunt CUCCUT_AGENT_SKILLS_DIR instellen)'}`, notInstalled: 'Niet geïnstalleerd', linkState: (target) => `Link → ${target}`, installedFolder: 'Geïnstalleerd (map)', isFile: 'Een bestand (geen Skill-map)',
};
