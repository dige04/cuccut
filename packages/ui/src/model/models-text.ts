import {
  defineMessages,
  live,
  DEFAULT_TEXT_CONCURRENCY,
  MAX_TEXT_CONCURRENCY,
  type ModelCapabilitiesView,
  type SetCapabilityParametersRequest,
  type TextCapabilityParameters,
  type TextEffort,
  type TextModelInfo,
} from '@cuccut/protocol';
import { zhHans } from './models-text.zh-Hans.ts';
import { zhHant } from './models-text.zh-Hant.ts';
import { ja } from './models-text.ja.ts';
import { ko } from './models-text.ko.ts';
import { es } from './models-text.es.ts';
import { fr } from './models-text.fr.ts';
import { de } from './models-text.de.ts';
import { nl } from './models-text.nl.ts';
import { ptBR } from './models-text.pt-BR.ts';
import { it } from './models-text.it.ts';
import { ru } from './models-text.ru.ts';
import { pl } from './models-text.pl.ts';
import { tr } from './models-text.tr.ts';
import { vi } from './models-text.vi.ts';

/**
 * Two parameter rows for cloud models under Model › Text generation (design draft settings-cloud.jsx:258-269 “Reasoning effort” and “Concurrent requests”):
 * stored in the Runtime's capability parameters (`models.setCapabilityParameters`, architecture design §6.8); new values are sent back via the `models` theme.
 */

/** Copy for this page (the English is the source of keys and types; translations are in `models-text.<lang>.ts`). */
const en = {
  /** Levels of reasoning effort (the design draft has “Low / Medium / High”; the Runtime also has a `minimal` level). */
  effort: { minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High' } as Record<TextEffort, string>,
  /** No default set; defers to the model's own default. */
  auto: 'Auto',
  context: (tokens: string) => `Context ${tokens}`,
  maxOutput: (tokens: string) => `Max output ${tokens}`,
  efforts: (labels: readonly string[]) => `Reasoning effort ${labels.join(' / ')}`,
  noEffort: "Reasoning effort can't be adjusted",
};

export type ModelsTextMessages = typeof en;

const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Display names of the reasoning effort levels. */
export const EFFORT_LABEL: Record<TextEffort, string> = live(() => M.effort);

/** Shorten token counts: multiples of a thousand use K (128000 → 128K); otherwise use 1024 (32768 → 32K, 1048576 → 1M). */
export function tokensShort(n: number): string {
  if (n >= 1_000_000) {
    const unit = n % 1_000_000 === 0 ? 1_000_000 : 1_048_576;
    return `${Math.round((n / unit) * 10) / 10}M`;
  }
  if (n >= 1000) {
    const unit = n % 1000 === 0 ? 1000 : 1024;
    return `${Math.round(n / unit)}K`;
  }
  return String(n);
}

/** One line for a text model: context, single output, reasoning effort (taken from the capability description; shared by the model row on the model page and the model menu on the tools page). */
export function textModelLine(info: Pick<TextModelInfo, 'notes' | 'contextTokens' | 'maxOutputTokens' | 'efforts'>): string {
  return [
    info.notes ?? null,
    M.context(tokensShort(info.contextTokens)),
    M.maxOutput(tokensShort(info.maxOutputTokens)),
    info.efforts.length ? M.efforts(info.efforts.map((e) => M.effort[e])) : M.noEffort,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The segment key: “Auto” = no default (null), defers to the model's own default. */
export type EffortKey = 'auto' | TextEffort;

/** The segment items: Auto, Minimum, Low, Medium, High. */
export const EFFORT_CHOICES: readonly { key: EffortKey; label: string }[] = [
  {
    key: 'auto',
    get label() {
      return M.auto;
    },
  },
  ...(['minimal', 'low', 'medium', 'high'] as const).map((key) => ({
    key,
    get label() {
      return M.effort[key];
    },
  })),
];

export function effortKey(effort: TextEffort | null): EffortKey {
  return effort ?? 'auto';
}

export function effortOfKey(key: string): TextEffort | null {
  return key === 'minimal' || key === 'low' || key === 'medium' || key === 'high' ? key : null;
}

/** Range of the concurrency limit (protocol schemas.ts: 1–32). */
export const CONCURRENCY_MIN = 1;
export const CONCURRENCY_MAX = MAX_TEXT_CONCURRENCY;

/** Parameters in the view; factory values are used when the Runtime does not supply them. */
export function textParameters(view: ModelCapabilitiesView): TextCapabilityParameters {
  return view.generateText.parameters ?? { effort: null, concurrency: DEFAULT_TEXT_CONCURRENCY };
}

/** Number in the input box → a valid concurrency limit; null (not submitted) if it is not a number. */
export function clampConcurrency(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(CONCURRENCY_MAX, Math.max(CONCURRENCY_MIN, Math.round(value)));
}

/** Changing reasoning effort: “Auto” passes null (back to the model's own default). */
export function effortRequest(key: string): SetCapabilityParametersRequest {
  return { capability: 'generateText', effort: effortOfKey(key) };
}

/** Changing the concurrency limit; not submitted (null) if it is not a number. */
export function concurrencyRequest(value: number): SetCapabilityParametersRequest | null {
  const n = clampConcurrency(value);
  return n === null ? null : { capability: 'generateText', concurrency: n };
}

/** How many connected text models can adjust reasoning effort (used for the note on the reasoning effort row). */
export function effortModelCount(view: ModelCapabilitiesView): { tunable: number; total: number } {
  const models = view.generateText.providers.filter((p) => p.kind === 'online' && p.available).flatMap((p) => p.models);
  return { tunable: models.filter((m) => m.efforts.length > 0).length, total: models.length };
}
