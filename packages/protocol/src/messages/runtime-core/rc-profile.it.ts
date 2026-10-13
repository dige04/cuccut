import type { RcProfileMessages } from './rc-profile.ts';

export const it: RcProfileMessages = {
  readOnly: 'Il profilo è stato salvato da una versione più recente di CucCut, quindi viene mostrato qui ma non modificato',
  projectNotFound: 'Progetto non trovato',
  projectUnavailable: 'La cartella del progetto manca o non è scrivibile, quindi le sue regole e preferenze non possono essere salvate',
  projectTextOnly: 'Un progetto ha un solo testo di preferenze, impostato come proprio. La sezione dell’intervista esiste solo a livello dello spazio di lavoro',
  noAnswers: 'Rispondi ad almeno una domanda, oppure salta.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Nomi dall’intervista',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `La regola non è stata salvata: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Regola non trovata: ${p.id}`,
  ruleOrder: 'Il nuovo ordine deve elencare ogni regola di questo livello esattamente una volta',
  ruleLimit: (p: { limit: number }) => `Un livello contiene al massimo ${p.limit} regole`,
  templateMissing: (p: { id: string }) => `Il modello «${p.id}» non è installato. La regola è stata salvata; l’agente ignora il modello finché non viene installato`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Nome della regola',
  fieldWhen: 'Quando',
  fieldInstruction: 'Istruzione',
  fieldTemplate: 'Modello',
  fieldNote: 'Nota',
  fieldOrder: 'Ordine',
  required: 'obbligatorio',
  tooLong: (p: { limit: number }) => `più lungo di ${p.limit} caratteri`,
  badId: 'usa lettere minuscole, cifre e trattini, iniziando con una lettera o una cifra, massimo 64 caratteri',
  badTemplateId: 'non è un id di modello valido (lettere minuscole e cifre, unite da trattini singoli)',
  badOrder: 'deve essere un numero intero',
  needInstructionOrTemplate: 'inserisci un’istruzione oppure scegli un modello',

  // A write from the answers (profile-writer)
  writeBusy: 'Le preferenze vengono già scritte dalle risposte. Attendi che questa scrittura finisca',
  writeStopped: 'CucCut si sta chiudendo, quindi le preferenze non sono state scritte. Le tue risposte sono salvate',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Questa sessione non appartiene a un progetto, quindi non c’è il livello di progetto. Usa il livello workspace oppure apri una sessione nel progetto',
  levelWorkspace: 'per ogni progetto',
  levelProject: (p: { name: string }) => `per il progetto ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Salva le risposte dell’intervista: ${p.questions}`,
  toolSkipSummary: 'Salta l’intervista (le risposte vengono conservate)',
  toolWriteSummary: 'Scrivi le tue preferenze dalle risposte dell’intervista',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Aggiungi alle tue preferenze ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Sostituisci le tue preferenze ${p.where} con: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Salva la regola «${p.name}» ${p.where}: quando ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `usa il modello ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Rimuovi la regola «${p.name}» ${p.where}`,
};
