import type { RcProfileMessages } from './rc-profile.ts';

/** English for now: the translation stage fills this file. */
export const it: RcProfileMessages = {
  readOnly: 'The profile was saved by a newer version of CucCut, so it is shown here but not changed',
  projectNotFound: 'Project not found',
  projectUnavailable: "The project folder is missing or can't be written, so its rules and preferences can't be saved",
  projectTextOnly: 'A project has one preferences text, set as own. The interview section exists only at the workspace level',
  noAnswers: 'Answer at least one question, or skip.',
  namesGlossaryName: 'Names from the interview',

  ruleInvalid: (p: { problems: string }) => `The rule wasn't saved: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Rule not found: ${p.id}`,
  ruleOrder: 'The new order must list every rule at this level exactly once',
  ruleLimit: (p: { limit: number }) => `A level holds at most ${p.limit} rules`,
  templateMissing: (p: { id: string }) => `The template "${p.id}" isn't installed. The rule was saved; the agent skips the template until it is installed`,
  problemSeparator: '; ',
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Rule name',
  fieldWhen: 'When',
  fieldInstruction: 'Instruction',
  fieldTemplate: 'Template',
  fieldNote: 'Note',
  fieldOrder: 'Order',
  required: 'required',
  tooLong: (p: { limit: number }) => `longer than ${p.limit} characters`,
  badId: 'use lowercase letters, digits and hyphens, starting with a letter or digit, at most 64 characters',
  badTemplateId: "isn't a template id (lowercase letters and digits, joined by single hyphens)",
  badOrder: 'must be a whole number',
  needInstructionOrTemplate: 'give an instruction, or pick a template',

  // A write from the answers (profile-writer)
  writeBusy: 'Preferences are already being written from the answers. Wait for that write to finish',
  writeStopped: 'CucCut is stopping, so the preferences were not written. Your answers are saved',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: "This session isn't in a project, so there is no project level. Use level workspace, or open a session in the project",
  levelWorkspace: 'for every project',
  levelProject: (p: { name: string }) => `for the project ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Save interview answers: ${p.questions}`,
  toolSkipSummary: 'Skip the interview (the answers are kept)',
  toolWriteSummary: 'Write your preferences from the interview answers',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Add to your preferences ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Replace your preferences ${p.where} with: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Save the rule "${p.name}" ${p.where}: when ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `use the template ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Remove the rule "${p.name}" ${p.where}`,
};
