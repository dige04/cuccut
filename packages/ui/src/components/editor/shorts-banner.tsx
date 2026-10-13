import type { DocumentRecord, Id } from '@cuccut/protocol';
import { Button, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import DevicePhone from '@react-spectrum/s2/icons/DevicePhone';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { cutEntryAction } from '../../model/shorts-entry.ts';
import { readDerivation } from '../../model/shorts-result.ts';
import { videoTargetOf } from '../../model/space.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { hostPanelTab, useEditor, type PanelTab } from '../../state/editor-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { openShortsResult, setAiToolPage, setPanelLanding } from './ai-tools-nav.ts';
import { SHORTS_COPY as S } from './shorts-copy.ts';
import { clearCutOrigin, closeCutEntry, openCutEntry, useCutEntry } from './shorts-entry.ts';
import { focusShortsRun, latestShortsRun, useShortsRuns } from './shorts-runs.ts';
import { panelTabLabel } from './side-panel.tsx';

const banner = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  paddingX: 12,
  paddingY: 4,
  minHeight: 40,
  boxSizing: 'border-box',
  backgroundColor: 'blue-100',
  borderBottomWidth: 1,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: 'blue-200',
  font: 'ui-sm',
  color: 'gray-800',
});
const icon = style({ display: 'flex', flexShrink: 0, color: 'blue-900' });
const text = style({ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

/**
 * A strip at the top of the child-video editor's content area (prototype shorts-source.jsx `ShortsChildBanner`, product design §5.10): which video it was cut from, the cell for adjusting the cut's start and end in the script, and
 * “回到原片”(back to source). On desktop the result page from that round still exists, and “回到原片” lands the right side on the result page in the AI Tools tab. The web has no AI Tools tab, so it only goes back to the source video.
 * When the source video is no longer in the video library (deleted), “回到原片” is not offered. When the video is not a child video (no derived source document), nothing is drawn.
 *
 * The cell depends on where the right column is (`cutEntryAction`). When the script is not open (or its panel is collapsed) it is “去文稿调整”(adjust in script): switch to the script, open the cut, scroll to the cut seam in front of the clip, and
 * record where it came from (shorts-entry.ts). When the script was reached from another panel, it becomes “回到结果页”(back to result) or “回到<那个面板>”(back to <that panel>). When the script is already open, on desktop with a result page from this round it shows “看结果页”(view result); otherwise nothing is shown.
 */
export function ShortsChildBanner({ videoId, documents }: { videoId: Id; documents: Record<Id, DocumentRecord> }) {
  const web = useRuntime().host.platform === 'web';
  const derivation = readDerivation(documents);
  const parentId = derivation?.parentVideoId ?? null;
  const parent = useSpace((s) =>
    parentId ? (s.entries.find((e) => e.kind === 'video' && !e.user.trashedAt && e.ref && 'videoId' in e.ref && e.ref.videoId === parentId) ?? null) : null,
  );
  const run = useShortsRuns((s) => (parentId ? latestShortsRun(s.runs, parentId) : null));
  const tab = useEditor((s) => (s.panelHidden ? null : hostPanelTab(s.panelTab, web)));
  const origin = useCutEntry((s) => (s.origin?.videoId === videoId ? s.origin : null));
  if (!derivation) return null;

  const back = () => {
    if (!parent || !parentId) return;
    if (!web) {
      if (run) focusShortsRun(run.conversationId, videoId);
      setAiToolPage(parentId, { tool: 'shortscut', preset: null, phase: 'result', host: parentId });
      setPanelLanding(parentId, 'aitools');
    }
    useShell.getState().openVideo(videoTargetOf(parent));
  };

  const entry = cutEntryAction<PanelTab>(tab, origin, {
    hasResult: !!run,
    ai: !web,
    railLabel: origin ? panelTabLabel(origin.tab) : null,
  });
  const showResult = () => {
    if (!parentId) return;
    if (run) focusShortsRun(run.conversationId, videoId);
    clearCutOrigin();
    openShortsResult(videoId, parentId);
  };
  const onEntry = () => {
    if (entry.kind === 'adjust') openCutEntry(videoId, web);
    else if (entry.kind === 'back') closeCutEntry();
    else if (entry.kind === 'backResult' || entry.kind === 'result') showResult();
  };
  const [label, tip] =
    entry.kind === 'adjust'
      ? [S.cutAdjust, S.cutAdjustTip]
      : entry.kind === 'back'
        ? [S.cutBack(entry.railLabel ?? ''), S.cutBackTip]
        : entry.kind === 'backResult'
          ? [S.cutBackResult, S.cutBackTip]
          : entry.kind === 'result'
            ? [S.cutResult, S.cutResultTip]
            : [null, null];

  const title = parent ? S.bannerFrom(parent.name) : S.bannerMissing;
  return (
    <div className={banner} role="note">
      <span className={icon}>
        <DevicePhone />
      </span>
      <span className={text} title={title}>
        {title}
      </span>
      {label ? (
        <TooltipTrigger>
          <Button size="S" variant="secondary" onPress={onEntry}>
            {label}
          </Button>
          <Tooltip>{tip}</Tooltip>
        </TooltipTrigger>
      ) : null}
      {parent ? (
        <Button size="S" variant="secondary" onPress={back}>
          {S.bannerBack}
        </Button>
      ) : null}
    </div>
  );
}
