import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './models-probe-copy.zh-Hans.ts';
import { zhHant } from './models-probe-copy.zh-Hant.ts';
import { ja } from './models-probe-copy.ja.ts';
import { ko } from './models-probe-copy.ko.ts';
import { es } from './models-probe-copy.es.ts';
import { fr } from './models-probe-copy.fr.ts';
import { de } from './models-probe-copy.de.ts';
import { nl } from './models-probe-copy.nl.ts';
import { ptBR } from './models-probe-copy.pt-BR.ts';
import { it } from './models-probe-copy.it.ts';
import { ru } from './models-probe-copy.ru.ts';
import { pl } from './models-probe-copy.pl.ts';
import { tr } from './models-probe-copy.tr.ts';
import { vi } from './models-probe-copy.vi.ts';

/** Copy for the cloud model test dialog (the English is the source of keys and types; translations are in `models-probe-copy.<lang>.ts`). Numbers are already formatted. */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const en = {
  /** The sentence spoken by the test synthesis (shown in the dialog, and also sent to the model to speak). */
  speechText: 'Hello, this is a CucCut speech synthesis test.',
  noResult: 'The task finished, but no result came back.',
  failed: 'The task failed.',
  cancelled: 'The task was cancelled.',
  interrupted: "The Runtime restarted, so this test didn't finish.",
  unknownOutcome: "The Runtime restarted before this call got a response, so the result is unknown.",
  /** One fact line for a result: seconds are kept to one decimal place. */
  audioFacts: (seconds: string, khz: number, type: string) => `${seconds} s · ${khz} kHz · ${type}`,
  videoFacts: (width: number, height: number, seconds: string, type: string) => `${width} × ${height} · ${seconds} s · ${type}`,
  textFacts: (entries: number, seconds: string, type: string) => `${plural(entries, 'entry', 'entries')} · ${seconds} s · ${type}`,
  packageFacts: (files: number, type: string) => `${plural(files, 'file', 'files')} · ${type}`,
  projectFacts: (clips: number, seconds: string, type: string) => `${plural(clips, 'clip', 'clips')} · ${seconds} s · ${type}`,
  /** Text result: character count and token count (already grouped by current language). */
  chars: (count: string) => `${count} characters`,
  inputTokens: (count: string) => `${count} input tokens`,
  outputTokens: (count: string) => `${count} output tokens`,
  hitLimit: 'Reached the output limit',
  filtered: "Blocked by the provider's content filter",
  /** Verdict on a model row. */
  untested: 'Not tested',
  testing: 'Testing…',
  passed: 'Test passed',
  passedIn: (seconds: number) => `Test passed · ${seconds} s`,
};

export type ModelsProbeMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
