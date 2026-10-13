import type { ProfileMessages } from './profile-copy.ts';

export const it: ProfileMessages = {
  help: `Uso:
  cuccut profile show [--project <id>]
                                   Ciò che CucCut sa di te: l’intervista, le tue preferenze, le tue regole
                                   e i nomi da scrivere correttamente; con un progetto (--project, o il progetto
                                   della cartella corrente), anche le preferenze e le regole di quel progetto
  cuccut profile answers set <question> <text>
                                   Salva una risposta dell’intervista (who, record, platforms, annoys, names);
                                   un testo vuoto la cancella
  cuccut profile interview skip|reopen|write
                                   Salta l’intervista, riaprila, oppure scrivi le tue preferenze dalle risposte con
                                   l’agente predefinito (senza agente, le risposte restano come le hai scritte)
  cuccut profile preferences [--project <id>] --file <md>
                                   Sostituisci le tue preferenze, o quelle del progetto, con un file Markdown
                                   (--file - legge dallo standard input); la sezione scritta dall’intervista resta
  cuccut profile rules list [--project <id>]
                                   Le tue regole (o quelle del progetto) nell’ordine in cui vengono lette
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Le regole vengono lette in ordine; quando due si contraddicono, vince la successiva
Gli agenti leggono il profilo all’avvio di una sessione; le sessioni già aperte mantengono ciò che avevano.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Non è una domanda dell’intervista: ${value} (usa una di: ${ids})`,
  needFile: 'Indica le preferenze come file Markdown: --file <md>, oppure --file - per lo standard input',
  badMove: (value: string) => `Sposta una regola su, giù o in una posizione (1 è la prima): ${value}`,
  ruleMissing: (id: string) => `Nessuna regola ${id} a questo livello (vedi cuccut profile rules list)`,
  projectMissing: (id: string) => `Nessun progetto ${id} (vedi cuccut projects list)`,
  stdinPrompt: 'Scrivi o incolla le preferenze, poi premi Ctrl-D:',

  // show
  questionWho: 'Cosa realizzi, e per chi è?',
  questionRecord: 'Cosa registri di solito?',
  questionPlatforms: 'Dove va a finire, e quanto deve durare?',
  questionAnnoys: 'Cosa ti infastidisce dei tuoi video oggi?',
  questionNames: 'Nomi che devono essere scritti correttamente',
  interviewLine: (status: string, answered: number, total: number) => `Intervista: ${status}, ${answered} risposte su ${total}`,
  statusPending: 'non ancora svolta',
  statusSkipped: 'saltata',
  statusDone: 'completata',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Le tue preferenze',
  interviewHeading: 'Quello che ha scritto l’intervista',
  projectHeading: (name: string) => `Preferenze per ${name}`,
  noText: '  (nessuna)',
  rulesHeading: 'Regole',
  projectRulesHeading: (name: string) => `Regole per ${name}`,
  noRules: '  Nessuna regola ancora',
  namesLine: (names: string) => `Nomi da scrivere correttamente: ${names}`,
  readOnly: 'Il profilo è stato salvato da una versione più recente di CucCut: viene mostrato, ma le modifiche sono rifiutate',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (disattiva)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Quando: ${when}`,
  ruleDo: (instruction: string) => `   Fare: ${instruction}`,
  ruleTemplate: (id: string) => `   Modello: ${id}`,
  stageAny: 'scelta e modifica',
  stageClip: 'scelta delle clip',
  stageEdit: 'montaggio',
  ruleEnabled: (name: string) => `Attivata: ${name}`,
  ruleDisabled: (name: string) => `Disattivata: ${name}`,
  ruleRemoved: (name: string, id: string) => `Eliminata ${name} (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `Spostata ${name} in posizione ${position} di ${total}`,

  // Writes
  answerSaved: (question: string) => `Risposta a «${question}» salvata`,
  answerCleared: (question: string) => `Risposta a «${question}» cancellata`,
  interviewSkipped: 'Intervista saltata; le risposte vengono mantenute',
  interviewReopened: 'L’intervista è di nuovo aperta, con le risposte precedenti',
  writing: 'Scrittura delle tue preferenze dalle risposte. Ci vuole un momento…',
  writtenByAgent: 'Preferenze scritte dalle tue risposte:',
  keptAsTyped: (reason: string) => `Le tue risposte sono state mantenute come le hai scritte (${reason}):`,
  reasonNoAgent: 'nessun agente è installato e connesso',
  reasonAgentFailed: 'l’esecuzione dell’agente non è terminata',
  reasonBadOutput: 'l’output dell’agente non era utilizzabile',
  namesAdded: (names: string) => `Nomi aggiunti al glossario: ${names}`,
  preferencesSaved: (chars: number) => `Preferenze salvate (${chars} caratteri)`,
  projectPreferencesSaved: (name: string, chars: number) => `Preferenze per ${name} salvate (${chars} caratteri)`,
  takesEffect: 'Gli agenti leggono questo all’avvio di una sessione; le sessioni già aperte mantengono ciò che avevano',
};
