import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './review-copy.zh-Hans.ts';
import { zhHant } from './review-copy.zh-Hant.ts';
import { ja } from './review-copy.ja.ts';
import { ko } from './review-copy.ko.ts';
import { es } from './review-copy.es.ts';
import { fr } from './review-copy.fr.ts';
import { de } from './review-copy.de.ts';
import { nl } from './review-copy.nl.ts';
import { ptBR } from './review-copy.pt-BR.ts';
import { it } from './review-copy.it.ts';
import { ru } from './review-copy.ru.ts';
import { pl } from './review-copy.pl.ts';
import { tr } from './review-copy.tr.ts';
import { vi } from './review-copy.vi.ts';

/**
 * Copy for the review gate in the editor (docs/cuccut/m2-review-gate.md §2.1, §2.2, §2.4): the "What correct looks like"
 * dialog, the review note in the export popover and the verdict badges. Metric names are in `review-metrics-copy.ts`.
 */
const en = {
  menuItem: 'What correct looks like',
  title: 'What correct looks like here',
  close: 'Close',
  loading: 'Reading the standard…',
  reasonBuiltin: 'You haven’t set a standard yet, so these are the built-in checks.',
  reasonUser: 'Held to your standard (Settings › Review).',
  counts: (checks: number, questions: number) =>
    `${checks === 1 ? '1 check' : `${checks} checks`}${
      questions ? `, and ${questions === 1 ? '1 question' : `${questions} questions`} an agent answers.` : ', and no questions.'
    }`,
  check: 'Check this video',
  ask: 'Ask the questions too',
  askNeedsAgent: 'Connect a coding agent to ask the questions.',
  askNeedsEdit: 'The video isn’t caught up yet, so nothing can be asked about it.',
  decisionsLocked: 'The video isn’t caught up yet, so findings can’t be let stand or changed for now.',
  asking: 'Asking…',
  askingNote: 'An agent is answering the questions in the video’s conversation.',
  openConversation: 'Open the conversation',
  askAgain: 'Ask again',
  stopWaiting: 'Stop waiting',
  notChecked: 'This video hasn’t been checked yet.',
  verdict: {
    passed: 'It holds to everything it is asked.',
    findings: 'Nothing blocking, and some things worth reading.',
    failed: 'Something critical is open, so a delivery export is refused until it is answered.',
    notReviewed: 'Nothing here could be read on this video.',
  },
  readFrom: (fromExport: boolean, answers: boolean) =>
    `Read from the project${fromExport ? (answers ? ', the last export' : ' and the last export') : ''}${answers ? ' and the answers' : ''}.`,
  letStandCount: (n: number) => (n === 1 ? '1 finding is let stand with a reason.' : `${n} findings are let stand with a reason.`),
  staleProject: 'The video has changed since it was checked.',
  staleExport: (revision: string) => `The last export was made from version ${revision}; the video has changed since.`,
  staleAnswers: 'The answers were given before the last change.',
  groups: {
    open: 'To answer for',
    waived: 'Let stand',
    holds: (n: number) => `${n} it holds to`,
    skipped: (n: number) => `${n} not read on this video`,
  },
  said: (label: string, value: string) => `${label} is ${value}`,
  asksFor: (limit: string) => `asks for ${limit}`,
  couldNotTell: (note: string) => (note ? `could not be told: ${note}` : 'could not be told'),
  rubricVerdict: {
    holds: 'holds',
    fails: 'fails',
    cannotTell: 'could not be told',
  },
  answered: (verdict: string, note: string, evidence: string) => `${note || verdict}${evidence ? ` — ${evidence}` : ''}`,
  lowered: (from: string, reason: string) => (reason ? `Lowered from ${from}: ${reason}` : `Lowered from ${from}`),
  letStand: 'Let it stand…',
  reasonLabel: 'Why this one is allowed',
  reasonPlaceholder: 'For example: the client drops their logo into this box.',
  reasonNeeded: 'Write why before saving.',
  save: 'Save',
  cancel: 'Cancel',
  letStandBy: (reason: string, who: string) => `Let stand: ${reason} — ${who}`,
  who: {
    user: 'You',
    agent: 'Agent',
  },
  holdAgain: 'Hold it to this again',
  worth: (id: string) => `What ${id} is worth here`,
  lowerReason: (severity: string) => `Why this is only a ${severity} here`,
  severity: {
    critical: 'Critical',
    suggestion: 'Suggestion',
    nitpick: 'Nitpick',
  },
  severityLower: {
    critical: 'critical',
    suggestion: 'suggestion',
    nitpick: 'nitpick',
  },
  limit: {
    atLeast: (n: string) => `at least ${n}`,
    atMost: (n: string) => `at most ${n}`,
    between: (min: string, max: string) => `${min} to ${max}`,
    yes: 'yes',
    no: 'no',
    any: 'anything',
  },
  skip: {
    aspect: (aspect: string) => `Not for this shape (${aspect})`,
    unknownMetric: (metric: string) => `${metric} isn’t a measurement CucCut takes`,
    notExported: 'Needs a finished export first',
    unreadable: (metric: string) => `${metric} couldn’t be read on this video`,
    notAsked: 'The questions haven’t been asked yet',
  },
  badge: {
    passed: 'Holds',
    findings: 'Worth a look',
    failed: 'Blocked',
    notReviewed: 'Not checked',
  },
  exportNote: (n: number) => (n === 1 ? '1 thing would stop this export.' : `${n} things would stop this export.`),
  openReview: 'Open the review',
  waivedToast: (name: string) => `${name} is let stand`,
  unwaivedToast: (name: string) => `${name} is held to the standard again`,
  severityToast: (name: string, severity: string) => `${name} is now a ${severity} here`,
  undo: 'Undo',
  failed: (message: string) => `Couldn’t do that: ${message}`,
  rubricPrompt: (videoName: string) =>
    `Answer the review questions for “${videoName}”. Read them with review_criteria, look at the video (frames, documents or a preview export), then record every answer with review_answer, pointing at the kind of evidence each question asks for. Don’t change the video or let any finding stand.`,
};

export type ReviewMessages = typeof en;
export const REVIEW_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
