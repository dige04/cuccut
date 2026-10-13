import type { WorkspaceMessages } from './workspace-copy.ts';

export const de: WorkspaceMessages = {
  aside: 'Alles hier gilt für jedes Projekt',
  generalBlurb: 'Wie CucCut aussieht und spricht, wo Downloads landen und was es aus dem Internet laden darf.',
  shortcutsBlurb: 'Tasten, die überall in CucCut funktionieren. Die Tastenkürzel des Editors stehen in der Hilfe (F1).',
  shortcutsPanel: 'Überall in CucCut',
  fontsBlurb: 'Schriften für Untertitel und Titel: woher sie kommen und welche schon auf diesem Computer sind.',
  privacyBlurb: 'Was auf diesem Computer bleibt, was an Cloud-Anbieter gesendet werden darf und was Agents ohne Nachfrage tun dürfen.',
  diagnosticsBlurb: 'Die lokale Runtime, ihre Protokolle und wie viel dieses Computers Hintergrundaufgaben nutzen dürfen.',
  aboutBlurb: 'Versionen von App, Oberfläche und Runtime, und wie CucCut aktualisiert wird.',
  checking: 'Wird geprüft…',
  noAgent: 'Kein Agent bereit',
  shortcutCount: (n) => (n === 1 ? '1 Tastenkürzel' : `${n} Tastenkürzel`),
  skillCount: (n) => (n === 0 ? 'Noch keine' : n === 1 ? '1 Skill' : `${n} Skills`),
  glossaryCount: (n) => (n === 0 ? 'Noch keine' : n === 1 ? '1 Glossar' : `${n} Glossare`),
  grantCount: (n) => (n === 0 ? 'Keine aktiven Freigaben' : n === 1 ? '1 aktive Freigabe' : `${n} aktive Freigaben`),
  runtimeOn: 'Runtime verbunden',
  runtimeOff: 'Runtime nicht verbunden',
  installed: (n) => (n === 0 ? 'Keine installiert' : `${n} installiert`),
  noDefault: 'Noch kein Standard',
  version: (version) => `Version ${version}`,
  desktopOnly: 'Nur in der Desktop-App',
  notYet: 'Noch nicht verfügbar',
  loadFailed: 'Konnte nicht geladen werden',
  fontsSummary: 'Für Untertitel und Titel',
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? 'Preferences written'
        : `Preferences written, ${answers === 1 ? '1 answer' : `${answers} answers`}`
      : answers === 0
        ? 'No preferences yet'
        : answers === 1
          ? '1 answer'
          : `${answers} answers`,
  ruleCount: (n, off) => (n === 0 ? 'None yet' : `${n === 1 ? '1 rule' : `${n} rules`}${off ? `, ${off} off` : ''}`),
};
