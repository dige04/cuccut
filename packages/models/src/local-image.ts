import { randomInt } from 'node:crypto';

import type { GenerationParameters, ImageModelInfo, ModelBundleStatus } from '@cuccut/protocol';
import { ModelsLocalImage as M } from '@cuccut/protocol/messages/models/local-image.ts';
import type { BundleDefinition } from './bundle-registry.ts';
import type { ImageRunOptions } from './worker-contract.ts';

/**
 * Local text-to-image (architecture design §6.1, §6.3): the model pack description, the seed frozen at submission, and the conversion from frozen parameters to the Worker's `job.run` (`image`).
 */

type ImageParameters = Extract<GenerationParameters, { capability: 'generateImage' }>;

/** The model description for `generateImage`: one image at a time, PNG output only, no reference images, accepts seed and steps. Sizes are the few the model pack registers. */
export function localImageModelInfo(def: BundleDefinition, status: ModelBundleStatus, usable: boolean): ImageModelInfo {
  const profile = def.image!;
  return {
    modelId: def.bundleId,
    label: def.label,
    sizes: [...profile.aspects.map((a) => a.size), ...profile.extraSizes],
    aspectRatios: profile.aspects.map((a) => ({ ratio: a.ratio, size: a.size })),
    defaultSize: profile.aspects[0]?.size ?? null,
    maxCount: 1,
    maxPromptChars: profile.maxPromptChars,
    formats: ['png'],
    defaultFormat: 'png',
    referenceImages: null,
    acceptsSeed: true,
    cost: 'free-local',
    available: usable,
    local: { steps: { ...profile.steps } },
    ...(profile.slow ? { notes: slowNote(def, status) } : {}),
    ...(!usable && status.detail ? { detail: status.detail, ...(status.detailRef ? { detailRef: status.detailRef } : {}) } : {}),
  };
}

/**
 * Slowness notice. candle on CPU (when there is no CUDA) is one to two orders of magnitude slower than on GPU: every step must re-dequantize the entire DiT, so 1024² at 20 steps takes several hours (measured in architecture design §6.5). State this plainly.
 */
// `notes` has no reference field: the text is stored in the language in use at generation time.
function slowNote(def: BundleDefinition, status: ModelBundleStatus): string {
  const steps = def.image!.steps.default;
  if (def.backend === 'candle' && (status.device ?? def.device) === 'cpu') {
    return M.slowCpu({ steps }).text;
  }
  return M.slowLocal({ steps }).text;
}

/**
 * The local image seed is frozen at submission: if the request doesn't give one, one is drawn here (`0..2^32-1`, same range as the request's `seed`). Retries and re-runs use the same one, so on the same machine they produce the same image.
 */
export function localImageSeed(seed: number | null): number {
  return seed ?? randomInt(0, 2 ** 32);
}

/**
 * Frozen parameters → the Worker's `job.run` (`image`) options. Size and seed have already been decided at submission; a missing one is a caller error. Steps take the frozen `steps`; if absent, take the caller's value (the model-pack self-test uses few steps for a small image and skips the range check at submission); if neither, null (use the model's default step count).
 */
export function imageRunOf(parameters: ImageParameters, steps: number | null = null): ImageRunOptions {
  const match = /^(\d+)x(\d+)$/.exec(parameters.size ?? '');
  if (!match) throw new Error(`Local image size was not frozen: ${String(parameters.size)}`);
  if (parameters.seed === null) throw new Error('Local image seed was not frozen');
  return {
    prompt: parameters.prompt,
    width: Number(match[1]),
    height: Number(match[2]),
    steps: parameters.steps ?? steps,
    seed: parameters.seed,
  };
}
