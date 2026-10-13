import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { AssetRecord, DocumentRecord, EditOperation, Id, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import {
  ActionButton,
  Button,
  Header,
  Heading,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import AIMark from '@react-spectrum/s2/icons/AIMark';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import Close from '@react-spectrum/s2/icons/Close';
import Copy from '@react-spectrum/s2/icons/Copy';
import Cut from '@react-spectrum/s2/icons/Cut';
import Delete from '@react-spectrum/s2/icons/Delete';
import Edit from '@react-spectrum/s2/icons/Edit';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import Revert from '@react-spectrum/s2/icons/Revert';
import Search from '@react-spectrum/s2/icons/Search';
import TranscriptIcon from '@react-spectrum/s2/icons/Transcript';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  chapterRows,
  moveParagraphPlan,
  paragraphSpan,
  sequenceChapters,
  visibleChapters,
  type ChapterRow,
  type ChapterSpan,
  type ParagraphSpan,
} from '../../model/chapters.ts';
import { readSpeechWords, type SpeechWords } from '../../model/speech-cues.ts';
import { compileFind, findRanges, stepIndex, type FindOptions, type TextRange } from '../../model/text-find.ts';
import { langName } from '../../model/tools-models.ts';
import { estimateLines } from '../../model/virtual-rows.ts';
import {
  centerScrollTop,
  cutOperations,
  cutSetRecord,
  cutTrackIds,
  editWordText,
  hideWords,
  paragraphPlayed,
  paragraphPlayedSpan,
  placementIndex,
  playedIndex,
  playedUntil,
  readCutSet,
  restoreOperations,
  restoreRanges,
  staleCaptions,
  transcriptParagraphs,
  transcriptWords,
  wordAt,
  type PlacementIndex,
  type TrackedCut,
  type TranscriptParagraph,
  type TranscriptWord,
} from '../../model/transcript-cut.ts';
import {
  copyReceipt,
  paragraphText,
  paragraphTranslations,
  replaceInParagraph,
  type CopyParagraph,
  type ParagraphText,
  type TranscriptView,
} from '../../model/transcript-text.ts';
import { existingTranslations } from '../../model/translate-setup.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor, type WordSelection } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { openAiTool } from './ai-tools-nav.ts';
import { CHAPTER_COPY } from './chapter-copy.ts';
import { EditorContext, useEditorActions, type EditorActions } from './editor-context.tsx';
import { PanelHead } from './panel-head.tsx';
import { applyCut, applyParagraphMove, applyRestore, applyTextReplace, copyToClipboard } from './transcript-actions.ts';
import { TranscriptChapterEmpty, TranscriptChapterHead } from './transcript-chapters.tsx';
import { copyScope, TranscriptCopyButton } from './transcript-copy-button.tsx';
import { TRANSCRIPT_COPY as C, TRANSCRIPT_TOOLS_COPY as T } from './transcript-copy.ts';
import { TranscriptFindBar } from './transcript-find-bar.tsx';
import { LiveTranscript, useLiveTranscriptJob } from './transcript-live.tsx';
import { Paragraph, type ParagraphAction, type ParagraphMoves, type ParaMarks } from './transcript-paragraph.tsx';
import { mediaCandidates } from './transcribe-run.ts';
import { RowHoldContext, useVirtualRows, type VirtualRows } from './use-virtual-rows.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { foldOutside, reclaimOperations, reclaimRange, visibleParagraphs, FOLD_STEP, type FoldPlan, type FoldSide, type ShortsFold } from '../../model/shorts-fold.ts';
import { readDerivation } from '../../model/shorts-result.ts';
import { ShortsFoldSeam } from './transcript-shorts-fold.tsx';
import { useTranscriptMode, type TranscriptMode } from './transcript-mode.ts';
import { consumeCutJump, useCutEntry } from './shorts-entry.ts';
import { entryAnchor } from '../../model/shorts-entry.ts';
import { SHORTS_COPY as S } from './shorts-copy.ts';

/**
 * Transcript panel (product design §5.7, S03; prototypes panels.jsx `TranscriptPanel` and panel-transcript-cut.jsx): shows the transcripts of assets used on the timeline, laid out by paragraph and word. Word times are projected onto the sequence (`projectSpeech`). Cut words stay struck through; the word at the playhead is highlighted; clicking a word jumps there.
 *
 * Two modes, with the mode tabs always below the page header:
 * - “edit source text, the default”: double-click a word to edit it, ⌫ deletes only the text. It is written back to the transcript document as a new version, and the timeline does not change (AT-09). Captions generated from it therefore go stale. The panel only shows a hint and does not regenerate them automatically.
 * - “cut audio and picture”: drag to select, or ⇧-click, a run of words. ⌫ or “Cut” makes one `addCuts` transaction. Restoring a selected cut word is a new transaction (AT-08).
 *
 * Page header (design `.panelhd`): find and replace (⌘F). Matches are marked on the words; a replacement lands on the words of the transcript body, and one replacement is one undoable transaction. Translation is find-only and is not replaced. Copy the full text (one click with the remembered combination; the dropdown is “Copy settings”, see transcript-copy-button.tsx). Next to the mode tabs is the language button. When translation documents exist, you can show only the translation or a bilingual side-by-side view. Translations are attached to paragraphs per sentence (paragraph-level following, since there is no word-level timing). In translation-only view, text cannot be edited and nothing can be cut.
 *
 * Paragraph row (design `ParaRow`): on hover shows ↑ ↓ (move this paragraph to the adjacent chapter; only with two or more chapters), play this paragraph, and ⋯ (copy this paragraph per the copy settings or as text only, move it to another chapter, cut this paragraph). A selection can be copied (⌘C).
 * The “This chapter…” menu on the chapter header row is in transcript-chapters.tsx.
 *
 * When the panel has focus, ⌫ / Delete are always caught here (and do nothing without a selection), so they do not fall through and delete the selected clip on the timeline.
 *
 * Differences from the prototype: the selection toolbar is docked at the bottom of the panel, not floating above the selection; there is no audition; paragraphs cannot be dragged between chapters (use ↑ ↓ or the ⋯ menu). With no selection, the bottom shows “Find cut points,” which goes to the page of the same name in the tools page (handed to the Agent). The web host has no tools page, so this item is not shown there.
 */

type Mode = TranscriptMode;

function selectedSet(selection: WordSelection | null): Set<number> {
  const set = new Set<number>();
  if (!selection) return set;
  for (const [a, b] of [...selection.extra, [selection.anchor, selection.focus] as [number, number]]) {
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
  }
  return set;
}

interface Source {
  asset: AssetRecord;
  record: DocumentRecord;
}

/** How one transcript looks once computed: panel-level actions (cut, restore, edit text, find and replace, copy) and the rendering of each section all draw from here. */
interface SourceModel {
  assetId: Id;
  asset: AssetRecord;
  record: DocumentRecord;
  /** Body: while a new version is still being fetched, the previous version is used (for display only); undefined before the first fetch completes. */
  body: unknown;
  /** The body is the current version: replacements are applied only to the current version, so they do not overwrite a newer one. */
  fresh: boolean;
  /** undefined: still fetching; null: not recognized. */
  read: SpeechWords | null | undefined;
  words: TranscriptWord[];
  paragraphs: TranscriptParagraph[];
  spans: ParagraphSpan[];
  /** Text of each paragraph (cut words excluded): find, replace, and copy all use it. */
  texts: ParagraphText[];
  /** Translation of each paragraph (when the translation view is selected and that language has a translation). */
  translations: string[] | null;
  /** Speaker → order of appearance (for coloring). */
  speakers: Map<string, number>;
  /** The asset's set of cuts (restore finds cuts through it); empty when absent or not yet fetched. */
  cuts: TrackedCut[];
  /** Index of landing points sorted by sequence time (the playhead uses it to find the current word). */
  index: PlacementIndex;
  /** The end of each word's earliest landing point, sorted (the playhead uses it for the read cursor). */
  played: number[];
  /** The minimum and maximum of the earliest landing-point ends of the words in each paragraph (the paragraph's read threshold); null for a paragraph that is entirely cut. */
  playedSpans: Array<[number, number] | null>;
  /** Sub-video: the two pieces outside the clip that are folded away (`foldOutside`). `paragraphs` and the rest already exclude folded words. null when this is not a sub-video. */
  fold: FoldPlan | null;
}

/** One find match: which transcript, which paragraph, original or translation, and the range within that side's text. */
interface Match extends TextRange {
  assetId: Id;
  para: number;
  side: 'src' | 'trans';
}

const modeRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flexShrink: 0,
  paddingX: 12,
  paddingY: 8,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const modeLine = style({ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' });
const modeHint = style({ font: 'ui-xs', color: 'gray-600', margin: 0 });
const viewNote = style({ display: 'flex', alignItems: 'start', gap: 4, font: 'ui-xs', color: 'gray-700', margin: 0 });
const staleRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  marginX: 12,
  marginTop: 8,
  paddingX: 8,
  paddingY: 4,
  borderRadius: 'default',
  backgroundColor: 'orange-100',
  font: 'ui-xs',
  color: 'orange-1000',
});
const staleText = style({ flexGrow: 1, minWidth: 0 });
const smallIcon = iconStyle({ size: 'S' });
const sectionHead = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  marginBottom: 4,
});
const sectionTitle = style({
  font: 'title-xs',
  color: 'gray-900',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const sectionStats = style({
  font: 'ui-xs',
  color: 'gray-600',
  whiteSpace: 'nowrap',
});
const note = style({
  font: 'ui-sm',
  color: 'gray-600',
  margin: 0,
  paddingY: 8,
});
const bar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  minHeight: 40,
  paddingX: 12,
  paddingY: 4,
  borderTopWidth: 1,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-50',
});
const barText = style({
  flexGrow: 1,
  minWidth: 0,
  font: 'ui-xs',
  color: 'gray-700',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const kbd = style({ font: 'ui-xs', color: 'gray-600', marginStart: 4 });
const centered = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  paddingX: 24,
  paddingY: 40,
  textAlign: 'center',
});
const emptyIcon = style({
  '--iconPrimary': { type: 'fill', value: 'gray-500' },
});
const emptyTitle = style({ font: 'title-sm', color: 'gray-900', margin: 0 });
const emptyText = style({ font: 'ui-sm', color: 'gray-600', margin: 0 });

/** Stable references to the event callbacks: for memoized paragraph cards, always calling the latest version. */
function useStable<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}

/**
 * Body text of several documents (the transcript and the selected translation). While a new version is being fetched, the previous one is used, so the text does not flicker on every edit. `fresh` holds those whose current version has been fetched.
 */
function useDocumentBodies(records: readonly DocumentRecord[]): { bodies: ReadonlyMap<Id, unknown>; fresh: ReadonlySet<Id> } {
  const documents = useRuntime().videos.documents;
  const key = records.map((r) => `${r.id}@${r.currentRevision}`).join(',');
  useEffect(() => {
    // Fetch by “document@version”: fetch again only when `key` changes.
    for (const r of records) documents.load(r.id, r.currentRevision);
  }, [documents, key]);
  const subscribe = useCallback((listener: () => void) => documents.subscribe(listener), [documents]);
  const ready = useSyncExternalStore(subscribe, () => records.map((r) => (documents.peek(r.id, r.currentRevision) === undefined ? 0 : 1)).join(''));
  const last = useRef(new Map<Id, unknown>());
  return useMemo(() => {
    const bodies = new Map<Id, unknown>();
    const fresh = new Set<Id>();
    for (const r of records) {
      const value = documents.peek(r.id, r.currentRevision);
      if (value !== undefined) {
        last.current.set(r.id, value);
        fresh.add(r.id);
      }
      const shown = value ?? last.current.get(r.id);
      if (shown !== undefined) bodies.set(r.id, shown);
    }
    return { bodies, fresh };
    // `key` and `ready`: recompute only when a document's version changes and its body has been fetched.
  }, [documents, key, ready]);
}

/** The part of one transcript that does not change with the language view or the set of cuts. */
type SpeechBase = Pick<SourceModel, 'read' | 'words' | 'paragraphs' | 'spans' | 'texts' | 'speakers' | 'index' | 'played' | 'playedSpans'>;

// Cached by the body object (the same one from the document cache) and the sequence cache, so that when the panel unmounts and mounts again it does not recompute (projecting 30k words onto the sequence takes tens of milliseconds).
const bases = new WeakMap<object, { sequence: Sequence; assetId: Id; base: SpeechBase }>();
const translationCache = new WeakMap<object, { body: unknown; paragraphs: readonly TranscriptParagraph[]; value: string[] | null }>();
const chapterCache = new WeakMap<Sequence, ChapterSpan[]>();

function speechBase(loaded: unknown, sequence: Sequence, assetId: Id): SpeechBase {
  const key = typeof loaded === 'object' && loaded !== null ? loaded : null;
  const cached = key ? bases.get(key) : undefined;
  if (cached && cached.sequence === sequence && cached.assetId === assetId) return cached.base;
  const read = loaded === undefined ? undefined : readSpeechWords(loaded);
  const words = read ? transcriptWords(sequence, assetId, read.words) : [];
  const paragraphs = transcriptParagraphs(words);
  const speakers = new Map<string, number>();
  for (const w of words) if (w.speaker !== undefined && !speakers.has(w.speaker)) speakers.set(w.speaker, speakers.size);
  const base: SpeechBase = {
    read,
    words,
    paragraphs,
    spans: paragraphs.map((p) => paragraphSpan(p.words)),
    texts: paragraphs.map((p) => paragraphText(p.words)),
    speakers,
    index: placementIndex(words),
    played: playedIndex(words),
    playedSpans: paragraphs.map((p) => paragraphPlayedSpan(p.words)),
  };
  if (key) bases.set(key, { sequence, assetId, base });
  return base;
}

/** Paragraphs and derived values after removing the words folded out of the clip. Returned unchanged when no words are folded. */
function foldedBase(base: SpeechBase, fold: FoldPlan | null): SpeechBase {
  if (!fold?.hidden.size) return base;
  const paragraphs = visibleParagraphs(base.paragraphs, fold.hidden) as TranscriptParagraph[];
  return {
    ...base,
    paragraphs,
    spans: paragraphs.map((p) => paragraphSpan(p.words)),
    texts: paragraphs.map((p) => paragraphText(p.words)),
    playedSpans: paragraphs.map((p) => paragraphPlayedSpan(p.words)),
  };
}

function translationsOf(loaded: unknown, translationBody: unknown, paragraphs: readonly TranscriptParagraph[]): string[] | null {
  const key = typeof translationBody === 'object' && translationBody !== null ? translationBody : null;
  const cached = key ? translationCache.get(key) : undefined;
  if (cached && cached.body === loaded && cached.paragraphs === paragraphs) return cached.value;
  const value = paragraphTranslations(loaded, translationBody, paragraphs);
  if (key) translationCache.set(key, { body: loaded, paragraphs, value });
  return value;
}

function chaptersOf(sequence: Sequence): ChapterSpan[] {
  let chapters = chapterCache.get(sequence);
  if (!chapters) chapterCache.set(sequence, (chapters = sequenceChapters(sequence)));
  return chapters;
}

/** Paragraphs for copy: paragraph start time, speaker name, text, and translation. A paragraph that is entirely cut (has no time) is excluded. */
function copyParagraphs(model: SourceModel, indices: readonly number[]): CopyParagraph[] {
  return indices.flatMap((n) => {
    const span = model.spans[n];
    const paragraph = model.paragraphs[n];
    if (!span || !paragraph) return [];
    const speaker = paragraph.speaker !== undefined ? (model.read?.speakers.get(paragraph.speaker) ?? paragraph.speaker) : null;
    return [{ start: span.start, speaker, text: model.texts[n]?.text ?? '', translation: model.translations?.[n] ?? '' }];
  });
}

export function TranscriptPanel({
  sequence,
  assets,
  documents,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
}) {
  const actions = useEditorActions();
  const cache = useRuntime().videos.documents;
  const editable = useVideo((s) => canEdit(s.video));
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const videoName = useVideo((s) => s.video?.state?.video?.name ?? null);
  const videoReady = useVideo((s) => s.video?.status === 'ready');
  const web = useRuntime().host.platform === 'web';
  const mode = useTranscriptMode((s) => s.mode);
  const setMode = useTranscriptMode((s) => s.setMode);
  const storedView = useTranscriptMode((s) => s.view);
  const setView = useTranscriptMode((s) => s.setView);
  const storedLanguage = useTranscriptMode((s) => s.language);
  const setLanguage = useTranscriptMode((s) => s.setLanguage);
  const candidates = useMemo(() => mediaCandidates(sequence, assets, documents), [sequence, assets, documents]);
  const sources = useMemo(() => candidates.flatMap((c): Source[] => (c.speech ? [{ asset: c.asset, record: c.speech }] : [])), [candidates]);
  // While transcription runs, the whole panel is swapped to the read-only live transcript (prototype round 220).
  const candidateIds = useMemo(() => candidates.map((c) => c.asset.id), [candidates]);
  const liveJobId = useLiveTranscriptJob(videoId, candidateIds, documents);
  const stale = useMemo(() => sources.flatMap((s) => staleCaptions(sequence, documents, s.record)), [sources, sequence, documents]);

  // ---- Language view: when translation documents exist, you can show only the translation or a bilingual side-by-side view ----

  const languages = useMemo(() => {
    const tags: string[] = [];
    for (const s of sources) for (const d of existingTranslations(documents, s.record.id)) if (d.language && !tags.includes(d.language)) tags.push(d.language);
    return tags;
  }, [sources, documents]);
  const language = storedLanguage && languages.includes(storedLanguage) ? storedLanguage : (languages[0] ?? null);
  const view: TranscriptView = language ? storedView : 'source';
  const translationRecords = useMemo(() => {
    const map = new Map<Id, DocumentRecord>();
    if (view === 'source' || !language) return map;
    for (const s of sources) {
      const found = existingTranslations(documents, s.record.id).find((d) => d.language === language);
      if (found) map.set(s.record.id, found);
    }
    return map;
  }, [view, language, sources, documents]);
  const sourceLanguage = sources.find((s) => s.record.language)?.record.language;
  const sourceName = sourceLanguage ? langName(sourceLanguage) : T.langSource;
  const translationName = language ? langName(language) : T.langTranslation;
  const viewLabel = view === 'source' ? sourceName : view === 'translation' ? translationName : T.langBoth(sourceName, translationName);

  // ---- Body, and the look of each transcript ----

  const cutSets = useMemo(
    () =>
      new Map(
        sources.flatMap((s) => {
          const record = cutSetRecord(documents, s.asset.id);
          return record ? [[s.asset.id, record] as const] : [];
        }),
      ),
    [sources, documents],
  );
  const records = useMemo(
    () => [...sources.map((s) => s.record), ...translationRecords.values(), ...cutSets.values()],
    [sources, translationRecords, cutSets],
  );
  const { bodies, fresh } = useDocumentBodies(records);
  // Sub-video: the content outside the clip is folded into two cut seams (product design §5.10). `foldShown` is how many sentences on each side have been spread out, recorded per “video · asset”; it is not kept when the video changes.
  const derivation = useMemo(() => readDerivation(documents), [documents]);
  const [foldShown, setFoldShown] = useState<Record<string, { before: number; after: number }>>({});
  // Derived documents record the asset ID from the parent video. When a sub-video copies the asset it gets a new ID, so it matches none of the transcripts here, and filtering by it is skipped (the first release has only one main asset).
  const primaryHere = !!derivation?.primaryAssetId && sources.some((s) => s.asset.id === derivation.primaryAssetId);
  const models = useMemo(
    () =>
      sources.map((source): SourceModel => {
        const assetId = source.asset.id;
        const loaded = bodies.get(source.record.id);
        const whole = speechBase(loaded, sequence, assetId);
        const folds = !!derivation && (!primaryHere || derivation.primaryAssetId === assetId) && whole.words.length > 0;
        const fold = folds ? foldOutside(whole.words, whole.paragraphs, foldShown[`${videoId}:${assetId}`] ?? { before: 0, after: 0 }) : null;
        const base = foldedBase(whole, fold);
        const translation = translationRecords.get(source.record.id);
        const translationBody = translation ? bodies.get(translation.id) : undefined;
        const cutSet = cutSets.get(assetId);
        return {
          assetId,
          asset: source.asset,
          record: source.record,
          body: loaded,
          fresh: fresh.has(source.record.id),
          ...base,
          translations:
            loaded !== undefined && translationBody !== undefined ? translationsOf(loaded, translationBody, base.paragraphs) : null,
          cuts: (cutSet && readCutSet(bodies.get(cutSet.id))) || [],
          fold,
        };
      }),
    [sources, bodies, fresh, sequence, translationRecords, cutSets, derivation, primaryHere, foldShown, videoId],
  );
  const foldStep = useCallback(
    (assetId: Id, side: FoldSide, action: 'more' | 'collapse') =>
      setFoldShown((prev) => {
        const key = `${videoId}:${assetId}`;
        const now = prev[key] ?? { before: 0, after: 0 };
        return { ...prev, [key]: { ...now, [side]: action === 'more' ? now[side] + FOLD_STEP : 0 } };
      }),
    [videoId],
  );
  // When a sub-video opens, the transcript scrolls to just before the clip, so the front seam row and the struck-through sentences right next to the clip show at the top of the viewport, with the start of the clip below them (product design §5.10).
  // With no front seam row (few sentences before the clip), start from the first paragraph.
  const reveal = useMemo(() => {
    for (const m of models) {
      if (!m.fold || !m.paragraphs.length || !videoId) continue;
      const key = m.fold.before ? `${m.record.id}:fold:before` : paraKey(m, 0);
      if (key) return { id: videoId, key };
    }
    return null;
  }, [models, videoId]);
  // Banner “Adjust in transcript” / result page “Adjust start and end” (shorts-entry.ts): scroll to the cut seam before the clip. If there is none, land on the paragraph holding the clip's first sentence. Scroll only once per request.
  const jumpN = useCutEntry((s) => (s.jump && s.jump.videoId === videoId && s.jump.n !== s.seen ? s.jump.n : null));
  const jump = useMemo(() => {
    if (jumpN === null) return null;
    for (const m of models) {
      const anchor = entryAnchor(m.fold, m.words, m.paragraphs);
      if (!anchor) continue;
      const key = 'fold' in anchor ? `${m.record.id}:fold:before` : paraKey(m, anchor.paragraph);
      if (key) return { n: jumpN, key };
    }
    return null;
  }, [jumpN, models]);
  const byAsset = useMemo(() => new Map(models.map((m) => [m.assetId, m])), [models]);
  const chapterTracks = useMemo(() => [...new Set(candidates.flatMap((c) => cutTrackIds(sequence, c.asset.id)))], [candidates, sequence]);
  const chapters = chaptersOf(sequence);
  // Row table for the list: the transcripts flattened (section headers, stats, chapter headers, paragraphs, hints). The grouping of each transcript is cached per transcript (`sectionLayout`).
  const layout = useMemo(() => listLayout(models, sequence, chapters, models.length > 1), [models, sequence, chapters]);

  // Word selection lives in editor-store. The store manages its mutual exclusion with the timeline clip selection (product design §5.7). It is cleared when the panel closes or the page switches, as the old local state was.
  const selection = useEditor((s) => s.wordSelection);
  const setSelection = useEditor.getState().setWordSelection;
  useEffect(() => () => setSelection(null), [setSelection]);
  const [editing, setEditing] = useState<{ assetId: Id; index: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Playback following (prototype panel-transcript-follow.jsx): `off` means the user scrolled away manually during playback; `last` is the scrollTop last emitted.
  const follow = useRef<FollowState>({ off: false, last: null });
  const resumeFollow = useCallback(() => {
    follow.current = { off: false, last: null };
  }, []);
  // Only user input counts (wheel, touch drag, pressing on the scrollbar), not the scroll event, since our own smooth scrollTo also dispatches scroll.
  const leaveFollow = () => {
    if (useEditor.getState().playing) follow.current.off = true;
  };
  // Jumps made from the panel (clicking a word, a paragraph's start time, a chapter's time, play this paragraph, find jumps) resume following. Jumps made on the timeline go through the outer actions and do not resume.
  const seekHere = useCallback(
    (seconds: number) => {
      resumeFollow();
      actions.seek(seconds);
    },
    [actions, resumeFollow],
  );
  const panelActions = useMemo<EditorActions>(() => ({ ...actions, seek: seekHere }), [actions, seekHere]);
  const drag = useRef<{
    assetId: Id;
    index: number;
    moved: boolean;
    plain: boolean;
  } | null>(null);
  const selected = useMemo(() => selectedSet(selection), [selection]);
  const model = selection ? byAsset.get(selection.assetId) : undefined;
  const latestModels = useRef(byAsset);
  latestModels.current = byAsset;
  const latestSequence = useRef(sequence);
  latestSequence.current = sequence;
  const latestEditable = useRef(editable);
  latestEditable.current = editable;

  // The transcript version changed (text edited or deleted), so the indexes may have shifted: clear the selection.
  const revisions = sources.map((s) => `${s.record.id}@${s.record.currentRevision}`).join(',');
  useEffect(() => {
    setSelection(null);
    setEditing(null);
  }, [revisions]);
  // No words can be selected in translation-only view.
  useEffect(() => {
    if (view === 'translation') {
      setSelection(null);
      setEditing(null);
    }
  }, [view]);

  const selectedWords = model ? model.words.filter((w) => selected.has(w.index)) : [];
  const plan = useMemo(
    () => (model && mode === 'cut' && selected.size ? cutOperations(sequence, assets, model.assetId, model.words, selected) : null),
    [model, mode, selected, sequence, assets],
  );
  const canRestore = selectedWords.some((w) => w.state !== 'kept');

  // ---- Find and replace (design `useFind` + `FindBar`): searches the side of the current language view. In bilingual view, both sides are searched ----

  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState<FindOptions>({ matchCase: false, wholeWord: false, regex: false });
  const [matchIndex, setMatchIndex] = useState(0);
  const compiled = useMemo(() => (finding ? compileFind(query, options) : {}), [finding, query, options]);
  const matches = useMemo<Match[]>(() => {
    const re = compiled.re;
    if (!re) return [];
    const out: Match[] = [];
    for (const m of models) {
      m.paragraphs.forEach((_, n) => {
        if (view !== 'translation') {
          for (const range of findRanges(m.texts[n]?.text ?? '', re, options.wholeWord)) out.push({ ...range, assetId: m.assetId, para: n, side: 'src' });
        }
        const translated = view !== 'source' ? m.translations?.[n] : undefined;
        if (translated) {
          for (const range of findRanges(translated, re, options.wholeWord)) out.push({ ...range, assetId: m.assetId, para: n, side: 'trans' });
        }
      });
    }
    return out;
  }, [compiled, models, view, options.wholeWord]);
  const current = matches.length ? matches[Math.min(matchIndex, matches.length - 1)]! : null;
  useEffect(() => setMatchIndex(0), [query, options, view, language]);
  const lockOf = (match: Match): string | null => (match.side === 'trans' ? T.lockTranslation : byAsset.get(match.assetId)?.fresh ? null : T.lockLoading);
  const marksByAsset = useMemo(() => {
    const out = new Map<Id, Map<number, ParaMarks>>();
    for (const match of matches) {
      let paras = out.get(match.assetId);
      if (!paras) out.set(match.assetId, (paras = new Map()));
      let marks = paras.get(match.para);
      if (!marks) paras.set(match.para, (marks = { src: [], trans: [], key: '' }));
      const isCurrent = match === current;
      marks[match.side].push({ start: match.start, end: match.end, current: isCurrent });
      marks.key += `${match.side}${match.start}-${match.end}${isCurrent ? '*' : ''},`;
    }
    return out;
  }, [matches, current]);

  // Jumping to another match: the list scrolls to it (`TranscriptList`) and the playhead follows to that paragraph.
  const currentKey = current ? `${current.assetId}:${current.para}:${current.side}:${current.start}` : null;
  const matchSpot = useMemo<MatchSpot | null>(() => {
    const target = current ? byAsset.get(current.assetId) : undefined;
    const key = current && target ? paraKey(target, current.para) : null;
    return current && key ? { key, assetId: current.assetId, para: current.para } : null;
    // Only switch when jumping to a different match (`currentKey`): if the version changed but the match is still in the same place, do not scroll again.
  }, [currentKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!current) return;
    const at = byAsset.get(current.assetId)?.spans[current.para]?.start;
    if (at !== undefined) seekHere(at);
    // Position only when jumping to a different match (`currentKey`).
  }, [currentKey]);

  const replace = (targets: readonly Match[]) => {
    if (!editable) return;
    const grouped = new Map<Id, Map<number, Match[]>>();
    for (const match of targets) {
      if (lockOf(match)) continue;
      let paras = grouped.get(match.assetId);
      if (!paras) grouped.set(match.assetId, (paras = new Map()));
      paras.set(match.para, [...(paras.get(match.para) ?? []), match]);
    }
    const operations: EditOperation[] = [];
    let count = 0;
    for (const [assetId, paras] of grouped) {
      const target = byAsset.get(assetId);
      // Change only the current version (when `fresh`, `texts` is computed from it).
      const currentBody = target ? cache.peek(target.record.id, target.record.currentRevision) : undefined;
      if (!target || currentBody === undefined) continue;
      let next: unknown = currentBody;
      let changed = 0;
      for (const [n, ranges] of paras) {
        const text = target.texts[n];
        const result = text ? replaceInParagraph(next, text, ranges, replacement) : null;
        if (!result) continue;
        next = result.body;
        changed += result.changed;
      }
      if (!changed) continue;
      const summary = target.record.revisions[target.record.currentRevision]?.summary;
      operations.push({
        type: 'putDocument',
        documentId: target.record.id,
        kind: target.record.kind,
        body: next as Record<string, unknown>,
        ...(summary !== undefined ? { summary } : {}),
      });
      count += changed;
    }
    void applyTextReplace(actions, operations, count);
  };

  const openFind = () => setFinding(true);
  const closeFind = () => {
    setFinding(false);
    setMatchIndex(0);
  };

  // ---- Copy (design transcript-copy.jsx): uses the current language view. The full text is copied with the copy button; excerpts follow the copy settings or are text only ----

  // All paragraphs are computed only when copying or opening the copy settings, so switching to the transcript tab or changing the view does not scan the whole text.
  const allParagraphs = useMemo(() => {
    let paras: CopyParagraph[] | undefined;
    const whole = (m: SourceModel) => copyParagraphs(m, [...m.paragraphs.keys()]);
    return () => (paras ??= models.flatMap(whole));
  }, [models]);

  const copySelection = () => {
    if (!model || !selected.size) return;
    const parts = model.paragraphs
      .map(
        (p) =>
          paragraphText(
            p.words.filter((w) => selected.has(w.index)),
            true,
          ).text,
      )
      .filter(Boolean);
    void copyToClipboard(
      parts.join('\n\n'),
      T.copied(
        T.scopeSelection,
        copyReceipt(
          parts.map((text) => ({ text, translation: '' })),
          'source',
        ),
      ),
    );
  };

  /** Copy of “this chapter”: the paragraphs of this transcript that belong to this chapter (called by the chapter header's menu). `chapter` null means before the first chapter (there is no chapter title to write). */
  const copyChapter = useStable((assetId: Id, rows: readonly ChapterRow[], chapter: ChapterSpan | null, withSettings: boolean) => {
    const target = byAsset.get(assetId);
    if (!target) return;
    const indices: number[] = [];
    let under: string | null | undefined;
    for (const row of rows) {
      if (row.kind === 'chapter') under = row.chapter?.id ?? null;
      else if (under === (chapter?.id ?? null)) indices.push(row.index);
    }
    void copyScope({
      scope: chapter ? 'chapter' : 'para',
      label: T.scopeChapter(chapter ? chapter.title : CHAPTER_COPY.beforeFirst),
      paras: copyParagraphs(target, indices),
      chapter,
      view,
      withSettings,
    });
  });

  // ---- Actions ----

  const cut = () => {
    if (!model || !plan || !editable) return;
    void applyCut(actions, plan, sequence.fps).then((done) => done && setSelection(null));
  };

  /** Restore the cut words in the selection: put back every cut covering them, as one transaction. */
  const restore = () => {
    if (!model || !editable) return;
    const ranges = restoreRanges(model.words, selected);
    if (!ranges.length) return;
    const result = restoreOperations(sequence, model.assetId, model.cuts, ranges);
    void applyRestore(actions, result).then((done) => done && setSelection(null));
  };

  const writeSpeech = async (target: SourceModel, next: Record<string, unknown> | null, message: string) => {
    if (!next) return false;
    const summary = target.record.revisions[target.record.currentRevision]?.summary;
    const receipt = await actions.apply(
      [
        {
          type: 'putDocument',
          documentId: target.record.id,
          kind: target.record.kind,
          body: next,
          ...(summary !== undefined ? { summary } : {}),
        },
      ],
      EditLabel.editTranscript(),
    );
    if (!receipt) return false;
    ToastQueue.positive(message, {
      timeout: 5000,
      actionLabel: C.undo,
      onAction: () => void actions.undo({ transaction: receipt.transactionId }),
      shouldCloseOnAction: true,
    });
    return true;
  };

  const deleteText = () => {
    if (!model || !editable || !selectedWords.length) return;
    void writeSpeech(
      model,
      hideWords(
        model.body,
        selectedWords.map((w) => w.id),
      ),
      C.textDeleted(selectedWords.length),
    ).then((done) => done && setSelection(null));
  };

  const commitEdit = useStable((assetId: Id, index: number, text: string) => {
    setEditing(null);
    const target = byAsset.get(assetId);
    const w = target?.words[index];
    if (!target || !w || !editable || text.trim() === w.text.trim()) return;
    void writeSpeech(target, editWordText(target.body, w.id, text), C.textSaved);
  });
  const cancelEdit = useStable(() => setEditing(null));

  const startEdit = () => {
    if (!model || !editable || selectedWords.length !== 1) return;
    setEditing({ assetId: model.assetId, index: selectedWords[0]!.index });
  };

  /** The buttons and the ⋯ menu on a paragraph row. */
  const paragraphAction = useStable((assetId: Id, index: number, action: ParagraphAction, moves: ParagraphMoves | null) => {
    const target = byAsset.get(assetId);
    const paragraph = target?.paragraphs[index];
    if (!target || !paragraph) return;
    const start = target.spans[index]?.start;
    switch (action) {
      case 'play':
        if (start === undefined) return;
        seekHere(start);
        if (!useEditor.getState().playing) actions.togglePlay();
        return;
      case 'copy':
      case 'copy-set':
        void copyScope({
          scope: 'para',
          label: T.scopePara,
          paras: copyParagraphs(target, [index]),
          chapter: null,
          view,
          withSettings: action === 'copy-set',
        });
        return;
      case 'up':
      case 'down': {
        const move = action === 'up' ? moves?.up : moves?.down;
        if (!editable) return;
        if (!move) {
          ToastQueue.neutral((action === 'up' ? moves?.upReason : moves?.downReason) ?? T.moveBlocked, { timeout: 3000 });
          return;
        }
        void applyParagraphMove(actions, move);
        return;
      }
      case 'cut': {
        if (!editable) return;
        const result = cutOperations(sequence, assets, assetId, target.words, new Set(paragraph.words.map((w) => w.index)));
        void applyCut(actions, result, sequence.fps).then((done) => done && setSelection(null));
        return;
      }
    }
  });

  // ---- Keyboard: ⌫ / Delete are always caught in the panel ----

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    // When focus is on a button in a paragraph row, or in a menu opened from there (menus render through a portal, so keyboard events still bubble up here): Enter, Esc, and ⌘C belong to that control. ⌫ is still caught and does nothing, so it does not fall through to the timeline.
    const onControl = target !== event.currentTarget && !!target.closest('button, [role="button"], [role="menu"], [role="menuitem"], [role="dialog"]');
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      event.stopPropagation();
      if (onControl || !selected.size) return;
      if (mode === 'cut') cut();
      else deleteText();
      return;
    }
    if (onControl) return;
    if (event.key === 'Escape' && selection) {
      event.stopPropagation();
      setSelection(null);
    } else if (event.key === 'Enter' && mode === 'edit' && selectedWords.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      startEdit();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && selected.size) {
      event.preventDefault();
      event.stopPropagation();
      copySelection();
    }
  };

  // ---- Pointer: press to select a word, drag to extend the selection, ⇧ extends to here, ⌘ starts a new range; a click without a drag jumps to that word ----

  const wordOf = (event: { target: EventTarget }): { assetId: Id; index: number } | null => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-w]');
    const assetId = element?.dataset.a;
    if (!element || !assetId) return null;
    return { assetId, index: Number(element.dataset.w) };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Pressed on the scroll container itself (the scrollbar, the blank margin) rather than on its content: treat it as a manual scroll.
    if (event.target === event.currentTarget) leaveFollow();
    if (event.button !== 0) return;
    const hit = wordOf(event);
    if (!hit) return;
    bodyRef.current?.focus({ preventScroll: true });
    const additive = event.metaKey || event.ctrlKey;
    if (event.shiftKey && selection && selection.assetId === hit.assetId) {
      setSelection({ ...selection, focus: hit.index });
      drag.current = { ...hit, moved: true, plain: false };
      return;
    }
    if (additive && selection && selection.assetId === hit.assetId) {
      setSelection({
        assetId: hit.assetId,
        anchor: hit.index,
        focus: hit.index,
        extra: [...selection.extra, [selection.anchor, selection.focus]],
      });
      drag.current = { ...hit, moved: false, plain: false };
      return;
    }
    setSelection({
      assetId: hit.assetId,
      anchor: hit.index,
      focus: hit.index,
      extra: [],
    });
    drag.current = { ...hit, moved: false, plain: true };
  };

  const onPointerOver = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const hit = wordOf(event);
    if (!hit || hit.assetId !== current.assetId || hit.index === current.index) return;
    current.moved = true;
    current.index = hit.index;
    setSelection((s) => (s && s.assetId === hit.assetId ? { ...s, focus: hit.index } : s));
  };

  useEffect(() => {
    const up = () => {
      const current = drag.current;
      drag.current = null;
      if (!current || current.moved || !current.plain) return;
      const owner = latestModels.current.get(current.assetId);
      // Sub-video: for words struck through outside the clip, a single click from this sentence to the clip edge restores this run, with no gap left behind (product design §5.10).
      const reclaim = owner?.fold && latestEditable.current ? reclaimRange(owner.words, owner.fold, current.index) : null;
      if (owner && reclaim) {
        setSelection(null);
        void applyRestore(actions, reclaimOperations(latestSequence.current, owner.assetId, owner.cuts, reclaim));
        return;
      }
      const w = owner?.words[current.index];
      const at = w?.placements[0]?.start;
      if (at !== undefined) seekHere(at);
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [seekHere, actions, setSelection]);

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'edit' || !editable) return;
    const hit = wordOf(event);
    if (hit) setEditing(hit);
  };

  // ---- Live transcript ----

  if (liveJobId) return <LiveTranscript jobId={liveJobId} sequence={sequence} assets={assets} />;

  // ---- Empty state ----

  if (!sources.length) {
    const hasMedia = Object.values(assets).some((asset) => asset.kind === 'video' || asset.kind === 'audio');
    const text = !hasMedia ? C.emptyNoMedia : !candidates.length ? C.emptyNotPlaced : C.emptyNotTranscribed;
    return (
      <>
        <PanelHead title={C.title} />
        <div className={centered}>
          <span className={emptyIcon}>
            <TranscriptIcon />
          </span>
          <h3 className={emptyTitle}>{C.emptyTitle}</h3>
          <p className={emptyText}>{text}</p>
          {candidates.length ? (
            <Button variant="secondary" onPress={() => useEditor.getState().showPanel('subtitle')}>
              {C.gotoSubtitle}
            </Button>
          ) : (
            <Button variant="secondary" onPress={() => useEditor.getState().showPanel('video')}>
              {C.addMedia}
            </Button>
          )}
        </div>
      </>
    );
  }

  const seconds = plan?.ok ? (plan.frames * sequence.fps.den) / sequence.fps.num : null;
  const translationOnly = view === 'translation';
  const loadedParagraphs = models.some((m) => m.paragraphs.length);

  return (
    <div
      style={{ display: 'contents' }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f') {
          event.preventDefault();
          event.stopPropagation();
          openFind();
        }
      }}>
      <PanelHead title={C.title}>
        <TooltipTrigger>
          <ActionButton isQuiet size="S" aria-label={T.findLabel} aria-pressed={finding} onPress={() => (finding ? closeFind() : openFind())}>
            <Search />
          </ActionButton>
          <Tooltip>{T.findTip}</Tooltip>
        </TooltipTrigger>
        <TranscriptCopyButton
          input={{
            videoId,
            ready: videoReady,
            revision: `${sequence.revision}|${records.map((r) => `${r.id}@${r.currentRevision}`).join(',')}`,
            sources: sources.map((s) => ({ documentId: s.record.id, translationId: translationRecords.get(s.record.id)?.id ?? null })),
            view,
            viewLabel,
            hasChapters: chapters.length > 0,
            chapters,
            title: videoName,
            paragraphs: allParagraphs,
            documents,
            disabled: !loadedParagraphs || !videoReady,
          }}
        />
      </PanelHead>
      {finding ? (
        <TranscriptFindBar
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
          canReplace={editable && !!current && !lockOf(current)}
          canReplaceAll={editable && matches.some((m) => !lockOf(m))}
          hint={current ? lockOf(current) : null}
          onReplace={() => current && replace([current])}
          onReplaceAll={() => replace(matches)}
        />
      ) : null}
      <div className={modeRow}>
        <div className={modeLine}>
          <SegmentedControl aria-label={C.modes} selectedKey={mode} isDisabled={translationOnly} onSelectionChange={(key) => setMode(key as Mode)}>
            <SegmentedControlItem id="edit">{C.modeEdit}</SegmentedControlItem>
            <SegmentedControlItem id="cut">{C.modeCut}</SegmentedControlItem>
          </SegmentedControl>
          <LanguageMenu
            label={viewLabel}
            sourceName={sourceName}
            languages={languages}
            language={language}
            view={view}
            onSource={() => setView('source')}
            onTranslation={(tag) => {
              setLanguage(tag);
              // Switching the language does not change the document: entering translation-only view happens only when coming from the original (design).
              if (view === 'source') setView('translation');
            }}
            onToggleBoth={() => setView(view === 'both' ? 'translation' : 'both')}
          />
        </div>
        <p className={modeHint}>{translationOnly ? T.translationOnly : mode === 'cut' ? C.hintCut : C.hintEdit}</p>
        {/* Sub-video (product design §5.10): the content outside the clip is also struck-through text */}
        {derivation && mode === 'cut' && !translationOnly ? <p className={modeHint}>{S.cutHint}</p> : null}
        {view !== 'source' ? (
          <p className={viewNote}>
            <InfoCircle styles={smallIcon} />
            <span>{T.translationNote}</span>
          </p>
        ) : null}
      </div>
      {stale.length ? (
        <div className={staleRow} role="status">
          <AlertTriangle styles={smallIcon} />
          <span className={staleText}>{C.stale(stale.length)}</span>
          <ActionButton isQuiet size="XS" onPress={() => useEditor.getState().showPanel('subtitle')}>
            {C.gotoCaptions}
          </ActionButton>
        </div>
      ) : null}
      {/* Jumps in the list (a paragraph's start time, a chapter's time) also count as jumps from the panel, so they use the version that resumes following. */}
      <EditorContext.Provider value={panelActions}>
        <TranscriptList
          bodyRef={bodyRef}
          models={models}
          layout={layout}
          sequence={sequence}
          chapters={chapters}
          view={view}
          language={language}
          editable={editable}
          marksByAsset={marksByAsset}
          selection={selection}
          selected={selected}
          editing={editing}
          match={matchSpot}
          chapterTracks={chapterTracks}
          follow={follow}
          resume={resumeFollow}
          seek={seekHere}
          onCommit={commitEdit}
          onCancel={cancelEdit}
          onParagraph={paragraphAction}
          onCopyChapter={copyChapter}
          onFold={foldStep}
          reveal={reveal}
          jump={jump}
          bodyProps={{
            onKeyDown,
            onPointerDown,
            onPointerOver,
            onDoubleClick,
            onWheel: leaveFollow,
            onTouchMove: leaveFollow,
          }}
        />
      </EditorContext.Provider>
      {selection && selected.size ? (
        <div className={bar}>
          <span className={barText}>{C.selected(selected.size, mode === 'cut' ? seconds : null)}</span>
          <TooltipTrigger>
            <ActionButton isQuiet size="S" aria-label={T.copySelectionTip} onPress={copySelection}>
              <Copy />
            </ActionButton>
            <Tooltip>{T.copySelectionTip}</Tooltip>
          </TooltipTrigger>
          {mode === 'cut' ? (
            <>
              {canRestore ? (
                <Button variant="secondary" size="S" isDisabled={!editable} onPress={restore}>
                  <Revert />
                  <Text>{C.restore}</Text>
                </Button>
              ) : null}
              <Button variant="secondary" size="S" isDisabled={!editable || !plan?.ok} onPress={cut}>
                <Cut />
                <Text>
                  {C.cut}
                  <span className={kbd}>⌫</span>
                </Text>
              </Button>
            </>
          ) : (
            <>
              {selectedWords.length === 1 ? (
                <Button variant="secondary" size="S" isDisabled={!editable} onPress={startEdit}>
                  <Edit />
                  <Text>{C.editWord}</Text>
                </Button>
              ) : null}
              <Button variant="secondary" size="S" isDisabled={!editable} onPress={deleteText}>
                <Delete />
                <Text>
                  {C.deleteText}
                  <span className={kbd}>⌫</span>
                </Text>
              </Button>
            </>
          )}
          <TooltipTrigger>
            <ActionButton isQuiet size="S" aria-label={C.clear} onPress={() => setSelection(null)}>
              <Close />
            </ActionButton>
            <Tooltip>{C.clear}</Tooltip>
          </TooltipTrigger>
        </div>
      ) : mode === 'cut' && !translationOnly && !web && videoId ? (
        <div className={bar}>
          <span className={barText}>{C.aiFindHint}</span>
          <Button variant="secondary" size="S" onPress={() => openAiTool(videoId, 'cleanup')}>
            <AIMark />
            <Text>{C.aiFind}</Text>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const langButton = style({ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' });
const langLabelText = style({ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' });

/**
 * Language button (design “Transcript language” menu): the original and each translation are radio choices. “Show original too” is a second axis: checking it gives bilingual side-by-side. When the original is being viewed there is no other column to pair with, so it is greyed out. With no translations there is only the original, and the line below says where to translate.
 */
function LanguageMenu({
  label,
  sourceName,
  languages,
  language,
  view,
  onSource,
  onTranslation,
  onToggleBoth,
}: {
  label: string;
  sourceName: string;
  languages: readonly string[];
  language: string | null;
  view: TranscriptView;
  onSource(): void;
  onTranslation(tag: string): void;
  onToggleBoth(): void;
}) {
  const picked = view === 'source' || !language ? 'src' : `tr:${language}`;
  return (
    <MenuTrigger align="start">
      <ActionButton size="S" aria-label={E.labeled(T.langLabel, label)}>
        {/* The arrow goes after the text: put it inside Text, so it does not take the icon slot in front of ActionButton (same as access-picker). */}
        <Text>
          <span className={langButton}>
            <span className={langLabelText}>{label}</span>
            <ChevronDown />
          </span>
        </Text>
      </ActionButton>
      <Menu aria-label={T.langLabel}>
        <MenuSection
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[picked]}
          onSelectionChange={(keys) => {
            if (keys === 'all') return;
            const key = [...keys][0];
            if (key === 'src') onSource();
            else if (typeof key === 'string' && key.startsWith('tr:')) onTranslation(key.slice(3));
          }}>
          <Header>
            <Heading>{T.langLabel}</Heading>
          </Header>
          <MenuItem id="src" textValue={sourceName}>
            <Text slot="label">{sourceName}</Text>
            <Text slot="description">{T.langSource}</Text>
          </MenuItem>
          {languages.map((tag) => (
            <MenuItem key={tag} id={`tr:${tag}`} textValue={langName(tag)}>
              <Text slot="label">{langName(tag)}</Text>
              <Text slot="description">{T.langTranslation}</Text>
            </MenuItem>
          ))}
        </MenuSection>
        {languages.length ? (
          <MenuSection aria-label={T.showBoth} selectionMode="multiple" selectedKeys={view === 'both' ? ['both'] : []} onSelectionChange={() => onToggleBoth()}>
            {/* Sections with their own selection do not honor Menu's disabledKeys, so the disabled state is set on the item. */}
            <MenuItem id="both" textValue={T.showBoth} isDisabled={view === 'source'}>
              <Text slot="label">{T.showBoth}</Text>
              <Text slot="description">{view === 'source' ? T.showBothNeedsTranslation : T.showBothHint}</Text>
            </MenuItem>
          </MenuSection>
        ) : (
          <MenuSection aria-label={T.noTranslation}>
            <MenuItem id="none" textValue={T.noTranslation} isDisabled>
              <Text slot="label">{T.noTranslation}</Text>
              <Text slot="description">{T.noTranslationHint}</Text>
            </MenuItem>
          </MenuSection>
        )}
      </Menu>
    </MenuTrigger>
  );
}

const SPEAKER_HUES = 6;

// ---- List: the transcripts are flattened into one row table (section headers, stats, chapter headers, paragraphs, hints), and the virtual list mounts only the rows near the viewport ----

/** How one transcript looks in the list: the chapter grouping, how each paragraph moves to an adjacent chapter, word → paragraph, and plain text used to estimate row height. Cached per transcript. */
interface SectionLayout {
  rows: ChapterRow[];
  /** Only shown with two or more chapters. */
  moves: ParagraphMoves[] | null;
  /** Word index → paragraph index. */
  paraOfWord: Int32Array;
  /** The text drawn for each paragraph (cut words included), used only to estimate row height. */
  plain: string[];
  cutCount: number;
}

/** Cached by the paragraph table (the transcript body and the sequence are the same object unless one changes, see `speechBase`). The chapter table is cached by the sequence (`chaptersOf`), and the ways to move a paragraph between chapters also change only with the sequence. */
const sections = new WeakMap<
  readonly TranscriptParagraph[],
  { chapters: readonly ChapterSpan[]; withEmpty: boolean; layout: SectionLayout }
>();

function sectionLayout(model: SourceModel, sequence: Sequence, chapters: readonly ChapterSpan[], withEmpty: boolean): SectionLayout {
  const cached = sections.get(model.paragraphs);
  if (cached && cached.chapters === chapters && cached.withEmpty === withEmpty) return cached.layout;
  const { paragraphs, spans, words } = model;
  // Chapter header rows are inserted per chapter: a paragraph's position on the sequence is assigned to a chapter by its midpoint. When transcripts are grouped separately, no empty chapter is listed.
  const rows = chapterRows(chapters, spans, withEmpty);
  // The ways to move each paragraph to an adjacent chapter (↑ ↓ and the ⋯ menu): only with two or more chapters.
  let moves: ParagraphMoves[] | null = null;
  const shown = visibleChapters(chapters);
  if (shown.length >= 2) {
    const under = new Map<number, ChapterSpan | null>();
    let head: ChapterSpan | null = null;
    for (const row of rows) {
      if (row.kind === 'chapter') head = row.chapter;
      else under.set(row.index, head);
    }
    moves = paragraphs.map((_, n): ParagraphMoves => {
      const at = under.get(n);
      const k = at ? shown.findIndex((c) => c.id === at.id) : -1;
      return {
        up: moveParagraphPlan(sequence, chapters, spans, n, -1),
        down: moveParagraphPlan(sequence, chapters, spans, n, 1),
        upReason: k === 0 ? T.noPrev : T.moveBlocked,
        downReason: k === shown.length - 1 ? T.noNext : T.moveBlocked,
      };
    });
  }
  const paraOfWord = new Int32Array(words.length).fill(-1);
  const plain = paragraphs.map((p, n) => {
    let text = '';
    p.words.forEach((w, k) => {
      paraOfWord[w.index] = n;
      text += (k > 0 && w.spaced ? ' ' : '') + w.text.trim();
    });
    return text;
  });
  const layout = { rows, moves, paraOfWord, plain, cutCount: words.filter((w) => w.state === 'cut').length };
  sections.set(model.paragraphs, { chapters, withEmpty, layout });
  return layout;
}

/** One row in the list. `section` is the index of the transcript (the sticky chapter header sticks only within its own section). */
type ListRow =
  | { kind: 'title' | 'stats'; key: string; section: number; model: SourceModel }
  | { kind: 'note'; key: string; section: number; text: string }
  | { kind: 'chapter'; key: string; section: number; model: SourceModel; chapter: ChapterSpan | null; count: number }
  | { kind: 'empty'; key: string; section: number }
  | { kind: 'paragraph'; key: string; section: number; model: SourceModel; index: number }
  /** The folded-out piece outside a sub-video clip (`ShortsFoldSeam`): before the first paragraph or after the last paragraph of this section. */
  | { kind: 'fold'; key: string; section: number; model: SourceModel; fold: ShortsFold };

interface ListLayout {
  rows: ListRow[];
  keys: string[];
  indexOf: Map<string, number>;
  /** Index of the chapter header row (sticky). */
  sticky: number[];
  /** Index of the first row of each section, with one more entry for the row count at the end. */
  bounds: number[];
}

const paraKey = (model: SourceModel, n: number): string | null => {
  const paragraph = model.paragraphs[n];
  return paragraph ? `${model.record.id}:p:${paragraph.key}` : null;
};

function listLayout(models: readonly SourceModel[], sequence: Sequence, chapters: readonly ChapterSpan[], showTitle: boolean): ListLayout {
  const rows: ListRow[] = [];
  const sticky: number[] = [];
  const bounds: number[] = [];
  models.forEach((model, section) => {
    bounds.push(rows.length);
    const id = model.record.id;
    const { read, words } = model;
    if (showTitle) rows.push({ kind: 'title', key: `${id}:title`, section, model });
    else if (read && words.length) rows.push({ kind: 'stats', key: `${id}:stats`, section, model });
    const text = model.body === undefined ? C.loading : !read ? C.notSpeech : !words.length ? C.noWords : null;
    if (text !== null) {
      rows.push({ kind: 'note', key: `${id}:note`, section, text });
      return;
    }
    const seen = new Map<string, number>();
    const before = model.fold?.before ?? null;
    const after = model.fold?.after ?? null;
    let lastParagraph = -1;
    for (const row of sectionLayout(model, sequence, chapters, !showTitle).rows) {
      if (row.kind === 'paragraph') {
        if (before && lastParagraph < 0) rows.push({ kind: 'fold', key: `${id}:fold:before`, section, model, fold: before });
        rows.push({ kind: 'paragraph', key: paraKey(model, row.index)!, section, model, index: row.index });
        lastParagraph = rows.length - 1;
        continue;
      }
      // The same chapter can appear twice (a clip was moved), so tell them apart by order of appearance.
      const chapterId = row.chapter?.id ?? 'before';
      const nth = seen.get(chapterId) ?? 0;
      seen.set(chapterId, nth + 1);
      const key = `${id}:c:${chapterId}:${nth}`;
      sticky.push(rows.length);
      rows.push({ kind: 'chapter', key, section, model, chapter: row.chapter, count: row.count });
      if (row.chapter && row.count === 0) rows.push({ kind: 'empty', key: `${key}:empty`, section });
    }
    if (after && lastParagraph >= 0) {
      rows.splice(lastParagraph + 1, 0, { kind: 'fold', key: `${id}:fold:after`, section, model, fold: after });
      for (let k = 0; k < sticky.length; k++) if (sticky[k]! > lastParagraph) sticky[k] = sticky[k]! + 1;
    }
  });
  bounds.push(rows.length);
  const keys = rows.map((row) => row.key);
  return { rows, keys, indexOf: new Map(keys.map((key, i) => [key, i])), sticky, bounds };
}

// Row height estimate (used until it is measured, after which the measured value is used): paragraph card gap 8px + border 2 + padding 16 + header row 22; body 14px × 1.8 line height; translation-only 14px × 1.7; bilingual 12px × 1.7 plus a 4px gap. The text width in the card is the content width minus the card's padding and border.
const PARA_BASE = 48;
const PARA_INSET = 18;
const WORD_SIZE = 14;
const WORD_LINE = 25.2;
const TRANS_LINE = 23.8;
const TRANS_SMALL = 12;
const TRANS_SMALL_LINE = 20.4;
const ROW_ESTIMATE = { title: 26, stats: 14, note: 34, chapter: 40, empty: 40, fold: 36 } as const;
/** Top margin of the first row in the list (it used to be the panel body's top padding; the virtual list container cannot have top padding). */
const LIST_TOP = 16;
/** Gap between sections when several transcripts are shown together. */
const SECTION_GAP = 20;

const listBody = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingBottom: 12, outlineStyle: 'none' });
/** Paragraph row: 8px from the row above (it used to be the paragraph card's top margin; rows cannot have margins between them). */
const paraSlot = style({ paddingTop: 8 });
/** Row wrapper: the children's margins do not leak out of the row (row height is measured on the wrapper). */
const ROW_STYLE = { display: 'flow-root' } as const;

/** A find match in the list: which transcript and which paragraph (scroll to it, pin it). */
interface MatchSpot {
  key: string;
  assetId: Id;
  para: number;
}

/**
 * The list part of the transcript: the scroll container, the rows, playback following, and find jumps. It is its own component, so when the window scrolls only this part redraws, not the header, the find bar, or the selection toolbar.
 *
 * Rows that are pinned (kept mounted when scrolled out of the window): the paragraph holding the word being edited, the paragraphs holding the selection's anchor and focus, the paragraph of the current find match, the chapter header stuck at the top of the viewport, the focused row and the rows right before and after it (managed by a hook), and rows that must stay mounted (a paragraph or chapter header menu is open, or a chapter name input is open; see `useHoldRow`). The rest of the state in a paragraph card need not be pinned: hover (`hovered`) and button hints (shown on hover) can be lost harmlessly. A button's keyboard focus is kept by its focused row. The drag selection state is kept in the panel by word index, not in the DOM.
 */
function TranscriptList({
  bodyRef,
  models,
  layout,
  sequence,
  chapters,
  view,
  language,
  editable,
  marksByAsset,
  selection,
  selected,
  editing,
  match,
  chapterTracks,
  follow,
  resume,
  seek,
  onCommit,
  onCancel,
  onParagraph,
  onCopyChapter,
  onFold,
  reveal,
  jump,
  bodyProps,
}: {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  models: readonly SourceModel[];
  layout: ListLayout;
  sequence: Sequence;
  chapters: readonly ChapterSpan[];
  view: TranscriptView;
  /** Translation language (the row height changes with the language). */
  language: string | null;
  editable: boolean;
  marksByAsset: ReadonlyMap<Id, ReadonlyMap<number, ParaMarks>>;
  selection: WordSelection | null;
  selected: ReadonlySet<number>;
  editing: { assetId: Id; index: number } | null;
  match: MatchSpot | null;
  chapterTracks: readonly Id[];
  follow: React.RefObject<FollowState>;
  resume(): void;
  seek(seconds: number): void;
  onCommit(assetId: Id, index: number, text: string): void;
  onCancel(): void;
  onParagraph(assetId: Id, index: number, action: ParagraphAction, moves: ParagraphMoves | null): void;
  onCopyChapter(assetId: Id, rows: readonly ChapterRow[], chapter: ChapterSpan | null, withSettings: boolean): void;
  /** Fold seam of a sub-video clip: reveal the next batch, or fold it again. */
  onFold(assetId: Id, side: FoldSide, action: 'more' | 'collapse'): void;
  /** The row to scroll to when a sub-video opens (the paragraph where the clip starts). Each video scrolls only once (`id`). */
  reveal: { id: string; key: string } | null;
  /** The one scroll for adjusting start and end from the transcript (`n` is which request this is). It takes precedence over `reveal`; once it has scrolled, it hands back to `consumeCutJump`. */
  jump: { n: number; key: string } | null;
  /** Keyboard and pointer handling on the scroll container (word selection, drag selection, ⌫ caught, …). */
  bodyProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const showTitle = models.length > 1;
  const byAsset = useMemo(() => new Map(models.map((m) => [m.assetId, m])), [models]);
  const sectionOf = useCallback(
    (model: SourceModel) => sectionLayout(model, sequence, chapters, !showTitle),
    [sequence, chapters, showTitle],
  );
  /** The row key of the paragraph holding word n of a transcript. */
  const wordRow = useCallback(
    (assetId: Id, index: number): string | null => {
      const model = byAsset.get(assetId);
      const n = model ? sectionOf(model).paraOfWord[index] : undefined;
      return model && n !== undefined && n >= 0 ? paraKey(model, n) : null;
    },
    [byAsset, sectionOf],
  );

  const estimate = useCallback(
    (i: number, width: number) => {
      const row = layout.rows[i];
      if (!row) return 0;
      const edges = (i === 0 ? LIST_TOP : 0) + (showTitle && i === layout.bounds[row.section + 1]! - 1 ? SECTION_GAP : 0);
      if (row.kind !== 'paragraph') return ROW_ESTIMATE[row.kind] + edges;
      const inner = width - PARA_INSET;
      let height = PARA_BASE + edges;
      if (view !== 'translation') height += WORD_LINE * estimateLines(sectionOf(row.model).plain[row.index] ?? '', inner, WORD_SIZE);
      if (view !== 'source') {
        const text = row.model.translations?.[row.index] || T.noParagraphTranslation;
        height +=
          view === 'both'
            ? 4 + TRANS_SMALL_LINE * estimateLines(text, inner, TRANS_SMALL)
            : TRANS_LINE * estimateLines(text, inner, WORD_SIZE);
      }
      return height;
    },
    [layout, view, showTitle, sectionOf],
  );

  const editingKey = editing ? wordRow(editing.assetId, editing.index) : null;
  const anchorKey = selection ? wordRow(selection.assetId, selection.anchor) : null;
  const focusKey = selection ? wordRow(selection.assetId, selection.focus) : null;
  const rows = useVirtualRows({
    scrollRef: bodyRef,
    keys: layout.keys,
    estimate,
    pinned: [editingKey, anchorKey, focusKey, match?.key],
    sticky: layout.sticky,
    measureKey: view === 'source' ? view : `${view}:${language}`,
  });
  const { scrollToIndex, scrollTo } = rows;

  // Jumping to another match: first center that paragraph. After it is mounted and measured, align the highlighted characters to the middle of the viewport.
  useEffect(() => {
    const index = match ? layout.indexOf.get(match.key) : undefined;
    if (index === undefined) return;
    void scrollToIndex(index, { align: 'center' }).then((done) => {
      const list = bodyRef.current;
      const mark = list?.querySelector('[data-match-current]');
      if (!done || !list || !mark) return;
      const box = list.getBoundingClientRect();
      const at = mark.getBoundingClientRect();
      scrollTo(list.scrollTop + at.top - box.top - (list.clientHeight - at.height) / 2);
    });
    // Position only when jumping to a different match (the panel changes `match` for each match).
  }, [match]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a sub-video opens, scroll to before the clip (with the front seam row at the top): once per video. After that, putting sentences back or expanding seams does not scroll again.
  const revealed = useRef<string | null>(null);
  useEffect(() => {
    // The scroll for adjusting start and end from the transcript happens this time. The opening scroll counts as already done, so two scrolls do not fight each other.
    if (jump) {
      const index = layout.indexOf.get(jump.key);
      if (index === undefined) return;
      consumeCutJump(jump.n);
      if (reveal) revealed.current = reveal.id;
      void scrollToIndex(index, { align: 'start' });
      return;
    }
    if (!reveal || revealed.current === reveal.id) return;
    const index = layout.indexOf.get(reveal.key);
    if (index === undefined) return;
    revealed.current = reveal.id;
    void scrollToIndex(index, { align: 'start' });
  }, [reveal, jump, layout, scrollToIndex]);

  const locate = useCallback(
    (assetId: Id, index: number) => {
      const key = wordRow(assetId, index);
      return key === null ? undefined : layout.indexOf.get(key);
    },
    [wordRow, layout],
  );

  // Blank segments are split by section: one outer div per section, so a chapter header's sticky position only sticks within its own section (each section used to be one block).
  const groups: ReactNode[][] = models.map(() => []);
  const count = layout.rows.length;
  let next = 0;
  rows.segments.forEach((segment, n) => {
    if ('gap' in segment) {
      const after = rows.segments[n + 1];
      const end = after && 'index' in after ? after.index : count;
      for (let s = 0; s < models.length; s++) {
        const from = Math.max(next, layout.bounds[s]!);
        const to = Math.min(end, layout.bounds[s + 1]!);
        if (to <= from) continue;
        const height = rows.rowTop(to) - rows.rowTop(from);
        if (height > 0) groups[s]!.push(<div key={`gap:${from}`} aria-hidden style={{ height }} />);
      }
      next = end;
      return;
    }
    const i = segment.index;
    const row = layout.rows[i]!;
    next = i + 1;
    const item = {
      ref: rows.measureRef(row.key),
      role: 'listitem',
      'aria-setsize': count,
      'aria-posinset': i + 1,
    } as const;
    const edges = {
      ...ROW_STYLE,
      ...(i === 0 ? { paddingTop: LIST_TOP } : {}),
      ...(showTitle && i === layout.bounds[row.section + 1]! - 1 ? { paddingBottom: SECTION_GAP } : {}),
    };
    let content: ReactNode;
    switch (row.kind) {
      case 'title': {
        const { asset, read, words } = row.model;
        content = (
          <div {...item} style={edges}>
            <div className={sectionHead}>
              <h3 className={sectionTitle} title={asset.name}>
                {asset.name}
              </h3>
              {read ? <span className={sectionStats}>{C.stats(words.length, sectionOf(row.model).cutCount)}</span> : null}
            </div>
          </div>
        );
        break;
      }
      case 'stats':
        content = (
          <div {...item} style={edges} className={sectionStats}>
            {C.stats(row.model.words.length, sectionOf(row.model).cutCount)}
          </div>
        );
        break;
      case 'note':
        content = (
          <div {...item} style={edges}>
            <p className={note}>{row.text}</p>
          </div>
        );
        break;
      case 'empty':
        content = (
          <div {...item} style={edges}>
            <TranscriptChapterEmpty />
          </div>
        );
        break;
      case 'fold': {
        const { model, fold } = row;
        content = (
          <div {...item} style={edges}>
            <ShortsFoldSeam
              fold={fold}
              onMore={() => onFold(model.assetId, fold.side, 'more')}
              onCollapse={() => onFold(model.assetId, fold.side, 'collapse')}
            />
          </div>
        );
        break;
      }
      case 'chapter': {
        const model = row.model;
        const chapter = row.chapter;
        content = (
          <RowHoldContext.Provider value={rows.holdRow(row.key)}>
            <TranscriptChapterHead
              rowProps={item}
              sequence={sequence}
              chapter={chapter}
              paragraphs={row.count}
              cutTrackIds={chapterTracks}
              onCopy={(withSettings) => onCopyChapter(model.assetId, sectionOf(model).rows, chapter, withSettings)}
            />
          </RowHoldContext.Provider>
        );
        break;
      }
      case 'paragraph': {
        const { model, index: n } = row;
        const paragraph = model.paragraphs[n]!;
        const mine =
          selection?.assetId === model.assetId
            ? paragraph.words
                .filter((w) => selected.has(w.index))
                .map((w) => w.index)
                .join(',')
            : '';
        const first = paragraph.words[0]!.index;
        const last = paragraph.words.at(-1)!.index;
        const editingHere = editing?.assetId === model.assetId && editing.index >= first && editing.index <= last ? editing.index : null;
        content = (
          <div {...item} style={edges} className={paraSlot}>
            <RowHoldContext.Provider value={rows.holdRow(row.key)}>
              <ParagraphRow
                model={model}
                index={n}
                view={view}
                editable={editable}
                marks={marksByAsset.get(model.assetId)?.get(n) ?? null}
                moves={sectionOf(model).moves?.[n] ?? null}
                selected={mine ? selected : null}
                selKey={mine}
                editing={editingHere}
                onSeek={seek}
                onCommit={onCommit}
                onCancel={onCancel}
                onAction={onParagraph}
              />
            </RowHoldContext.Provider>
          </div>
        );
        break;
      }
    }
    groups[row.section]!.push(<Fragment key={row.key}>{content}</Fragment>);
  });

  return (
    <div ref={bodyRef} className={listBody} tabIndex={0} aria-label={C.title} {...bodyProps} {...rows.containerProps}>
      <TranscriptFollow
        models={models}
        bodyRef={bodyRef}
        follow={follow}
        editing={editing !== null}
        words={view !== 'translation'}
        resume={resume}
        locate={locate}
        rows={rows}
      />
      {groups.map((items, s) => (
        <div key={models[s]!.record.id}>{items}</div>
      ))}
    </div>
  );
}

/**
 * One paragraph. It subscribes to the playhead itself (current word, read threshold), so during playback only the one or two paragraphs being read redraw, while the list and the other paragraphs do not.
 * The current word yields a number only when it is inside this paragraph. The read threshold is folded into constants (fully read or not yet read). See `paragraphPlayed`.
 */
const ParagraphRow = memo(function ParagraphRow({
  model,
  index: n,
  view,
  editable,
  marks,
  moves,
  selected,
  selKey,
  editing,
  onSeek,
  onCommit,
  onCancel,
  onAction,
}: {
  model: SourceModel;
  index: number;
  view: TranscriptView;
  editable: boolean;
  marks: ParaMarks | null;
  moves: ParagraphMoves | null;
  selected: ReadonlySet<number> | null;
  selKey: string;
  editing: number | null;
  onSeek(seconds: number): void;
  onCommit(assetId: Id, index: number, text: string): void;
  onCancel(): void;
  onAction(assetId: Id, index: number, action: ParagraphAction, moves: ParagraphMoves | null): void;
}) {
  const paragraph = model.paragraphs[n]!;
  const first = paragraph.words[0]!.index;
  const last = paragraph.words.at(-1)!.index;
  const active = useEditor((s) => {
    const at = wordAt(model.index, s.playhead);
    return at !== null && at >= first && at <= last ? at : null;
  });
  const played = useEditor((s) => paragraphPlayed(model.playedSpans[n] ?? null, playedUntil(model.played, s.playhead)));
  const { read, speakers } = model;
  // Words of a sub-video outside the clip: those struck through other than the first and last kept words. Clicking one restores it (only when editable; the hover hint follows).
  const fold = editable ? model.fold : null;
  return (
    <Paragraph
      keptFrom={fold ? (model.words[fold.firstKept]?.index ?? null) : null}
      keptTo={fold ? (model.words[fold.lastKept]?.index ?? null) : null}
      assetId={model.assetId}
      index={n}
      paragraph={paragraph}
      text={model.texts[n]!}
      view={view}
      translation={view === 'source' ? null : (model.translations?.[n] ?? '')}
      marks={marks}
      markKey={marks?.key ?? ''}
      moves={moves}
      editable={editable}
      selected={selected}
      selKey={selKey}
      active={active}
      played={played}
      editing={editing}
      speaker={paragraph.speaker !== undefined && speakers.size > 1 ? (read?.speakers.get(paragraph.speaker) ?? paragraph.speaker) : null}
      hue={paragraph.speaker !== undefined ? (speakers.get(paragraph.speaker) ?? 0) % SPEAKER_HUES : null}
      onSeek={onSeek}
      onCommit={onCommit}
      onCancel={onCancel}
      onAction={onAction}
    />
  );
});

/** Playback following state: `off` means the user scrolled away manually during playback; `last` is the scrollTop last emitted (cleared when following resumes). */
interface FollowState {
  off: boolean;
  last: number | null;
}

/**
 * Playback following (prototype panel-transcript-follow.jsx `useTranscriptFollow`): during playback, scroll the current word to the vertical middle of the list. It draws nothing. It is its own component that subscribes to the current word, so the whole list does not re-render on every word change.
 *
 * - The element that really scrolls (the list's `bodyRef`) does the scrolling. It does not use `scrollIntoView`, which would also scroll the ancestors.
 * - If the current word is mounted (usually near the viewport), smooth-scroll it to the center as before. If it is not mounted (a far jump), first scroll its paragraph to the middle by index (virtual list estimate → measure → correct). Once it is mounted, center it precisely on the word node, writing directly with `scrollTo` and recording it as a programmatic scroll.
 * - If the computed center position differs from the last one emitted by less than 1px, nothing is emitted: changing words within the same row does not scroll, and only a new row does.
 * - When the playhead is in a pause (no current word), it stays put. It does not scroll while paused, and it does not follow while a word is being edited. When several transcripts have a current word at once, it follows the first.
 * - In translation-only view there are no word nodes and no per-word timing, so following works by whole paragraph (§5.7): when the paragraph changes, the paragraph holding the current word is scrolled to the middle by index. The bilingual view still follows the original's words.
 * - Manually scrolling away stops following. The panel responds only to user input (wheel, touch drag, pressing on the scrollbar, recorded in `follow.off`) and not to scroll events, so the anchor correction of the virtual list and the scrollTop written while aligning do not break following. Following resumes on a jump from the panel, or when playback restarts from a pause (`resume`).
 */
function TranscriptFollow({
  models,
  bodyRef,
  follow,
  editing,
  words,
  resume,
  locate,
  rows,
}: {
  models: readonly SourceModel[];
  bodyRef: React.RefObject<HTMLDivElement | null>;
  follow: React.RefObject<FollowState>;
  editing: boolean;
  /** Word nodes drawn in the list (not drawn in translation-only view). */
  words: boolean;
  resume(): void;
  /** The index in the list of the paragraph holding word n of a transcript. */
  locate(assetId: Id, index: number): number | undefined;
  rows: Pick<VirtualRows, 'scrollToIndex' | 'scrollTo'>;
}) {
  const playing = useEditor((s) => s.playing);
  // With word nodes, this is “which word n of which transcript.” In translation-only view it is only “which list row” (within the same paragraph, changing words does not change it, so following does not rerun).
  const current = useEditor((s) => {
    for (const m of models) {
      const at = wordAt(m.index, s.playhead);
      if (at === null) continue;
      if (words) return `${m.assetId}\u0000${at}`;
      const row = locate(m.assetId, at);
      return row === undefined ? null : `\u0000${row}`;
    }
    return null;
  });
  useEffect(() => {
    if (playing) resume();
  }, [playing, resume]);
  const { scrollToIndex, scrollTo } = rows;
  useEffect(() => {
    const list = bodyRef.current;
    const state = follow.current;
    if (!playing || state.off || editing || current === null || !list) return;
    const [assetId, at] = current.split('\u0000') as [Id, string];
    if (!words) {
      // Translation-only: translations have no per-word timing, so following works by whole paragraph (§5.7). When the paragraph changes, center that paragraph, using the same scrollToIndex.
      state.last = null;
      void scrollToIndex(Number(at), { align: 'center' });
      return;
    }
    const find = () => list.querySelector(`[data-a="${CSS.escape(assetId)}"][data-w="${at}"]`);
    const center = (node: Element, smooth: boolean) => {
      const box = list.getBoundingClientRect();
      const rect = node.getBoundingClientRect();
      const top = centerScrollTop(list.scrollHeight, list.clientHeight, rect.top - box.top + list.scrollTop, rect.height);
      if (state.last !== null && Math.abs(top - state.last) < 1) return;
      state.last = top;
      if (Math.abs(top - list.scrollTop) < 1) return;
      if (smooth) list.scrollTo({ top, behavior: 'smooth' });
      else scrollTo(top);
    };
    const node = find();
    if (node) {
      center(node, true);
      return;
    }
    const index = locate(assetId, Number(at));
    if (index === undefined) return;
    let alive = true;
    void scrollToIndex(index, { align: 'center' }).then((done) => {
      const target = alive && done ? find() : null;
      if (target) center(target, false);
    });
    return () => {
      alive = false;
    };
  }, [playing, current, editing, words, bodyRef, follow, locate, scrollToIndex, scrollTo]);
  return null;
}
