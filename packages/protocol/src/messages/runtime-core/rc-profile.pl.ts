import type { RcProfileMessages } from './rc-profile.ts';

export const pl: RcProfileMessages = {
  readOnly: 'Profil został zapisany przez nowszą wersję CucCut, więc jest tu pokazany, ale nie jest zmieniany',
  projectNotFound: 'Nie znaleziono projektu',
  projectUnavailable: 'Folder projektu jest niedostępny lub nie można do niego zapisywać, więc jego reguł i preferencji nie da się zapisać',
  projectTextOnly: 'Projekt ma jeden tekst preferencji, ustawiony jako własny. Sekcja wywiadu istnieje tylko na poziomie obszaru roboczego',
  noAnswers: 'Odpowiedz przynajmniej na jedno pytanie albo pomiń.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Nazwy z wywiadu',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `Reguła nie została zapisana: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Nie znaleziono reguły: ${p.id}`,
  ruleOrder: 'Nowa kolejność musi wymieniać każdą regułę na tym poziomie dokładnie raz',
  ruleLimit: (p: { limit: number }) => `Jeden poziom może mieć najwyżej ${p.limit} reguł`,
  templateMissing: (p: { id: string }) => `Szablon „${p.id}” nie jest zainstalowany. Reguła została zapisana; agent pomija szablon, dopóki nie zostanie zainstalowany`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Nazwa reguły',
  fieldWhen: 'Kiedy',
  fieldInstruction: 'Instrukcja',
  fieldTemplate: 'Szablon',
  fieldNote: 'Notatka',
  fieldOrder: 'Kolejność',
  required: 'wymagane',
  tooLong: (p: { limit: number }) => `dłuższe niż ${p.limit} znaków`,
  badId: 'użyj małych liter, cyfr i myślników, zaczynając od litery lub cyfry, najwyżej 64 znaki',
  badTemplateId: 'nie jest identyfikatorem szablonu (małe litery i cyfry, łączone pojedynczymi myślnikami)',
  badOrder: 'musi być liczbą całkowitą',
  needInstructionOrTemplate: 'podaj instrukcję albo wybierz szablon',

  // A write from the answers (profile-writer)
  writeBusy: 'Preferencje są już zapisywane na podstawie odpowiedzi. Poczekaj, aż ten zapis się zakończy',
  writeStopped: 'CucCut się zamyka, więc preferencje nie zostały zapisane. Twoje odpowiedzi są zachowane',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Ta sesja nie należy do projektu, więc nie ma poziomu projektu. Użyj poziomu workspace albo otwórz sesję w projekcie',
  levelWorkspace: 'dla każdego projektu',
  levelProject: (p: { name: string }) => `dla projektu ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Zapisz odpowiedzi z wywiadu: ${p.questions}`,
  toolSkipSummary: 'Pomiń wywiad (odpowiedzi zostaną zachowane)',
  toolWriteSummary: 'Zapisz swoje preferencje na podstawie odpowiedzi z wywiadu',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Dodaj do swoich preferencji ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Zastąp swoje preferencje ${p.where} tekstem: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Zapisz regułę „${p.name}” ${p.where}: gdy ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `użyj szablonu ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Usuń regułę „${p.name}” ${p.where}`,
};
