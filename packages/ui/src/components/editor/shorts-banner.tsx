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
 * 子视频编辑器内容区顶上的一条（原型 shorts-source.jsx `ShortsChildBanner`，产品设计 §5.10）：它从哪部视频切出来、进文稿调起止的那一格、
 * 「回到原片」。桌面端那一轮的结果页还在，「回到原片」时右侧落在 AI 工具 Tab 的结果页；网页没有 AI 工具 Tab，只回来源视频。
 * 来源视频不在视频库里（删了）时不给「回到原片」。不是子视频（没有派生来源文档）时不画。
 *
 * 那一格看右栏在哪（`cutEntryAction`）：不在文稿（或面板收着）是「去文稿调整」——切到文稿、剪辑打开、滚到片段前面那条剪缝，
 * 记下来处（shorts-entry.ts）；从别的面板跳进文稿的换成「回到结果页」/「回到<那个面板>」；直接落在文稿的，桌面端这一轮
 * 有结果页时给「看结果页」，否则不摆。
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
