import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './workspace-copy.zh-Hans.ts';
import { zhHant } from './workspace-copy.zh-Hant.ts';
import { ja } from './workspace-copy.ja.ts';
import { ko } from './workspace-copy.ko.ts';
import { es } from './workspace-copy.es.ts';
import { fr } from './workspace-copy.fr.ts';
import { de } from './workspace-copy.de.ts';
import { nl } from './workspace-copy.nl.ts';
import { ptBR } from './workspace-copy.pt-BR.ts';
import { it } from './workspace-copy.it.ts';
import { ru } from './workspace-copy.ru.ts';
import { pl } from './workspace-copy.pl.ts';
import { tr } from './workspace-copy.tr.ts';
import { vi } from './workspace-copy.vi.ts';

/** Copy for the settings shell (the workspace page): its header, the blurb under each section title, and the rail. */
const en = {
  aside: 'Everything here applies to every project',
  generalBlurb: 'How CucCut looks and speaks, where downloads land and what it may fetch from the internet.',
  shortcutsBlurb: 'Keys that work anywhere in CucCut. Shortcuts for the editor are listed in Help (F1).',
  shortcutsPanel: 'Anywhere in CucCut',
  fontsBlurb: 'Fonts for captions and titles: where they come from, and the ones already on this computer.',
  privacyBlurb: 'What stays on this computer, what may be sent to cloud providers, and what agents may do without asking.',
  diagnosticsBlurb: 'The local Runtime, its logs, and how much of this computer background jobs may use.',
  aboutBlurb: 'Versions of the app, the interface and the Runtime, and how CucCut updates.',
  checking: 'Checking…',
  noAgent: 'No agent ready',
  shortcutCount: (n: number) => (n === 1 ? '1 shortcut' : `${n} shortcuts`),
  skillCount: (n: number) => (n === 0 ? 'None yet' : n === 1 ? '1 skill' : `${n} skills`),
  glossaryCount: (n: number) => (n === 0 ? 'None yet' : n === 1 ? '1 glossary' : `${n} glossaries`),
  grantCount: (n: number) => (n === 0 ? 'No active grants' : n === 1 ? '1 active grant' : `${n} active grants`),
  runtimeOn: 'Runtime connected',
  runtimeOff: 'Runtime not connected',
  installed: (n: number) => (n === 0 ? 'None installed' : `${n} installed`),
  noDefault: 'No default yet',
  version: (version: string) => `Version ${version}`,
  desktopOnly: 'Desktop app only',
  notYet: 'Not available yet',
  loadFailed: "Couldn't load",
  fontsSummary: 'For captions and titles',
};

export type WorkspaceMessages = typeof en;

export const W = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
