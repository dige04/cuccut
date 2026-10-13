import { defineMessages, type LibraryEntrySummary } from '@cuccut/protocol';
import {
  customVoiceAllowed,
  libraryIdOf,
  libraryVoiceBlock,
  libraryVoiceKey,
  voiceKeyFor,
  type MyVoices,
  type SpeechOption,
  type TtsDraft,
  type VoiceKey,
} from './tools-tts.ts';
import { zhHans } from './voice-picker.zh-Hans.ts';
import { zhHant } from './voice-picker.zh-Hant.ts';
import { ja } from './voice-picker.ja.ts';
import { ko } from './voice-picker.ko.ts';
import { es } from './voice-picker.es.ts';
import { fr } from './voice-picker.fr.ts';
import { de } from './voice-picker.de.ts';
import { nl } from './voice-picker.nl.ts';
import { ptBR } from './voice-picker.pt-BR.ts';
import { it } from './voice-picker.it.ts';
import { ru } from './voice-picker.ru.ts';
import { pl } from './voice-picker.pl.ts';
import { tr } from './voice-picker.tr.ts';
import { vi } from './voice-picker.vi.ts';
import { VOICE_CLONE_PROVIDERS } from './voices-library.ts';

/** Copy for the voice picker (translations are in `voice-picker.<language>.ts`). “My voices” is the name of that page in settings. */
const en = {
  clonedOn: (provider: string) => `Cloned on ${provider} · synthesized with this clone`,
  defaultVoice: 'Default voice',
  providerPreset: (provider: string, name: string) => `${provider}’s ${name}`,
  loadingMine: 'Loading My voices…',
  cloneNew: 'Clone a new voice…',
  cloneNewHint: 'Record one or import from a file in Settings › Models › Speech synthesis › My voices',
  myVoices: 'My voices',
  providerVoices: (provider: string) => `${provider} voices`,
  customVoice: 'Enter a voice ID…',
  customVoiceHint: 'A voice ID from your provider account',
  tempReference: 'Use a recording once…',
  tempReferenceHint: 'This version’s synthesis API doesn’t take a one-off reference recording yet · save it to My voices and clone it first',
  other: 'Other',
  voiceDeleted: 'This voice was deleted · pick another, or go back to the default',
  customLine: 'Passed to the provider as is for it to check; you can also create a cloned voice in My voices and choose it',
  presetLine: (provider: string, voiceId: string | null) => (voiceId === null ? `${provider} voice` : `${provider} voice · ${voiceId}`),
  defaultLine: (provider: string, name: string) => `If you don’t choose, ${provider}’s default voice (${name}) is used`,
  noDefault: 'This model has no default voice; choose one first',
};
export type VoicePickerMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Groups for the shared voice picker (design mockup voice-picker.jsx; model-cloud-tts.js `pickerGroups` / `valueLine`). Under a cloud model, the groups are:
 * Default · 「我的声音」(My voices; greyed out according to this provider's clone status, with “Clone new voice…” at the end) · this provider's voices · a manually entered voice ID · a temporary reference clip.
 * “Clone new voice…” only goes to 设置 › 模型 › 语音合成 › 我的声音 (Settings › Models › Speech synthesis › My voices), where cloning is created. “Temporary reference clip”: this version's synthesis API does not accept a temporary reference audio, so it is greyed out with the reason.
 */

/** The two items that are actions, not voices. */
export const CLONE_NEW = 'clone-new';
export const TEMP_REFERENCE = 'temp-reference';

export interface VoicePickerItem {
  /** How a voice is chosen (`VoiceKey`), or `CLONE_NEW` / `TEMP_REFERENCE`. */
  key: string;
  label: string;
  description: string | null;
  disabled: boolean;
}

export interface VoicePickerGroup {
  id: 'default' | 'mine' | 'presets' | 'other';
  /** The default group has no heading. */
  title: string | null;
  items: VoicePickerItem[];
}

function presetName(option: SpeechOption, voiceId: string): string {
  return option.info.voices.find((v) => v.voiceId === voiceId)?.label ?? voiceId;
}

/** Whether this provider can clone: the Runtime currently has a cloning API only for ElevenLabs. */
function canClone(option: Pick<SpeechOption, 'providerId'>): boolean {
  return VOICE_CLONE_PROVIDERS.includes(option.providerId);
}

/** The note under a voice in My voices: when it can be used, says which provider's clone to use; when it cannot, the reason. */
export function libraryVoiceLine(voice: LibraryEntrySummary, option: SpeechOption): { ok: boolean; line: string } {
  const block = libraryVoiceBlock(voice, option);
  return block ? { ok: false, line: block } : { ok: true, line: M.clonedOn(option.provider) };
}

/** The groups in the picker. When `voices` is null (My voices not read yet), that group keeps only “Clone new voice…” and shows “Loading”. */
export function voicePickerGroups(option: SpeechOption, voices: MyVoices): VoicePickerGroup[] {
  const info = option.info;
  const groups: VoicePickerGroup[] = [];
  if (info.defaultVoice) {
    groups.push({
      id: 'default',
      title: null,
      items: [{ key: 'default', label: M.defaultVoice, description: M.providerPreset(option.provider, presetName(option, info.defaultVoice)), disabled: false }],
    });
  }
  const mine: VoicePickerItem[] = (voices ?? []).map((v) => {
    const st = libraryVoiceLine(v, option);
    return { key: libraryVoiceKey(v.id), label: v.name, description: st.line, disabled: !st.ok };
  });
  if (!voices) mine.push({ key: 'mine-loading', label: M.loadingMine, description: null, disabled: true });
  mine.push({ key: CLONE_NEW, label: M.cloneNew, description: M.cloneNewHint, disabled: false });
  groups.push({ id: 'mine', title: M.myVoices, items: mine });
  if (info.voices.length) {
    groups.push({
      id: 'presets',
      title: M.providerVoices(option.provider),
      items: info.voices.map((v) => ({ key: `preset:${v.voiceId}`, label: v.label, description: v.label === v.voiceId ? null : v.voiceId, disabled: false })),
    });
  }
  const other: VoicePickerItem[] = [];
  if (customVoiceAllowed(info)) other.push({ key: 'custom', label: M.customVoice, description: M.customVoiceHint, disabled: false });
  if (canClone(option)) {
    other.push({ key: TEMP_REFERENCE, label: M.tempReference, description: M.tempReferenceHint, disabled: true });
  }
  if (other.length) groups.push({ id: 'other', title: M.other, items: other });
  return groups;
}

/** The item selected in the picker. If the voice was deleted from My voices, it is not in the list, so return null (the control shows a placeholder). */
export function pickerSelection(draft: Pick<TtsDraft, 'voice'>, option: SpeechOption, voices: MyVoices): VoiceKey | null {
  const key = voiceKeyFor(draft, option.info);
  const id = libraryIdOf(key);
  if (id !== null) return voices?.some((v) => v.id === id) ? key : null;
  return voicePickerGroups(option, voices).some((g) => g.items.some((i) => i.key === key && !i.disabled)) ? key : null;
}

/** The sentence written below the control after selection (`valueLine`): how this model will use it. */
export function voiceValueLine(draft: Pick<TtsDraft, 'voice'>, option: SpeechOption, voices: MyVoices): string {
  const info = option.info;
  const key = voiceKeyFor(draft, info);
  const id = libraryIdOf(key);
  if (id !== null) {
    if (!voices) return M.loadingMine;
    const voice = voices.find((v) => v.id === id);
    return voice ? libraryVoiceLine(voice, option).line : M.voiceDeleted;
  }
  if (key === 'custom') return M.customLine;
  if (key.startsWith('preset:')) {
    const voiceId = key.slice('preset:'.length);
    const name = presetName(option, voiceId);
    return M.presetLine(option.provider, name === voiceId ? null : voiceId);
  }
  return info.defaultVoice ? M.defaultLine(option.provider, presetName(option, info.defaultVoice)) : M.noDefault;
}

/** Which voice is picked first when “Clone voice” opens: keep it if the draft already uses one of my voices; otherwise the first one this provider can use, and then the first one; null if there are none. */
export function cloneVoiceKey(draft: Pick<TtsDraft, 'voice'>, option: SpeechOption | null, voices: MyVoices): VoiceKey | null {
  if (libraryIdOf(draft.voice) !== null) return draft.voice;
  if (!voices?.length) return null;
  const usable = option ? voices.find((v) => !libraryVoiceBlock(v, option)) : undefined;
  return libraryVoiceKey((usable ?? voices[0]!).id);
}
