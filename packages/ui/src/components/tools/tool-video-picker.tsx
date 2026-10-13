import { useMemo, useState } from 'react';
import type { Id } from '@cuccut/protocol';
import { ActionButton, Badge, SearchField, Text } from '@react-spectrum/s2';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import Video from '@react-spectrum/s2/icons/Video';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Radio, RadioGroup } from 'react-aria-components';
import { formatBytes, measureText, statusText } from '../../model/space.ts';
import { isVideoTool, type ToolId } from '../../model/tool-catalog.ts';
import { spaceKindsOf, spaceKindsText, spaceRows, type SpaceRow } from '../../model/tool-space-input.ts';
import { NEEDS } from '../../model/tool-targets.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { EmptyCard } from '../models/model-parts.tsx';
import { EntryThumb } from '../space/space-list.tsx';
import { PICKER_COPY } from './tools-copy.ts';
import { PAGE, type Candidates } from './use-candidates.ts';

export { useCandidates, type Candidates } from './use-candidates.ts';

/*
 * The Space picker for tools (product design §2.7 “Pages”, item 1; design files tool-space-picker.jsx and tool-video-picker.jsx, tools.css `.tvp*`):
 * lists only the kinds this tool accepts (model/tool-space-input.ts), and items in the trash are not listed; videos come from `tools.candidates` (marking existing transcripts, translations and
 * dubbings), and other entries come from the Space directory. This only draws: a search box plus a single-select list, where items that cannot be selected are greyed out with the reason written out.
 */

const box = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingX: 20,
  paddingY: 16,
  borderRadius: '[24px]',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  minWidth: 0,
});
const head = style({ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 });
const headTitle = style({ flexGrow: 1, margin: 0, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const small = style({ font: 'ui-xs', color: 'gray-600', minWidth: 0 });
const list = style({ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto', minWidth: 0 });
const row = style({
  display: 'flex',
  alignItems: 'start',
  gap: 8,
  padding: 8,
  borderRadius: 'default',
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isSelected: 'blue-100', isDisabled: 'transparent' },
  cursor: { default: 'default', isDisabled: 'default' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: -2,
  minWidth: 0,
});
const dot = style({
  flexShrink: 0,
  boxSizing: 'border-box',
  width: 14,
  height: 14,
  marginTop: '[3px]',
  borderRadius: 'full',
  borderStyle: 'solid',
  borderWidth: { default: 2, isSelected: '[4px]' },
  borderColor: { default: 'gray-500', isSelected: 'blue-900', isDisabled: 'gray-300' },
  backgroundColor: 'gray-25',
});
const rowText = style({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flexGrow: 1 });
const rowTitle = style({ font: 'ui', fontWeight: 'bold', color: { default: 'gray-900', isDisabled: 'gray-600' }, overflowWrap: 'anywhere' });
const rowSub = style({ font: 'ui-xs', color: 'gray-700' });
const tags = style({ display: 'flex', flexWrap: 'wrap', gap: 4 });
const why = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  font: 'ui-xs',
  color: 'gray-700',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const foot = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0 });

/** All candidates for this tool (without a search term): the page uses it to find the selected row. `data` is the video candidates; tools that do not accept videos pass null. */
export function useSpaceRows(tool: ToolId, data: Candidates | null): SpaceRow[] {
  const entries = useSpace((s) => s.entries);
  const videos = data?.rows;
  return useMemo(() => spaceRows(tool, entries, videos ?? []), [tool, entries, videos]);
}

/**
 * The second line of a row: for a video it is “项目名 · N 分钟” (project name · N min); the duration comes from the media info of the Space entry, which the candidates do not have. For other entries it is “种类 · 大小 · 时长或尺寸 · 项目 · 状态” (kind · size · duration or dimensions · project · status).
 * Durations are written as m:ss (a few-second audio clip is not written as “1 分钟” (1 min)).
 */
function useRowDetails(): (r: SpaceRow) => string {
  const projects = useDirectory((s) => s.projects);
  const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  return (r) => {
    const projectId = r.video ? r.video.projectId : (r.entry?.source.projectId ?? r.entry?.origin?.projectId ?? null);
    const project = (projectId && names.get(projectId)) || PICKER_COPY.noProject;
    const sec = r.entry?.media?.durationSec;
    const minutes = sec ? PICKER_COPY.minutes(Math.max(1, Math.round(sec / 60))) : null;
    if (r.video) return minutes ? `${project} · ${minutes}` : project;
    const status = r.entry ? statusText(r.entry) : null;
    const measure = r.entry ? measureText(r.entry) : null;
    return [r.kindLabel, r.entry ? formatBytes(r.entry.size) : null, measure, project, status].filter(Boolean).join(' · ');
  };
}

/** Space picker: a search box plus a single-select list; selectable items come first, and items that cannot be selected are greyed out with the reason. `data` is the video candidates (tools that do not accept videos pass null). */
export function SpacePicker({
  tool,
  data,
  value,
  onChange,
  label,
}: {
  tool: ToolId;
  data: Candidates | null;
  value: Id | null;
  onChange: (entryId: Id) => void;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const entries = useSpace((s) => s.entries);
  const all = useSpaceRows(tool, data);
  const rows = query.trim() ? spaceRows(tool, entries, data?.rowsFor(query) ?? [], query) : all;
  const ok = all.filter((r) => r.eligible).length;
  const details = useRowDetails();
  const page = data?.page ?? null;
  const onlyVideos = spaceKindsOf(tool).every((k) => k === 'video');
  const title = label ?? (onlyVideos ? PICKER_COPY.label : PICKER_COPY.spaceLabel);
  const count = !onlyVideos
    ? PICKER_COPY.countKinds(spaceKindsText(tool), ok)
    : isVideoTool(tool) && NEEDS[tool] === 'transcript'
      ? PICKER_COPY.countTranscript(ok)
      : PICKER_COPY.count(ok);
  const loading = !!data?.loading && !all.length;
  return (
    <section className={box} aria-label={title}>
      <div className={head}>
        <h2 className={headTitle}>{title}</h2>
        {page || !data ? <span className={small}>{count}</span> : null}
      </div>
      <SearchField aria-label={PICKER_COPY.search} placeholder={PICKER_COPY.searchPlaceholder} value={query} onChange={setQuery} />
      {data?.error && !page ? (
        <span className={small} role="alert">
          {PICKER_COPY.failed(data.error)}
        </span>
      ) : null}
      {loading ? (
        <span className={small} role="status">
          {PICKER_COPY.loading}
        </span>
      ) : rows.length ? (
        <RadioGroup aria-label={title} value={value} onChange={(v) => onChange(v)} className={list}>
          {rows.map((r) => (
            <Radio key={r.entryId} value={r.entryId} isDisabled={!r.eligible} className={(rp) => row(rp)}>
              {({ isSelected, isDisabled }) => (
                <>
                  <span className={dot({ isSelected, isDisabled })} aria-hidden />
                  {r.entry ? <EntryThumb entry={r.entry} small /> : null}
                  <span className={rowText}>
                    <span className={rowTitle({ isDisabled })}>{r.name}</span>
                    <span className={rowSub}>{details(r)}</span>
                    {r.eligible ? (
                      r.video?.tags.length ? (
                        <span className={tags}>
                          {r.video.tags.map((t) => (
                            <Badge key={t.key} size="S" fillStyle="subtle" variant={t.key === 'transcript' ? 'accent' : 'neutral'}>
                              {t.label}
                            </Badge>
                          ))}
                        </span>
                      ) : null
                    ) : (
                      <span className={why}>
                        <InfoCircle aria-hidden />
                        {r.reason}
                      </span>
                    )}
                  </span>
                </>
              )}
            </Radio>
          ))}
        </RadioGroup>
      ) : onlyVideos ? (
        <EmptyCard icon={<Video />} title={PICKER_COPY.emptyTitle} body={PICKER_COPY.emptyBody} />
      ) : (
        <EmptyCard icon={<Video />} title={PICKER_COPY.emptySpaceTitle} body={PICKER_COPY.emptySpaceBody(spaceKindsText(tool))} />
      )}
      {page && (page.pendingVideos > 0 || page.scanning || page.nextCursor) ? (
        <div className={foot}>
          {page.pendingVideos > 0 ? <span className={small}>{PICKER_COPY.pending(page.pendingVideos)}</span> : null}
          {page.scanning ? <span className={small}>{PICKER_COPY.scanning}</span> : null}
          {page.nextCursor && data ? (
            <>
              <span className={small}>{PICKER_COPY.shown(page.list.length, page.total)}</span>
              <ActionButton isQuiet size="S" onPress={data.more}>
                <Text>{PICKER_COPY.more(Math.min(PAGE, page.total - page.list.length))}</Text>
              </ActionButton>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
