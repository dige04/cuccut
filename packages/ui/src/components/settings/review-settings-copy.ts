import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './review-settings-copy.zh-Hans.ts';
import { zhHant } from './review-settings-copy.zh-Hant.ts';
import { ja } from './review-settings-copy.ja.ts';
import { ko } from './review-settings-copy.ko.ts';
import { es } from './review-settings-copy.es.ts';
import { fr } from './review-settings-copy.fr.ts';
import { de } from './review-settings-copy.de.ts';
import { nl } from './review-settings-copy.nl.ts';
import { ptBR } from './review-settings-copy.pt-BR.ts';
import { it } from './review-settings-copy.it.ts';
import { ru } from './review-settings-copy.ru.ts';
import { pl } from './review-settings-copy.pl.ts';
import { tr } from './review-settings-copy.tr.ts';
import { vi } from './review-settings-copy.vi.ts';

/**
 * Copy for Settings › Review (docs/cuccut/m2-review-gate.md §2.3): the gate switch, the checks and questions of the
 * user's standard, and what lint says about it (the Runtime sends codes; the words are here).
 */
const en = {
  title: 'Review',
  status: (checks: number, questions: number) =>
    `${checks === 1 ? '1 check' : `${checks} checks`} · ${questions === 1 ? '1 question' : `${questions} questions`}`,
  statusBuiltin: 'Built-in',
  gate: 'Hold finished videos to this standard',
  gateHelp: 'Exports for delivery stop on a critical finding until it is fixed or let stand. Previews are never stopped.',
  intro:
    'The part of what you want that can be checked. A check is one measurement CucCut takes and the limit you hold it to; a question is one an agent answers with something to point at.',
  desktopOnly: 'The standard can be changed in the desktop app.',
  checks: 'Checks',
  checksEmpty: 'No checks of your own yet: the built-in ones below apply.',
  builtin: 'Built-in',
  measurement: 'Measurement',
  fromProject: 'Read from the project.',
  fromExport: 'Read from the last export, so it needs an export first.',
  limit: 'Limit',
  limitHelp: 'Write ≤ 60, ≥ 3 or 3–60.',
  limitInvalid: 'Write the limit as ≤ 60, ≥ 3 or 3–60: a bare number says nothing about which side is wrong.',
  limitYes: 'Yes',
  limitNo: 'No',
  onlyFor: 'Only for',
  aspectAny: 'Any shape',
  worth: 'Worth',
  fix: 'What to do about it',
  fixRequired: 'A critical check stops an export, so say what to do about it.',
  addCheck: 'Add this check',
  remove: (name: string) => `Remove ${name}`,
  removed: (name: string) => `Removed ${name}`,
  undo: 'Undo',
  saveFailed: (message: string) => `Couldn’t save the standard: ${message}`,
  questions: 'Questions',
  questionsEmpty: 'No questions yet.',
  questionsHint: 'For what no number catches. An answer has to point at something, or it is recorded as “cannot tell”.',
  question: 'Question',
  answeredWith: 'Answered with',
  evidence: {
    timestamp: 'A moment',
    frame: 'A frame',
    field: 'A part of the video',
    quote: 'A quote',
  },
  addQuestion: 'Add this question',
  lint: {
    unknownMetric: (id: string, metric: string, suggestions: string) =>
      suggestions ? `${id}: ${metric} isn’t a measurement CucCut takes. Did you mean ${suggestions}?` : `${id}: ${metric} isn’t a measurement CucCut takes.`,
    noLimit: (id: string) => `${id} has no limit, so it can never fail.`,
    limitKind: (id: string, metric: string) => `${id}: the limit doesn’t fit ${metric} (a number takes ≤ or ≥, a yes-or-no takes yes or no).`,
    minOverMax: (id: string) => `${id} asks for at least more than its most, so it always fails.`,
    criticalNoFix: (id: string) => `${id} is critical and doesn’t say what to do about it.`,
    duplicateId: (id: string) => `${id} is used twice.`,
    tooLong: (id: string, limit: number) => `${id} is longer than ${limit} characters.`,
    tooMany: (limit: number) => `There are more than ${limit} of these.`,
  },
};

export type ReviewSettingsMessages = typeof en;
export const REVIEW_SETTINGS_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
