import {
  localizeText,
  type JobRecord,
  type LibraryEntry,
  type LibraryEntrySummary,
  type LibraryPutParams,
  type MessageRef,
  type ModelCapabilitiesView,
  type VoiceContent,
} from '@cuccut/protocol';
import { agoLabel } from './format.ts';
import type { ModelChip } from './models-local.ts';
import { fmtSize } from './task-facts.ts';
import { langName, languageOptions, type LanguageOption } from './tools-models.ts';
import { M } from './voices-library-copy.ts';
import { jobErrorText, remedyHintText, remedyText } from './localized-text.ts';

/**
 * Pure logic for Models › Speech synthesis › 我的声音 (My voices) (architecture design §5.9, design mockup settings-voices.jsx): how a voice row is displayed, cloning on each provider, the create and edit forms, which clones must be deleted before a voice is deleted, and how errors are worded. Commands are in components/models/voice-actions.ts.
 */

export type VoiceEntry = LibraryEntry<'voices'>;

/** Providers that can create clones. The Runtime currently has a cloning API only for ElevenLabs; others are rejected with `VOICE_CLONE_UNSUPPORTED`. */
export const VOICE_CLONE_PROVIDERS: readonly string[] = ['elevenlabs'];
/** The statement written into `consent.statement` when “I declare” is ticked (in the current UI language; once saved, the original wording does not change). */
export function voiceConsentStatement(): string {
  return M.consentStatement;
}
/** Reference recordings accept only these three formats (the Runtime checks the file header, then parses it again with ffprobe). */
export const VOICE_AUDIO_EXTENSIONS: readonly string[] = ['wav', 'mp3', 'flac'];
export const VOICE_PACKAGE_EXTENSION = 'bcvoice';
export const VOICE_NAME_MAX = 200;
export const VOICE_TRANSCRIPT_MAX = 10_000;

const chars = (s: string) => [...s].length;

// ---- Cloning ----

export interface CloneProvider {
  providerId: string;
  label: string;
  available: boolean;
  /** The explanation the Runtime gives when unavailable (not enabled, no key set, …). */
  detail: string | null;
}

/** The providers in this Runtime that can clone and are registered under the speech synthesis capability. */
export function cloneProviders(view: ModelCapabilitiesView | null): CloneProvider[] {
  const providers = view?.synthesizeSpeech.providers ?? [];
  return VOICE_CLONE_PROVIDERS.flatMap((providerId) => {
    const p = providers.find((x) => x.providerId === providerId);
    if (!p) return [];
    return [{ providerId, label: p.label, available: p.available, detail: p.available ? null : (localizeText(p.detail, p.detailRef) ?? null) }];
  });
}

const LIVE: readonly JobRecord['state'][] = ['queued', 'running'];

/** The most recent cloning task for this voice on this provider. */
export function latestCloneJob(jobs: readonly JobRecord[], voiceId: string, providerId: string): JobRecord | null {
  let latest: JobRecord | null = null;
  for (const job of jobs) {
    if (job.kind !== 'voiceClone' || job.providerId !== providerId || job.library?.entries[0]?.id !== voiceId) continue;
    if (!latest || job.createdAt > latest.createdAt) latest = job;
  }
  return latest;
}

export interface CloneRow {
  providerId: string;
  label: string;
  /** `none`: no clone exists on this provider yet. */
  state: 'valid' | 'stale' | 'none';
  running: boolean;
  /** The reason for the most recent clone failure (no clone was created afterwards). */
  failure: string | null;
  /** Whether “Upload to X” can be clicked. When it cannot, `why` gives the reason. A valid clone no longer shows this item. */
  create: { enabled: boolean; why: string | null } | null;
  /** Can be deleted when a clone record exists (valid or expired). */
  removable: boolean;
}

/** The status of one voice on each provider that can clone. Providers recorded in the entry but no longer registered in this Runtime are also listed, so they can be deleted. */
export function cloneRows(voice: LibraryEntrySummary, providers: readonly CloneProvider[], jobs: readonly JobRecord[]): CloneRow[] {
  const ids = [...providers.map((p) => p.providerId)];
  for (const c of voice.clones ?? []) if (!ids.includes(c.providerId)) ids.push(c.providerId);
  return ids.map((providerId) => {
    const provider = providers.find((p) => p.providerId === providerId) ?? null;
    const label = provider?.label ?? providerId;
    const state = voice.clones?.find((c) => c.providerId === providerId)?.state ?? 'none';
    const job = latestCloneJob(jobs, voice.id, providerId);
    const running = !!job && LIVE.includes(job.state);
    const failure = job?.state === 'failed' && state !== 'valid' && job.error ? errorText(job.error.code, jobErrorText(job.error), job.error.details) : null;
    let create: CloneRow['create'] = null;
    if (state !== 'valid') {
      const why = running
        ? M.uploading(label)
        : !voice.consentDeclared
          ? M.noConsent
          : !provider
            ? M.cannotClone(label)
            : !provider.available
              ? M.providerOff(label, provider.detail)
              : null;
      create = { enabled: why === null, why };
    }
    return { providerId, label, state, running, failure, create, removable: state !== 'none' && !running };
  });
}

// ---- Display of a row ----

/** Label beside the name: the missing self-declaration, and the clones on each provider. */
export function voiceChips(voice: LibraryEntrySummary, providers: readonly CloneProvider[]): ModelChip[] {
  const chips: ModelChip[] = [];
  if (!voice.consentDeclared) chips.push({ label: M.consentUnstated, tone: 'neutral' });
  for (const clone of voice.clones ?? []) {
    const label = providers.find((p) => p.providerId === clone.providerId)?.label ?? clone.providerId;
    chips.push(clone.state === 'valid' ? { label: M.cloned(label), tone: 'positive' } : { label: M.cloneStale(label), tone: 'notice' });
  }
  return chips;
}

const FORMAT: Record<string, string> = { 'audio/wav': 'WAV', 'audio/mpeg': 'MP3', 'audio/flac': 'FLAC' };

/** The line under the name: language · recording format and size · source · when it was last changed. */
export function voiceMeta(entry: VoiceEntry, now = Date.now()): string {
  const c = entry.content;
  const parts = [
    c.language ? langName(c.language) : M.languageUnknown,
    `${FORMAT[c.reference.mediaType] ?? c.reference.mediaType} ${fmtSize(c.reference.byteLength)}`,
    c.origin === 'recorded' ? M.recorded : M.imported,
    M.edited(agoLabel(entry.updatedAt, now)),
  ];
  return parts.join(' · ');
}

// ---- Create and edit ----

export interface VoiceForm {
  name: string;
  /** BCP 47; an empty string means unknown. */
  language: string;
  transcript: string;
  consent: boolean;
}

export interface VoiceFormErrors {
  name: string | null;
  transcript: string | null;
}

function baseName(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? '';
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(0, dot) : file;
}

/** When created from a file, the name starts as the file name without its extension. */
export function formForFile(path: string): VoiceForm {
  return { name: [...baseName(path).trim()].slice(0, VOICE_NAME_MAX).join(''), language: '', transcript: '', consent: false };
}

export function formFromEntry(entry: VoiceEntry): VoiceForm {
  const c = entry.content;
  return { name: c.name, language: c.language ?? '', transcript: c.transcript, consent: c.consent.declared };
}

export function validateVoiceForm(form: VoiceForm): VoiceFormErrors {
  const name = form.name.trim();
  return {
    name: !name ? M.nameRequired : chars(name) > VOICE_NAME_MAX ? M.nameTooLong(VOICE_NAME_MAX) : null,
    transcript: chars(form.transcript.trim()) > VOICE_TRANSCRIPT_MAX ? M.transcriptTooLong(VOICE_TRANSCRIPT_MAX) : null,
  };
}

export function formValid(form: VoiceForm): boolean {
  const errors = validateVoiceForm(form);
  return !errors.name && !errors.transcript;
}

/** Language dropdown: unknown, plus common languages. A language in the entry that is not among the common ones is also listed. */
export function voiceLanguageOptions(current: string): LanguageOption[] {
  const options = languageOptions('any', M.dontKnow);
  if (current && !options.some((o) => o.key === current)) options.push({ key: current, label: langName(current) });
  return options;
}

/**
 * Form → content for `library.put`. Declaration: when ticked, keep the sentence originally saved in the entry (the original wording stays unchanged, so the Runtime keeps the original declaration time).
 * If there was no original wording, use a fixed sentence. When unticked, revoke the declaration.
 */
export function voiceContentInput(form: VoiceForm, origin: VoiceContent['origin'], previous: VoiceContent | null): LibraryPutParams['content'] {
  const kept = previous?.consent.declared && previous.consent.statement ? previous.consent.statement : null;
  return {
    name: form.name.trim(),
    language: form.language || null,
    transcript: form.transcript.trim(),
    origin,
    consent: form.consent ? { declared: true, statement: kept ?? M.consentStatement } : { declared: false, statement: null },
  };
}

/** Creates one voice from an audio file (the Runtime copies the reference recording from this path into the library). */
export function createVoiceRequest(form: VoiceForm, path: string): Omit<LibraryPutParams, 'commandId'> {
  return { library: 'voices', content: voiceContentInput(form, 'imported', null), source: { path } };
}

/** Changing the name, language, transcript, or declaration: do not pass `source`, so the original recording is kept. Include the version number, so a change made elsewhere first is rejected. */
export function editVoiceRequest(form: VoiceForm, entry: VoiceEntry): Omit<LibraryPutParams, 'commandId'> {
  return {
    library: 'voices',
    id: entry.id,
    expectedVersion: entry.version,
    content: voiceContentInput(form, entry.content.origin, entry.content),
  };
}

/** A rough filter for choosing an audio file (by extension). The real check is in the Runtime. */
export function isVoiceAudioPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return VOICE_AUDIO_EXTENSIONS.includes(ext);
}

/** Default file name for an exported voice package: `名字.bcvoice` (name.bcvoice), with characters not allowed in file names removed. */
export function voicePackageName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = [...name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '')]
    .slice(0, 100)
    .join('')
    .trim();
  return `${cleaned || 'voice'}.${VOICE_PACKAGE_EXTENSION}`;
}

// ---- Delete ----

/** The clones to delete before a voice is deleted. Both valid and expired ones are deleted: deleting only the entry would leave the clone on the provider's side, and the UI could no longer find it. */
export function clonesToRemove(voice: LibraryEntrySummary): string[] {
  return (voice.clones ?? []).map((c) => c.providerId);
}

export function deleteBody(voice: LibraryEntrySummary, providers: readonly CloneProvider[]): string {
  const labels = clonesToRemove(voice).map((id) => providers.find((p) => p.providerId === id)?.label ?? id);
  return M.deleteBody(labels.length ? M.deleteClones(labels) : '');
}

/** The notice before upload (the mockup's uploadNotice; there is no recording duration here, so the size is given). */
export function uploadNotice(voice: LibraryEntrySummary, label: string, entry: VoiceEntry | null): string {
  return M.uploadNotice(voice.name, entry ? fmtSize(entry.content.reference.byteLength) : null, label);
}

// ---- Errors ----

function str(details: unknown, key: string): string | null {
  const v = (details as Record<string, unknown> | null | undefined)?.[key];
  return typeof v === 'string' && v ? v : null;
}

function remedyHint(details: unknown): string | null {
  return remedyText(details) ?? remedyHintText((details as { remedy?: unknown } | null | undefined)?.remedy);
}

/** Adds a sentence on what to do for each error code (saving voices, import and export, cloning and deleting). */
export function errorText(code: string | null, message: string, details: unknown): string {
  const add = (remedy: string | null) => (remedy ? M.withRemedy(message, remedy) : message);
  switch (code) {
    case 'VOICE_CONSENT_REQUIRED':
      return add(M.remedyConsent);
    case 'CAPABILITY_NOT_CONFIGURED':
      return add(M.remedyConfigure);
    case 'LIBRARY_VERSION_CONFLICT':
      return add(M.remedyConflict);
    case 'GRANT_REQUIRED':
    case 'GRANT_REVOKED':
    case 'BUDGET_EXCEEDED':
      return add(remedyHint(details) ?? M.remedyGrant);
    default:
      return add(remedyHint(details));
  }
}

/** A one-sentence message when an RPC is rejected (the error code is in `details.code`). */
export function rpcErrorText(error: unknown): string {
  // When an RpcError carries `messageRef`, the message is regenerated in the current UI language.
  const ref = (error as { messageRef?: MessageRef } | null)?.messageRef;
  const message = localizeText(error instanceof Error ? error.message : String(error), ref);
  const details = (error as { details?: unknown } | null)?.details;
  return errorText(str(details, 'code'), message, details);
}

/** Error codes (`details.code`). */
export function errorCode(error: unknown): string | null {
  return str((error as { details?: unknown } | null)?.details, 'code');
}
