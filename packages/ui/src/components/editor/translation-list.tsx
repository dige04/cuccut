import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import {
  Button,
  Picker,
  PickerItem,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { languageName } from '../../model/caption-tracks.ts';
import { formatClock } from '../../model/format.ts';
import { projectSpeech, readSpeechWords } from '../../model/speech-cues.ts';
import { langName } from '../../model/tools-models.ts';
import { derivedFrom } from '../../model/translation-cues.ts';
import { estimateLines } from '../../model/virtual-rows.ts';
import {
  editableRow,
  isStale,
  needsTranslation,
  pairRows,
  pairStats,
  readTranslation,
  speechSentences,
  unitText,
  type PairRow,
  type TranslationBody,
} from '../../model/translation-doc.ts';
import { liveRefresh } from '../../model/translate-progress.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { openAiTool } from './ai-tools-nav.ts';
import { useEditorActions } from './editor-context.tsx';
import { usePlaybackFollow } from './use-playback-follow.ts';
import { useDocumentBody } from './use-document-body.ts';
import { TRANSLATE_COPY as C } from './translate-copy.ts';
import { editTranslation, markTranslation, openFlow, putOnScreen, startRefresh, useTranslateRun, type CompareMode } from './translate-run.ts';
import { TranslationStatbar, UnitMenu, useAgentRetranslate, useRetranslateModel, type UnitMenuActions } from './translation-actions.tsx';
import { useVirtualRows } from './use-virtual-rows.ts';

/** Comparison bar (prototype panel-subtitle.jsx `ListBar`, .sublist). */
const bar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
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
const barLabel = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-600' });
const barPicker = style({ flexGrow: 1, minWidth: 96, maxWidth: 200 });

const place = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  paddingX: 12,
  paddingY: 8,
  backgroundColor: 'blue-100',
  font: 'ui-xs',
  color: 'blue-1000',
});
const placeText = style({ flexGrow: 1, minWidth: 0 });
const colhead = style({
  display: 'grid',
  gridTemplateColumns: { default: '1fr 1fr', isSingle: '1fr' },
  gap: 8,
  flexShrink: 0,
  paddingX: 12,
  paddingTop: 8,
  font: 'ui-xs',
  fontWeight: 'bold',
  color: 'gray-600',
});
const list = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingBottom: 12 });
/** A row of the virtual list: there must be no margin between rows; the card spacing (also above the first card) is this layer's 8px top padding. */
const pairRow = style({ paddingTop: 8 });
/** One pair (prototype panel-translate.jsx `PlainCard`): original above, translation below. The pair being played has a blue background; the pair being edited has a blue border. */
const card = style({
  position: 'relative',
  overflow: 'hidden',
  paddingY: '[9px]',
  paddingStart: '[12px]',
  paddingEnd: '[10px]',
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-200', isOn: 'blue-400', isEditing: 'blue-800' },
  backgroundColor: { default: 'gray-25', isOn: 'blue-100', isGone: 'gray-75' },
});
const accent = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  insetStart: 0,
  width: '[3px]',
  backgroundColor: { default: 'gray-300', isOn: 'blue-800', isEditing: 'blue-800', isStale: 'orange-700', isGone: 'gray-400' },
});
const cardHead = style({ display: 'flex', alignItems: 'center', gap: '[6px]', marginBottom: '[5px]', minHeight: 20 });
/** The ⋯ menu sits on the right and does not enlarge the card header (the XS button is a little taller than the header's 20px, so it leaves a little room above and below). */
const headEnd = style({ marginStart: 'auto', marginY: -4, flexShrink: 0 });
const number = style({ fontSize: '[10px]', color: 'gray-500', minWidth: 16 });
const time = style({
  padding: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
  font: 'ui-xs',
  color: { default: 'gray-500', isMissing: 'gray-400' },
  cursor: { default: 'pointer', isMissing: 'default' },
  textDecoration: { isHovered: 'underline' },
  borderRadius: 'sm',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
});
const chip = style({
  flexShrink: 0,
  paddingX: '[6px]',
  borderRadius: 'sm',
  fontSize: '[10px]',
  fontWeight: 'medium',
  lineHeight: '[16px]',
  backgroundColor: { default: 'orange-200', tone: { muted: 'gray-200', info: 'blue-200' } },
  color: { default: 'orange-1100', tone: { muted: 'gray-800', info: 'blue-1100' } },
});
const original = style({ display: 'block', font: 'body-sm', lineHeight: '[1.6]', color: { default: 'gray-600', isGone: 'gray-500' }, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
const translated = style({
  display: 'block',
  marginTop: 4,
  font: 'body-sm',
  lineHeight: '[1.6]',
  color: { default: 'gray-900', isEmpty: 'gray-500', isGone: 'gray-500' },
  fontStyle: { default: 'normal', isEmpty: 'italic' },
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  cursor: { default: 'text', isGone: 'default' },
  borderRadius: 'sm',
  outlineStyle: { default: 'none', ':focus-visible': 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
});
const editor = style({
  display: 'block',
  boxSizing: 'border-box',
  width: 'full',
  marginTop: 4,
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
const muted = style({ font: 'ui-sm', color: 'gray-600', paddingY: 24, paddingX: 12, textAlign: 'center' });
/**
 * Estimated height of a row (used before it is measured): top padding 8, card border 2, top and bottom padding 18, card header 20, 5 below the header. Each line of original and translation is 22.4 (14px × 1.6), with 4 more above the translation. Text is 24 narrower than the list content (border 2, left and right padding 12 and 10).
 */
const ROW_BASE = 53;
const TEXT_SIZE = 14;
const TEXT_LINE = 22.4;
const CARD_INSET = 24;

/** Name of a translation in the comparison bar: the language name. When the same language has several (translated from different transcripts), add the document name. */
function optionLabel(record: DocumentRecord, all: readonly DocumentRecord[]): string {
  const name = record.language ? languageName(record.language) : record.name;
  const twins = record.language ? all.filter((d) => d.language === record.language).length : 1;
  return twins > 1 ? `${name} · ${record.name}` : name;
}

/**
 * Comparison bar (prototype panel-subtitle.jsx `ListBar`): the list shows only the original, the original plus the translation, or only the translation, and says which translation to compare against. When no translation exists, the last two modes cannot be entered: the caller must say where to create one (no silent fallback).
 */
export function CompareBar({
  mode,
  translations,
  compared,
  onMode,
  onPick,
}: {
  mode: CompareMode;
  translations: readonly DocumentRecord[];
  compared: DocumentRecord | null;
  onMode(mode: CompareMode): void;
  onPick(documentId: Id): void;
}) {
  return (
    <div className={bar}>
      <span className={barLabel}>{C.list}</span>
      <SegmentedControl aria-label={C.list} selectedKey={mode} onSelectionChange={(key) => onMode(key as CompareMode)}>
        <SegmentedControlItem id="src">{C.modes.src}</SegmentedControlItem>
        <SegmentedControlItem id="bi">{C.modes.bi}</SegmentedControlItem>
        <SegmentedControlItem id="trans">{C.modes.trans}</SegmentedControlItem>
      </SegmentedControl>
      {mode === 'src' || !compared ? null : (
        <Picker
          aria-label={C.compareLanguage}
          size="S"
          styles={barPicker}
          selectedKey={compared.id}
          onSelectionChange={(key) => key !== null && onPick(String(key))}>
          {translations.map((d) => (
            <PickerItem key={d.id} id={d.id} textValue={optionLabel(d, translations)}>
              <Text slot="label">{optionLabel(d, translations)}</Text>
              {d.language ? <Text slot="description">{langName(d.language)}</Text> : null}
            </PickerItem>
          ))}
        </Picker>
      )}
    </div>
  );
}

/** Document body; while a new version is still being fetched, the previous version is used. */
/**
 * Derivations recorded against the fetched body object (the body does not change after fetching; a change yields a new object): when switching from “only original” back to comparison, the list remounts without having to split several thousand sentences with WASM again.
 */
const derived = new WeakMap<object, Map<string, unknown>>();
function derive<T>(body: unknown, name: string, compute: (body: unknown) => T): T {
  if (typeof body !== 'object' || body === null) return compute(body);
  let entry = derived.get(body);
  if (!entry) derived.set(body, (entry = new Map()));
  if (!entry.has(name)) entry.set(name, compute(body));
  return entry.get(name) as T;
}

function useLoaded(record: DocumentRecord | undefined): unknown {
  const body = useDocumentBody(record);
  const last = useRef<{ id: Id | undefined; body: unknown }>({ id: undefined, body: undefined });
  if (body !== undefined) last.current = { id: record?.id, body };
  return body ?? (last.current.id === record?.id ? last.current.body : undefined);
}

/**
 * Original plus translation comparison list (prototype panel-translate.jsx `EditView`; with `only: 'trans'`, only the translation is shown): pairs sentences, and marks stale ones, untranslated ones and ones whose original was deleted. Clicking a translation rewrites it in place (commit on blur, Esc to discard), in one transaction together with the subtitles generated from it on screen, undoable in one step. Stale and untranslated sentences can be re-translated in place via the model API (Runtime's `translate` refreshes in place) or handed to the Agent, one at a time or in batches. They can also be marked stale by hand, or have the mark cleared (translation-actions.tsx). Web hosts have only markers and copy.
 */
export function TranslationList({
  videoId,
  sequence,
  documents,
  record,
  only,
}: {
  videoId: Id;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  /** `translation` document. */
  record: DocumentRecord;
  only: 'trans' | null;
}) {
  const { seek } = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const web = useRuntime().host.platform === 'web';
  const model = useRetranslateModel();
  const toAgent = useAgentRetranslate(videoId);
  // Refreshing this translation in place: submitted from here (counts even before the receipt arrives), or started elsewhere.
  const ownRefresh = useTranslateRun((s) => s.refreshes[record.id] ?? null);
  // Select the whole task list before computing: `liveRefresh` gives a new object each time, and using it directly as a selector would make zustand 5's subscription think it changed every time.
  const jobs = useJobs((s) => s.jobs);
  const foreignRefresh = useMemo(() => liveRefresh(jobs, record.id), [jobs, record.id]);
  const refreshing = ownRefresh ? ownRefresh.count : foreignRefresh ? foreignRefresh.count : undefined;
  const loaded = useLoaded(record);
  // A translation just edited whose new version is not yet fetched back: further edits are applied on top of it.
  const [local, setLocal] = useState<{ base: unknown; body: TranslationBody } | null>(null);
  useEffect(() => {
    if (local && local.base !== loaded) setLocal(null);
  }, [local, loaded]);
  const translation = useMemo(
    () => (local && local.base === loaded ? local.body : derive(loaded, 'translation', readTranslation)),
    [local, loaded],
  );

  const speechId = record.sourceDocumentId ?? translation?.sourceBasis.speechRef.id ?? null;
  const speechRecord = speechId ? documents[speechId] : undefined;
  const speechBody = useLoaded(speechRecord);
  const words = useMemo(
    () => (speechBody === undefined ? null : derive(speechBody, 'words', (body) => readSpeechWords(body))),
    [speechBody],
  );
  // Sentences and fingerprints are computed via editor-wasm (WASM is inlined in the bundle and instantiated synchronously on first call): computed once per body.
  const ready = useMemo(() => (speechBody === undefined ? null : derive(speechBody, 'sentences', speechSentences)), [speechBody]);

  const rows = useMemo(() => (translation && ready ? pairRows(ready, translation) : []), [translation, ready]);
  const stats = useMemo(() => pairStats(rows), [rows]);

  /** The interval where each sentence first appears on the sequence (words from the source clock are projected through the instance; cut ones have none). */
  const spans = useMemo(() => {
    const map = new Map<Id, { start: number; end: number }>();
    const assetId = speechRecord?.sourceAssetId;
    if (!words || !assetId || !ready) return map;
    const placed = projectSpeech(sequence, assetId, words.words);
    const sentenceOf = new Map<Id, Id>();
    for (const s of ready) for (const w of s.wordIds) sentenceOf.set(w, s.id);
    for (const word of placed) {
      const id = sentenceOf.get(word.id);
      if (!id) continue;
      const span = map.get(id);
      if (!span) map.set(id, { start: word.start, end: word.end });
      else if (word.start >= span.start && word.start - span.end < 1) span.end = Math.max(span.end, word.end);
    }
    return map;
  }, [words, speechRecord?.sourceAssetId, ready, sequence]);

  const activeId = useEditor(
    useCallback(
      (s: { playhead: number }) => {
        for (const [id, span] of spans) if (s.playhead >= span.start && s.playhead < span.end) return id;
        return null;
      },
      [spans],
    ),
  );
  const playing = useEditor((s) => s.playing);
  const listRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // Virtual list: only mounts the cards for one screen before and after the viewport, plus the one being edited (unmounting the edit box would lose uncommitted text and interrupt IME composition).
  const keys = useMemo(() => rows.map((r) => r.key), [rows]);
  const sentenceIndex = useMemo(() => new Map(rows.flatMap((r, index) => (r.sentence ? [[r.sentence.id, index] as const] : []))), [rows]);
  const estimate = useCallback(
    (index: number, width: number) => {
      const r = rows[index];
      if (!r) return ROW_BASE + TEXT_LINE;
      const text = width - CARD_INSET;
      const source = only === 'trans' || !r.sentence ? 0 : estimateLines(r.sentence.text, text, TEXT_SIZE);
      return ROW_BASE + TEXT_LINE * source + 4 + TEXT_LINE * estimateLines(r.unit ? unitText(r.unit) : '', text, TEXT_SIZE);
    },
    [rows, only],
  );
  const virtual = useVirtualRows({ scrollRef: listRef, keys, estimate, pinned: [editing], measureKey: `${record.id}:${only ?? 'both'}` });
  const { scrollToIndex } = virtual;
  // Playback-follow switch (product design §5.7): turned off when the user scrolls away manually; restored when seeking in this panel, or when playback restarts. Switching between comparison and translation-only counts as a changed view, so it is also restored (consistent with the list remounting when switching between original and comparison).
  const follow = usePlaybackFollow(listRef);
  useEffect(() => follow.resume(), [only]); // eslint-disable-line react-hooks/exhaustive-deps
  // While playing, follow the sentence being played and scroll it into view. Scroll only once: on a sentence change, on starting playback, on leaving edit, or on switching view.
  useEffect(() => {
    if (!playing || !activeId || editing || follow.off.current) return;
    const index = sentenceIndex.get(activeId);
    if (index !== undefined) void scrollToIndex(index, { align: 'nearest' });
  }, [activeId, playing, editing, only]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Seeking within this panel (clicking a time, clicking a card): restores following. */
  const seekHere = (at: number) => {
    follow.resume();
    seek(at);
  };

  // Card actions: cards are memoized, so they call the latest handler through this stable ref. During playback, only the two cards entering and leaving “playing” are repainted.
  const actions = useRef<PairActions & UnitMenuActions>(null!);

  const [placing, setPlacing] = useState(false);
  const placed = Object.values(documents).some((d) => derivedFrom(d, record.id));

  if (loaded === undefined) return <div className={muted}>{C.reading}</div>;
  if (!translation) return <div className={muted}>{C.unreadable}</div>;
  if (!speechRecord) return <div className={muted}>{C.speechMissing}</div>;
  if (!ready || !words) return <div className={muted}>{speechBody === undefined ? C.reading : C.unreadable}</div>;

  const language = translation.language || record.language || '';
  const languageLabel = language ? languageName(language) : C.unnamed;
  const sourceLanguage = speechRecord.language ? langName(speechRecord.language) : C.source;
  const todo = rows.filter(needsTranslation).length;
  // Sentences whose whole frame has been cut. Not computed when this transcript is not used on the timeline (otherwise every sentence would be computed).
  const cut = spans.size ? rows.filter((r) => r.sentence && r.state !== 'sentence-gone' && !spans.has(r.sentence.id)).length : 0;
  const scopeOf = (row: PairRow) => {
    const at = row.sentence ? spans.get(row.sentence.id)?.start : undefined;
    return { time: at === undefined ? null : formatClock(at), text: (row.sentence?.text ?? '').trim().slice(0, 24) };
  };
  const commit = async (row: PairRow, text: string) => {
    setEditing(null);
    const before = row.unit ? unitText(row.unit) : '';
    if (text.trim() === before) return;
    const next = await editTranslation({ videoId, record, body: translation, sentences: ready, row, text, speech: words, documents });
    if (next) setLocal({ base: loaded, body: next });
  };
  actions.current = {
    seek: seekHere,
    begin: (row) => {
      const at = row.sentence ? spans.get(row.sentence.id)?.start : undefined;
      if (!playing && at !== undefined) seekHere(at);
      setEditing(row.key);
    },
    commit: (row, text) => void commit(row, text),
    cancel: () => setEditing(null),
    direct: (row) => {
      if (!row.sentence) return;
      void startRefresh({ videoId, record, language, sentences: [row.sentence.id], count: 1, model: model.ref });
    },
    agent: (row) => toAgent({ language: languageLabel, scope: scopeOf(row) }),
    mark: (row, on) =>
      void markTranslation({ videoId, record, body: translation, row, on, speech: words, documents }).then((next) => {
        if (next) setLocal({ base: loaded, body: next });
      }),
  };

  return (
    <>
      {placed ? null : (
        <div className={place}>
          <span className={placeText}>{C.notPlaced}</span>
          <Button
            size="S"
            variant="secondary"
            isDisabled={!editable}
            isPending={placing}
            onPress={() => {
              setPlacing(true);
              void putOnScreen(videoId, record.id).finally(() => setPlacing(false));
            }}>
            {C.place}
          </Button>
        </div>
      )}
      <TranslationStatbar
        stats={stats}
        cut={cut}
        todo={todo}
        refreshing={refreshing}
        web={web}
        editable={editable}
        modelName={model.name}
        onDirect={() => void startRefresh({ videoId, record, language, count: todo, model: model.ref })}
        onAgent={() => toAgent({ language: languageLabel, count: todo })}
        onCut={() => openAiTool(videoId, 'stale', { language: language ? languageName(language) : null, translationId: record.id })}
        onTranslateTool={() => openFlow(videoId, true)}
      />
      <div className={colhead({ isSingle: only === 'trans' })}>
        {only === 'trans' ? null : <span>{C.original(sourceLanguage)}</span>}
        <span>{C.translation(language ? languageName(language) : C.unnamed)}</span>
      </div>
      <div ref={listRef} className={`${list} cc-scroll`} {...virtual.containerProps}>
        {rows.length ? null : <div className={muted}>{C.noRows}</div>}
        {virtual.segments.map((segment, n) => {
          if ('gap' in segment) return <div key={`gap:${n}`} aria-hidden style={{ height: segment.gap }} />;
          const index = segment.index;
          const row = rows[index]!;
          return (
            <div
              key={row.key}
              ref={virtual.measureRef(row.key)}
              className={pairRow}
              role="listitem"
              aria-setsize={rows.length}
              aria-posinset={index + 1}>
              <PairCard
                row={row}
                index={index}
                only={only}
                at={row.sentence ? (spans.get(row.sentence.id)?.start ?? null) : null}
                on={!!row.sentence && row.sentence.id === activeId}
                editing={editing === row.key}
                editable={editable && editableRow(row)}
                ai={!web}
                busy={refreshing !== undefined}
                modelName={model.name}
                actions={actions}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

function stateChip(row: PairRow): { text: string; tone?: 'muted' | 'info'; tip?: string } | null {
  if (row.state === 'sentence-gone') return { text: C.chipGone, tone: 'muted', tip: C.goneTip };
  if (isStale(row.state)) return { text: C.chipStale };
  if (row.state === 'untranslated' || row.state === 'empty') return { text: C.chipUntranslated, tone: 'info' };
  return null;
}

/** Card actions (TranslationList supplies the latest version on every render; cards call it via ref). */
interface PairActions {
  seek(at: number): void;
  begin(row: PairRow): void;
  commit(row: PairRow, text: string): void;
  cancel(): void;
}

const PairCard = memo(function PairCard({
  row,
  index,
  only,
  at,
  on,
  editing,
  editable,
  ai,
  busy,
  modelName,
  actions,
}: {
  row: PairRow;
  index: number;
  only: 'trans' | null;
  /** The moment this sentence first appears on the sequence; null when it has been cut (or the original sentence was deleted). */
  at: number | null;
  on: boolean;
  editing: boolean;
  editable: boolean;
  /** ⋯ menu: desktop (can call models and sessions), whether this translation is being re-translated, and the name of the model called directly. */
  ai: boolean;
  busy: boolean;
  modelName: string | null;
  actions: RefObject<PairActions & UnitMenuActions>;
}) {
  const gone = row.state === 'sentence-gone';
  const stale = isStale(row.state);
  const text = row.unit ? unitText(row.unit) : '';
  const flag = stateChip(row);
  const onSeek = (at: number) => actions.current.seek(at);
  const onBegin = () => actions.current.begin(row);
  return (
    <div className={card({ isOn: on, isEditing: editing, isGone: gone })} data-sentence={row.sentence?.id}>
      <span className={accent({ isOn: on, isEditing: editing, isStale: stale, isGone: gone })} aria-hidden />
      <div className={cardHead}>
        <span className={`${number} cc-tabular`}>{index + 1}</span>
        {gone ? null : (
          <TooltipTrigger>
            <RACButton
              className={({ isHovered, isFocusVisible }) =>
                `${time({ isMissing: at === null, isHovered: isHovered && at !== null, isFocusVisible })} cc-tabular`
              }
              onPress={() => at !== null && onSeek(at)}>
              {at === null ? '—' : formatClock(at, { tenths: true })}
            </RACButton>
            <Tooltip>{at === null ? C.cutTip : C.seekTip}</Tooltip>
          </TooltipTrigger>
        )}
        {flag ? (
          flag.tip ? (
            <TooltipTrigger>
              <RACButton className={chip({ tone: flag.tone })}>{flag.text}</RACButton>
              <Tooltip>{flag.tip}</Tooltip>
            </TooltipTrigger>
          ) : (
            <span className={chip({ tone: flag.tone })}>{flag.text}</span>
          )
        ) : null}
        <span className={headEnd}>
          <UnitMenu row={row} index={index} text={text} ai={ai} editable={editable} busy={busy} modelName={modelName} actions={actions} />
        </span>
      </div>
      {only === 'trans' || !row.sentence ? null : <span className={original({ isGone: gone })}>{row.sentence.text}</span>}
      {editing ? (
        <UnitEditor initial={text} onCommit={(value) => actions.current.commit(row, value)} onCancel={() => actions.current.cancel()} />
      ) : (
        <span
          className={translated({ isEmpty: !text, isGone: gone })}
          role={editable ? 'button' : undefined}
          tabIndex={editable ? 0 : undefined}
          aria-label={editable ? C.editLabel(index + 1) : undefined}
          onClick={() => {
            if (!editable) return at !== null && onSeek(at);
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) return;
            onBegin();
          }}
          onKeyDown={(event) => {
            if (editable && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              onBegin();
            }
          }}>
          {text || (editable ? C.emptyPlaceholder : '—')}
        </span>
      )}
    </div>
  );
});

/** Edit a sentence's translation: commit on blur or Enter, Esc to discard, Shift+Enter for a new line. Enter during IME composition does not count. */
function UnitEditor({ initial, onCommit, onCancel }: { initial: string; onCommit(text: string): void; onCancel(): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
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
    element.setSelectionRange(element.value.length, element.value.length);
    fit();
  }, []);
  const finish = (action: () => void) => {
    handled.current = true;
    action();
  };
  return (
    <textarea
      ref={ref}
      className={editor}
      aria-label={C.editing}
      defaultValue={initial}
      rows={1}
      onInput={fit}
      onBlur={(event) => {
        if (!handled.current) onCommit(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish(onCancel);
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          const value = event.currentTarget.value;
          finish(() => onCommit(value));
        }
      }}
    />
  );
}
