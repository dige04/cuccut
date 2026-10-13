import type { RcProfileMessages } from './rc-profile.ts';

export const de: RcProfileMessages = {
  readOnly: 'Das Profil wurde von einer neueren Version von CucCut gespeichert. Es wird hier angezeigt, aber nicht geändert',
  projectNotFound: 'Projekt nicht gefunden',
  projectUnavailable: 'Der Projektordner fehlt oder ist nicht beschreibbar, daher können seine Regeln und Einstellungen nicht gespeichert werden',
  projectTextOnly: 'Ein Projekt hat einen Einstellungstext, der als eigener festgelegt ist. Der Interview-Abschnitt gibt es nur auf Arbeitsbereichsebene',
  noAnswers: 'Beantworte mindestens eine Frage oder überspringe das Interview.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Namen aus dem Interview',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `Die Regel wurde nicht gespeichert: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Regel nicht gefunden: ${p.id}`,
  ruleOrder: 'Die neue Reihenfolge muss jede Regel auf dieser Ebene genau einmal enthalten',
  ruleLimit: (p: { limit: number }) => `Eine Ebene enthält höchstens ${p.limit} Regeln`,
  templateMissing: (p: { id: string }) => `Die Vorlage „${p.id}“ ist nicht installiert. Die Regel wurde gespeichert; der Agent überspringt die Vorlage, bis sie installiert ist`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'ID',
  fieldName: 'Regelname',
  fieldWhen: 'Wann',
  fieldInstruction: 'Anweisung',
  fieldTemplate: 'Vorlage',
  fieldNote: 'Notiz',
  fieldOrder: 'Reihenfolge',
  required: 'erforderlich',
  tooLong: (p: { limit: number }) => `länger als ${p.limit} Zeichen`,
  badId: 'Kleinbuchstaben, Ziffern und Bindestriche verwenden, mit einem Buchstaben oder einer Ziffer beginnen, höchstens 64 Zeichen',
  badTemplateId: 'ist keine Vorlagen-ID (Kleinbuchstaben und Ziffern, durch einzelne Bindestriche verbunden)',
  badOrder: 'muss eine ganze Zahl sein',
  needInstructionOrTemplate: 'gib eine Anweisung an oder wähle eine Vorlage',

  // A write from the answers (profile-writer)
  writeBusy: 'Einstellungen werden bereits aus den Antworten geschrieben. Warte, bis dieser Vorgang abgeschlossen ist',
  writeStopped: 'CucCut wird beendet, daher wurden die Einstellungen nicht geschrieben. Deine Antworten sind gespeichert',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Diese Sitzung gehört zu keinem Projekt, daher gibt es keine Projektebene. Verwende die Ebene workspace oder öffne eine Sitzung im Projekt',
  levelWorkspace: 'für jedes Projekt',
  levelProject: (p: { name: string }) => `für das Projekt ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Interview-Antworten speichern: ${p.questions}`,
  toolSkipSummary: 'Interview überspringen (die Antworten bleiben erhalten)',
  toolWriteSummary: 'Deine Einstellungen aus den Interview-Antworten schreiben',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Deinen Einstellungen ${p.where} hinzufügen: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Deine Einstellungen ${p.where} ersetzen durch: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Die Regel „${p.name}“ ${p.where} speichern: wenn ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `die Vorlage ${p.id} verwenden`,
  toolRuleRemove: (p: { where: string; name: string }) => `Die Regel „${p.name}“ ${p.where} entfernen`,
};
