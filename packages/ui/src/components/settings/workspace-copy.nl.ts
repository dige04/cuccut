import type { WorkspaceMessages } from './workspace-copy.ts';

export const nl: WorkspaceMessages = {
  aside: 'Alles hier geldt voor elk project',
  generalBlurb: 'Hoe CucCut eruitziet en welke taal het spreekt, waar downloads terechtkomen en wat het van internet mag ophalen.',
  shortcutsBlurb: 'Toetsen die overal in CucCut werken. De sneltoetsen van de editor staan in Help (F1).',
  shortcutsPanel: 'Overal in CucCut',
  fontsBlurb: 'Lettertypen voor ondertitels en titels: waar ze vandaan komen en welke al op deze computer staan.',
  privacyBlurb: 'Wat op deze computer blijft, wat naar cloudproviders mag en wat agents zonder te vragen mogen doen.',
  diagnosticsBlurb: 'De lokale Runtime, de logboeken en hoeveel van deze computer achtergrondtaken mogen gebruiken.',
  aboutBlurb: 'Versies van de app, de interface en de Runtime, en hoe CucCut wordt bijgewerkt.',
  checking: 'Controleren…',
  noAgent: 'Geen agent klaar',
  shortcutCount: (n) => (n === 1 ? '1 sneltoets' : `${n} sneltoetsen`),
  skillCount: (n) => (n === 0 ? 'Nog geen' : n === 1 ? '1 skill' : `${n} skills`),
  glossaryCount: (n) => (n === 0 ? 'Nog geen' : n === 1 ? '1 woordenlijst' : `${n} woordenlijsten`),
  grantCount: (n) => (n === 0 ? 'Geen actieve toestemmingen' : n === 1 ? '1 actieve toestemming' : `${n} actieve toestemmingen`),
  runtimeOn: 'Runtime verbonden',
  runtimeOff: 'Runtime niet verbonden',
  installed: (n) => (n === 0 ? 'Niets geïnstalleerd' : `${n} geïnstalleerd`),
  noDefault: 'Nog geen standaard',
  version: (version) => `Versie ${version}`,
  desktopOnly: 'Alleen in de desktop-app',
  notYet: 'Nog niet beschikbaar',
  loadFailed: 'Kon niet laden',
  fontsSummary: 'Voor ondertitels en titels',
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? 'Voorkeuren geschreven'
        : answers === 1
          ? 'Voorkeuren geschreven, 1 antwoord'
          : `Voorkeuren geschreven, ${answers} antwoorden`
      : answers === 0
        ? 'Nog geen voorkeuren'
        : answers === 1
          ? '1 antwoord'
          : `${answers} antwoorden`,
  ruleCount: (n, off) => (n === 0 ? 'Nog geen' : `${n === 1 ? '1 regel' : `${n} regels`}${off ? `, ${off} uit` : ''}`),
};
