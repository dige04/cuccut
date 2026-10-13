import type { ModelBundleStatus, ModelCapabilitiesView, ModelLicense, SpeechModelInfo } from '@cuccut/protocol';
import { LOCAL_PROVIDER, bundleChips, type ModelChip } from './models-local.ts';
import { M } from './models-tts-local-copy.ts';

/**
 * One row of a local speech-synthesis model under Settings › Models › Speech synthesis (design draft settings-local.jsx ModelRow, model-tts.js `modelBrief`):
 * the row says only “what you can do with it”: how it produces sound, whether you must supply your own recording, style, which languages it speaks, and size. Licenses that forbid commercial use are flagged.
 * Facts all come from the `synthesizeSpeech` model description of the `local` Provider (`SpeechModelInfo.local`), not guessed from the model name.
 */

/** Synthesis models listed by the `local` Provider, taken by model pack ID (a local model's `modelId` is its `bundleId`). */
export function localSpeechModels(view: ModelCapabilitiesView | null): Map<string, SpeechModelInfo> {
  const local = view?.synthesizeSpeech.providers.find((p) => p.providerId === LOCAL_PROVIDER);
  return new Map((local?.models ?? []).map((m) => [m.modelId, m]));
}

/** How the preview panel produces sound: the model's own speaker (`preset`), a voice from description (`describe`), or built-in voices and cloning (`clone`). */
export type QuickKind = 'preset' | 'describe' | 'clone';

export function quickKind(model: Pick<SpeechModelInfo, 'voiceModes' | 'local'>): QuickKind {
  if (model.voiceModes.includes('clone')) return 'clone';
  if (model.voiceModes.includes('describe')) return 'describe';
  return 'preset';
}

/** Can clone from a recording (“My voice” can be tried on it). */
export function canClone(model: Pick<SpeechModelInfo, 'voiceModes'>): boolean {
  return model.voiceModes.includes('clone');
}

/** Which languages it speaks: when unrestricted, write “Any language”; with more than five, only the first four and the total. */
export function languagesFact(languages: SpeechModelInfo['languages']): string {
  if (languages === 'any') return M.languagesAny;
  const short = languages.map((c) => M.languageShort(c));
  return short.length > 5 ? M.languagesMore(short.slice(0, 4), short.length) : short.join(' / ');
}

export interface TtsBrief {
  summary: string;
  facts: string[];
}

/**
 * Brief on the row (design draft `modelBrief`). Emotion control is not yet included in requests in this version (`LocalSpeechTraits.emotion` only describes the engine), so the row does not say “emotion adjustable”.
 */
export function ttsBrief(model: SpeechModelInfo): TtsBrief {
  const local = model.local;
  const builtins = model.voices.filter((v) => v.source === 'builtin').length;
  const speakers = model.voices.filter((v) => v.source !== 'builtin').length;
  const style = local?.instructions === 'style';
  const kind = quickKind(model);
  const describe = model.voiceModes.includes('describe');
  let summary: string;
  let mode: string;
  if (kind === 'clone' && describe) {
    summary = M.summaryCloneDescribe(builtins, !!local?.maxDurationSec);
    mode = M.modeCloneDescribe;
  } else if (kind === 'clone') {
    summary = M.summaryClone(builtins, style);
    mode = M.modeClone;
  } else if (kind === 'describe') {
    summary = M.summaryDescribe(builtins);
    mode = M.modeDescribe;
  } else {
    summary = M.summaryPreset(speakers, style);
    mode = M.modePreset;
  }
  const facts = [mode];
  if (style && kind === 'clone') facts.push(M.factStyle);
  facts.push(languagesFact(model.languages));
  if (local) facts.push(`${local.sampleRate / 1000} kHz`);
  if (local?.slow) facts.push(M.factSlow);
  return { summary, facts };
}

/** Total size of the installed components (null if not fully installed or if sizes are not reported; shared components count by their share). */
export function installedBytes(bundle: Pick<ModelBundleStatus, 'components'>): number | null {
  const comps = bundle.components;
  if (!comps?.length || comps.some((c) => c.bytes === null)) return null;
  return comps.reduce((sum, c) => sum + (c.bytes ?? 0), 0);
}

/** License permitting only non-commercial use (the row marks “Non-commercial only”, shown to the user before download); commercially usable ones get null. */
export function nonCommercial(license: ModelLicense | undefined | null): ModelLicense | null {
  return license && !license.commercialUse ? license : null;
}

/** The upstream owner in the license URL (huggingface.co/k2-fsa/OmniVoice → k2-fsa); if not found, write the license name. */
export function licenseOwner(license: Pick<ModelLicense, 'url' | 'name'>): string {
  try {
    const owner = new URL(license.url).pathname.split('/').filter(Boolean)[0];
    return owner || license.name;
  } catch {
    return license.name;
  }
}

/** One-line license summary (design draft `ttsLicenseBrief`): “CC-BY-NC-4.0 · non-commercial use only · commercial use requires a separate application to k2-fsa”. */
export function licenseBrief(license: ModelLicense): string {
  return license.commercialUse ? M.licenseCommercial(license.name) : M.licenseNonCommercial(license.name, licenseOwner(license));
}

/** Label for a synthesis model pack row: default, Worker status, missing components (`ownFiles`, same as `bundleChips`), plus “Non-commercial only”. */
export function ttsChips(bundle: ModelBundleStatus, isDefault: boolean, ownFiles?: boolean): ModelChip[] {
  const chips = bundleChips(bundle, isDefault, ownFiles);
  if (nonCommercial(bundle.license)) chips.push({ label: M.nonCommercialChip, tone: 'notice' });
  return chips;
}

/**
 * Engine family description (design draft model-tts.js ENGINES `desc`, taken by `LocalSpeechTraits.family`).
 * Only what this version can use is written: emotion control and synthesis to a target duration are engine capabilities not yet wired into requests, so they are not mentioned.
 */
export function familyDesc(model: Pick<SpeechModelInfo, 'local'>): string | null {
  return model.local ? (M.familyDesc[model.local.family] ?? null) : null;
}

/**
 * A sentence to state clearly before previewing (design draft `quickSlow`); null if none. The model description's `notes` take priority (candle on CPU is several times to a hundred times slower than real time, so one preview takes minutes, and then VoxCPM2's real-time-factor claim and the large-model claim are both wrong). Next come the voice-from-description note, VoxCPM2's real-time factor, the non-commercial restriction, and finally the large model's slowness.
 */
export function quickNote(model: SpeechModelInfo): string | null {
  if (model.notes) return model.notes;
  if (quickKind(model) === 'describe') return M.quickDescribe;
  if (model.local?.family === 'voxcpm2') return M.quickVoxcpm;
  const license = nonCommercial(model.local?.license);
  if (license) return M.quickNonCommercial(license.name);
  if (model.local?.slow) return M.quickSlow;
  return null;
}
