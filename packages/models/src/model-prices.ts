/**
 * Price table for usage estimates (architecture design §6.10): gives list prices by `providerId/modelId`, used only to estimate when usage is read (`models.usage`). Not written to the ledger, and not used in budget admission (budget reads the model description's `ModelPrice`, §7.8; the two are kept separate for now).
 *
 * Amounts are decimal strings (same as `Money`, at most 6 decimal places); the currency is kept as is, with no conversion. Each unit price has the official pricing page and the date it was checked written in a comment; anything uncertain is left empty: a model without a unit price cannot be estimated and counts as "unknown".
 */

export interface ModelUnitPrice {
  currency: 'USD' | 'CNY';
  /** Per million input tokens (excluding the portion that hits the cache). */
  inputPerMTok?: string;
  /** Per million output tokens. */
  outputPerMTok?: string;
  /** Per million cache-hit input tokens; when not given, this portion is charged at `inputPerMTok`. */
  cachedPerMTok?: string;
  /** Per minute of audio (transcription). */
  audioPerMinute?: string;
  /** Per thousand characters (speech synthesis, counted in Unicode code points). */
  per1kChars?: string;
  /** Per image. */
  perImage?: string;
}

export const MODEL_PRICES: Readonly<Record<string, ModelUnitPrice>> = {
  // Anthropic: https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-09-25).
  'anthropic/claude-opus-5-5': { currency: 'USD', inputPerMTok: '4', outputPerMTok: '20', cachedPerMTok: '0.2' },
  'anthropic/claude-sonnet-5-5': { currency: 'USD', inputPerMTok: '2', outputPerMTok: '10', cachedPerMTok: '0.2' },
  // The unit price for cache reads was not found this time, so it is left empty (cache-hit input is charged at the input unit price, which overestimates).
  'anthropic/claude-haiku-4-5': { currency: 'USD', inputPerMTok: '1', outputPerMTok: '5' },
};

export function modelPrice(providerId: string, modelId: string): ModelUnitPrice | null {
  return MODEL_PRICES[`${providerId}/${modelId}`] ?? null;
}
