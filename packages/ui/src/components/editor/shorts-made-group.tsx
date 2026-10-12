import { useEffect, useMemo, useState } from 'react';
import type { Id, SpaceEntry } from '@cuccut/protocol';
import { ActionButton, Button, Text, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import ChevronUp from '@react-spectrum/s2/icons/ChevronUp';
import Folder from '@react-spectrum/s2/icons/Folder';
import Play from '@react-spectrum/s2/icons/Play';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { formatClock, formatDuration } from '../../model/format.ts';
import { MADE_SHOWN, madeShorts } from '../../model/shorts-result.ts';
import { videoTargetOf } from '../../model/space.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { openAiTool } from './ai-tools-nav.ts';
import { SHORTS_COPY as S } from './shorts-copy.ts';
import { useShortFacts } from './shorts-video-ops.ts';

const ROW_H = 56;

const group = style({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-25',
  overflow: 'hidden',
});
const head = style({ display: 'flex', alignItems: 'center', gap: 4, paddingStart: 4, paddingEnd: 8, minHeight: 44 });
const toggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexGrow: 1,
  minWidth: 0,
  paddingX: 4,
  paddingY: 4,
  borderWidth: 0,
  borderRadius: 'default',
  backgroundColor: { default: 'transparent', isHovered: 'gray-100' },
  textAlign: 'start',
  cursor: 'pointer',
  color: 'gray-600',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
});
const headText = style({ display: 'flex', flexDirection: 'column', gap: '[2px]', minWidth: 0 });
const headTitle = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900' });
const headSub = style({ font: 'ui-xs', color: 'gray-600' });
const body = style({ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, borderTopWidth: 1, borderTopStyle: 'solid', borderColor: 'gray-200' });
const rows = style({ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, padding: 0, listStyleType: 'none' });
const more = style({ display: 'flex', paddingX: 4 });
const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: 'full',
  boxSizing: 'border-box',
  height: ROW_H,
  paddingX: 8,
  borderWidth: 0,
  borderRadius: 'default',
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isPressed: 'gray-200' },
  textAlign: 'start',
  cursor: 'pointer',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
});
const thumb = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 24,
  height: 40,
  borderRadius: 'sm',
  backgroundColor: 'gray-200',
  color: 'gray-600',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const rowText = style({ display: 'flex', flexDirection: 'column', gap: '[2px]', minWidth: 0, flexGrow: 1 });
const rowName = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const rowSpan = style({ font: 'ui-xs', color: 'gray-700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const foot = style({ margin: 0, paddingX: 4, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

/**
 * 父视频视频面板顶上的「切出的短视频」（原型 shorts-source.jsx `ShortsMadeGroup`，产品设计 §5.10）：从这部视频切出、
 * 没移进回收站的子视频收成一组，可以收起；新建的排在最上面，默认露出 `MADE_SHOWN` 行，多的收起，「还有 N 支」展开、
 * 「收起」收回。每行名字、在原片上的区间与时长，点一行在同一个编辑器里打开那一支。
 * 子视频按 Space 里的派生来源（`derivedFrom`）反查，父视频自己不记。这是普通的编辑动作，桌面端与 Web 共用；
 * 去往剪成短视频流程的「再切几支」只在有 AI 工具 Tab 的桌面端。
 */
export function ShortsMadeGroup({ videoId }: { videoId: Id }) {
  const runtime = useRuntime();
  const ai = runtime.host.platform !== 'web';
  const entries = useSpace((s) => s.entries);
  const kids = useMemo(() => madeShorts(entries, videoId), [entries, videoId]);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [videoId]);
  if (!kids.length) return null;
  const hidden = Math.max(0, kids.length - MADE_SHOWN);
  const shown = expanded ? kids : kids.slice(0, MADE_SHOWN);
  const inSpace = () => useShell.getState().go({ tab: 'space', category: 'all', projectId: null, from: videoId });

  return (
    <section className={group} aria-label={S.madeTitle}>
      <div className={head}>
        <RACButton className={(state) => toggle(state)} aria-expanded={open} onPress={() => setOpen((v) => !v)}>
          {open ? <ChevronDown /> : <ChevronRight />}
          <span className={headText}>
            <span className={headTitle}>{S.madeTitle}</span>
            <span className={headSub} style={tabular}>
              {S.madeCount(kids.length)}
            </span>
          </span>
        </RACButton>
        {ai ? (
          <Button size="S" variant="secondary" onPress={() => openAiTool(videoId, 'shortscut', { skipDone: true })}>
            <Add />
            <Text>{S.more}</Text>
          </Button>
        ) : null}
        <TooltipTrigger>
          <ActionButton size="S" isQuiet aria-label={S.inSpace} onPress={inSpace}>
            <Folder />
          </ActionButton>
          <Tooltip>{S.inSpace}</Tooltip>
        </TooltipTrigger>
      </div>
      {open ? (
        <div className={body}>
          <ul className={rows} aria-label={S.madeTitle}>
            {shown.map((entry) => (
              <li key={entry.id}>
                <MadeRow entry={entry} />
              </li>
            ))}
          </ul>
          {hidden ? (
            <div className={more}>
              <ActionButton size="S" isQuiet aria-expanded={expanded} onPress={() => setExpanded((v) => !v)}>
                {expanded ? <ChevronUp /> : <ChevronDown />}
                <Text>{expanded ? S.collapse : S.madeMore(hidden)}</Text>
              </ActionButton>
            </div>
          ) : null}
          <p className={foot}>{S.madeFoot}</p>
        </div>
      ) : null}
    </section>
  );
}

function MadeRow({ entry }: { entry: SpaceEntry }) {
  const facts = useShortFacts(entry, false);
  const length = facts.seconds !== null ? formatDuration(facts.seconds * 1000) : null;
  const span = facts.derivation && length ? S.span(formatClock(facts.derivation.range.start), formatClock(facts.derivation.range.end), length) : length;
  return (
    <RACButton className={(state) => row(state)} aria-label={S.madeOpen(entry.name)} onPress={() => useShell.getState().openVideo(videoTargetOf(entry))}>
      <span className={thumb} aria-hidden="true">
        <Play />
      </span>
      <span className={rowText}>
        <span className={rowName} title={entry.name}>
          {entry.name}
        </span>
        {span ? (
          <span className={rowSpan} style={tabular}>
            {span}
          </span>
        ) : null}
      </span>
    </RACButton>
  );
}
