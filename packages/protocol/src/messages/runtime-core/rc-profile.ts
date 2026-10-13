import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-profile.zh-Hans.ts';
import { zhHant } from './rc-profile.zh-Hant.ts';
import { ja } from './rc-profile.ja.ts';
import { ko } from './rc-profile.ko.ts';
import { es } from './rc-profile.es.ts';
import { fr } from './rc-profile.fr.ts';
import { de } from './rc-profile.de.ts';
import { nl } from './rc-profile.nl.ts';
import { ptBR } from './rc-profile.pt-BR.ts';
import { it } from './rc-profile.it.ts';
import { ru } from './rc-profile.ru.ts';
import { pl } from './rc-profile.pl.ts';
import { tr } from './rc-profile.tr.ts';
import { vi } from './rc-profile.vi.ts';

/** The user's profile, interview and rules (profile/). English is the source of keys and types; translations are in `rc-profile.<language>.ts`. */
const en = {
  // Storage and lookup (profile-service)
  readOnly: 'The profile was saved by a newer version of CucCut, so it is shown here but not changed',
  projectNotFound: 'Project not found',
  projectUnavailable: "The project folder is missing or can't be written, so its rules and preferences can't be saved",
  projectTextOnly: 'A project has one preferences text, set as own. The interview section exists only at the workspace level',
  noAnswers: 'Answer at least one question, or skip.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Names from the interview',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `The rule wasn't saved: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Rule not found: ${p.id}`,
  ruleOrder: 'The new order must list every rule at this level exactly once',
  ruleLimit: (p: { limit: number }) => `A level holds at most ${p.limit} rules`,
  templateMissing: (p: { id: string }) => `The template "${p.id}" isn't installed. The rule was saved; the agent skips the template until it is installed`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
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

export type RcProfileMessages = typeof en;

export const RcProfile = defineCatalog('rcProfile', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
