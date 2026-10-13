/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * packages/server/src/server/agent/providers/claude/models.ts's getClaudeModelsWithSettings / readClaudeSettingsModels
 * (merges the models specified in the env of settings.json into the model table).
 */
import type { DriverEffort, DriverModel, ModelTier } from '@cuccut/protocol';
import type { EffortLevel, ModelInfo } from '@anthropic-ai/claude-agent-sdk';
import { DriversClaude } from '@cuccut/protocol/messages/agent-drivers';

/**
 * Claude's model table: from the SDK's `supportedModels()` (costs nothing, does not require login); when unavailable, a built-in trimmed table is used.
 *
 * The actual shape of `supportedModels()` (2.1.284, not logged in): the first row is `value: 'default'`, and its description states which model it currently points to
 * (`resolvedModel` too); the `value` of the other rows is an alias or a full id (`opus`, `sonnet`, `haiku`, `claude-fable-5-1[1m]`),
 * and `description` looks like `Opus 5.5 · Best for everyday, complex tasks · $4/$20 per Mtok`.
 */

export interface ClaudeModelEntry extends DriverModel {
  /** Full model id that an alias resolves to; also compared when checking whether a model written in `settings.json` is recognized. */
  resolvedModel: string | null;
}

const EFFORT_LABEL: Record<EffortLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};

export const CLAUDE_EFFORTS: readonly EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export function isClaudeEffort(value: string): value is EffortLevel {
  return (CLAUDE_EFFORTS as readonly string[]).includes(value);
}

function efforts(levels: readonly EffortLevel[] | undefined): DriverEffort[] {
  return (levels ?? []).map((id) => ({ id, label: EFFORT_LABEL[id] ?? id }));
}

/** Bucket by name. Fable is one tier above Opus and also goes into `max`; unrecognized ones (custom gateway ids, etc.) are null. */
export function claudeTier(id: string): ModelTier | null {
  const lower = id.toLowerCase();
  if (lower.includes('fable') || lower.includes('opus')) return 'max';
  if (lower.includes('sonnet')) return 'balanced';
  if (lower.includes('haiku')) return 'fast';
  return null;
}

/** SDK model table → DriverModel. The `default` row is not listed separately; the model it points to is marked as the default. */
export function mapClaudeModels(infos: ModelInfo[]): ClaudeModelEntry[] {
  const fallback = infos.find((m) => m.value === 'default');
  const defaultTarget = fallback?.resolvedModel ?? null;
  let defaultTaken = false;
  return infos
    .filter((m) => m.value !== 'default')
    .map((m) => {
      const { label, description } = splitDescription(m);
      const isDefault = !defaultTaken && defaultTarget !== null && m.resolvedModel === defaultTarget;
      if (isDefault) defaultTaken = true;
      return {
        id: m.value,
        label,
        description,
        tier: claudeTier(m.resolvedModel ?? m.value),
        isDefault,
        efforts: m.supportsEffort === false ? [] : efforts(m.supportedEffortLevels),
        // The SDK does not give the model's default effort level; null = use Claude Code's own default.
        defaultEffort: null,
        resolvedModel: m.resolvedModel ?? null,
      };
    });
}

/** `Opus 5.5 · Best for … · $4/$20 per Mtok` → label `Opus 5.5`, the rest becomes the description. Without a separator, use displayName. */
function splitDescription(m: ModelInfo): { label: string; description: string | null } {
  const parts = (m.description ?? '').split(' · ').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { label: parts[0]!, description: parts.slice(1).join(' · ') };
  return { label: m.displayName || m.value, description: m.description?.trim() || null };
}

/**
 * Trimmed fallback table used when `supportedModels()` is unavailable: lists aliases only; aliases always point to the current version, so they do not go stale.
 * Effort levels are given as the four common tiers; since it is not known which one is the default, none is marked.
 */
export const FALLBACK_CLAUDE_MODELS: ClaudeModelEntry[] = [
  { id: 'opus', label: 'Opus', description: null, tier: 'max', isDefault: false, efforts: efforts(['low', 'medium', 'high', 'max']), defaultEffort: null, resolvedModel: null },
  { id: 'sonnet', label: 'Sonnet', description: null, tier: 'balanced', isDefault: false, efforts: efforts(['low', 'medium', 'high', 'max']), defaultEffort: null, resolvedModel: null },
  { id: 'haiku', label: 'Haiku', description: null, tier: 'fast', isDefault: false, efforts: [], defaultEffort: null, resolvedModel: null },
];

const ENV_KEY_TIER: Record<string, ModelTier | null> = {
  ANTHROPIC_MODEL: null,
  ANTHROPIC_DEFAULT_FABLE_MODEL: 'max',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'max',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'balanced',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'fast',
};

/**
 * Merges the models named in the user's settings `env` (`ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_*_MODEL`) into the model table: those already in the table (compared by id and by resolved full id, see `claudeModelKnown`) are not listed again, and the rest are appended. The tier is first recognized by name; if the name is not recognized, the tier is taken from the tier it replaces;
 * effort levels are unknown, so none are given (empty table = no effort levels).
 */
export function withSettingsModels(models: ClaudeModelEntry[], envModels: Array<{ key: string; id: string }>): ClaudeModelEntry[] {
  const out = [...models];
  for (const { key, id } of envModels) {
    if (claudeModelKnown(id, out)) continue;
    out.push({
      id,
      label: id,
      description: String(DriversClaude.fromSettings({ key })),
      tier: claudeTier(id) ?? ENV_KEY_TIER[key] ?? null,
      isDefault: false,
      efforts: [],
      defaultEffort: null,
      resolvedModel: null,
    });
  }
  return out;
}

/** Whether the model written in `settings.json` is in the table: compares ids and resolved full ids, ignoring suffixes such as `[1m]` and case. */
export function claudeModelKnown(model: string, models: ClaudeModelEntry[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\[[^\]]*\]$/, '');
  const want = norm(model);
  return models.some((m) => norm(m.id) === want || (m.resolvedModel !== null && norm(m.resolvedModel) === want));
}

/**
 * Whether a model can use the `auto` permission mode. Check `supportsAutoMode`: on 2.1.284, opus / sonnet / fable are marked true, and haiku has no such field.
 * When no row in the table has this field (old CLI), it is not known: return null, and the caller just tries it.
 * `model` null means the default model is used; check the `default` row.
 */
export function claudeAutoModeSupport(infos: ModelInfo[], model: string | null): boolean | null {
  if (!infos.some((m) => m.supportsAutoMode !== undefined)) return null;
  const want = model ?? 'default';
  const entry = infos.find((m) => m.value === want) ?? infos.find((m) => m.resolvedModel === want);
  if (!entry) return null;
  return entry.supportsAutoMode === true;
}
