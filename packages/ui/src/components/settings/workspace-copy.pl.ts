import { pluralForm } from '@cuccut/protocol';
import type { WorkspaceMessages } from './workspace-copy.ts';

export const pl: WorkspaceMessages = {
  aside: 'Wszystko tutaj dotyczy każdego projektu',
  generalBlurb: 'Jak wygląda CucCut i w jakim języku mówi, gdzie trafiają pobrane pliki i co może pobierać z internetu.',
  shortcutsBlurb: 'Klawisze działające w całym CucCut. Skróty edytora są w Pomocy (F1).',
  shortcutsPanel: 'W całym CucCut',
  fontsBlurb: 'Czcionki do napisów i tytułów: skąd pochodzą i które są już na tym komputerze.',
  privacyBlurb: 'Co zostaje na tym komputerze, co można wysyłać do dostawców chmurowych i co agenci mogą robić bez pytania.',
  diagnosticsBlurb: 'Lokalny Runtime, jego dzienniki i to, ile tego komputera mogą używać zadania w tle.',
  aboutBlurb: 'Wersje aplikacji, interfejsu i Runtime oraz sposób aktualizacji CucCut.',
  checking: 'Sprawdzanie…',
  noAgent: 'Żaden agent nie jest gotowy',
  shortcutCount: (n) => pluralForm('pl', n, { one: `${n} skrót`, few: `${n} skróty`, many: `${n} skrótów`, other: `${n} skrótu` }),
  skillCount: (n) => (n === 0 ? 'Jeszcze brak' : pluralForm('pl', n, { one: `${n} skill`, few: `${n} skille`, many: `${n} skilli`, other: `${n} skilla` })),
  glossaryCount: (n) => (n === 0 ? 'Jeszcze brak' : pluralForm('pl', n, { one: `${n} słownik`, few: `${n} słowniki`, many: `${n} słowników`, other: `${n} słownika` })),
  grantCount: (n) =>
    n === 0 ? 'Brak aktywnych zgód' : pluralForm('pl', n, { one: `${n} aktywna zgoda`, few: `${n} aktywne zgody`, many: `${n} aktywnych zgód`, other: `${n} aktywnej zgody` }),
  runtimeOn: 'Runtime połączony',
  runtimeOff: 'Runtime niepołączony',
  installed: (n) => (n === 0 ? 'Nic nie zainstalowano' : `Zainstalowane: ${n}`),
  noDefault: 'Brak domyślnego',
  version: (version) => `Wersja ${version}`,
  desktopOnly: 'Tylko w aplikacji desktopowej',
  notYet: 'Jeszcze niedostępne',
  loadFailed: 'Nie udało się wczytać',
  fontsSummary: 'Do napisów i tytułów',
  packsBlurb:
    'A way of making videos that travels: templates, skills, library items and a style guide in one folder. Import one from a folder, GitHub or a web address, or export yours to send.',
  packCount: (n: number) => (n === 0 ? 'None installed' : n === 1 ? '1 pack' : `${n} packs`),
};
