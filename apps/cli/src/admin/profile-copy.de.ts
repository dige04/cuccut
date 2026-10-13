import type { ProfileMessages } from './profile-copy.ts';

export const de: ProfileMessages = {
  help: `Verwendung:
  cuccut profile show [--project <id>]
                                   Was CucCut über dich weiß: das Interview, deine Einstellungen, deine Regeln
                                   und die Namen, die richtig geschrieben werden müssen; mit einem Projekt
                                   (--project oder dem Projekt des aktuellen Ordners) auch dessen Einstellungen und Regeln
  cuccut profile answers set <question> <text>
                                   Eine Interview-Antwort speichern (who, record, platforms, annoys, names);
                                   ein leerer Text löscht sie
  cuccut profile interview skip|reopen|write
                                   Das Interview überspringen, erneut öffnen oder deine Einstellungen aus den
                                   Antworten mit deinem Standard-Agent schreiben (ohne Agent bleiben die Antworten wie eingegeben)
  cuccut profile preferences [--project <id>] --file <md>
                                   Deine eigenen Einstellungen oder die des Projekts durch eine Markdown-Datei ersetzen
                                   (--file - liest die Standardeingabe); der vom Interview geschriebene Abschnitt bleibt
  cuccut profile rules list [--project <id>]
                                   Deine Regeln (oder die des Projekts) in der Reihenfolge, in der sie gelesen werden
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Regeln werden der Reihe nach gelesen; widersprechen sich zwei, gewinnt die spätere
Agenten lesen das Profil beim Start einer Sitzung; bereits offene Sitzungen behalten ihren Stand.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Keine Interviewfrage: ${value} (verwende eine von: ${ids})`,
  needFile: 'Gib die Einstellungen als Markdown-Datei an: --file <md>, oder --file - für die Standardeingabe',
  badMove: (value: string) => `Verschiebe eine Regel nach oben, unten oder an eine Position (1 ist die erste): ${value}`,
  ruleMissing: (id: string) => `Keine Regel ${id} auf dieser Ebene (siehe cuccut profile rules list)`,
  projectMissing: (id: string) => `Kein Projekt ${id} (siehe cuccut projects list)`,
  stdinPrompt: 'Tippe oder füge die Einstellungen ein und drücke dann Strg-D:',

  // show
  questionWho: 'Was machst du, und für wen ist es?',
  questionRecord: 'Was nimmst du normalerweise auf?',
  questionPlatforms: 'Wohin geht es, und wie lang soll es sein?',
  questionAnnoys: 'Was nervt dich heute an deinen Videos?',
  questionNames: 'Namen, die richtig geschrieben werden müssen',
  interviewLine: (status: string, answered: number, total: number) => `Interview: ${status}, ${answered} von ${total} beantwortet`,
  statusPending: 'noch nicht gemacht',
  statusSkipped: 'übersprungen',
  statusDone: 'erledigt',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Deine Einstellungen',
  interviewHeading: 'Was das Interview geschrieben hat',
  projectHeading: (name: string) => `Einstellungen für ${name}`,
  noText: '  (keine)',
  rulesHeading: 'Regeln',
  projectRulesHeading: (name: string) => `Regeln für ${name}`,
  noRules: '  Noch keine Regeln',
  namesLine: (names: string) => `Namen, die richtig geschrieben werden müssen: ${names}`,
  readOnly: 'Das Profil wurde von einer neueren Version von CucCut gespeichert: Es wird angezeigt, Änderungen werden abgelehnt',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (aus)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Wenn: ${when}`,
  ruleDo: (instruction: string) => `   Tun: ${instruction}`,
  ruleTemplate: (id: string) => `   Vorlage: ${id}`,
  stageAny: 'auswählen und bearbeiten',
  stageClip: 'Clips auswählen',
  stageEdit: 'bearbeiten',
  ruleEnabled: (name: string) => `Eingeschaltet: ${name}`,
  ruleDisabled: (name: string) => `Ausgeschaltet: ${name}`,
  ruleRemoved: (name: string, id: string) => `${name} (${id}) entfernt`,
  ruleMoved: (name: string, position: number, total: number) => `${name} auf Position ${position} von ${total} verschoben`,

  // Writes
  answerSaved: (question: string) => `Antwort auf „${question}“ gespeichert`,
  answerCleared: (question: string) => `Antwort auf „${question}“ gelöscht`,
  interviewSkipped: 'Interview übersprungen; die Antworten bleiben erhalten',
  interviewReopened: 'Das Interview ist wieder geöffnet, mit den bisherigen Antworten',
  writing: 'Deine Einstellungen werden aus den Antworten geschrieben. Das dauert einen Moment…',
  writtenByAgent: 'Einstellungen aus deinen Antworten geschrieben:',
  keptAsTyped: (reason: string) => `Deine Antworten blieben wie eingegeben erhalten (${reason}):`,
  reasonNoAgent: 'es ist kein Agent installiert und angemeldet',
  reasonAgentFailed: 'der Lauf des Agenten wurde nicht abgeschlossen',
  reasonBadOutput: 'die Ausgabe des Agenten war nicht verwendbar',
  namesAdded: (names: string) => `Namen zum Glossar hinzugefügt: ${names}`,
  preferencesSaved: (chars: number) => `Deine Einstellungen gespeichert (${chars} Zeichen)`,
  projectPreferencesSaved: (name: string, chars: number) => `Einstellungen für ${name} gespeichert (${chars} Zeichen)`,
  takesEffect: 'Agenten lesen dies beim Start einer Sitzung; bereits offene Sitzungen behalten ihren Stand',
};
