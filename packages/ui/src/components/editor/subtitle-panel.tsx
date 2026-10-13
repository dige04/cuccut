import { newCaptionStyle } from '../../state/caption-preferences-store.ts';
import { withNewCaptionStyle } from '../../model/caption-preferences.ts';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { AssetRecord, CaptionItem, DocumentRecord, Id, Localized, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ActionButton, Button, TextField, ToastQueue, ToggleButton, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronUp from '@react-spectrum/s2/icons/ChevronUp';
import Close from '@react-spectrum/s2/icons/Close';
import Import from '@react-spectrum/s2/icons/Import';
import Search from '@react-spectrum/s2/icons/Search';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { captionChips, onScreen } from '../../model/caption-tracks.ts';
import { placedCues } from '../../model/caption-cues.ts';
import {
  guessLanguage,
  importCaptionOperations,
  listCues,
  mergeCue,
  readingSpeed,
  setCueTexts,
  splitCue,
  type CueList,
  type ListCue,
} from '../../model/cue-edit.ts';
import { formatClock } from '../../model/format.ts';
import { countSentences } from '../../model/speech-cues.ts';
import { decodeSubtitleText, parseSubtitles, subtitleFormatOf } from '../../model/subtitles.ts';
import { compileFind, findRanges, replaceRanges, stepIndex, type FindOptions, type TextRange } from '../../model/text-find.ts';
import { pairedOriginal } from '../../model/translation-cues.ts';
import { estimateLines } from '../../model/virtual-rows.ts';
import { readCaptions } from '../../render/captions.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { CaptionGallery, openGallery, useCaptionGallery } from './caption-gallery.tsx';
import { useEditorActions } from './editor-context.tsx';
import { usePlaybackFollow } from './use-playback-follow.ts';
import { PanelHead } from './panel-head.tsx';
import { SUBTITLE_COPY as C } from './subtitle-copy.ts';
import { SubtitleEmpty } from './subtitle-empty.tsx';
import { SubtitleLive } from './subtitle-live.tsx';
import { SubtitleStrip } from './subtitle-strip.tsx';
import { useDocumentBody } from './use-document-body.ts';
import { TranscribeProblemAlert, TranscribeProgress } from './transcribe-progress.tsx';
import { TRANSLATE_COPY } from './translate-copy.ts';
import { TranslateFlow } from './translate-flow.tsx';
import { bindTranslate, openFlow, setCompare, useTranslateRun, type CompareMode } from './translate-run.ts';
import { liveChip, TranslateProblemAlert, TranslateReceiptCard, TranslateRunHead, useTranslateLive } from './translate-status.tsx';
import { CompareBar, TranslationList } from './translation-list.tsx';
import { useVirtualRows } from './use-virtual-rows.ts';
import {
  awaitingDecision,
  bindTranscribe,
  chooseChip,
  clearFocus,
  decisionProblem,
  focusDocument,
  transcribeStepJob,
  useSubtitleRun,
  type TranscribeDeps,
} from './transcribe-run.ts';

type Json = Record<string, unknown>;

const SUBTITLE_FILES = '.srt,.vtt,.ass,.ssa';

const statbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  paddingX: 12,
  paddingY: 4,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  font: 'ui-xs',
  color: 'gray-600',
});
const warn = style({ color: 'orange-1000', fontWeight: 'medium' });
const tail = style({ marginStart: 'auto', color: 'gray-500' });
const findbar = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '[6px]',
  flexShrink: 0,
  paddingX: 12,
  paddingY: 8,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-50',
});
const findRow = style({ display: 'flex', alignItems: 'center', gap: '[6px]' });
const findField = style({ flexGrow: 1, minWidth: 0 });
const findCount = style({
  flexShrink: 0,
  minWidth: 44,
  textAlign: 'end',
  font: 'ui-xs',
  color: { default: 'gray-600', isBad: 'red-1000' },
});
const findNote = style({ paddingX: 8, paddingY: 4, borderRadius: 'default', backgroundColor: 'red-100', font: 'ui-xs', color: 'red-1100' });
const list = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingBottom: 12 });
/** One cue (prototype .sb): a colored bar on the left, the cue being played gets a blue background, the cue being edited gets a blue border. The 8px gap to the previous card is supplied by `cueSlot`. */
const cueCard = style({
  position: 'relative',
  overflow: 'hidden',
  paddingY: '[9px]',
  paddingStart: '[12px]',
  paddingEnd: '[10px]',
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-200', isOn: 'blue-400', isEditing: 'blue-800' },
  backgroundColor: { default: 'gray-25', isOn: 'blue-100' },
});
/** The style macro has no per-edge border colors: the colored bar on the left is drawn as its own block. */
const cueAccent = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  insetStart: 0,
  width: '[3px]',
  backgroundColor: { default: 'gray-300', isOn: 'blue-800', isEditing: 'blue-800' },
});
const cueHead = style({ display: 'flex', alignItems: 'center', gap: '[6px]', marginBottom: '[5px]', minHeight: 20 });
const cueNumber = style({ fontSize: '[10px]', color: 'gray-500', minWidth: 16 });
const speaker = style({
  font: 'ui-xs',
  fontWeight: 'bold',
  color: 'gray-800',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const cueTime = style({
  padding: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
  font: 'ui-xs',
  color: { default: 'gray-500', isMissing: 'gray-400' },
  cursor: { default: 'pointer', isMissing: 'default' },
  textDecoration: { isHovered: 'underline' },
  borderRadius: 'sm',
  outlineStyle: { default: 'none', ':focus-visible': 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
});
const cps = style({
  marginStart: 'auto',
  fontSize: '[10px]',
  color: { default: 'gray-500', level: { warn: 'orange-1000', bad: 'red-1000' } },
  fontWeight: { default: 'normal', level: { warn: 'bold', bad: 'bold' } },
});
const cueText = style({
  display: 'block',
  font: 'body-sm',
  lineHeight: '[1.6]',
  color: 'gray-800',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  cursor: 'text',
  borderRadius: 'sm',
  outlineStyle: { default: 'none', ':focus-visible': 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
});
const editor = style({
  display: 'block',
  boxSizing: 'border-box',
  width: 'full',
  margin: 0,
  padding: 0,
  borderWidth: 0,
  outlineStyle: 'none',
  resize: 'none',
  overflow: 'hidden',
  backgroundColor: 'transparent',
  font: 'body-sm',
  lineHeight: '[1.6]',
  color: 'gray-900',
});
const mark = style({ borderRadius: 'sm', backgroundColor: { default: 'yellow-200', isCurrent: 'orange-400' }, color: 'gray-900' });
const muted = style({ font: 'ui-sm', color: 'gray-600', paddingY: 24, textAlign: 'center' });
/**
 * One row of the virtual list: a cue card together with the seam on its top edge (`cueCard` clips overflow, so the button straddling the edge can only hang outside the card). Rows must not have
 * margins between them (the virtual list lays rows out by border-box height); the gap between cards is this layer's 8px top padding, and the first card is also 8px from the top.
 */
const cueSlot = style({ position: 'relative', paddingTop: 8 });
/** “merge into previous” (prototype ui.css .sbseam): straddles the card's top edge and only appears on hover (.cc-cue-seam in editor.css); it takes no layout space. */
// The card's top edge is 8px below the top of this layer: the button is 20px tall with its top at -2px, so it straddles the line exactly (the focus ring also reaches 4px into the row above, overlapping it).
const seamRow = style({
  position: 'absolute',
  top: '[-2px]',
  insetStart: 0,
  insetEnd: 0,
  zIndex: 2,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
});
const seamPill = style({
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  height: 20,
  boxSizing: 'border-box',
  paddingStart: '[6px]',
  paddingEnd: '[9px]',
  paddingY: 0,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-300', isHovered: 'blue-400', isDisabled: 'gray-200' },
  borderRadius: 'full',
  backgroundColor: { default: 'gray-25', isHovered: 'blue-100' },
  fontSize: '[11px]',
  color: { default: 'blue-1000', isDisabled: 'gray-500' },
  cursor: { default: 'pointer', isDisabled: 'default' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
/**
 * Estimated height of a row (used until it is measured): top padding 8 + card border 2 + top and bottom padding 18 + card header 20 + space below the header 5; body text is 22.4 per line (14px × 1.6),
 * and the body is 24 narrower than the list content (border 2, left and right padding 12 and 10).
 */
const ROW_BASE = 53;
const TEXT_SIZE = 14;
const TEXT_LINE = 22.4;
const CARD_INSET = 24;

function captionItemsOf(sequence: Sequence): CaptionItem[] {
  const order = new Map(sequence.tracks.map((track) => [track.id, track.order]));
  return sequence.items
    .filter((item): item is CaptionItem => item.type === 'caption')
    .sort((a, b) => (order.get(a.trackId) ?? 0) - (order.get(b.trackId) ?? 0) || a.span.fromFrame - b.span.fromFrame);
}

/** Notice when transcription finishes: successful ones have an “Undo”. */
const transcribeToast: TranscribeDeps['toast'] = (kind, message, undo) =>
  ToastQueue[kind](message, undo ? { timeout: 5000, actionLabel: C.undo, onAction: undo, shouldCloseOnAction: true } : { timeout: 5000 });

/**
 * Subtitle panel (prototype §13.2, panel-subtitle.jsx): one subtitle document is one list of cues; editing text, splitting, merging, and find-and-replace are each written as a new version of that document,
 * one action per undo entry. At the top are the style entry card and the track strip for “on the picture”; the track strip is the only way to pick which subtitle to proofread. When there are no subtitles yet,
 * “transcribes the clips on the timeline and cuts them into subtitles” or importing a subtitle file (SRT, WebVTT, ASS); while transcribing, the task's stage and progress are shown.
 */
export function SubtitlePanel({
  sequence,
  assets,
  documents,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
}) {
  const runtime = useRuntime();
  useEffect(() => bindTranscribe({ runtime, toast: transcribeToast }), [runtime]);
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const items = useMemo(() => captionItemsOf(sequence), [sequence]);
  const chips = useMemo(() => captionChips(sequence, documents), [sequence, documents]);
  const chosen = useSubtitleRun((s) => (videoId ? s.chosen[videoId] : undefined));
  const focus = useSubtitleRun((s) => (videoId ? s.focus[videoId] : undefined));
  const run = useSubtitleRun((s) => (videoId ? (s.runs[videoId] ?? null) : null));
  const problem = useSubtitleRun((s) => (videoId ? (s.problems[videoId] ?? null) : null));
  // The task for this round; when no round is running, check whether something elsewhere (an agent, the command line) is transcribing this video.
  const job = useJobs((s) =>
    run
      ? run.jobId
        ? (s.jobs.find((j) => j.jobId === run.jobId) ?? null)
        : null
      : (s.jobs.find((j) => j.kind === 'transcribe' && j.videoId === videoId && (isJobLive(j) || j.state === 'needs-reconciliation')) ??
        null),
  );
  // Submissions from here are the transcription flow (the parent task): progress follows the `transcribe` Job submitted by its transcription step, and cancelling cancels the parent task.
  const step = useJobs((s) => (job ? transcribeStepJob(job, s.jobs) : null));
  const live = !!run || !!job;
  // Transcriptions waiting for the user to decide in a background task (started elsewhere): no progress is drawn, just point to it. Ones started from here have already wrapped up into an issue card, so they are not drawn again.
  const deciding = job && awaitingDecision(job) && problem?.kind !== 'decide' ? job : null;

  // The one just generated or imported: the track strip selects it.
  useEffect(() => {
    if (!videoId || !focus) return;
    const target = chips.find((c) => c.documentId === focus);
    if (!target) return;
    chooseChip(videoId, target.key);
    clearFocus(videoId);
  }, [videoId, focus, chips]);

  const current = chips.find((c) => c.key === chosen && c.state !== 'shelved') ?? onScreen(chips)[0] ?? chips[0] ?? null;
  const record = current ? documents[current.documentId] : undefined;
  const importer = useCaptionImport(sequence, (documentId) => videoId && focusDocument(videoId, documentId));

  // Translation: the settings page (a sub-page pushed in), the running state, issues and receipts, and the comparison bar.
  useEffect(() => bindTranslate({ runtime, toast: transcribeToast }), [runtime]);
  const flowOpen = useTranslateRun((s) => (videoId ? !!s.flow[videoId] : false));
  const galleryOpen = useCaptionGallery((s) => (videoId ? !!s.open[videoId] : false));
  const compare = useTranslateRun((s) => (videoId ? s.compare[videoId] : undefined));
  const translateProblem = useTranslateRun((s) => (videoId ? (s.problems[videoId] ?? null) : null));
  const receipt = useTranslateRun((s) => (videoId ? (s.receipts[videoId] ?? null) : null));
  const translating = useTranslateLive(videoId);
  const translations = useMemo(() => Object.values(documents).filter((d) => d.kind === 'translation'), [documents]);
  const compared = translations.find((d) => d.id === compare?.documentId) ?? translations[0] ?? null;
  /** The `translation` document for a translation chip; null for a source chip. */
  const translationOf = (key: string | undefined) => {
    const chip = chips.find((c) => c.key === key);
    return chip?.kind === 'translation' ? (documents[chip.documentId]?.sourceDocumentId ?? null) : null;
  };
  // When only the source is shown, the list is the source document: if a translation track is selected, use its paired source track (the style being edited is still the selected track).
  const currentTranslation = translationOf(current?.key);
  const original = currentTranslation
    ? pairedOriginal(chips, documents, documents[currentTranslation]?.sourceDocumentId ?? '')
    : current;
  const originalRecord = original ? documents[original.documentId] : undefined;
  const preferred: CompareMode = compared ? (compare?.mode ?? 'src') : 'src';
  // When there is no source to show on the picture (only translation tracks remain, or it has not been placed on the picture yet), the list falls on the translation.
  const mode: CompareMode = preferred === 'src' && !originalRecord && compared ? 'trans' : preferred;
  const select = (key: string) => {
    if (!videoId) return;
    // Selecting a translation track switches the comparison bar to that language, and if only the source was showing, also switches to bilingual (prototype BC_SUBLIST.onPick). Selecting a source track leaves the list as it is.
    const translation = translationOf(key);
    if (translation && documents[translation]) setCompare(videoId, { mode: mode === 'src' ? 'bi' : mode, documentId: translation });
    chooseChip(videoId, key);
  };
  const changeMode = (next: CompareMode) => {
    if (!videoId) return;
    if (next !== 'src' && !compared) {
      ToastQueue.neutral(TRANSLATE_COPY.noTranslation, { timeout: 4000 });
      return;
    }
    setCompare(videoId, { mode: next, documentId: compared?.id ?? null });
  };

  if (flowOpen && videoId) {
    return <TranslateFlow videoId={videoId} documents={documents} onBack={() => openFlow(videoId, false)} onStarted={() => openFlow(videoId, false)} />;
  }
  if (galleryOpen && videoId && current) {
    return (
      <CaptionGallery videoId={videoId} sequence={sequence} documents={documents} chips={chips} selected={current.key} onBack={() => openGallery(videoId, false)}>
        <SubtitleStrip noCard sequence={sequence} documents={documents} chips={chips} selected={current.key} onSelect={select} onTranslate={() => openFlow(videoId, true)} running={liveChip(translating)} />
      </CaptionGallery>
    );
  }

  return (
    <>
      <PanelHead title={C.panelTitle}>
        {record ? (
          <TooltipTrigger>
            <ActionButton isQuiet size="S" aria-label={C.importFile} isDisabled={!importer.editable} onPress={importer.open}>
              <Import />
            </ActionButton>
            <Tooltip>{C.importFileTip}</Tooltip>
          </TooltipTrigger>
        ) : null}
      </PanelHead>
      {importer.input}
      {problem && videoId ? <TranscribeProblemAlert videoId={videoId} problem={problem} /> : null}
      {deciding && videoId ? (
        <TranscribeProblemAlert videoId={videoId} problem={decisionProblem(deciding)} onDismiss={null} />
      ) : live ? (
        <TranscribeProgress
          run={run}
          job={job && step && isJobLive(step) ? step : job}
          cancelJobId={job?.jobId ?? null}
          assetName={run?.assetName ?? (job?.assetId ? (assets[job.assetId]?.name ?? null) : null)}
        />
      ) : null}
      {translateProblem && videoId ? <TranslateProblemAlert videoId={videoId} problem={translateProblem} /> : null}
      {receipt && videoId ? <TranslateReceiptCard videoId={videoId} receipt={receipt} /> : null}
      {translating ? <TranslateRunHead live={translating} documents={documents} /> : null}
      {(record && current) || compared ? (
        <>
          <SubtitleStrip
            sequence={sequence}
            documents={documents}
            chips={chips}
            selected={current?.key ?? null}
            onSelect={select}
            onTranslate={videoId ? () => openFlow(videoId, true) : undefined}
            running={liveChip(translating)}
          />
          <CompareBar
            mode={mode}
            translations={translations}
            compared={compared}
            onMode={changeMode}
            onPick={(documentId) => videoId && setCompare(videoId, { mode, documentId })}
          />
          {mode !== 'src' && compared && videoId ? (
            <TranslationList key={compared.id} videoId={videoId} sequence={sequence} documents={documents} record={compared} only={mode === 'trans' ? 'trans' : null} />
          ) : originalRecord ? (
            <CueEditor
              key={originalRecord.id}
              record={originalRecord}
              sequence={sequence}
              items={items.filter((item) => item.documentId === originalRecord.id)}
            />
          ) : null}
        </>
      ) : live ? (
        deciding ? null : <SubtitleLive jobId={step?.jobId ?? (job?.kind === 'transcribe' ? job.jobId : null)} sequence={sequence} />
      ) : !videoId ? null : (
        <SubtitleEmpty
          videoId={videoId}
          sequence={sequence}
          assets={assets}
          documents={documents}
          editable={importer.editable}
          busy={live}
          onImport={importer.open}
        />
      )}
    </>
  );
}

/** Pick a subtitle file, read it, and in one transaction turn it into a document plus a subtitle instance. The host has no file-reading interface, so it uses the browser's file picker. */
function useCaptionImport(sequence: Sequence, onImported: (documentId: Id) => void) {
  const { apply, undo } = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const ref = useRef<HTMLInputElement>(null);
  const read = async (file: File) => {
    const format = subtitleFormatOf(file.name);
    if (!format) {
      ToastQueue.negative(C.importUnsupported, { timeout: 5000 });
      return;
    }
    const cues = parseSubtitles(decodeSubtitleText(new Uint8Array(await file.arrayBuffer())), format);
    if (!cues.length) {
      ToastQueue.negative(C.importEmpty(file.name), { timeout: 5000 });
      return;
    }
    const name = file.name.replace(/\.[^.]+$/, '') || file.name;
    const language = guessLanguage(
      cues
        .slice(0, 30)
        .map((cue) => cue.text)
        .join(''),
    );
    const receipt = await apply(withNewCaptionStyle(importCaptionOperations(sequence, cues, name, language), newCaptionStyle()), EditLabel.importSubtitles());
    if (!receipt) return;
    const documentId = receipt.refs?.['imported-caption'];
    if (documentId) onImported(documentId);
    ToastQueue.positive(C.imported(cues.length, formatClock(cues[cues.length - 1]!.end)), {
      timeout: 5000,
      actionLabel: C.undo,
      onAction: () => void undo({ transaction: receipt.transactionId }),
      shouldCloseOnAction: true,
    });
  };
  const input = (
    <input
      ref={ref}
      type="file"
      accept={SUBTITLE_FILES}
      hidden
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void read(file);
      }}
    />
  );
  return { input, editable, open: () => ref.current?.click() };
}

/** The document body; while the new version is still being fetched, use the previous version so the list does not flicker on every edit. */
function useLoadedBody(record: DocumentRecord): unknown {
  const body = useDocumentBody(record);
  const last = useRef<unknown>(undefined);
  if (body !== undefined) last.current = body;
  return body ?? last.current;
}

interface Editing {
  id: string;
  caret: number | 'end';
  /** A new one is generated every time editing starts: after merging into the same cue, the edit box must start over with the new text. */
  token: number;
}

interface Match extends TextRange {
  id: string;
}

const NO_OPTIONS: FindOptions = { matchCase: false, wholeWord: false, regex: false };

/** Hits are grouped by cue, keeping their original order within each group. */
function groupById(matches: readonly Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const match of matches) {
    const group = map.get(match.id);
    if (group) group.push(match);
    else map.set(match.id, [match]);
  }
  return map;
}

// The derived result of a full scan is cached outside the component, keyed by body version (same approach as the script panel): when switching back to the subtitle panel and it remounts, the cached result is used directly instead of being recomputed.
// The body and cue table are immutable snapshots; a new version is a new object, and the old one is collected along with it.
const cueLists = new WeakMap<object, CueList | null>();
function cachedCues(body: unknown): CueList | null {
  if (typeof body !== 'object' || body === null) return listCues(body);
  if (!cueLists.has(body)) cueLists.set(body, listCues(body));
  return cueLists.get(body)!;
}
const sentenceCounts = new WeakMap<CueList, number>();
function cachedSentences(cues: CueList | null): number {
  if (!cues) return countSentences([]);
  if (!sentenceCounts.has(cues)) sentenceCounts.set(cues, countSentences(cues.cues.map((cue) => cue.text)));
  return sentenceCounts.get(cues)!;
}
const speedCache = new WeakMap<CueList, Map<string, ReadonlyMap<string, ReturnType<typeof readingSpeed>>>>();
/** Reading speed for each cue, cached by cue table and language (the language only sets the threshold; when missing, it is treated the same as an empty string). */
function cachedSpeeds(cues: CueList | null, language: string | undefined): ReadonlyMap<string, ReturnType<typeof readingSpeed>> {
  if (!cues) return new Map();
  let byLanguage = speedCache.get(cues);
  if (!byLanguage) speedCache.set(cues, (byLanguage = new Map()));
  let speeds = byLanguage.get(language ?? '');
  if (!speeds) {
    speeds = new Map(cues.cues.map((cue) => [cue.id, readingSpeed(cue.text, cue.end - cue.start, language)]));
    byLanguage.set(language ?? '', speeds);
  }
  return speeds;
}

function CueEditor({ record, sequence, items }: { record: DocumentRecord; sequence: Sequence; items: CaptionItem[] }) {
  const { apply, undo, seek } = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const loaded = useLoadedBody(record);
  // Body just written whose new version has not come back yet: the actions chained after it build on it.
  const [local, setLocal] = useState<{ base: unknown; body: Json } | null>(null);
  const body = local && local.base === loaded ? local.body : loaded;
  // As soon as the new version arrives, drop the local copy: when undo goes back to the old version, the old body is exactly the base it was built on, so it must not be reused in its place.
  useEffect(() => {
    if (local && local.base !== loaded) setLocal(null);
  }, [local, loaded]);
  const cues = useMemo(() => cachedCues(body), [body]);
  // For how cues are counted, see countSentences: count terminal punctuation, continue counting across cues, and a final unterminated segment also counts as one sentence.
  const sentences = useMemo(() => cachedSentences(cues), [cues]);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const tokens = useRef(0);
  const setEditing = (next: Omit<Editing, 'token'> | null) => setEditingState(next && { ...next, token: ++tokens.current });
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState<FindOptions>(NO_OPTIONS);
  const [matchIndex, setMatchIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const language = useMemo(
    () =>
      record.language ??
      guessLanguage(
        (cues?.cues ?? [])
          .slice(0, 30)
          .map((cue) => cue.text)
          .join(''),
      ),
    [record.language, cues],
  );

  /** Where each cue appears on the sequence (the source clip clock is projected through the applied instance; cut-away cues do not appear). */
  const occurrences = useMemo(() => {
    const map = new Map<string, { start: number; end: number }[]>();
    const track = readCaptions(loaded);
    if (!track) return map;
    for (const item of items) {
      for (const placed of placedCues(item, sequence, track)) {
        const spans = map.get(placed.cueId) ?? [];
        spans.push({ start: placed.start, end: placed.end });
        map.set(placed.cueId, spans);
      }
    }
    return map;
  }, [loaded, items, sequence]);

  const activeId = useEditor(
    useCallback(
      (s: { playhead: number }) => {
        for (const [id, spans] of occurrences) if (spans.some((span) => s.playhead >= span.start && s.playhead < span.end)) return id;
        return null;
      },
      [occurrences],
    ),
  );
  const playing = useEditor((s) => s.playing);

  const compiled = useMemo(() => (finding ? compileFind(query, options) : {}), [finding, query, options]);
  const matches = useMemo<Match[]>(() => {
    if (!compiled.re || !cues) return [];
    return cues.cues.flatMap((cue) => findRanges(cue.text, compiled.re!, options.wholeWord).map((range) => ({ ...range, id: cue.id })));
  }, [compiled, cues, options.wholeWord]);
  const byCue = useMemo(() => groupById(matches), [matches]);
  /** Reading speed per cue is computed once: the status bar's over-speed count and the cps on the cards share it. */
  const speeds = useMemo(() => cachedSpeeds(cues, language), [cues, language]);
  const fast = useMemo(() => [...speeds.values()].filter((speed) => speed.level === 'warn' || speed.level === 'bad').length, [speeds]);
  // Card actions: the cards are memoized, so they call the latest handlers through this stable ref; during playback only the two cards entering or leaving “playing” are redrawn.
  const actions = useRef<CueActions>(null!);
  const current = matches.length ? matches[Math.min(matchIndex, matches.length - 1)]! : null;
  useEffect(() => setMatchIndex(0), [query, options]);

  // Virtual list: only the cards within one screen before and after the viewport are mounted, plus the one being edited (unmounting the edit box would lose uncommitted text and interrupt IME composition) and the one matching the search.
  const keys = useMemo(() => (cues?.cues ?? []).map((cue) => cue.id), [cues]);
  const cueIndex = useMemo(() => new Map(keys.map((key, index) => [key, index])), [keys]);
  const estimate = useCallback(
    (index: number, width: number) => ROW_BASE + TEXT_LINE * estimateLines(cues?.cues[index]?.text ?? '', width - CARD_INSET, TEXT_SIZE),
    [cues],
  );
  const rows = useVirtualRows({ scrollRef: listRef, keys, estimate, pinned: [editing?.id, current?.id] });
  const { scrollToIndex, scrollTo } = rows;
  // Playback-follow switch (product design §5.7): turns off when the user scrolls manually, and is restored when jumping or restarting playback in this panel.
  const follow = usePlaybackFollow(listRef);
  // During playback, scroll to keep the cue being played in view (scrolls only once when the cue changes, playback starts, or editing exits).
  useEffect(() => {
    if (!playing || !activeId || editing || follow.off.current) return;
    const index = cueIndex.get(activeId);
    if (index !== undefined) void scrollToIndex(index, { align: 'nearest' });
    // Follow only once, when the cue changes, playback starts, or editing exits.
  }, [activeId, playing, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Jumps in this panel (clicking a time, clicking a card, search navigation) restore following. */
  const seekTo = (cue: ListCue) => {
    const at = occurrences.get(cue.id)?.[0]?.start ?? (cues?.clock === 'sequence' ? cue.start : null);
    if (at === null) return;
    follow.resume();
    seek(at);
  };
  useEffect(() => {
    if (!current || !cues) return;
    const index = cueIndex.get(current.id);
    if (index === undefined) return;
    // First center that card; after it mounts and has been measured, center the highlighted characters in the viewport.
    void scrollToIndex(index, { align: 'center' }).then((done) => {
      const list = listRef.current;
      const mark = list?.querySelector('[data-match-current]');
      if (!done || !list || !mark) return;
      const box = list.getBoundingClientRect();
      const at = mark.getBoundingClientRect();
      scrollTo(list.scrollTop + at.top - box.top - (list.clientHeight - at.height) / 2);
    });
    seekTo(cues.cues[index]!);
    // Only position when jumping to a different match.
  }, [current?.id, current?.start]); // eslint-disable-line react-hooks/exhaustive-deps

  if (body === undefined) return <div className={muted}>{C.readingCues}</div>;
  if (!cues) return <div className={muted}>{C.unsupportedDoc}</div>;

  /** Write a new version: on success the notice has an “Undo”; on failure, drop the local copy. */
  const write = async (next: Json, label: Localized, done: string) => {
    if (!editable) return;
    setLocal({ base: loaded, body: next });
    const previous = record.revisions[record.currentRevision]?.summary;
    const summary = { ...(previous && typeof previous === 'object' ? previous : {}), cueCount: listCues(next)?.cues.length ?? 0 };
    const receipt = await apply([{ type: 'putDocument', documentId: record.id, kind: record.kind, body: next, summary }], label);
    if (!receipt) {
      setLocal(null);
      return;
    }
    ToastQueue.positive(done, {
      timeout: 4000,
      actionLabel: C.undo,
      onAction: () => void undo({ transaction: receipt.transactionId }),
      shouldCloseOnAction: true,
    });
  };
  const source = body as Json;

  const commit = (cue: ListCue, value: string) => {
    setEditing(null);
    const text = value.trim();
    if (!text || text === cue.text) return;
    void write(setCueTexts(source, new Map([[cue.id, text]])).body, EditLabel.rewriteSubtitle(), C.rewritten);
  };
  const split = (cue: ListCue, value: string, at: number) => {
    const result = splitCue(source, cue.id, value, at);
    if (!result) {
      commit(cue, value);
      return;
    }
    setEditing({ id: result.id, caret: 0 });
    void write(result.body, EditLabel.splitSubtitle(), C.splitDone);
  };
  /** Returns false when merging is not possible (end reached, different speakers), and editing continues. */
  const merge = (cue: ListCue, value: string, direction: -1 | 1): boolean => {
    const result = mergeCue(source, cue.id, value, direction);
    if ('refused' in result) {
      ToastQueue.neutral(result.refused === 'speaker' ? C.mergeSpeaker : direction < 0 ? C.firstCue : C.lastCue, {
        timeout: 3000,
      });
      return false;
    }
    setEditing({ id: result.id, caret: result.caret });
    void write(result.body, EditLabel.mergeSubtitles(), direction < 0 ? C.mergedUp : C.mergedDown);
    return true;
  };
  /** “merge into previous” on a seam: no editing, merges directly. */
  const mergeUp = (cue: ListCue) => {
    const result = mergeCue(source, cue.id, null, -1);
    if ('refused' in result) {
      ToastQueue.neutral(result.refused === 'speaker' ? C.seamSpeaker : C.firstCue, { timeout: 3000 });
      return;
    }
    void write(result.body, EditLabel.mergeSubtitles(), C.mergedUp);
  };
  const replace = (targets: Match[]) => {
    // Group by cue and look up cues by id: during replace-all there can be thousands of hits and cues, so the cue table must not be scanned once per hit.
    const byId = new Map(cues.cues.map((cue) => [cue.id, cue]));
    const texts = new Map<string, string>();
    let count = 0;
    for (const [id, ranges] of groupById(targets)) {
      const cue = byId.get(id);
      if (!cue) continue;
      const result = replaceRanges(cue.text, ranges, replacement);
      if (!result.changed) continue;
      texts.set(id, result.text);
      count += result.changed;
    }
    if (!count) {
      ToastQueue.neutral(C.noChanges, { timeout: 3000 });
      return;
    }
    void write(setCueTexts(source, texts).body, EditLabel.replaceSubtitleText(), C.replaced(count));
  };

  actions.current = {
    seek: seekTo,
    begin: (cue, caret) => {
      if (!playing) seekTo(cue);
      setEditing({ id: cue.id, caret });
    },
    commit,
    cancel: () => setEditing(null),
    split,
    merge,
    mergeUp,
  };

  const openFind = () => setFinding(true);
  const closeFind = () => {
    setFinding(false);
    setMatchIndex(0);
  };

  return (
    <div
      style={{ display: 'contents' }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault();
          openFind();
        }
      }}>
      <div className={statbar}>
        <span>{C.stats(cues.cues.length, sentences)}</span>
        {fast ? <span className={warn}>{C.tooFast(fast)}</span> : null}
        <span className={tail}>{C.keysHint}</span>
        <TooltipTrigger>
          <ActionButton
            isQuiet
            size="XS"
            aria-label={C.findReplace}
            aria-pressed={finding}
            onPress={() => (finding ? closeFind() : openFind())}>
            <Search />
          </ActionButton>
          <Tooltip>{C.findReplaceTip}</Tooltip>
        </TooltipTrigger>
      </div>
      {finding ? (
        <FindBar
          query={query}
          setQuery={setQuery}
          replacement={replacement}
          setReplacement={setReplacement}
          options={options}
          setOptions={setOptions}
          error={compiled.error ?? null}
          count={matches.length}
          index={current ? Math.min(matchIndex, matches.length - 1) : -1}
          onStep={(direction) => setMatchIndex((index) => stepIndex(index, matches.length, direction))}
          onClose={closeFind}
          editable={editable}
          onReplace={() => current && replace([current])}
          onReplaceAll={() => replace(matches)}
        />
      ) : null}
      <div ref={listRef} className={`${list} cc-scroll`} {...rows.containerProps}>
        {cues.cues.length ? null : <div className={muted}>{C.noSentences}</div>}
        {rows.segments.map((segment, n) => {
          if ('gap' in segment) return <div key={`gap:${n}`} aria-hidden style={{ height: segment.gap }} />;
          const index = segment.index;
          const cue = cues.cues[index]!;
          return (
            <CueCard
              key={cue.id}
              measure={rows.measureRef(cue.id)}
              count={cues.cues.length}
              seam={
                index === 0 || !editable || editing?.id === cue.id
                  ? null
                  : (cue.speaker ?? null) === (cues.cues[index - 1]!.speaker ?? null)
                    ? 'merge'
                    : 'speaker'
              }
              cue={cue}
              index={index}
              at={occurrences.get(cue.id)?.[0]?.start ?? (cues.clock === 'sequence' ? cue.start : null)}
              speed={speeds.get(cue.id)!}
              on={cue.id === activeId}
              editing={editing?.id === cue.id ? editing : null}
              editable={editable}
              matches={byCue.get(cue.id) ?? NO_MATCHES}
              current={current?.id === cue.id ? current : null}
              actions={actions}
            />
          );
        })}
      </div>
    </div>
  );
}

function FindBar({
  query,
  setQuery,
  replacement,
  setReplacement,
  options,
  setOptions,
  error,
  count,
  index,
  onStep,
  onClose,
  editable,
  onReplace,
  onReplaceAll,
}: {
  query: string;
  setQuery(value: string): void;
  replacement: string;
  setReplacement(value: string): void;
  options: FindOptions;
  setOptions(options: FindOptions): void;
  error: string | null;
  count: number;
  index: number;
  onStep(direction: 1 | -1): void;
  onClose(): void;
  editable: boolean;
  onReplace(): void;
  onReplaceAll(): void;
}) {
  const label = error ? C.badRegex : !query ? '' : count ? `${index + 1} / ${count}` : C.noResults;
  const escape = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };
  const option = (key: keyof FindOptions, text: string, tip: string) => (
    <TooltipTrigger>
      <ToggleButton size="XS" aria-label={tip} isSelected={options[key]} onChange={(on) => setOptions({ ...options, [key]: on })}>
        {text}
      </ToggleButton>
      <Tooltip>{tip}</Tooltip>
    </TooltipTrigger>
  );
  return (
    <div className={findbar}>
      <div className={findRow}>
        <TextField
          aria-label={C.find}
          placeholder={C.findPlaceholder}
          size="S"
          autoFocus
          value={query}
          onChange={setQuery}
          isInvalid={!!error}
          styles={findField}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onStep(event.shiftKey ? -1 : 1);
            }
            escape(event);
          }}
        />
        <span className={findCount({ isBad: !!error })}>{label}</span>
        <ActionButton isQuiet size="XS" aria-label={C.previous} isDisabled={!count} onPress={() => onStep(-1)}>
          <ChevronUp />
        </ActionButton>
        <ActionButton isQuiet size="XS" aria-label={C.next} isDisabled={!count} onPress={() => onStep(1)}>
          <ChevronDown />
        </ActionButton>
        <ActionButton isQuiet size="XS" aria-label={C.closeFind} onPress={onClose}>
          <Close />
        </ActionButton>
      </div>
      <div className={findRow}>
        <TextField
          aria-label={C.replaceWith}
          placeholder={C.replaceWith}
          size="S"
          value={replacement}
          onChange={setReplacement}
          styles={findField}
          onKeyDown={escape}
        />
        {option('matchCase', 'Aa', C.matchCase)}
        {option('wholeWord', C.wholeWordShort, C.wholeWord)}
        {option('regex', '.*', C.regex)}
      </div>
      <div className={findRow}>
        <span className={style({ flexGrow: 1 })} />
        <Button size="S" variant="secondary" isDisabled={!editable || index < 0} onPress={onReplace}>
          {C.replace}
        </Button>
        <Button size="S" variant="secondary" isDisabled={!editable || !count} onPress={onReplaceAll}>
          {C.replaceAll}
        </Button>
      </div>
      {error ? <div className={findNote}>{C.regexError(error)}</div> : null}
    </div>
  );
}

/** Position of the clicked character within the text (correct even when highlights are interleaved in the text). */
function caretIn(element: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

/** Card actions (CueEditor replaces them with a fresh set on every render; cards call them through a ref). */
interface CueActions {
  seek(cue: ListCue): void;
  begin(cue: ListCue, caret: number | 'end'): void;
  commit(cue: ListCue, value: string): void;
  cancel(): void;
  split(cue: ListCue, value: string, at: number): void;
  /** Returns false when merging is not possible, and editing continues. */
  merge(cue: ListCue, value: string, direction: -1 | 1): boolean;
  mergeUp(cue: ListCue): void;
}

const NO_MATCHES: Match[] = [];

const CueCard = memo(function CueCard({
  measure,
  count,
  seam,
  cue,
  index,
  at,
  speed,
  on,
  editing,
  editable,
  matches,
  current,
  actions,
}: {
  /** Ref the virtual list uses to measure this row (stable per key). */
  measure: (element: HTMLElement | null) => void;
  /** Total number of cues (the list item's aria-setsize). */
  count: number;
  /** “merge into previous” on the top edge: `'merge'` when merging is possible, `'speaker'` when the speakers differ (shows the reason and cannot be clicked), null when it is not shown. */
  seam: 'merge' | 'speaker' | null;
  cue: ListCue;
  index: number;
  /** The moment this cue first appears on the sequence; null if it does not appear (cut away). */
  at: number | null;
  speed: ReturnType<typeof readingSpeed>;
  on: boolean;
  editing: Editing | null;
  editable: boolean;
  matches: Match[];
  current: Match | null;
  actions: RefObject<CueActions>;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const onSeek = () => actions.current.seek(cue);
  const onBegin = (caret: number | 'end') => actions.current.begin(cue, caret);
  return (
    <div ref={measure} className={`${cueSlot} cc-cue-slot`} role="listitem" aria-setsize={count} aria-posinset={index + 1}>
      {seam === null ? null : (
        <div className={`${seamRow} cc-cue-seam`}>
          {seam === 'speaker' ? (
            <span className={seamPill({ isDisabled: true })}>{C.seamSpeaker}</span>
          ) : (
            <RACButton
              className={({ isHovered, isFocusVisible }) => seamPill({ isHovered, isFocusVisible })}
              onPress={() => actions.current.mergeUp(cue)}>
              <ChevronUp />
              {C.seam}
            </RACButton>
          )}
        </div>
      )}
      <div className={cueCard({ isOn: on, isEditing: !!editing })} data-cue={cue.id}>
        <span className={cueAccent({ isOn: on, isEditing: !!editing })} aria-hidden />
        <div className={cueHead}>
          <span className={`${cueNumber} cc-tabular`}>{index + 1}</span>
          {cue.speaker ? <span className={speaker}>{cue.speaker}</span> : null}
          <TooltipTrigger>
            <ActionButtonLike missing={at === null} onPress={onSeek}>
              {formatClock(at ?? cue.start, { tenths: true })}
            </ActionButtonLike>
            <Tooltip>{at === null ? C.cutAway : C.seekHere}</Tooltip>
          </TooltipTrigger>
          {editing || speed.level === 'none' ? null : (
            <span className={`${cps({ level: speed.level === 'ok' ? undefined : speed.level })} cc-tabular`} title={C.readingSpeed}>
              {speed.value} cps
            </span>
          )}
        </div>
        {editing ? (
          <CueTextEditor
            key={editing.token}
            initial={cue.text}
            caret={editing.caret}
            onCommit={(value) => actions.current.commit(cue, value)}
            onCancel={() => actions.current.cancel()}
            onSplit={(value, at) => actions.current.split(cue, value, at)}
            onMerge={(value, direction) => actions.current.merge(cue, value, direction)}
          />
        ) : (
          <span
            ref={textRef}
            className={cueText}
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-label={editable ? C.editCue(index + 1) : undefined}
            onClick={() => {
              if (!editable) return onSeek();
              const selection = window.getSelection();
              if (selection && !selection.isCollapsed) return;
              onBegin(caretIn(textRef.current!) ?? 'end');
            }}
            onKeyDown={(event) => {
              if (editable && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onBegin('end');
              }
            }}>
            <Highlighted text={cue.text} matches={matches} current={current} />
          </span>
        )}
      </div>
    </div>
  );
});

/** The time cell: a button without a frame. */
function ActionButtonLike({ missing, onPress, children }: { missing: boolean; onPress(): void; children: ReactNode }) {
  return (
    <RACButton
      className={({ isHovered }) => `${cueTime({ isMissing: missing, isHovered: isHovered && !missing })} cc-tabular`}
      onPress={() => !missing && onPress()}>
      {children}
    </RACButton>
  );
}

function Highlighted({ text, matches, current }: { text: string; matches: Match[]; current: Match | null }) {
  if (!matches.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const match of [...matches].sort((a, b) => a.start - b.start)) {
    if (match.start < at) continue;
    if (match.start > at) parts.push(text.slice(at, match.start));
    const isCurrent = current?.start === match.start;
    parts.push(
      <mark key={match.start} className={mark({ isCurrent })} {...(isCurrent ? { 'data-match-current': '' } : {})}>
        {text.slice(match.start, match.end)}
      </mark>,
    );
    at = match.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/**
 * Editing a cue (key bindings from the old `cue_edit.rs`): Enter splits at the cursor, and Enter at either end commits; ⌫ at the start of the line merges into the previous cue, ⌦ at the end of the line merges into the next cue;
 * ⌘Enter or losing focus commits, Esc discards, Shift+Enter inserts a line break. Enter during IME composition does not count.
 */
function CueTextEditor({
  initial,
  caret,
  onCommit,
  onCancel,
  onSplit,
  onMerge,
}: {
  initial: string;
  caret: number | 'end';
  onCommit(value: string): void;
  onCancel(): void;
  onSplit(value: string, at: number): void;
  onMerge(value: string, direction: -1 | 1): boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // The key handler has already handled this edit, so losing focus does not commit it again.
  const handled = useRef(false);
  const fit = () => {
    const element = ref.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    const at = caret === 'end' ? element.value.length : Math.min(caret, element.value.length);
    element.setSelectionRange(at, at);
    fit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = (action: () => void) => {
    handled.current = true;
    action();
  };
  return (
    <textarea
      ref={ref}
      className={editor}
      aria-label={C.cueText}
      defaultValue={initial}
      rows={1}
      onInput={fit}
      onBlur={(event) => {
        if (!handled.current) onCommit(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        const element = event.currentTarget;
        const at = element.selectionStart;
        const collapsed = at === element.selectionEnd;
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish(onCancel);
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          finish(() => onCommit(element.value));
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          finish(() => onSplit(element.value, at));
        } else if (event.key === 'Backspace' && collapsed && at === 0) {
          event.preventDefault();
          handled.current = onMerge(element.value, -1);
        } else if (event.key === 'Delete' && collapsed && at === element.value.length) {
          event.preventDefault();
          handled.current = onMerge(element.value, 1);
        }
      }}
    />
  );
}
