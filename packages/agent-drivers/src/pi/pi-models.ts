/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * resolvePiThinkingConfig in packages/server/src/server/agent/providers/pi/agent.ts (filter reasoning levels by thinkingLevelMap; default medium, going up first and then down to the nearest), parseModelReference (`provider/id` or `provider:id`), and piModelSupportsImageInput.
 * Changed to CucCut's DriverModel: model ids are uniformly written as `provider/id`, and level names use pi's level ids directly.
 */
import type { DriverModel } from '@cuccut/protocol';

/** Models from `get_available_models` and `get_state`. Only the fields that are used are listed. */
export interface PiModel {
  id: string;
  name?: string;
  provider: string;
  reasoning?: boolean;
  input?: string[];
  /** Mapping from levels to the model's native values. A null for a level means this model does not support it. xhigh and max count as supported only when the mapping includes them. */
  thinkingLevelMap?: Record<string, unknown>;
}

export const PI_THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type PiThinkingLevel = (typeof PI_THINKING_LEVELS)[number];
const DEFAULT_THINKING: PiThinkingLevel = 'medium';

export function isPiThinkingLevel(value: string | null | undefined): value is PiThinkingLevel {
  return !!value && (PI_THINKING_LEVELS as readonly string[]).includes(value);
}

/** Model id in CucCut: `provider/id`. */
export function piModelId(model: Pick<PiModel, 'provider' | 'id'>): string {
  return `${model.provider}/${model.id}`;
}

/** Split `provider/id` (also accepts `provider:id`). With no separator, there is only the id. */
export function parseModelReference(modelId: string): { provider: string | null; id: string } {
  for (const sep of ['/', ':']) {
    const at = modelId.indexOf(sep);
    if (at > 0 && at < modelId.length - 1) return { provider: modelId.slice(0, at), id: modelId.slice(at + 1) };
  }
  return { provider: null, id: modelId };
}

export function piModelTakesImages(model: Pick<PiModel, 'input'> | null | undefined): boolean {
  return model?.input?.includes('image') === true;
}

/**
 * The reasoning levels this model can select, and its default level. Non-reasoning models have no levels. pi's own default is medium. If the model does not support it, take the nearest higher level; if there is none, take the highest remaining one.
 */
export function piThinkingLevels(model: PiModel): { efforts: PiThinkingLevel[]; defaultEffort: PiThinkingLevel | null } {
  if (!model.reasoning) return { efforts: [], defaultEffort: null };
  const efforts = PI_THINKING_LEVELS.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level];
    if (mapped === null) return false;
    if (level === 'xhigh' || level === 'max') return mapped !== undefined;
    return true;
  });
  const base = PI_THINKING_LEVELS.indexOf(DEFAULT_THINKING);
  const defaultEffort = efforts.find((level) => PI_THINKING_LEVELS.indexOf(level) >= base) ?? efforts.at(-1) ?? null;
  return { efforts, defaultEffort };
}

/** `get_available_models` result → CucCut's model table. `current` is the current model from `get_state` (pi's default). */
export function derivePiModels(models: PiModel[], current: Pick<PiModel, 'provider' | 'id'> | null): DriverModel[] {
  const currentId = current && current.provider !== 'unknown' ? piModelId(current) : null;
  return models
    .filter((m) => typeof m?.id === 'string' && typeof m?.provider === 'string')
    .map((m) => {
      const id = piModelId(m);
      const { efforts, defaultEffort } = piThinkingLevels(m);
      return {
        id,
        label: typeof m.name === 'string' && m.name ? m.name : m.id,
        description: id,
        tier: null,
        isDefault: id === currentId,
        efforts: efforts.map((level) => ({ id: level, label: level })),
        defaultEffort,
      };
    });
}
