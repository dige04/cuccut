import {
  live,
  RpcError,
  type FrozenSpeechReference,
  type Localized,
  type LocalSpeechTraits,
  type ModelBundleStatus,
  type SpeechModelInfo,
  type SpeechVoice,
  type SpeechVoiceDescription,
  type SynthesizeSpeechRequest,
} from '@cuccut/protocol';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ModelsLocalSpeech as M } from '@cuccut/protocol/messages/models/local-speech.ts';
import { parseLibraryVoice } from '@cuccut/runtime-storage/library';
import type { BundleDefinition } from './bundle-registry.ts';
import { appFileMissing } from './model-assets.ts';
import { sha256File } from './model-catalog.ts';
import type { ModelChoice } from './model-selection.ts';
import { BUILTIN_VOICES, builtinVoice, builtinVoiceFile, defaultBuiltinVoice, type BuiltinVoice } from './speech-voices.ts';
import type { JobInput, SynthesizeOptions, SynthesizeVoice } from './worker-contract.ts';

/**
 * Local speech synthesis (architecture design §6.1, §6.3): describes a `synthesize` model pack as the `synthesizeSpeech` model of the `local` provider. The voice mode is decided at submission (it is not swapped for another voice), and is converted at execution time into the Worker's `job.run` arguments (Model Worker protocol spec §2.5.2).
 */

/**
 * Per-request text limit for local models (counted in code points). The engine splits text into sentences internally. This limit only blocks text that is too long for one task, and it is rejected at submission rather than truncated: the caller splits long text into segments.
 */
export const LOCAL_SPEECH_MAX_CHARS = 2000;

/** The `synthesizeSpeech` model description for a `synthesize` model pack. */
export function localSpeechModelInfo(def: BundleDefinition, status: ModelBundleStatus, usable: boolean): SpeechModelInfo {
  const profile = def.speech!;
  const builtin = profile.presets === 'builtin-reference' || profile.presets === 'builtin-description';
  const voices: SpeechVoice[] =
    profile.presets === 'model'
      ? (profile.speakers ?? []).map((id) => ({ voiceId: id, label: id, source: 'model' as const }))
      : builtin
        ? BUILTIN_VOICES.map((v) => ({ voiceId: v.id, label: v.id, source: 'builtin' as const, language: v.language }))
        : [];
  const local: LocalSpeechTraits = {
    family: profile.family,
    sampleRate: profile.sampleRate,
    slow: profile.slow,
    builtinVoices: profile.presets === 'builtin-reference' ? 'reference' : profile.presets === 'builtin-description' ? 'description' : null,
    reference: profile.reference,
    voiceDescription: profile.voiceDescription,
    instructions: profile.instructions,
    emotion: profile.emotion,
    knobs: profile.knobs,
    maxDurationSec: profile.maxDurationSec,
    readings: profile.readings,
    license: def.license!,
  };
  return {
    modelId: def.bundleId,
    label: def.label,
    voices,
    defaultVoice: voices[0]?.voiceId ?? null,
    voiceModes: [...profile.voiceModes],
    languages: profile.languages === 'any' ? 'any' : [...profile.languages],
    maxInputChars: LOCAL_SPEECH_MAX_CHARS,
    formats: ['wav'],
    defaultFormat: 'wav',
    acceptsInstructions: profile.instructions !== null,
    speedRange: profile.knobs.speed ? { min: profile.knobs.speed.min, max: profile.knobs.speed.max } : null,
    acceptsSeed: profile.acceptsSeed,
    cost: 'free-local',
    available: usable,
    local,
    ...(onCpu(def, status) ? { notes: cpuNote(def) } : {}),
    ...(!usable && status.detail ? { detail: status.detail, ...(status.detailRef ? { detailRef: status.detailRef } : {}) } : {}),
  };
}

/** candle model packs run on CPU (the Worker did not report CUDA). */
function onCpu(def: BundleDefinition, status: ModelBundleStatus): boolean {
  return def.backend === 'candle' && (status.device ?? def.device) === 'cpu';
}

/**
 * How slow candle synthesis is on CPU, per model (the part before `@` in `bundleId`). The numbers are measured on this machine (Apple M-series, 16 GiB, `--release`) (architecture design §6.5): Qwen3-TTS 0.6B took 162 s for 2.9 s of audio and 268 s for 5.0 s; IndexTTS 2.5 took 420–625 s for 3.4–4.9 s per sentence; OmniVoice took 646 s for 22 s; GPT-SoVITS took 56 s for 9 s (including loading). Where there is no measurement, state plainly "this has not been measured" and do not make up numbers.
 */
const CPU_PACE: Record<string, () => Localized> = {
  'qwen3-tts-0.6b-base': M.paceQwen06,
  'qwen3-tts-0.6b-customvoice': M.paceQwen06,
  'qwen3-tts-1.7b-base': M.paceQwen17,
  'qwen3-tts-1.7b-customvoice': M.paceQwen17,
  'qwen3-tts-1.7b-voicedesign': M.paceQwen17,
  indextts2: M.paceIndexTts2,
  'index-tts2.5': M.paceIndexTts25,
  'gpt-sovits-v2': M.paceGptSovits,
  voxcpm2: M.paceVoxcpm2,
  omnivoice: M.paceOmnivoice,
};

/**
 * Slowness notice (same `notes` as text-to-image): candle synthesis on CPU uses only one or two cores (same as the older version), running several to over a hundred times slower than real time. State this plainly. CUDA has not been measured. When the Worker reports CUDA, this sentence is not written, same as for the same model on MLX.
 */
// `notes` has no reference field: the text is stored in the language in use at generation time.
function cpuNote(def: BundleDefinition): string {
  const pace = (CPU_PACE[def.bundleId.split('@')[0]!] ?? M.paceDefault)();
  return M.cpuNote({ pace }).text;
}

/**
 * The voice decided at submission (the reference audio has not been read yet):
 * - `preset`: the model's speaker or built-in voice (`builtin` is not null);
 * - `clone`: the reference recording comes from a file in the request, or from a voice library entry (`library:<id>`; the task manager reads its fixed-version recording and transcript);
 * - `describe`: a one-sentence description.
 */
export type LocalVoicePlan =
  | { mode: 'preset'; voice: string; builtin: BuiltinVoice | null }
  | { mode: 'clone'; source: 'file'; path: string; transcript: string | null }
  | { mode: 'clone'; source: 'library'; libraryId: string }
  | { mode: 'describe'; description: string };

/** Decide the voice mode from the model's description. When the model does not support the requested mode, reject rather than substitute a different voice. */
export function planLocalVoice(choice: ModelChoice<'synthesizeSpeech'>, request: SynthesizeSpeechRequest): LocalVoicePlan {
  const model = choice.model;
  const local = model.local!;
  const where = { providerId: choice.providerId, modelId: choice.modelId };
  const given = [request.voice, request.reference, request.voiceDescription].filter((v) => v !== undefined).length;
  if (given > 1) throw new RpcError('invalid-request', M.oneVoiceSource(), where);
  const requireMode = (mode: 'preset' | 'clone' | 'describe', what: Localized) => {
    if (model.voiceModes.includes(mode)) return;
    throw new RpcError('invalid-request', M.modeUnsupported({ modelId: choice.modelId, what, mode }), {
      ...where,
      voiceMode: mode,
      voiceModes: model.voiceModes,
    });
  };

  const libraryId = parseLibraryVoice(request.voice);
  if (libraryId !== null) {
    requireMode('clone', M.modeClone());
    return { mode: 'clone', source: 'library', libraryId };
  }
  if (request.reference) {
    requireMode('clone', M.modeClone());
    const transcript = request.reference.transcript?.trim() ? request.reference.transcript.trim() : null;
    if (transcript && local.reference && !local.reference.acceptsTranscript) {
      throw new RpcError('invalid-request', M.noReferenceTranscript({ modelId: choice.modelId }), where);
    }
    return { mode: 'clone', source: 'file', path: request.reference.file, transcript };
  }
  if (request.voiceDescription !== undefined) {
    requireMode('describe', M.modeDescribe());
    const description = request.voiceDescription.trim();
    if (!description) throw new RpcError('invalid-request', M.descriptionEmpty(), where);
    checkDescription(description, local.voiceDescription, choice.modelId, where);
    return { mode: 'describe', description };
  }

  if (!model.voiceModes.includes('preset')) {
    const need = model.voiceModes.includes('describe') ? 'voiceDescription' : 'reference';
    throw new RpcError('invalid-request', M.noPresetVoice({ modelId: choice.modelId, need }), {
      ...where,
      voiceModes: model.voiceModes,
    });
  }
  if (request.voice !== undefined) {
    const listed = model.voices.find((v) => v.voiceId === request.voice);
    if (!listed) {
      throw new RpcError('invalid-request', M.noSuchVoice({ modelId: choice.modelId, voice: request.voice }), {
        ...where,
        voices: model.voices.map((v) => v.voiceId),
      });
    }
    return { mode: 'preset', voice: listed.voiceId, builtin: listed.source === 'builtin' ? builtinVoice(listed.voiceId) : null };
  }
  // No voice specified: a built-in voice is chosen for the requested language (if there is none in that language, the first one); the model's speaker uses `defaultVoice`.
  if (local.builtinVoices) {
    const voice = defaultBuiltinVoice(request.language ?? null);
    return { mode: 'preset', voice: voice.id, builtin: voice };
  }
  if (!model.defaultVoice) throw new RpcError('invalid-request', M.noDefaultVoice({ modelId: choice.modelId }), where);
  return { mode: 'preset', voice: model.defaultVoice, builtin: null };
}

/** Closed vocabulary: comma-separated (half-width or full-width), each item must be in the vocabulary (English is case-insensitive), at most one per category. */
function checkDescription(description: string, spec: SpeechVoiceDescription | null, modelId: string, where: Record<string, string>): void {
  if (!spec || spec.kind === 'free') return;
  const seen = new Set<string>();
  // i18n-ignore: full-width comma used in the parse description
  for (const raw of description.split(/[,，]/)) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    const category = spec.categories.find((c) => Object.values(c.terms).some((list) => list.some((t) => t.toLowerCase() === term)));
    if (!category) {
      throw new RpcError('invalid-request', M.termNotInVocabulary({ modelId, term: raw.trim() }), {
        ...where,
        term: raw.trim(),
        vocabulary: spec.categories,
      });
    }
    if (seen.has(category.category)) {
      throw new RpcError('invalid-request', M.onePerCategory({ modelId, category: category.category }), {
        ...where,
        category: category.category,
      });
    }
    seen.add(category.category);
  }
  if (seen.size === 0) throw new RpcError('invalid-request', M.descriptionEmpty(), where);
}

/** Reference recording to freeze: a file given in the request (`path`), or a recording shipped with the app for a built-in voice (`asset`; `path` is resolved at use time, null when the model data directory cannot be found). */
export type ReferenceToFreeze =
  | { source: 'file'; path: string; transcript: string | null }
  | { source: 'builtin'; voiceId: string; asset: string; path: string | null; transcript: string | null };

/**
 * Whether a built-in voice needs to read a reference recording: a cloning model's built-in voice is a recording shipped with the app (`builtin`); otherwise no file is used.
 * Returns the file to freeze (the task manager reads its summary). Does not read the file and does not throw.
 */
export function builtinReferenceFile(
  model: SpeechModelInfo,
  plan: LocalVoicePlan,
): Extract<ReferenceToFreeze, { source: 'builtin' }> | null {
  if (plan.mode !== 'preset' || !plan.builtin || model.local?.builtinVoices !== 'reference') return null;
  const voice = plan.builtin;
  return { source: 'builtin', voiceId: voice.id, asset: voice.asset, path: builtinVoiceFile(voice), transcript: voice.transcript };
}

/** What a built-in voice's recording is called in errors (for people to read): regenerated in the current language on each read, and carried with its reference when embedded in a sentence. */
export const BUILTIN_REFERENCE_LABEL: Localized = live(() => M.builtinReferenceLabel());

/** The reference recording given in the request cannot be read (`INPUT_UNREADABLE`): the sentence names only the file name, and the full path is in `details.file`. */
export function referenceUnreadableMessage(file: string): Localized {
  return M.referenceUnreadable({ name: path.basename(file) });
}

/**
 * Reference recording: at submission, its digest and length are read. If it cannot be read (does not exist, is not a file), a request-supplied file is `invalid-request` (`INPUT_UNREADABLE`), and a built-in voice's recording is `conflict` (`APP_FILE_MISSING`, incomplete installation).
 */
export async function freezeReferenceFile(reference: ReferenceToFreeze): Promise<FrozenSpeechReference> {
  const { source, path: file, transcript } = reference;
  const unreadable = () =>
    reference.source === 'builtin'
      ? appFileMissing(BUILTIN_REFERENCE_LABEL, reference.asset, reference.path)
      : new RpcError('invalid-request', referenceUnreadableMessage(reference.path), {
          code: 'INPUT_UNREADABLE',
          reference: 'file',
          file: reference.path,
        });
  if (file === null) throw unreadable();
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) throw unreadable();
  const hex = await sha256File(file).catch(() => null);
  if (hex === null) throw unreadable();
  return { source, path: file, sha256: `sha256:${hex}`, byteLength: stat.size, transcript };
}

/** `voice` in frozen parameters: for presets it is the voice ID. Cloning and description have no voice ID, so record the source (library entries as-is). */
export function frozenVoiceOf(plan: LocalVoicePlan): string {
  switch (plan.mode) {
    case 'preset':
      return plan.voice;
    case 'clone':
      return plan.source === 'library' ? `library:${plan.libraryId}` : 'reference';
    case 'describe':
      return 'description';
  }
}

/**
 * Frozen parameters → Worker's `job.run` (`synthesize`). With a reference recording it is `clone` (built-in voices too); with a description it is `describe`; otherwise it is the model's speaker. The reference recording's digest was read at submission; before execution, the caller checks the file again.
 */
export function synthesizeRunOf(parameters: {
  text: string;
  voice: string;
  language: string | null;
  instructions: string | null;
  speed: number | null;
  seed: number | null;
  reference?: FrozenSpeechReference;
  voiceDescription?: string;
  cfg?: number;
  steps?: number;
}): { input: JobInput | null; options: SynthesizeOptions } {
  let voice: SynthesizeVoice;
  let input: JobInput | null = null;
  if (parameters.reference) {
    voice = { mode: 'clone', transcript: parameters.reference.transcript };
    input = { file: parameters.reference.path, contentHash: parameters.reference.sha256, track: 0 };
  } else if (parameters.voiceDescription !== undefined) {
    voice = { mode: 'describe', description: parameters.voiceDescription };
  } else {
    voice = { mode: 'preset', id: parameters.voice };
  }
  return {
    input,
    options: {
      text: parameters.text,
      language: parameters.language,
      voice,
      instructions: parameters.instructions,
      speed: parameters.speed,
      cfg: parameters.cfg ?? null,
      steps: parameters.steps ?? null,
      seed: parameters.seed,
    },
  };
}
