import type { ProfileMessages } from './profile-copy.ts';

export const pl: ProfileMessages = {
  help: `Użycie:
  cuccut profile show [--project <id>]
                                   Co CucCut wie o Tobie: wywiad, Twoje preferencje, Twoje reguły
                                   i nazwy do poprawnego zapisania; z projektem (--project lub projekt
                                   bieżącego folderu) także preferencje i reguły tego projektu
  cuccut profile answers set <question> <text>
                                   Zapisz jedną odpowiedź z wywiadu (who, record, platforms, annoys, names);
                                   pusty tekst ją usuwa
  cuccut profile interview skip|reopen|write
                                   Pomiń wywiad, otwórz go ponownie lub zapisz preferencje na podstawie odpowiedzi
                                   domyślnym agentem (bez agenta odpowiedzi zostają wpisane tak, jak są)
  cuccut profile preferences [--project <id>] --file <md>
                                   Zastąp swoje preferencje lub preferencje projektu plikiem Markdown
                                   (--file - czyta standardowe wejście); sekcja zapisana przez wywiad pozostaje
  cuccut profile rules list [--project <id>]
                                   Twoje reguły (lub reguły projektu) w kolejności, w jakiej są czytane
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Reguły są czytane po kolei; gdy dwie się różnią, wygrywa późniejsza
Agenci czytają profil na początku sesji; sesje, które są już otwarte, zachowują to, co miały.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `To nie jest pytanie z wywiadu: ${value} (użyj jednego z: ${ids})`,
  needFile: 'Podaj preferencje jako plik Markdown: --file <md>, albo --file - dla standardowego wejścia',
  badMove: (value: string) => `Przesuń regułę w górę, w dół lub na pozycję (1 to pierwsza): ${value}`,
  ruleMissing: (id: string) => `Brak reguły ${id} na tym poziomie (zobacz cuccut profile rules list)`,
  projectMissing: (id: string) => `Brak projektu ${id} (zobacz cuccut projects list)`,
  stdinPrompt: 'Wpisz lub wklej preferencje, a potem naciśnij Ctrl-D:',

  // show
  questionWho: 'Co tworzysz i dla kogo to jest?',
  questionRecord: 'Co zwykle nagrywasz?',
  questionPlatforms: 'Gdzie to trafia i jak długie powinno być?',
  questionAnnoys: 'Co dziś irytuje Cię w Twoich filmach?',
  questionNames: 'Nazwy, które muszą być napisane poprawnie',
  interviewLine: (status: string, answered: number, total: number) => `Wywiad: ${status}, odpowiedziano na ${answered} z ${total}`,
  statusPending: 'jeszcze nie przeprowadzony',
  statusSkipped: 'pominięty',
  statusDone: 'zakończony',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Twoje preferencje',
  interviewHeading: 'Co zapisał wywiad',
  projectHeading: (name: string) => `Preferencje dla ${name}`,
  noText: '  (brak)',
  rulesHeading: 'Reguły',
  projectRulesHeading: (name: string) => `Reguły dla ${name}`,
  noRules: '  Brak reguł',
  namesLine: (names: string) => `Nazwy do poprawnego zapisania: ${names}`,
  readOnly: 'Profil został zapisany przez nowszą wersję CucCut: jest pokazany, ale zmiany są odrzucane',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (wyłączona)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Gdy: ${when}`,
  ruleDo: (instruction: string) => `   Zrób: ${instruction}`,
  ruleTemplate: (id: string) => `   Szablon: ${id}`,
  stageAny: 'wybór i edycja',
  stageClip: 'wybór klipów',
  stageEdit: 'edycja',
  ruleEnabled: (name: string) => `Włączono: ${name}`,
  ruleDisabled: (name: string) => `Wyłączono: ${name}`,
  ruleRemoved: (name: string, id: string) => `Usunięto ${name} (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `Przeniesiono ${name} na pozycję ${position} z ${total}`,

  // Writes
  answerSaved: (question: string) => `Zapisano odpowiedź na „${question}”`,
  answerCleared: (question: string) => `Usunięto odpowiedź na „${question}”`,
  interviewSkipped: 'Pominięto wywiad; odpowiedzi zostają zachowane',
  interviewReopened: 'Wywiad jest znów otwarty, z poprzednimi odpowiedziami',
  writing: 'Zapisywanie Twoich preferencji na podstawie odpowiedzi. To chwilę potrwa…',
  writtenByAgent: 'Preferencje zapisane na podstawie Twoich odpowiedzi:',
  keptAsTyped: (reason: string) => `Twoje odpowiedzi zostały zachowane tak, jak je wpisano (${reason}):`,
  reasonNoAgent: 'żaden agent nie jest zainstalowany i zalogowany',
  reasonAgentFailed: 'działanie agenta nie zostało zakończone',
  reasonBadOutput: 'wynik agenta nie nadawał się do użycia',
  namesAdded: (names: string) => `Dodano nazwy do glosariusza: ${names}`,
  preferencesSaved: (chars: number) => `Zapisano Twoje preferencje (${chars} znaków)`,
  projectPreferencesSaved: (name: string, chars: number) => `Zapisano preferencje dla ${name} (${chars} znaków)`,
  takesEffect: 'Agenci czytają to na początku sesji; sesje, które są już otwarte, zachowują to, co miały',
};
