import type { DocumentRecord, EditOperation, Id, Sequence } from '@cuccut/protocol';
import { defaultStyleName } from './caption-presets.ts';
import type { CaptionChip } from './caption-tracks.ts';
import { DEFAULT_CAPTION_STYLE } from './property-values.ts';
import {
  CUE_PARAMS,
  captionPlacement,
  deriveCues,
  splitUntimed,
  type CueParams,
  type DerivedCue,
  type SpeechWord,
  type SpeechWords,
} from './speech-cues.ts';
import { unitText, type TranslationUnit } from './translation-doc.ts';

/**
 * Translation → captions (product design S02, architecture design §10.3): the timing of a translated sentence is taken from the timing of the member words of that source sentence (asset clock, the same clock as the generated source captions,
 * projected onto the sequence through the instance, and following along when media is cut, split or deleted). Translated text is cut into cues by the same rules as speech-cues.ts
 * (`splitUntimed` splits on whitespace and punctuation, timing is interpolated by display width, `deriveCues` cuts greedily, no cue longer than 7 seconds), so the number of translated cues
 * and their line breaks may differ from the source, but a cue never crosses out of its source sentence.
 *
 * A caption cue's ID is `q-<unit ID>`, optionally followed by `~n` (the cue that starts the n-th block split out of the same sentence). When a translated sentence is edited, its
 * cues are found by this prefix and only those cues are replaced (`retextCaption`).
 *
 * The agent's `captions_create` uses the same cutting in the Runtime: `translationCues` in `packages/jobs/src/pipelines/caption-cues.ts` is a port of this, and the transaction is the same as `translationCaptionOperations` (`caption-layer.ts`). They are not merged into one copy: the UI cannot depend on jobs that only run in Node, and jobs do not depend on the UI (architecture design §14 “caption layer for transcription tools”); when the cutting changes, both places change together.
 */

type Json = Record<string, unknown>;

export const TRANSLATION_CAPTION_EXTENSION = 'cuccut.translationCues';

/** `w12~3` (a block split out of a paragraph with no word timing) → `w12`. */
const baseWordId = (id: string) => id.replace(/~\d+$/, '');

/** Translation unit → caption cues (asset clock, seconds). Units marked stale and units without a translation produce no captions (same rule as text export); nor do units whose source words cannot all be found. */
export function translationCues(speech: SpeechWords, units: readonly TranslationUnit[], params: CueParams = CUE_PARAMS): DerivedCue[] {
  const byBase = new Map<string, SpeechWord[]>();
  for (const word of speech.words) {
    const base = baseWordId(word.id);
    byBase.set(base, [...(byBase.get(base) ?? []), word]);
  }
  const pseudo: SpeechWord[] = [];
  for (const unit of units) {
    const text = unitText(unit);
    if (unit.status === 'stale' || !text) continue;
    const words = (unit.alignment?.sourceWordIds ?? []).flatMap((id) => byBase.get(id) ?? []);
    if (!words.length) continue;
    const start = Math.min(...words.map((w) => w.start));
    const end = Math.max(...words.map((w) => w.end));
    const speaker = words.find((w) => w.start === start)!.speaker;
    splitUntimed(text, start, end, params.maxChars).forEach((piece, n) => {
      pseudo.push({
        id: n === 0 ? unit.id : `${unit.id}~${n + 1}`,
        start: piece.start,
        end: piece.end,
        text: piece.text.trim(),
        ...(speaker !== undefined ? { speaker } : {}),
        // A translated sentence stands on its own: it is not joined into one cue with adjacent translations.
        sentenceId: unit.id,
        paragraphStart: false,
      });
    });
  }
  return deriveCues(pseudo, params);
}

/** Whether a caption cue belongs to this translated sentence: after `q-<unit ID>` it either ends, or is immediately followed by `~` (so `t-s-w1` does not swallow `t-s-w10`). */
export function cueOfUnit(cueId: string, unitId: Id): boolean {
  const base = `q-${unitId}`;
  if (!cueId.startsWith(base)) return false;
  const rest = cueId.slice(base.length);
  return rest === '' || rest[0] === '~';
}

interface BodyCue {
  id?: unknown;
  start: number;
  end: number;
  text?: unknown;
  speaker?: unknown;
}

/**
 * Caption body after a translated sentence is edited: removes the sentence's original cues, puts back the cues re-cut from the new translation in their place (if there were none, inserts them by time),
 * then fixes overlaps using the rounding rules of `speechCaptionBody`. Other cues are left untouched, including text that was edited by hand.
 */
export function retextCaption(body: Json, unitId: Id, fresh: readonly DerivedCue[], speakers: ReadonlyMap<string, string>): Json {
  const scale = typeof body.timescale === 'number' && body.timescale > 0 ? body.timescale : 1000;
  const cues = (Array.isArray(body.cues) ? body.cues : []) as BodyCue[];
  const firstOld = cues.findIndex((cue) => typeof cue.id === 'string' && cueOfUnit(cue.id, unitId));
  const kept = cues.filter((cue) => !(typeof cue.id === 'string' && cueOfUnit(cue.id, unitId)));
  // New cues get a speaker only if the original had one (a video with one speaker does not write one).
  const withSpeaker = cues.some((cue) => typeof cue.speaker === 'string');
  const made: BodyCue[] = fresh.map((cue) => ({
    id: cue.id,
    start: Math.round(cue.start * scale),
    end: Math.round(cue.end * scale),
    text: cue.text,
    ...(withSpeaker && cue.speaker !== undefined ? { speaker: speakers.get(cue.speaker) ?? cue.speaker } : {}),
  }));
  let at: number;
  if (firstOld >= 0) at = cues.slice(0, firstOld).filter((cue) => !(typeof cue.id === 'string' && cueOfUnit(cue.id, unitId))).length;
  else {
    const from = made[0]?.start ?? 0;
    at = kept.findIndex((cue) => cue.start > from);
    if (at < 0) at = kept.length;
  }
  const merged = [...kept.slice(0, at), ...made, ...kept.slice(at)].map((cue) => ({ ...cue }));
  merged.forEach((cue, i) => {
    const next = merged[i + 1];
    if (next && cue.end > next.start) cue.end = next.start;
    if (cue.end <= cue.start) cue.end = cue.start + 1;
    if (next && next.start < cue.end) next.start = cue.end;
  });
  return { ...body, cues: merged };
}

/**
 * The source caption paired with a translation: the one generated from the same transcript; otherwise the first source caption on the picture. null when neither exists.
 */
export function pairedOriginal(chips: readonly CaptionChip[], documents: Record<Id, DocumentRecord>, speechDocumentId: Id): CaptionChip | null {
  const originals = chips.filter((chip) => chip.kind === 'original');
  return (
    originals.find((chip) => documents[chip.documentId]?.sourceDocumentId === speechDocumentId) ??
    originals.find((chip) => chip.state !== 'shelved') ??
    null
  );
}

export interface TranslationCaptionSource {
  translationDocumentId: Id;
  translationRevision: string;
  speechDocumentId: Id;
  speechRevision: string;
  assetId: Id;
  language: string;
  /** Names for the caption document, the caption instance and the new track. */
  name: string;
  /** Shown together with the source (bilingual); otherwise only the translation is shown, and the source is taken off the picture (not deleted). */
  bilingual: boolean;
}

const TRACK_REF = 'translation-track';
const DOCUMENT_REF = 'translation-caption';
const STYLE_REF = 'translation-style';

/**
 * A single transaction that puts the translation on the picture (one undo reverts it all): creates a new caption track (one per language), writes the caption document (asset clock, derived from the translation document,
 * recording the asset and which translation and transcript version it came from), and places a caption instance: the target instance and range are those of the source captions generated together (`captionPlacement`).
 *
 * The render kernel stacks captions into a group by style document (`styleDocumentId ?? itemId` in `crates/frame-render`), so:
 * - Bilingual: shares one style with the paired source. It uses the source's style if it has one, otherwise creates a default style; source and translation are both used, and a source that was taken off is put back.
 * - Translation only: the paired source is taken off the picture. If the source has a style, the translation uses it too, so putting the source back later naturally stacks them into bilingual.
 * When the paired source is locked, it is not touched (the engine would reject it); it is only shared when it has a style.
 */
export function translationCaptionOperations(
  sequence: Sequence,
  body: Json,
  source: TranslationCaptionSource,
  paired: CaptionChip | null,
): EditOperation[] {
  const cues = Array.isArray(body.cues) ? body.cues : [];
  const operations: EditOperation[] = [
    { type: 'addTrack', sequenceId: sequence.id, kind: 'subtitle', ref: TRACK_REF, name: source.name },
    {
      type: 'putDocument',
      ref: DOCUMENT_REF,
      kind: 'caption',
      name: source.name,
      language: source.language,
      sourceAsset: { assetId: source.assetId },
      sourceDocument: { documentId: source.translationDocumentId },
      body,
      summary: { cueCount: cues.length },
      extensions: {
        [TRANSLATION_CAPTION_EXTENSION]: {
          translationDocumentId: source.translationDocumentId,
          translationRevision: source.translationRevision,
          speechDocumentId: source.speechDocumentId,
          speechRevision: source.speechRevision,
          assetId: source.assetId,
        },
      },
    },
  ];
  const touch = paired && !paired.locked ? paired : null;
  let style: { styleDocumentId: Id } | { styleDocumentRef: string } | null = paired?.styleDocumentId
    ? { styleDocumentId: paired.styleDocumentId }
    : null;
  if (source.bilingual && touch) {
    if (!style) {
      operations.push({ type: 'putDocument', ref: STYLE_REF, kind: 'caption-style', name: defaultStyleName(), body: DEFAULT_CAPTION_STYLE });
      for (const itemId of touch.itemIds) {
        operations.push({ type: 'setCaptionStyle', sequenceId: sequence.id, itemId, styleDocument: { ref: STYLE_REF } });
      }
      style = { styleDocumentRef: STYLE_REF };
    }
    if (touch.state === 'shelved') {
      for (const itemId of touch.itemIds) operations.push({ type: 'updateItem', sequenceId: sequence.id, itemId, enabled: true });
    }
  } else if (!source.bilingual && touch && touch.state !== 'shelved') {
    for (const itemId of touch.itemIds) operations.push({ type: 'updateItem', sequenceId: sequence.id, itemId, enabled: false });
  }
  const { span, scopeItemIds } = captionPlacement(sequence, source.assetId, body);
  operations.push({
    type: 'insertItems',
    sequenceId: sequence.id,
    items: [
      {
        type: 'caption',
        name: source.name,
        span,
        documentRef: DOCUMENT_REF,
        trackRef: TRACK_REF,
        ...(scopeItemIds.length ? { scopeItemIds } : {}),
        ...(style ?? {}),
      },
    ],
  });
  return operations;
}

/** Whether the caption document was generated from this translation (only then is it updated along with translation edits; captions cut differently by someone else are left alone). */
export function derivedFrom(record: DocumentRecord, translationDocumentId: Id): boolean {
  const ext = record.extensions?.[TRANSLATION_CAPTION_EXTENSION] as { translationDocumentId?: unknown } | undefined;
  return record.kind === 'caption' && record.sourceDocumentId === translationDocumentId && ext?.translationDocumentId === translationDocumentId;
}
