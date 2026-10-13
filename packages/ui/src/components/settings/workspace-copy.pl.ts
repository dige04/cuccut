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
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? 'Preferencje zapisane'
        : answers === 1
          ? 'Preferencje zapisane, 1 odpowiedź'
          : `Preferencje zapisane, ${answers} odpowiedzi`
      : answers === 0
        ? 'Brak preferencji'
        : answers === 1
          ? '1 odpowiedź'
          : `${answers} odpowiedzi`,
  ruleCount: (n, off) => (n === 0 ? 'Brak' : `${n === 1 ? '1 reguła' : `${n} reguł`}${off ? `, wyłączone: ${off}` : ''}`),
  packsBlurb:
    'Sposób tworzenia wideo, który można przenosić: szablony, umiejętności, elementy biblioteki i przewodnik stylu w jednym folderze. Zaimportuj pakiet z folderu, GitHub lub adresu internetowego albo wyeksportuj własny, aby go wysłać.',
  packCount: (n: number) => (n === 0 ? 'Nic nie zainstalowano' : n === 1 ? '1 pakiet' : `${n} pakietów`),
};
