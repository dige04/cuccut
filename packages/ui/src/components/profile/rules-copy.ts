import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './rules-copy.zh-Hans.ts';
import { zhHant } from './rules-copy.zh-Hant.ts';
import { ja } from './rules-copy.ja.ts';
import { ko } from './rules-copy.ko.ts';
import { es } from './rules-copy.es.ts';
import { fr } from './rules-copy.fr.ts';
import { de } from './rules-copy.de.ts';
import { nl } from './rules-copy.nl.ts';
import { ptBR } from './rules-copy.pt-BR.ts';
import { it } from './rules-copy.it.ts';
import { ru } from './rules-copy.ru.ts';
import { pl } from './rules-copy.pl.ts';
import { tr } from './rules-copy.tr.ts';
import { vi } from './rules-copy.vi.ts';

/**
 * Copy for the user's rules (docs/cuccut/m2-profile-rules.md §2.2): Settings › Rules, the rule form and the rule rows the project dialog shares.
 * English is the source of the keys and types; translations are in `rules-copy.<lang>.ts`.
 */
const en = {
  blurb:
    'Tell the agent what to repeat in your videos. Each rule has a condition and an instruction. These rules apply across projects; saving one does not change existing videos.',
  create: 'Create a rule',
  loading: 'Loading your rules',
  listLabel: 'Your rules',
  empty: {
    title: 'No rules yet',
    body: 'A rule is how you stop repeating yourself: “when the clip is gameplay, never cover the game with pictures.” The agent judges the sentence.',
  },
  footnote: 'Rules are read in this order. When two disagree, the later one wins.',
  stage: {
    any: 'Choosing and editing',
    clip: 'Choosing clips',
    edit: 'Editing',
  },
  rule: {
    when: (when: string) => `When ${when}`,
    moveUp: (name: string) => `Move “${name}” earlier`,
    moveDown: (name: string) => `Move “${name}” later`,
    firstAlready: 'Already the first rule',
    lastAlready: 'Already the last rule',
    on: 'On',
    off: 'Off',
    edit: 'Edit',
    remove: (name: string) => `Delete “${name}”`,
    deleted: (name: string) => `Deleted “${name}”`,
    toggleFailed: (message: string) => `Couldn’t switch the rule: ${message}`,
    moveFailed: (message: string) => `Couldn’t move the rule: ${message}`,
    removeFailed: (message: string) => `Couldn’t delete the rule: ${message}`,
  },
  effect: {
    template: (name: string) => `Use ${name}`,
    templateMissing: '(not installed)',
    instruction: (text: string) => `Agent instruction: ${text}`,
  },
  form: {
    back: 'Back to rules',
    createTitle: 'Create a rule',
    editTitle: 'Edit rule',
    lede: 'Say when the rule applies and what the agent should do then. Review it, then save it for future sessions.',
    review: 'Review your rule',
    whenLabel: 'When:',
    whenEmpty: 'Describe when this rule should apply below.',
    noEffect: 'Add an instruction or choose a template below.',
    scopeAll: 'Applies to every project.',
    scopeProject: 'Applies only to this project.',
    enabled: 'Enabled for new sessions.',
    paused: 'Paused; it will not apply.',
    existing: 'Existing videos keep their current edits.',
    when: 'When should it apply?',
    whenPlaceholder: 'The clip shows gameplay footage',
    name: 'Rule name',
    namePlaceholder: 'Keep gameplay visible',
    stage: 'Use this rule when',
    level: 'Where it applies',
    levelWorkspace: 'Every project',
    levelProject: 'This project only',
    instruction: 'Instruction for the agent',
    instructionPlaceholder: 'Keep the full game interface visible when choosing a crop.',
    instructionHelp: 'The agent follows this when the condition holds. It does not change videos on its own.',
    template: 'Template',
    noTemplate: 'No template',
    notInstalled: (id: string) => `${id} (not installed)`,
    more: 'More options',
    note: 'Note to yourself',
    noteHelp: 'Only you see this; it is never sent to the agent.',
    order: 'Order (lower numbers run first)',
    enable: 'Enable rule',
    save: 'Save rule',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    done: 'Done',
    needName: 'Give the rule a name to save it.',
    needWhen: 'Say when the rule should apply to save it.',
    needAction: 'Add an instruction or choose a template to save the rule.',
    badOrder: 'The order must be a whole number.',
    saved: 'Rule saved',
    savedWithNotes: 'Saved with notes',
  },
};

export type RulesMessages = typeof en;

export const RULES_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
