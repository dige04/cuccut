import { useEffect, useMemo, useState, type ComponentType } from 'react';
import type { Id, SpaceEntry } from '@cuccut/protocol';
import { ActionButton, Badge, Button, ProgressCircle, TextField, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import ChevronLeft from '@react-spectrum/s2/icons/ChevronLeft';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import Cut from '@react-spectrum/s2/icons/Cut';
import Export from '@react-spectrum/s2/icons/Export';
import Folder from '@react-spectrum/s2/icons/Folder';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { untitled } from '../../copy.ts';
import { aiTool } from '../../model/ai-tools.ts';
import { agentRunState } from '../../model/ai-tools-handoff.ts';
import { formatClock, formatDuration } from '../../model/format.ts';
import { createdVideoIds, entryVideoId, framingShots, pagerIndex, shortsBatch, type ShortsDerivation } from '../../model/shorts-result.ts';
import { derivedFrom, videoTargetOf } from '../../model/space.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useTimeline } from '../../state/timeline-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { requestExport } from '../export/export-request.ts';
import { ReviewBadge } from '../review/review-badge.tsx';
import { openReview } from '../review/review-dialog.tsx';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { setAiToolPage, setPanelLanding, type AiToolPage } from './ai-tools-nav.ts';
import { PanelHead } from './panel-head.tsx';
import { SHORTS_COPY as S } from './shorts-copy.ts';
import { openCutEntry } from './shorts-entry.ts';
import { focusShortsRun, latestShortsRun, useShortsRuns } from './shorts-runs.ts';
import { exportShorts, renameShort, useShortFacts } from './shorts-video-ops.ts';

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 12, paddingBottom: 16 });
const pager = style({ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, font: 'ui-xs', color: 'gray-700' });
const tabular = { fontVariantNumeric: 'tabular-nums' } as const;
const lead = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 'lg',
  backgroundColor: 'gray-75',
  font: 'ui-sm',
  color: 'gray-800',
  lineHeight: '[1.5]',
});
const list = style({ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 });
const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-200', isCurrent: 'blue-800' },
  backgroundColor: { default: 'transparent', isCurrent: 'blue-100' },
});
const cardHead = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const cardN = style({ flexShrink: 0, font: 'code-xs', color: 'gray-600' });
const cardTitle = style({
  flexGrow: 1,
  minWidth: 0,
  padding: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
  textAlign: 'start',
  font: 'ui',
  fontWeight: 'bold',
  color: 'gray-900',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'text',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
  borderRadius: 'sm',
});
const renameField = style({ flexGrow: 1, minWidth: 0 });
const cardSpan = style({ font: 'ui-xs', color: 'gray-600' });
/** The “opening” and “why this one” rows (prototype .sc-quote / .sc-why): small label on the left, body text on the right. */
const line = style({ display: 'flex', alignItems: 'baseline', gap: 8, font: 'ui-sm', lineHeight: '[1.5]' });
const lineLabel = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-600' });
const quote = style({ minWidth: 0, color: 'gray-900' });
const why = style({ minWidth: 0, color: 'gray-700' });
const flags = style({ display: 'flex', flexWrap: 'wrap', gap: 4 });
const cardActs = style({ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'end' });
const status = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, font: 'ui-sm', color: 'gray-700' });
const hint = style({ marginTop: 12, marginBottom: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const secHead = style({ marginTop: 20, marginBottom: 4, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const tile = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: 'full',
  boxSizing: 'border-box',
  paddingX: 12,
  paddingY: 8,
  borderRadius: 'lg',
  borderWidth: 0,
  textAlign: 'start',
  font: 'ui-sm',
  color: 'gray-800',
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isPressed: 'gray-200' },
  cursor: 'pointer',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
  transition: 'default',
});
const tileText = style({ display: 'flex', flexDirection: 'column', gap: '[2px]', flexGrow: 1, minWidth: 0, lineHeight: '[1.4]' });
const tileName = style({ font: 'ui', fontWeight: 'bold', color: 'inherit' });
const tileSub = style({ font: 'ui-xs', color: 'gray-600' });
const tileIcon = style({ display: 'flex', flexShrink: 0, color: 'gray-700' });
const chev = style({ display: 'flex', flexShrink: 0, color: 'gray-500' });

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const fail = (error: unknown) => ToastQueue.negative(S.failed(reasonOf(error)), { timeout: 6000 });

/** Opens another video; the right panel lands on the AI tools tab's `page` (result page or parameter page). */
function openWithPage(entry: SpaceEntry, page: AiToolPage): void {
  const id = entryVideoId(entry);
  if (!id) return;
  setAiToolPage(id, page);
  setPanelLanding(id, 'aitools');
  useShell.getState().openVideo(videoTargetOf(entry));
}

/** Waits for the editor to switch away from this video (when another one was opened), so it gives it up before moving it to the trash; waits at most `ms`. */
function released(videoId: Id, ms = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (useVideo.getState().video?.videoId !== videoId) return resolve();
    const timer = setTimeout(done, ms);
    const stop = useVideo.subscribe((s) => {
      if (s.video?.videoId !== videoId) done();
    });
    function done() {
      clearTimeout(timer);
      stop();
      resolve();
    }
  });
}

/**
 * Result page for cutting shorts (prototype panel-aitools-shorts-result.jsx `ShortsCutResult`, product design §5.10 “result page”): the sub-videos cut in this session run, one card each: title (click to rename, `renameVideo`), start and end in the source and current duration, the opening line, why it was picked and a badge (shown only when the source document provides one), “now watching”, “Open” and “Don't keep this one”. At the top, “N created” and “k/N ‹ ›” to step through them. “Open” switches to that one in the same editor; the result page stays on the right with that card highlighted. “Don't keep this one” moves it to the trash, with undo offered in the toast.
 * Below, “Next”: cut more (back to the parameter page, with “skip ones already cut” checked), watch these in Space (filtered by source), export all… (starts one final-render export per sub-video, `exportShorts`).
 *
 * This page belongs to that run and is attached to the parent video (`host`): opening the parent or any of its sub-videos shows the same page. The run is recognized by the handoff recorded on this machine (`useShortsRuns`); with no record (for example, a sub-video opened directly in Space), all sub-videos derived from this parent video are listed.
 */
export function ShortsResultPage({ videoId, host }: { videoId: Id; host: Id }) {
  const runtime = useRuntime();
  const run = useShortsRuns((s) => latestShortsRun(s.runs, host));
  const conversationId = run?.conversationId ?? null;
  useEffect(() => (conversationId ? runtime.watchConversation(conversationId) : undefined), [runtime, conversationId]);
  const items = useTimeline((s) => (conversationId ? s.byConversationId[conversationId]?.items : undefined));
  const entries = useSpace((s) => s.entries);
  const created = useMemo(() => createdVideoIds(items), [items]);
  const batch = useMemo(
    () =>
      run
        ? shortsBatch(entries, { parentVideoId: host, conversationId: run.conversationId, handedAt: run.handedAt, created })
        : shortsBatch(
            entries.filter((e) => derivedFrom(e) === host),
            { parentVideoId: host, conversationId: '', handedAt: '', created: null },
          ),
    [entries, run, host, created],
  );
  const live = useMemo(() => batch.filter((e) => !e.user.trashedAt), [batch]);
  const state = run ? agentRunState({ taskId: run.taskId, handedAt: run.handedAt, items }) : null;
  const working = state?.kind === 'starting' || state?.kind === 'running' || state?.kind === 'waiting';

  const openName = useVideo((s) => s.video?.state?.video?.name ?? null);
  const hostEntry = entries.find((e) => e.kind === 'video' && !e.user.trashedAt && entryVideoId(e) === host) ?? null;
  const hostName = hostEntry?.name ?? (videoId === host ? openName : null) ?? untitled();
  const inChild = videoId !== host;

  const ids = live.map((e) => entryVideoId(e)!);
  const at = pagerIndex(ids, videoId, run?.focus ?? null);
  // The verdict badges (docs/cuccut/m2-review-gate.md §2.4) read the `review` topic's summaries; a short checked in an
  // earlier run of the Runtime is read once here, so its badge does not say "Not checked" for a stored result.
  const idsKey = ids.join(',');
  useEffect(() => {
    if (idsKey) void runtime.reviewPeek(idsKey.split(','));
  }, [runtime, idsKey]);

  const resultPage: AiToolPage = { tool: 'shortscut', preset: null, phase: 'result', host };
  const open = (entry: SpaceEntry) => {
    const id = entryVideoId(entry);
    if (!id) return;
    if (run) focusShortsRun(run.conversationId, id);
    if (id !== videoId) openWithPage(entry, resultPage);
  };
  // “Back”: in the parent video, returns to the parameter page (settings are kept in the local draft); in a sub-video, returns to the parent video, where the result page is still there.
  const back = () => {
    if (!inChild) setAiToolPage(videoId, { tool: 'shortscut', preset: null, phase: 'setup' });
    else if (hostEntry) openWithPage(hostEntry, resultPage);
  };
  const more = () => {
    const page: AiToolPage = { tool: 'shortscut', preset: { skipDone: true }, phase: 'setup' };
    if (!inChild) setAiToolPage(videoId, page);
    else if (hostEntry) openWithPage(hostEntry, page);
  };
  const inSpace = () => useShell.getState().go({ tab: 'space', category: 'all', projectId: null, from: host });
  // “Export all…”: each sub-video from this run that has not been moved to the trash starts its own final-render export (`exportShorts`); progress shows in the task list, and the sub-video that is open gets its export dialog opened to watch it.
  const [exporting, setExporting] = useState(false);
  const exportAll = () => {
    if (exporting || !live.length) return;
    setExporting(true);
    void exportShorts(runtime, live, { opening: S.exportSkipOpening })
      .then((outcome) => {
        if (outcome.cancelled) return;
        if (outcome.started.length && live.some((e) => entryVideoId(e) === videoId)) requestExport(videoId);
        if (outcome.started.length) ToastQueue.positive(S.exportStarted(outcome.started.length), { timeout: 6000 });
        if (outcome.skipped.length) {
          const detail = outcome.skipped.map((x) => S.exportSkippedItem(x.name, x.reason)).join(S.exportSkippedSeparator);
          ToastQueue.negative(S.exportSkipped(outcome.skipped.length, detail), { timeout: 12000 });
        }
      })
      .catch(fail)
      .finally(() => setExporting(false));
  };
  // The badge opens that short (when it is not the one open) and its review dialog.
  const review = (entry: SpaceEntry) => {
    const id = entryVideoId(entry);
    if (!id) return;
    open(entry);
    openReview(id);
  };
  const discard = (entry: SpaceEntry) => {
    const id = entryVideoId(entry);
    const trash = () =>
      runtime
        .updateSpaceEntry(entry.id, { trashed: true })
        .then(() =>
          ToastQueue.neutral(S.discarded(entry.name), {
            timeout: 5000,
            actionLabel: S.undo,
            onAction: () => void runtime.updateSpaceEntry(entry.id, { trashed: false }).catch(fail),
            shouldCloseOnAction: true,
          }),
        )
        .catch(fail);
    // The sub-video that is open: first go back to the parent video (the result page is still there), let go, then move it to the trash.
    if (id === videoId && hostEntry) {
      openWithPage(hostEntry, resultPage);
      void released(videoId).then(trash);
    } else void trash();
  };

  return (
    <>
      <PanelHead title={aiTool('shortscut').name} back={{ label: inChild ? S.backTo(hostName) : C.back, onPress: back }}>
        {batch.length || !working ? (
          <Badge size="S" variant="positive" fillStyle="subtle">
            {S.created(live.length)}
          </Badge>
        ) : null}
        {live.length ? (
          <span className={pager}>
            <span style={tabular}>{S.pager(at + 1, live.length)}</span>
            <ActionButton size="XS" isQuiet aria-label={S.prev} isDisabled={at <= 0} onPress={() => open(live[at - 1]!)}>
              <ChevronLeft />
            </ActionButton>
            <ActionButton size="XS" isQuiet aria-label={S.next} isDisabled={at >= live.length - 1} onPress={() => open(live[at + 1]!)}>
              <ChevronRight />
            </ActionButton>
          </span>
        ) : null}
      </PanelHead>
      <div className={`${body} cc-scroll`}>
        <div className={lead}>
          <span>{S.lead}</span>
        </div>

        {working ? (
          <div className={status} role="status">
            <ProgressCircle size="S" isIndeterminate aria-label={S.working} />
            <span>{S.working}</span>
          </div>
        ) : null}

        <div className={list}>
          {live.map((entry, i) => (
            <ShortCard
              key={entry.id}
              entry={entry}
              n={i + 1}
              current={entryVideoId(entry) === videoId}
              onOpen={() => open(entry)}
              onReview={() => review(entry)}
              onTrim={() => openCutEntry(videoId, runtime.host.platform === 'web')}
              onDiscard={() => discard(entry)}
            />
          ))}
        </div>
        {!working && !batch.length ? <p className={hint}>{S.none}</p> : null}
        {batch.length && !live.length ? <p className={hint}>{S.allTrashed}</p> : null}

        <h3 className={secHead}>{S.nextHead}</h3>
        <NextRow icon={Cut} title={S.more} sub={S.moreSub} onPress={more} />
        <NextRow icon={Folder} title={S.inSpace} sub={S.inSpaceSub(hostName)} onPress={inSpace} />
        {live.length ? (
          <NextRow icon={Export} title={S.exportAll} sub={exporting ? S.exporting : S.exportAllSub(live.length)} onPress={exportAll} isDisabled={exporting} />
        ) : null}
        <p className={hint}>{S.hint}</p>
      </div>
    </>
  );
}

function NextRow({ icon: Icon, title, sub, onPress, isDisabled }: { icon: ComponentType; title: string; sub: string; onPress(): void; isDisabled?: boolean }) {
  return (
    <RACButton className={(state) => tile(state)} onPress={onPress} isDisabled={isDisabled}>
      <span className={tileIcon}>
        <Icon />
      </span>
      <span className={tileText}>
        <span className={tileName}>{title}</span>
        <span className={tileSub}>{sub}</span>
      </span>
      <span className={chev}>
        <ChevronRight />
      </span>
    </RACButton>
  );
}

function spanText(derivation: ShortsDerivation | null, seconds: number | null): string | null {
  const length = seconds !== null ? formatDuration(seconds * 1000) : null;
  if (derivation && length) return S.span(formatClock(derivation.range.start), formatClock(derivation.range.end), length);
  return length;
}

function ShortCard({
  entry,
  n,
  current,
  onOpen,
  onReview,
  onTrim,
  onDiscard,
}: {
  entry: SpaceEntry;
  n: number;
  current: boolean;
  onOpen(): void;
  /** Opens this short's review dialog (opening the short first when it is not the one being watched). */
  onReview(): void;
  /** The “now watching” sub-video goes to the transcript to adjust its start and end (same as the sub-video banner's “Adjust in transcript”, shorts-entry.ts). */
  onTrim(): void;
  onDiscard(): void;
}) {
  const runtime = useRuntime();
  const facts = useShortFacts(entry);
  const id = entryVideoId(entry);
  const reason = facts.derivation?.reason ?? null;
  const notes = facts.derivation?.notes ?? [];
  const shots = framingShots(facts.derivation);
  const [draft, setDraft] = useState<string | null>(null);
  const span = spanText(facts.derivation, facts.seconds);
  const commit = () => {
    const name = draft?.trim() ?? '';
    setDraft(null);
    if (!id || !name || name === entry.name) return;
    renameShort(runtime, videoTargetOf(entry), id, name).catch(fail);
  };
  return (
    <div className={card({ isCurrent: current })} aria-current={current ? 'true' : undefined}>
      <div className={cardHead}>
        <span className={cardN} style={tabular}>
          {n}
        </span>
        {draft !== null ? (
          <TextField
            aria-label={S.renameLabel}
            size="S"
            autoFocus
            value={draft}
            onChange={setDraft}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') setDraft(null);
            }}
            styles={renameField}
          />
        ) : (
          <RACButton className={(state) => cardTitle(state)} aria-label={`${entry.name} · ${S.rename}`} onPress={() => setDraft(entry.name)}>
            <span title={S.rename}>{entry.name}</span>
          </RACButton>
        )}
        {current ? (
          <Badge size="S" variant="informative" fillStyle="subtle">
            {S.watching}
          </Badge>
        ) : null}
        {id ? <ReviewBadge videoId={id} onOpen={onReview} /> : null}
      </div>
      {span ? (
        <span className={cardSpan} style={tabular}>
          {span}
        </span>
      ) : null}
      {facts.opening ? (
        <div className={line}>
          <span className={lineLabel}>{S.hookLabel}</span>
          <q className={quote}>{facts.opening}</q>
        </div>
      ) : null}
      {reason ? (
        <div className={line}>
          <span className={lineLabel}>{S.reasonLabel}</span>
          <span className={why}>{reason}</span>
        </div>
      ) : null}
      {shots !== null ? (
        <div className={line}>
          <span className={lineLabel}>{S.framingLabel}</span>
          <span className={why}>{S.framingShots(shots)}</span>
        </div>
      ) : null}
      {notes.length ? (
        <div className={flags}>
          {notes.map((note, i) => (
            <Badge key={`${i}:${note}`} size="S" variant="notice" fillStyle="subtle">
              {note}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className={cardActs}>
        {/* For the “now watching” sub-video, start and end are adjusted in the transcript (product design §4.6 / §5.10); this only provides the entry point */}
        {current ? (
          <TooltipTrigger>
            <Button size="S" variant="secondary" onPress={onTrim}>
              {S.cutTrim}
            </Button>
            <Tooltip>{S.cutTrimTip}</Tooltip>
          </TooltipTrigger>
        ) : null}
        <Button size="S" variant="secondary" fillStyle="outline" onPress={onDiscard}>
          {S.discard}
        </Button>
        {current ? null : (
          <Button size="S" variant="secondary" onPress={onOpen}>
            {S.open}
          </Button>
        )}
      </div>
    </div>
  );
}
