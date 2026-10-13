import {
  defineMessages,
  GRANT_DATA_KIND_LABELS,
  GRANT_DATA_KINDS,
  RpcError,
  type DocumentRecord,
  type DubOriginalAudio,
  type DubParams,
  type DubVoiceSource,
  type GrantCreateParams,
  type GrantDataKind,
  type Id,
  type LibraryEntrySummary,
  type SpeakerVoiceBinding,
  type SpeechModelInfo,
} from '@cuccut/protocol';
import { languageName } from './caption-tracks.ts';
import { recipientName } from './data-grants.ts';
import { langName } from './tools-models.ts';
import { sameLanguage, TARGET_LANGUAGES } from './translate-setup.ts';
import { speechSentences } from './translation-doc.ts';
import { zhHans } from './dub-setup.zh-Hans.ts';
import { zhHant } from './dub-setup.zh-Hant.ts';
import { ja } from './dub-setup.ja.ts';
import { ko } from './dub-setup.ko.ts';
import { es } from './dub-setup.es.ts';
import { fr } from './dub-setup.fr.ts';
import { de } from './dub-setup.de.ts';
import { nl } from './dub-setup.nl.ts';
import { ptBR } from './dub-setup.pt-BR.ts';
import { it } from './dub-setup.it.ts';
import { ru } from './dub-setup.ru.ts';
import { pl } from './dub-setup.pl.ts';
import { tr } from './dub-setup.tr.ts';
import { vi } from './dub-setup.vi.ts';
import { remedyHintText } from './localized-text.ts';

/** Copy for the dub setup model (English is the source of keys and types; translations are in `dub-setup.zh-Hans.ts`). */
const en = {
  useExisting: (name: string) => `Use existing translation · ${name}`,
  translateFirst: (language: string) => `${language} · Translate first`,
  sameAsSource: 'Same language as the original',
  missingLibraryVoice: (id: string) => `Library voice (${id}, no longer in the library)`,
  voiceRemoved: 'This voice is no longer in the library',
  noConsent: 'No consent statement from the speaker, so it won’t be uploaded to the provider',
  notCloned: (provider: string) => `Not cloned with ${provider} yet`,
  cloneExpired: (provider: string) => `The clone with ${provider} has expired; clone it again`,
  modelDefaultNamed: (voice: string) => `Model default · ${voice}`,
  modelDefault: 'Model default',
  noDefaultVoice: 'This model has no default voice',
  needsVoice: 'This model needs a voice to be specified',
  presetVoice: 'Preset voice',
  myVoiceProblem: (problem: string) => `My voices · ${problem}`,
  myVoice: 'My voices',
  customVoice: 'Enter voice ID…',
  customVoiceDesc: 'A voice in your provider account',
  purpose: (language: string, videoName: string | null) =>
    `Voice-over: dub ${videoName ? `“${videoName}”` : 'this video'} into ${language}`,
  kindList: (kinds: readonly string[]) => kinds.join(', '),
  transcriptNote: ' (the translation to synthesize; when translating first, also the original text)',
  factWhat: 'Data sent',
  factTo: 'Sent to',
  factScope: 'Scope',
  factPurpose: 'Purpose',
  factBudget: 'Budget',
  factRevoke: 'Revoking',
  scopeVideoNamed: (name: string) => `Only the video “${name}”`,
  scopeThisVideo: 'Only this video',
  budget: 'Counted per call, cost unknown, unlimited calls; the provider charges for usage as usual',
  revoke: 'Revoke any time in Settings › Privacy › Data sharing grants; data already sent can’t be taken back',
};
export type DubSetupMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Pure logic for the translated-dub setup page (design draft panel-dub-setup.jsx `DubSetup`): which language is chosen (an existing translation, or translate first), the voice in effect for each speaker, the parameters handed to `pipelines.start` (`dub`), and the grant to send when the first dub is rejected with `GRANT_REQUIRED`.
 * The design draft's automatic engine choice, local model download, 注音 (phonetic annotation), duration comparison and sample clips are simulations of the local engine. They are not part of the Runtime's `dub` contract, so they are not done here.
 */

export const DUB_PIPELINE = 'dub';
export const DEFAULT_DUCK_DB = 18;
export const DUCK_DB_MIN = 1;
export const DUCK_DB_MAX = 60;
/** Upper limit for style hints (same as translation). */
export const DUB_STYLE_MAX = 500;
/** Upper limit for the grant's purpose (`purpose` of `grants.create`). */
export const GRANT_PURPOSE_MAX = 200;

/** How many dB to lower: an integer from 1 to 60 (the Runtime accepts integers). The default 12 when it is not a number. */
export function clampDuckDb(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DUCK_DB;
  return Math.min(DUCK_DB_MAX, Math.max(DUCK_DB_MIN, Math.round(value)));
}

// ---- Which language ----

export interface DubLanguageOption {
  /** `doc:<translation ID>` uses an existing translation. `lang:<tag>` translates into this language first. */
  key: string;
  /** The language's own name. */
  label: string;
  description: string;
  language: string;
  translationId: Id | null;
  /** The reason it cannot be chosen (same language as the source). null when it can be chosen. */
  disabled: string | null;
}

/**
 * Language dropdown: lists this transcript's existing translations first (use one, and the language follows it), then common languages (translate first). Languages that already have a translation are not listed with “translate first”: there is one translation per language, and redoing it is done in the subtitle panel.
 */
export function dubLanguageOptions(sourceLanguage: string | null, translations: readonly DocumentRecord[]): DubLanguageOption[] {
  const docs: DubLanguageOption[] = translations
    .filter((d) => !!d.language)
    .map((d) => ({
      key: `doc:${d.id}`,
      label: languageName(d.language!),
      description: M.useExisting(d.name),
      language: d.language!,
      translationId: d.id,
      disabled: null,
    }));
  const fresh: DubLanguageOption[] = TARGET_LANGUAGES.filter((tag) => !docs.some((d) => sameLanguage(d.language, tag))).map((tag) => ({
    key: `lang:${tag}`,
    label: languageName(tag),
    description: M.translateFirst(langName(tag)),
    language: tag,
    translationId: null,
    disabled: sourceLanguage !== null && sameLanguage(sourceLanguage, tag) ? M.sameAsSource : null,
  }));
  return [...docs, ...fresh];
}

/** Which item is selected by default: the first existing translation when there is one. Otherwise, English when the source is Chinese, else another Simplified Chinese. When none can be chosen, the first selectable item. */
export function defaultDubLanguage(options: readonly DubLanguageOption[], sourceLanguage: string | null): string | null {
  const doc = options.find((o) => o.translationId !== null && !o.disabled);
  if (doc) return doc.key;
  const preferred = sourceLanguage && sourceLanguage.toLowerCase().startsWith('zh') ? 'lang:en' : 'lang:zh-Hans';
  return (options.find((o) => o.key === preferred && !o.disabled) ?? options.find((o) => !o.disabled))?.key ?? null;
}

// ---- Parameters ----

export interface DubSetup {
  videoId: Id;
  /** The source text (`speech`). When an existing translation is used, the Runtime takes the source from the translation, so it is not passed here. */
  speechDocumentId: Id;
  /** An existing translation. When null, translate into `targetLanguage` first. */
  translationId: Id | null;
  targetLanguage: string;
  /** The speech synthesis Provider and model. When null, the speech synthesis default is used. */
  voiceModel: { providerId: string; modelId: string } | null;
  /** The voice for speakers without a bound voice. When null, the model's default voice is used. */
  voice: string | null;
  /** The text model used when translating first. When null, the text generation default is used. */
  textModel: { providerId: string; modelId: string } | null;
  style: string;
  originalAudio: DubOriginalAudio;
  duckDb: number;
  /** Separate vocals and background first (`separateBackground`): the background sound becomes its own track, and the original audio keeps only the vocals (muted or lowered). When `keep`, the Runtime does not separate. */
  separateBackground: boolean;
}

/**
 * `params` for `pipelines.start`: only keys the flow recognizes. When `translationId` is given, there is no translation, so `targetLanguage`, `style` and the text model are not passed either. The Runtime rejects that combination, and the language follows the translation. The glossary is not passed here: when translating first, the glossary enabled in the video is used (same as translation).
 * Separation is passed only as `separateBackground: true` when it is turned on (same as the CLI's `--separate-background`). Without a separation model, the Runtime skips the step and warns.
 */
export function dubParams(setup: DubSetup): DubParams {
  const voice = setup.voice?.trim();
  const base: DubParams = {
    videoId: setup.videoId,
    ...(setup.voiceModel ? { provider: setup.voiceModel.providerId, model: setup.voiceModel.modelId } : {}),
    ...(voice ? { voice } : {}),
    originalAudio: setup.originalAudio,
    ...(setup.originalAudio === 'duck' ? { duckDb: clampDuckDb(setup.duckDb) } : {}),
    ...(setup.separateBackground ? { separateBackground: true } : {}),
  };
  if (setup.translationId) return { ...base, translationId: setup.translationId };
  const style = setup.style.trim().slice(0, DUB_STYLE_MAX);
  return {
    ...base,
    documentId: setup.speechDocumentId,
    targetLanguage: setup.targetLanguage,
    ...(style ? { style } : {}),
    ...(setup.textModel ? { textProvider: setup.textModel.providerId, textModel: setup.textModel.modelId } : {}),
  };
}

// ---- Speakers and voices ----

export interface SpeechSpeaker {
  speakerId: string;
  name: string;
  /** The sentence count for this speaker. A sentence's speaker is taken from its first unhidden word, as the Runtime does. */
  sentences: number;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The speakers in the transcript and their sentence counts. Empty when there is no speaker info (all sentences use the parameter voice or the model default). */
export function speechSpeakers(body: unknown): SpeechSpeaker[] {
  const sentences = speechSentences(body);
  if (!sentences || !isObject(body)) return [];
  const names = new Map<string, string>();
  for (const raw of Array.isArray(body.speakers) ? body.speakers : []) {
    if (!isObject(raw) || typeof raw.id !== 'string') continue;
    names.set(raw.id, (typeof raw.name === 'string' && raw.name.trim()) || raw.id);
  }
  const words = new Map<string, { speaker?: string; hidden?: boolean }>();
  for (const raw of Array.isArray(body.words) ? body.words : []) {
    if (isObject(raw) && typeof raw.id === 'string') {
      words.set(raw.id, {
        ...(typeof raw.speaker === 'string' ? { speaker: raw.speaker } : {}),
        ...(raw.hidden === true ? { hidden: true } : {}),
      });
    }
  }
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    const first = sentence.wordIds.map((id) => words.get(id)).find((w) => w && !w.hidden);
    if (first?.speaker) counts.set(first.speaker, (counts.get(first.speaker) ?? 0) + 1);
  }
  // Ordered by speaker appearance in the transcript first, then speakers without a registered name.
  const order = [...names.keys(), ...[...counts.keys()].filter((id) => !names.has(id))];
  return order.filter((id) => counts.has(id)).map((id) => ({ speakerId: id, name: names.get(id) ?? id, sentences: counts.get(id)! }));
}

const LIBRARY_PREFIX = 'library:';

/** The entry ID for `library:<id>`. null when the voice is not in the library. */
export function libraryVoiceId(voice: string): string | null {
  return voice.startsWith(LIBRARY_PREFIX) && voice.length > LIBRARY_PREFIX.length ? voice.slice(LIBRARY_PREFIX.length) : null;
}

/** A voice's short name: a library voice uses the entry name, a built-in voice uses the name the model gives, and others use the ID as written. */
export function voiceName(voice: string, info: Pick<SpeechModelInfo, 'voices'> | null, library: readonly LibraryEntrySummary[]): string {
  const id = libraryVoiceId(voice);
  if (id !== null) return library.find((e) => e.id === id)?.name ?? M.missingLibraryVoice(id);
  return info?.voices.find((v) => v.voiceId === voice)?.label ?? voice;
}

/**
 * Whether a library voice can be used with this provider. Without the person's own declaration of consent it is not uploaded (`VOICE_CONSENT_REQUIRED`). Without a valid clone it cannot be synthesized (`VOICE_CLONE_REQUIRED`). null when it can be used.
 */
export function libraryVoiceProblem(entry: LibraryEntrySummary | undefined, providerId: string | null, providerLabel: string): string | null {
  if (!entry) return M.voiceRemoved;
  if (!entry.consentDeclared) return M.noConsent;
  if (!providerId) return null;
  const clone = entry.clones?.find((c) => c.providerId === providerId);
  if (!clone) return M.notCloned(providerLabel);
  if (clone.state !== 'valid') return M.cloneExpired(providerLabel);
  return null;
}

export interface VoiceChoice {
  /** `default`、`preset:<id>`、`library:<id>`、`custom`。 */
  key: string;
  label: string;
  description: string | null;
  /** The value handed to the Runtime (parameter `voice`) or written into the binding. `default` and `custom` give null. */
  voice: string | null;
  /** A built-in voice only makes sense on its own provider: include the provider when writing the binding. Library voices do not include it (the Runtime swaps in the clone for the provider chosen for the dub). */
  providerId?: string;
  /** The reason it cannot be chosen. null when it can be chosen. */
  disabled: string | null;
}

/**
 * Voice dropdown: the model default (`defaultLabel`; in a binding it is written as “unbound”), the model's built-in voices, library voices (saying clearly whether each works with this provider), and a hand-typed voice ID (when `custom` is true and the model accepts typed IDs). A library voice used as the parameter voice needs a valid clone, or the start is rejected at launch, so it cannot be chosen then. A binding can be set first and cloned later. Sentences that cannot use it this time are reported one by one.
 */
export function voiceChoices(options: {
  info: SpeechModelInfo | null;
  providerId: string | null;
  providerLabel: string;
  library: readonly LibraryEntrySummary[];
  defaultLabel: string;
  /** The dropdown for the parameter voice. A library voice can be chosen only if it works. Typing is allowed. */
  forParams: boolean;
}): VoiceChoice[] {
  const { info, providerId, providerLabel, library, defaultLabel, forParams } = options;
  const list: VoiceChoice[] = [];
  const preset = info?.defaultVoice ? (info.voices.find((v) => v.voiceId === info.defaultVoice)?.label ?? info.defaultVoice) : null;
  list.push({
    key: 'default',
    label: defaultLabel,
    description: forParams ? (preset ? M.modelDefaultNamed(preset) : M.noDefaultVoice) : null,
    voice: null,
    disabled: forParams && info && !info.defaultVoice ? M.needsVoice : null,
  });
  for (const v of info?.voices ?? []) {
    list.push({
      key: `preset:${v.voiceId}`,
      label: v.label,
      description: M.presetVoice,
      voice: v.voiceId,
      ...(providerId ? { providerId } : {}),
      disabled: null,
    });
  }
  for (const entry of library) {
    const problem = libraryVoiceProblem(entry, providerId, providerLabel);
    list.push({
      key: `library:${entry.id}`,
      label: entry.name,
      description: problem ? M.myVoiceProblem(problem) : M.myVoice,
      voice: `${LIBRARY_PREFIX}${entry.id}`,
      disabled: forParams && problem ? problem : null,
    });
  }
  if (forParams && info?.voiceModes.includes('custom')) {
    list.push({ key: 'custom', label: M.customVoice, description: M.customVoiceDesc, voice: null, disabled: null });
  }
  return list;
}

/** Which dropdown item a voice value corresponds to. null when it is not in the list (bound elsewhere, or the model has changed). */
export function choiceKeyOf(voice: string, choices: readonly VoiceChoice[]): string | null {
  return choices.find((c) => c.voice === voice)?.key ?? null;
}

export interface SpeakerRow {
  speakerId: string;
  name: string;
  sentences: number;
  /** The voice bound in this video to this speaker (in this transcript). null when there is none. */
  binding: SpeakerVoiceBinding | null;
  /** The bound voice is a built-in voice of another provider: it is not used this time, and falls back to the parameter voice or the model default. */
  bindingIgnored: boolean;
  /** The voice in effect (binding → parameter `voice` → model default): the name shown to people, and its source. */
  effective: { label: string; source: DubVoiceSource };
  /** The voice in effect is a library voice that does not work with this provider, so this speaker's sentences will not be synthesized. */
  warning: string | null;
}

/**
 * In the setup page's “voice” section, one row per speaker. The voice in effect follows the Runtime's priority: the binding in the video → the parameter `voice` → the model default.
 * A binding for another provider is not used by the Runtime (`providerId` does not match). Here it also falls back and says so.
 */
export function speakerRows(options: {
  speakers: readonly SpeechSpeaker[];
  bindings: readonly SpeakerVoiceBinding[];
  documentId: Id;
  providerId: string | null;
  providerLabel: string;
  voice: string | null;
  info: SpeechModelInfo | null;
  library: readonly LibraryEntrySummary[];
}): SpeakerRow[] {
  const { speakers, bindings, documentId, providerId, providerLabel, voice, info, library } = options;
  const fallback = (): SpeakerRow['effective'] => {
    if (voice) return { label: voiceName(voice, info, library), source: 'params' };
    const preset = info?.defaultVoice ? voiceName(info.defaultVoice, info, library) : null;
    return { label: preset ? M.modelDefaultNamed(preset) : M.modelDefault, source: 'default' };
  };
  return speakers.map((s) => {
    const binding = bindings.find((b) => b.documentId === documentId && b.speakerId === s.speakerId) ?? null;
    const ignored = !!binding && binding.providerId !== undefined && providerId !== null && binding.providerId !== providerId;
    const used = binding && !ignored ? binding : null;
    const effectiveVoice = used ? used.voice : voice;
    const libraryId = effectiveVoice ? libraryVoiceId(effectiveVoice) : null;
    const warning =
      libraryId !== null
        ? libraryVoiceProblem(
            library.find((e) => e.id === libraryId),
            providerId,
            providerLabel,
          )
        : null;
    return {
      speakerId: s.speakerId,
      name: s.name,
      sentences: s.sentences,
      binding,
      bindingIgnored: ignored,
      effective: used ? { label: voiceName(used.voice, info, library), source: 'video' } : fallback(),
      warning,
    };
  });
}

/**
 * Change one speaker's binding: replace it in place or remove this speaker's entry in this transcript, and leave the others as they are. A new one goes last. `library:` voices do not carry `providerId` (the Runtime rejects it). Built-in voices carry the provider they belong to.
 */
export function withBinding(
  bindings: readonly SpeakerVoiceBinding[],
  documentId: Id,
  speakerId: string,
  choice: { voice: string; providerId?: string } | null,
): SpeakerVoiceBinding[] {
  const next: SpeakerVoiceBinding | null = choice
    ? {
        documentId,
        speakerId,
        voice: choice.voice,
        ...(choice.providerId !== undefined && libraryVoiceId(choice.voice) === null ? { providerId: choice.providerId } : {}),
      }
    : null;
  const index = bindings.findIndex((b) => b.documentId === documentId && b.speakerId === speakerId);
  if (index < 0) return next ? [...bindings, next] : [...bindings];
  const out = [...bindings];
  if (next) out[index] = next;
  else out.splice(index, 1);
  return out;
}

// ---- Grant ----

/** When the first dub is rejected for lack of a grant: which data goes to whom, for which video, and the Runtime's remedy note and command. */
export interface GrantRefusal {
  code: 'GRANT_REQUIRED' | 'GRANT_REVOKED';
  message: string;
  recipient: string;
  dataKinds: GrantDataKind[];
  videoId: Id | null;
  hint: string;
  commands: string[];
}

const GRANT_CODES = new Set(['GRANT_REQUIRED', 'GRANT_REVOKED']);

/**
 * Reads a rejection from `pipelines.start` / `pipelines.retry`. For `GRANT_REQUIRED` or `GRANT_REVOKED`, when the remedy is “grant access”, it gives the message to send. Other rejections (budget, missing config, …) give null. The recipient, data kind and video come from the top-level details (the command is not parsed).
 */
export function grantRefusal(error: unknown): GrantRefusal | null {
  const details = error instanceof RpcError ? error.details : (error as { details?: unknown } | null)?.details;
  if (!isObject(details) || typeof details.code !== 'string' || !GRANT_CODES.has(details.code)) return null;
  const remedy = isObject(details.remedy) ? details.remedy : null;
  if (!remedy || remedy.action !== 'create-grant') return null;
  if (typeof details.recipient !== 'string' || !details.recipient) return null;
  const kinds = Array.isArray(details.dataKinds)
    ? details.dataKinds.filter((k): k is GrantDataKind => typeof k === 'string' && (GRANT_DATA_KINDS as readonly string[]).includes(k))
    : [];
  return {
    code: details.code as GrantRefusal['code'],
    message: error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? ''),
    recipient: details.recipient,
    dataKinds: kinds.length ? kinds : ['transcript'],
    videoId: typeof details.videoId === 'string' ? details.videoId : null,
    hint: remedyHintText(remedy) ?? '',
    commands: Array.isArray(remedy.commands) ? remedy.commands.filter((c): c is string => typeof c === 'string') : [],
  };
}

/** The same recipient and the same data kinds. When it was sent once and still rejected, do not loop. */
export function refusalKey(refusal: Pick<GrantRefusal, 'recipient' | 'dataKinds'>): string {
  return `${refusal.recipient}|${[...refusal.dataKinds].sort().join(',')}`;
}

/** The purpose of the grant (shown to people; `purpose` in `grants.create`, up to 200 characters). */
export function grantPurpose(language: string, videoName: string | null): string {
  const what = M.purpose(langName(language), videoName);
  return what.slice(0, GRANT_PURPOSE_MAX);
}

/**
 * The grant sent after the user confirms. The data kind and recipient follow the rejection (for dubbing it is `transcript`). It is limited to this video. The purpose is as written on the settings page. The amount is unknown and charged per call with no call limit (`per-call-unknown-cost`, no amount cap; a cap needs `estimate-cap` and `budgetCap`).
 */
export function grantRequest(refusal: Pick<GrantRefusal, 'recipient' | 'dataKinds' | 'videoId'>, videoId: Id, purpose: string): GrantCreateParams {
  return {
    dataKinds: [...refusal.dataKinds],
    recipient: refusal.recipient,
    scope: { videoId: refusal.videoId ?? videoId },
    purpose: purpose.trim().slice(0, GRANT_PURPOSE_MAX),
    budgetMode: 'per-call-unknown-cost',
  };
}

/** The lines in the confirmation dialog: what leaves, who receives it, which video it is limited to, the purpose, the budget, and how to revoke it. */
export function grantFacts(
  refusal: Pick<GrantRefusal, 'recipient' | 'dataKinds'>,
  labels: ReadonlyMap<string, string>,
  videoName: string | null,
  purpose: string,
): Array<[label: string, value: string]> {
  const kinds = M.kindList(refusal.dataKinds.map((k) => GRANT_DATA_KIND_LABELS[k]));
  const transcript = refusal.dataKinds.includes('transcript') ? M.transcriptNote : '';
  return [
    [M.factWhat, `${kinds}${transcript}`],
    [M.factTo, recipientName(refusal.recipient, labels)],
    [M.factScope, videoName ? M.scopeVideoNamed(videoName) : M.scopeThisVideo],
    [M.factPurpose, purpose],
    [M.factBudget, M.budget],
    [M.factRevoke, M.revoke],
  ];
}
