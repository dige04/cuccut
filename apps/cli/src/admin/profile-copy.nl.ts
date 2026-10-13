import type { ProfileMessages } from './profile-copy.ts';

/** English for now: the translation stage fills this file. */
export const nl: ProfileMessages = {
  help: `Usage:
  cuccut profile show [--project <id>]
                                   What CucCut knows about you: the interview, your preferences, your rules
                                   and the names to spell; with a project (--project, or the project of the
                                   current folder), also that project's preferences and rules
  cuccut profile answers set <question> <text>
                                   Save one interview answer (who, record, platforms, annoys, names);
                                   an empty text clears it
  cuccut profile interview skip|reopen|write
                                   Skip the interview, open it again, or write your preferences from the
                                   answers with your default agent (without one, the answers are kept as typed)
  cuccut profile preferences [--project <id>] --file <md>
                                   Replace your own preferences, or the project's, with a Markdown file
                                   (--file - reads standard input); the section the interview wrote stays
  cuccut profile rules list [--project <id>]
                                   Your rules (or the project's) in the order they are read
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Rules are read in order; when two disagree, the later one wins
Agents read the profile when a session starts; sessions already open keep what they had.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Not an interview question: ${value} (use one of ${ids})`,
  needFile: 'Give the preferences as a Markdown file: --file <md>, or --file - for standard input',
  badMove: (value: string) => `Move a rule up, down or to a position (1 is first): ${value}`,
  ruleMissing: (id: string) => `No rule ${id} at this level (see cuccut profile rules list)`,
  projectMissing: (id: string) => `No project ${id} (see cuccut projects list)`,
  stdinPrompt: 'Type or paste the preferences, then press Ctrl-D:',

  // show
  questionWho: 'What do you make, and who is it for?',
  questionRecord: 'What do you usually record?',
  questionPlatforms: 'Where does it go, and how long should it be?',
  questionAnnoys: 'What annoys you about your videos today?',
  questionNames: 'Names that must be spelled right',
  interviewLine: (status: string, answered: number, total: number) => `Interview: ${status}, ${answered} of ${total} answered`,
  statusPending: 'not taken yet',
  statusSkipped: 'skipped',
  statusDone: 'done',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Your preferences',
  interviewHeading: 'What the interview wrote',
  projectHeading: (name: string) => `Preferences for ${name}`,
  noText: '  (none)',
  rulesHeading: 'Rules',
  projectRulesHeading: (name: string) => `Rules for ${name}`,
  noRules: '  No rules yet',
  namesLine: (names: string) => `Names to spell: ${names}`,
  readOnly: 'The profile was saved by a newer version of CucCut: it is shown, but changes are refused',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (off)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   When: ${when}`,
  ruleDo: (instruction: string) => `   Do: ${instruction}`,
  ruleTemplate: (id: string) => `   Template: ${id}`,
  stageAny: 'choosing and editing',
  stageClip: 'choosing clips',
  stageEdit: 'editing',
  ruleEnabled: (name: string) => `Turned on: ${name}`,
  ruleDisabled: (name: string) => `Turned off: ${name}`,
  ruleRemoved: (name: string, id: string) => `Removed ${name} (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `Moved ${name} to ${position} of ${total}`,

  // Writes
  answerSaved: (question: string) => `Saved the answer to "${question}"`,
  answerCleared: (question: string) => `Cleared the answer to "${question}"`,
  interviewSkipped: 'Skipped the interview; the answers are kept',
  interviewReopened: 'The interview is open again, with the previous answers',
  writing: 'Writing your preferences from the answers. This takes a moment…',
  writtenByAgent: 'Preferences written from your answers:',
  keptAsTyped: (reason: string) => `Your answers were kept as typed (${reason}):`,
  reasonNoAgent: 'no agent is installed and signed in',
  reasonAgentFailed: "the agent's run did not finish",
  reasonBadOutput: "the agent's output was not usable",
  namesAdded: (names: string) => `Names added to the glossary: ${names}`,
  preferencesSaved: (chars: number) => `Saved your preferences (${chars} characters)`,
  projectPreferencesSaved: (name: string, chars: number) => `Saved the preferences for ${name} (${chars} characters)`,
  takesEffect: 'Agents read this when a session starts; sessions already open keep what they had',
};
