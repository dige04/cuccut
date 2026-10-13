import { defineMessages, live, type ModelCheckCode } from '@cuccut/protocol';
import { zhHans } from './model-check-copy.zh-Hans.ts';
import { zhHant } from './model-check-copy.zh-Hant.ts';
import { ja } from './model-check-copy.ja.ts';
import { ko } from './model-check-copy.ko.ts';
import { es } from './model-check-copy.es.ts';
import { fr } from './model-check-copy.fr.ts';
import { de } from './model-check-copy.de.ts';
import { nl } from './model-check-copy.nl.ts';
import { ptBR } from './model-check-copy.pt-BR.ts';
import { it } from './model-check-copy.it.ts';
import { ru } from './model-check-copy.ru.ts';
import { pl } from './model-check-copy.pl.ts';
import { tr } from './model-check-copy.tr.ts';
import { vi } from './model-check-copy.vi.ts';

/**
 * Wording for failed local-model “检查” (check) and trial (listen) runs (design model-local-check.js): check code → one sentence on what is wrong + what to do.
 * Code and technical details go only into “技术详情” (technical details); the body text contains no code. Whether a fix will help is not decided here; it is decided by `modelCheckRepair` in `@cuccut/protocol`.
 * The English is the source of the keys and types; translations are in `model-check-copy.<locale>.ts`; the current language must be read at call time.
 */

/** Kinds of capability: recognition and separation (no trial), synthesis (listen), image and music generation (listen). What “不对” (wrong) looks like is described separately for each. */
export type CheckSubject = 'transcribe' | 'synthesize' | 'image' | 'separate' | 'music';

export interface CheckSentence {
  text: string;
  todo: string;
}

/**
 * What a trial refers to: speech synthesis is “试听” (listen), image generation is “试画” (try drawing) (design model-local-check.js `TRY`, `tryFailure`).
 * Each language writes out the whole sentence; verbs and nouns are not assembled at the call site.
 */
export interface TrySubject {
  /** Not enough memory; did not finish. */
  noMemory: CheckSentence;
  /** The model errored; did not produce output. */
  modelError: CheckSentence;
  /** Other failure: the Runtime's own message. */
  other: (message: string) => CheckSentence;
  /** Could not start: the Runtime's own message; there is no “怎么办” (what to do) (`todo` is empty). */
  notStarted: (message: string) => CheckSentence;
  /** Second sentence of the reminder at the top of the trial panel: the “怎么办” (what to do) from the last check, followed by “现在试听多半也会失败” (listening now will most likely fail too). */
  noticeTodo: (todo: string) => string;
}

const outputWrong: Record<CheckSubject, string> = {
  transcribe: "The model runs, but it can't recognize the speech in the sample",
  synthesize: "The model runs, but the voice it produces isn't right",
  image: "The model runs, but the image it draws isn't right",
  separate: "The model runs, but it didn't separate the voice from the background",
  music: 'The model runs, but what it generates is nearly silent',
};

const checkSentences = {
  APP_FILE_MISSING: () => ({
    text: "A file that comes with CucCut is missing; it's not a problem with the model",
    todo: "Reinstalling CucCut fixes this. Models you've already downloaded aren't affected.",
  }),
  MODEL_FILES_DAMAGED: () => ({ text: 'The model files are damaged', todo: 'Repair downloads the damaged files again.' }),
  MODEL_OUTPUT_WRONG: (subject: CheckSubject) => ({
    text: outputWrong[subject],
    todo: 'Repair it first. If it still happens after repairing, copy the technical details and send them to us.',
  }),
  MODEL_OUT_OF_MEMORY: () => ({
    text: "Not enough memory, so the model couldn't load",
    todo: 'Close other large models or memory-heavy apps, then check again.',
  }),
  MODEL_WORKER_FAILED: () => ({
    text: 'The background process that runs the model ran into an error',
    todo: 'Check again. If it keeps happening, restart CucCut, or copy the technical details and send them to us.',
  }),
} satisfies Record<ModelCheckCode, (subject: CheckSubject) => CheckSentence>;

const en = {
  /** Buttons and headings. */
  label: {
    check: 'Check',
    checkFull: 'Check model',
    recheck: 'Check again',
    repair: 'Repair…',
    repairSub: 'Only downloads the damaged files again',
    details: 'Technical details',
    hideDetails: 'Hide technical details',
    copy: 'Copy technical details',
    copied: 'Technical details copied',
    copyFailed: "Couldn't copy. Select the text above and copy it yourself.",
    cancel: 'Cancel',
    retry: 'Try again',
    pickRef: 'Choose another recording…',
    useSample: 'Use sample recording',
  },
  /** The sentence above the installed list: what check and repair each do; the second sentence is the rule for deletion. */
  caption:
    'Check confirms a model works; Repair only downloads the damaged files again. When you delete a model, shared components that other models still use are kept.',
  head: {
    running: 'Checking…',
    repairing: 'Repairing…',
    failed: 'Check failed:',
    notStarted: "Check couldn't start:",
  },
  /** The full stop used when “哪里不对” (what is wrong) is followed by “怎么办” (what to do). */
  sentence: (text: string) => `${text}.`,
  phase: {
    queued: 'Queued',
    loading: 'Loading the model',
    running: 'Running a short sample',
    verifying: 'Verifying the result',
    repairing: 'Downloading the damaged files again; it checks again automatically once fixed',
  },
  /** Check failed: one sentence for each recognized code. */
  checkSentences: checkSentences as Record<ModelCheckCode, (subject: CheckSubject) => CheckSentence>,
  /** Unrecognized codes (old records, codes added in a newer Runtime): one generic sentence; the Runtime's own message goes into the technical details. */
  unknown: {
    text: "The model didn't work properly",
    todo: 'Check again. If it keeps happening, copy the technical details and send them to us.',
  } as CheckSentence,
  /** Check could not start (submission rejected): `details.code` → one sentence. */
  notStarted: {
    RUNTIME_UNREACHABLE: {
      text: "CucCut's background service isn't responding",
      todo: 'Check again later. If it keeps happening, restart CucCut.',
    },
    MODEL_IN_USE: {
      text: 'Another task is using this model',
      todo: 'Wait for that task to finish, or cancel it in Background tasks, then check again.',
    },
    MODEL_UNAVAILABLE: { text: "This model can't be used right now", todo: 'Repair it first, or turn it back on, then check again.' },
    RESOURCE_ADMISSION_UNSATISFIABLE: {
      text: "This computer doesn't have enough memory to run this model",
      todo: 'Switch to a smaller model.',
    },
    WEB_METHOD_NOT_ALLOWED: { text: "Local models can't be checked in the browser", todo: 'Check it in the desktop app.' },
    OFFLINE_STRICT: { text: 'Strict offline mode is on', todo: 'Turn off strict offline mode in Settings, then check again.' },
  } as Record<string, CheckSentence>,
  notStartedUnknown: {
    text: "CucCut didn't accept this check",
    todo: 'Check again later. If it keeps happening, copy the technical details and send them to us.',
  } as CheckSentence,
  /** Lines of the technical details. */
  detail: {
    code: (code: string) => `Code ${code}`,
    model: (id: string, when: string) => `Model ${id} · ${when}`,
    message: (message: string) => `Message ${message}`,
    passed: (when: string) => `Check passed · ${when}`,
  },
  /** Reminder at the top of the trial panel: the last check did not pass. */
  noticeText: (what: string) => `This model failed its last check: ${what}`,
  /** The user's reference recording could not be read. */
  refUnreadable: (file: string) => ({
    text: `Couldn't read your recording "${file}". The file may be damaged, or it isn't audio`,
    todo: 'Try another recording, or hear how it sounds with the sample recording first.',
  }),
  refUnknown: 'recording',
  /** Speech synthesis listen test. */
  trySpeech: {
    noMemory: {
      text: 'Not enough memory to finish synthesizing',
      todo: 'Close other large models or memory-heavy apps, then try again.',
    },
    modelError: { text: 'The model ran into an error and produced no audio', todo: 'Check the model to see what went wrong.' },
    other: (message: string) => ({
      text: `Couldn't synthesize: ${message}`,
      todo: 'You can try again. If it keeps happening, look at the details in Background tasks.',
    }),
    notStarted: (message: string) => ({ text: `Couldn't start synthesizing: ${message}`, todo: '' }),
    noticeTodo: (todo: string) => `${todo} A preview now will most likely fail too.`,
  } as TrySubject,
  /** Image generation trial drawing. */
  tryImage: {
    noMemory: {
      text: 'Not enough memory to finish drawing',
      todo: 'Close other large models and try again, or lower the steps.',
    },
    modelError: { text: 'The model ran into an error and drew nothing', todo: 'Check the model to see what went wrong.' },
    other: (message: string) => ({
      text: `Couldn't draw: ${message}`,
      todo: 'You can try again. If it keeps happening, look at the details in Background tasks.',
    }),
    notStarted: (message: string) => ({ text: `Couldn't start drawing: ${message}`, todo: '' }),
    noticeTodo: (todo: string) => `${todo} A test drawing now will most likely fail too.`,
  } as TrySubject,
  /** Music generation listen test. */
  tryMusic: {
    noMemory: {
      text: 'Not enough memory to finish generating',
      todo: 'Close other large models and try again, or make it shorter.',
    },
    modelError: { text: 'The model ran into an error and produced no music', todo: 'Check the model to see what went wrong.' },
    other: (message: string) => ({
      text: `Couldn't generate: ${message}`,
      todo: 'You can try again. If it keeps happening, look at the details in Background tasks.',
    }),
    notStarted: (message: string) => ({ text: `Couldn't start generating: ${message}`, todo: '' }),
    noticeTodo: (todo: string) => `${todo} A preview now will most likely fail too.`,
  } as TrySubject,
};

export type ModelCheckMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Buttons and headings. */
export const CHECK_LABEL: ModelCheckMessages['label'] = live(() => M.label);

/** The sentence above the installed list: what check and repair each do; the second sentence is the rule for deletion. */
export const checkCaption = (): string => M.caption;

export const CHECK_HEAD: ModelCheckMessages['head'] = live(() => M.head);

/** The full stop used when “哪里不对” (what is wrong) is followed by “怎么办” (what to do). */
export const sentence = (text: string): string => M.sentence(text);

export const CHECK_PHASE: ModelCheckMessages['phase'] = live(() => M.phase);

/** Check failed: one sentence for each recognized code. */
export const CHECK_SENTENCES: Record<ModelCheckCode, (subject: CheckSubject) => CheckSentence> = live(() => M.checkSentences);

/** Unrecognized codes (old records, codes added in a newer Runtime): one generic sentence; the Runtime's own message goes into the technical details. */
export const CHECK_UNKNOWN: CheckSentence = live(() => M.unknown);

/** Check could not start (submission rejected): `details.code` → one sentence. */
export const CHECK_NOT_STARTED: Record<string, CheckSentence> = live(() => M.notStarted);

export const CHECK_NOT_STARTED_UNKNOWN: CheckSentence = live(() => M.notStartedUnknown);

/** Lines of the technical details. */
export const CHECK_DETAIL: ModelCheckMessages['detail'] = live(() => M.detail);

/** Reminder at the top of the trial panel: the last check did not pass. The second sentence depends on the kind of trial (`TrySubject.noticeTodo`). */
export const TRY_NOTICE = {
  text: (what: string) => M.noticeText(what),
};

/** Failure shared by trials (listen and try drawing); the wording that varies by kind is in `TrySubject`. */
export const TRY_FAILURE = {
  refUnreadable: (file: string): CheckSentence => M.refUnreadable(file),
  get refUnknown(): string {
    return M.refUnknown;
  },
  get appFileMissing(): CheckSentence {
    return M.checkSentences.APP_FILE_MISSING('synthesize');
  },
};

export const TRY_SUBJECT: TrySubject = live(() => M.trySpeech);
export const TRY_SUBJECT_IMAGE: TrySubject = live(() => M.tryImage);
export const TRY_SUBJECT_MUSIC: TrySubject = live(() => M.tryMusic);
