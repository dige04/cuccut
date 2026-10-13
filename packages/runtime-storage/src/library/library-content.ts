import type { BrandMediaKind, CaptionStyleBody, GlossaryContent, LibraryContentInput, LibraryName } from '@cuccut/protocol';
import { formatInvalid, libraryError } from './library-errors.ts';
import { RuntimeStorageLibrary as SL } from '@cuccut/protocol/messages/runtime-storage';

/**
 * Normalization and semantic checks for entry content. The RPC shape is checked by the protocol's zod. Exchange-file imports do not go through zod, so this file does the checks itself, and both paths get the same content.
 */

export const MAX_NAME_CHARS = 200;
export const MAX_TERM_CHARS = 200;
export const MAX_TERMS = 5000;
export const MAX_MISHEARD_PER_TERM = 50;
export const MAX_NOTE_CHARS = 1000;
export const MAX_TRANSCRIPT_CHARS = 10_000;
export const MAX_STATEMENT_CHARS = 2000;
/** Upper limit for subtitle style, same as the style object of `setStyle`. */
export const MAX_CAPTION_STYLE_BYTES = 64 * 1024;

export const BRAND_MEDIA_KINDS: readonly BrandMediaKind[] = ['image', 'video', 'sticker', 'font'];

export function isBrandMediaKind(kind: string): kind is BrandMediaKind {
  return (BRAND_MEDIA_KINDS as readonly string[]).includes(kind);
}

function text(value: unknown, field: string, max: number, options: { allowEmpty?: boolean } = {}): string {
  if (typeof value !== 'string') throw formatInvalid(SL.fieldNotText({ field }), { field });
  const trimmed = value.trim();
  if (!trimmed && !options.allowEmpty) throw formatInvalid(SL.fieldEmpty({ field }), { field });
  if ([...trimmed].length > max) throw formatInvalid(SL.fieldTooLong({ field, max }), { field });
  return trimmed;
}

/** A term is one line of text: it cannot contain line breaks. */
function term(value: unknown, field: string): string {
  const t = text(value, field, MAX_TERM_CHARS);
  if (/[\r\n]/.test(t)) throw formatInvalid(SL.fieldNoNewline({ field }), { field });
  return t;
}

function languageOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return language(value, field);
}

function language(value: unknown, field: string): string {
  if (typeof value !== 'string') throw formatInvalid(SL.fieldNotLanguageTag({ field }), { field });
  try {
    const [canonical] = Intl.getCanonicalLocales(value.trim());
    if (canonical) return canonical;
  } catch {
    // The errors below are reported uniformly.
  }
  throw formatInvalid(SL.fieldBadLanguageTag({ field, value }), { field });
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw formatInvalid(SL.fieldNotBoolean({ field }), { field });
  return value;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw formatInvalid(SL.fieldNotObject({ field }), { field });
  return value as Record<string, unknown>;
}

function list(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw formatInvalid(SL.fieldNotArray({ field }), { field });
  if (value.length > max) throw formatInvalid(SL.fieldTooMany({ field, max }), { field });
  return value;
}

/** Glossary: trims leading and trailing whitespace. Removes duplicate mishearings and any that match the canonical spelling. Rejects the glossary if the same canonical spelling (or source term) appears twice. */
export function normalizeGlossary(value: unknown): GlossaryContent {
  const v = object(value, 'content');
  const name = text(v.name, 'name', MAX_NAME_CHARS);
  const defaultEnabled = bool(v.defaultEnabled, 'defaultEnabled');
  if (v.kind === 'transcription') {
    const seen = new Set<string>();
    const terms = list(v.terms, 'terms', MAX_TERMS).map((raw, i) => {
      const t = object(raw, `terms[${i}]`);
      const canonical = term(t.canonical, `terms[${i}].canonical`);
      if (seen.has(canonical)) throw formatInvalid(SL.duplicateCanonical({ term: canonical }), { field: `terms[${i}].canonical` });
      seen.add(canonical);
      const misheard = [
        ...new Set(list(t.misheard, `terms[${i}].misheard`, MAX_MISHEARD_PER_TERM).map((m, j) => term(m, `terms[${i}].misheard[${j}]`))),
      ].filter((m) => m !== canonical);
      return { canonical, misheard };
    });
    return { name, kind: 'transcription', language: languageOrNull(v.language, 'language'), defaultEnabled, terms };
  }
  if (v.kind === 'translation') {
    const seen = new Set<string>();
    const terms = list(v.terms, 'terms', MAX_TERMS).map((raw, i) => {
      const t = object(raw, `terms[${i}]`);
      const source = term(t.source, `terms[${i}].source`);
      if (seen.has(source)) throw formatInvalid(SL.duplicateSource({ term: source }), { field: `terms[${i}].source` });
      seen.add(source);
      const note = t.note === null || t.note === undefined ? '' : text(t.note, `terms[${i}].note`, MAX_NOTE_CHARS, { allowEmpty: true });
      return { source, target: term(t.target, `terms[${i}].target`), note: note || null };
    });
    return {
      name,
      kind: 'translation',
      sourceLanguage: languageOrNull(v.sourceLanguage, 'sourceLanguage'),
      targetLanguage: language(v.targetLanguage, 'targetLanguage'),
      defaultEnabled,
      terms,
    };
  }
  throw formatInvalid(SL.glossaryKind(), { field: 'kind' });
}

/** Fields the user provides for a voice (the library handles the reference recording and the consent time). */
export interface VoiceFields {
  name: string;
  language: string | null;
  transcript: string;
  origin: 'recorded' | 'imported';
  consent: { declared: boolean; statement: string | null };
}

export function normalizeVoiceFields(value: unknown): VoiceFields {
  const v = object(value, 'content');
  if (v.origin !== 'recorded' && v.origin !== 'imported') throw formatInvalid(SL.voiceOrigin(), { field: 'origin' });
  const consent = object(v.consent, 'consent');
  const statement =
    consent.statement === null || consent.statement === undefined
      ? null
      : text(consent.statement, 'consent.statement', MAX_STATEMENT_CHARS, { allowEmpty: true }) || null;
  return {
    name: text(v.name, 'name', MAX_NAME_CHARS),
    language: languageOrNull(v.language, 'language'),
    transcript: text(v.transcript, 'transcript', MAX_TRANSCRIPT_CHARS, { allowEmpty: true }),
    origin: v.origin,
    consent: { declared: bool(consent.declared, 'consent.declared'), statement },
  };
}

/** The part of a brand library entry that has no files. Kinds that carry files have only a name. `overlayTemplate` is rejected. */
export type BrandFields =
  | { name: string; kind: BrandMediaKind }
  | { name: string; kind: 'color'; value: string }
  | { name: string; kind: 'captionStyle'; style: CaptionStyleBody };

export function normalizeBrandFields(value: unknown): BrandFields {
  const v = object(value, 'content');
  const name = text(v.name, 'name', MAX_NAME_CHARS);
  if (v.kind === 'overlayTemplate') {
    throw libraryError(
      'LIBRARY_KIND_RESERVED',
      'invalid-request',
      SL.overlayTemplateReserved(),
      { kind: 'overlayTemplate' },
    );
  }
  if (typeof v.kind === 'string' && isBrandMediaKind(v.kind)) return { name, kind: v.kind };
  if (v.kind === 'color') {
    if (typeof v.value !== 'string' || !/^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(v.value)) {
      throw formatInvalid(SL.colorFormat(), { field: 'value' });
    }
    return { name, kind: 'color', value: v.value.toUpperCase() };
  }
  if (v.kind === 'captionStyle') {
    const style = object(v.style, 'style');
    if (typeof style.schema !== 'string' || !style.schema.trim()) {
      throw formatInvalid(SL.captionStyleSchema(), { field: 'style.schema' });
    }
    if (Buffer.byteLength(JSON.stringify(style)) > MAX_CAPTION_STYLE_BYTES) {
      throw formatInvalid(SL.captionStyleTooLarge({ kib: MAX_CAPTION_STYLE_BYTES / 1024 }), { field: 'style' });
    }
    return { name, kind: 'captionStyle', style: style as CaptionStyleBody };
  }
  throw formatInvalid(SL.brandKind(), { field: 'kind' });
}

/** Display name and kind of an entry (for lists). */
export function kindOf(library: LibraryName, content: LibraryContentInput): string {
  return library === 'voices' ? 'voice' : (content as { kind: string }).kind;
}
