import type { EditOperation, Id } from '@cuccut/protocol';
import type { AsrResult } from '@cuccut/models';
import { JobsSpeechDocument as J } from '@cuccut/protocol/messages/jobs/speech-document.ts';

/**
 * `asr-result` → `speech` document (the “apply to video” step in architecture design §6.6). The body matches the `cuccut.speech/1` written by the legacy project importer (`scripts/legacy-import/ccut-project.ts`): the vocabulary, speakers, `sentences: null` (sentence segmentation is filled in by a later step), and empty chapters. The words of each segment are appended in order to the vocabulary. When a segment has no word-level timing, the whole segment text is taken as one word that covers this segment, marked `timingQuality: 'missing'`.
 * Words whose timing is untrustworthy (`estimated` interpolation, `missing`) carry `timingQuality`, so export does not treat them as word-synced (acceptance AT-05). Aligned words and words provided by the service do not write this field.
 */

export interface SpeechDocumentContext {
  assetId: Id;
  jobId: Id;
  /** The Provider that ran this transcription (`local` or `node:<nodeId>`): the document records the route the job took, not a name the node reported about itself. */
  providerId: string;
  inputHash: string;
  rawResultArtifactId: string;
  createdAt: string;
  /** Prefix for word IDs, default `w-`. When a different transcript is used, supply another one so new word IDs do not duplicate the old transcript's (video format spec §5.3). */
  wordIdPrefix?: string;
}

export interface SpeechWord {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  /** Only appears when word timing is untrustworthy. */
  timingQuality?: 'estimated' | 'missing';
}

export function speechWords(result: AsrResult, prefix = 'w-'): SpeechWord[] {
  const words: SpeechWord[] = [];
  const push = (start: number, end: number, text: string, speaker: string | null, quality: string) => {
    words.push({
      id: `${prefix}${String(words.length + 1).padStart(6, '0')}`,
      start,
      end,
      text,
      ...(speaker ? { speaker } : {}),
      ...(quality === 'estimated' || quality === 'missing' ? { timingQuality: quality } : {}),
    });
  };
  for (const segment of result.segments) {
    if (segment.words.length === 0) push(segment.start, segment.end, segment.text.trim(), segment.speakerId, 'missing');
    // When speaker diarization has tagged words with speakers (§6.6), use the per-word speaker; otherwise use the segment's.
    else for (const word of segment.words) push(word.start, word.end, word.text, word.speakerId ?? segment.speakerId, word.timingQuality);
  }
  return words;
}

export function speechDocumentOperation(
  result: AsrResult,
  context: SpeechDocumentContext,
): Extract<EditOperation, { type: 'putDocument' }> {
  const words = speechWords(result, context.wordIdPrefix);
  const speakers = result.speakers.map((s, i) => ({ id: s.id, name: s.label ?? J.speakerName({ n: i + 1 }).text }));
  const language = result.language.tag;
  const p = result.provenance;
  return {
    type: 'putDocument',
    ref: 'speech',
    kind: 'speech',
    name: J.documentName().text,
    ...(language ? { language } : {}),
    sourceAsset: { assetId: context.assetId },
    body: {
      schema: 'cuccut.speech/1',
      clock: 'source-asset',
      timescale: result.timescale,
      engine: {
        provider: context.providerId,
        bundleId: p.bundleId,
        models: p.models,
        backend: p.backend,
        device: p.device,
        workerVersion: p.workerVersion,
        ...(p.cost ? { cost: p.cost } : {}),
      },
      createdAt: context.createdAt,
      speakers,
      words,
      sentences: null,
      chapters: [],
    },
    summary: {
      wordCount: words.length,
      speakerCount: speakers.length,
      sentenceCount: null,
      chapterCount: 0,
      language,
    },
    extensions: {
      rawResultArtifactId: context.rawResultArtifactId,
      asrOutcome: result.outcome,
      language: result.language,
      warnings: result.warnings,
      jobId: context.jobId,
      inputHash: context.inputHash,
    },
  };
}
