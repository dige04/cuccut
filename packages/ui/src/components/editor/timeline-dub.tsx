import { useEffect, useMemo, useReducer, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { AssetRecord, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { itemRangeSeconds } from '@cuccut/protocol';
import { Header, Heading, Menu, MenuItem, MenuSection, Text } from '@react-spectrum/s2';
import DeleteIcon from '@react-spectrum/s2/icons/Delete';
import EditIcon from '@react-spectrum/s2/icons/Edit';
import PlayIcon from '@react-spectrum/s2/icons/Play';
import RefreshIcon from '@react-spectrum/s2/icons/Refresh';
import VolumeOff from '@react-spectrum/s2/icons/VolumeOff';
import VolumeTwo from '@react-spectrum/s2/icons/VolumeTwo';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { formatTimecode } from '../../model/editor.ts';
import {
  DUB_FAST_RATE,
  anyLocked,
  dubBlocks,
  dubGroups,
  planRecordOf,
  planSpeechId,
  planUnits,
  selectedBlocks,
  showsRate,
  type DubBlock,
} from '../../model/timeline-dub.ts';
import { queuedKey, queuedSet, withRegen } from '../../model/dub-takes.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { DUB_REGEN_COPY as REGEN, TIMELINE_DUB_COPY as COPY } from './dub-copy.ts';
import { openDubFit, regenDeps, regenerateUnits, useDubRegen } from './dub-regen.ts';
import { useEditorActions } from './editor-context.tsx';
import { auditionRange, deleteDubBlocks, muteDubBlocks } from './timeline-commands.ts';

/**
 * Dub blocks on the timeline (design draft timeline-dub.jsx `DubBlock` / `DubBlockMenu`, ui.css `.tdub`): the blocks are faded, with a neutral light-gray fill, a 3px speaker-colored strip on the left edge, and the translation. A speed above 1.35× turns the whole block yellow, with a corner badge reading “1.62× · 过快”. Muted blocks are dimmed with strikethrough; selected blocks get a blue outline.
 * The right edge is a stretch handle: drag it to change this sentence's speed (the timeline handles the gesture; one `setSpeed` on release). Right-click opens the block menu, which acts on the selected sentences.
 * All computation is in model/timeline-dub.ts; this file only draws, and it fetches the dub plan and the transcript body through the document cache.
 */

/**
 * Dub blocks in the sequence: the dub plan and the body of the transcript for the original sentences are fetched through the document cache (shared with preview and subtitle blocks); once fetched, the blocks are recomputed.
 * Until then the blocks still draw (hue takes the first tier, text is left to the clip name). On top of that, the sentences being re-dubbed (the `params.regroup` frozen in the dub flow running in the `jobs` mirror) and the current take number (model/dub-takes.ts) are layered. Task progress events are very frequent, so this subscribes to the sorted string of sentences; it does not recompute when the sentences are unchanged.
 */
export function useDubBlocks(sequence: Sequence, documents: Record<Id, DocumentRecord>, assets: Record<Id, AssetRecord>): ReadonlyMap<Id, DubBlock> {
  const cache = useRuntime().videos.documents;
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const queued = useJobs((s) => queuedKey(s.jobs, videoId));
  const [loaded, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => cache.subscribe(bump), [cache]);
  const { blocks, plans, wanted } = useMemo(() => {
    const plans = new Map<string, unknown>();
    const speeches = new Map<Id, unknown>();
    const missing: Array<[Id, string]> = [];
    const peek = (record: DocumentRecord) => {
      const body = cache.peek(record.id, record.currentRevision);
      if (body === undefined) missing.push([record.id, record.currentRevision]);
      return body;
    };
    for (const group of dubGroups(sequence)) {
      const plan = planRecordOf(documents, group.groupId);
      const body = plan ? peek(plan) : undefined;
      if (body === undefined) continue;
      plans.set(group.groupId, body);
      const speechId = planSpeechId(planUnits(body));
      const speech = speechId ? documents[speechId] : undefined;
      const speechBody = speech ? peek(speech) : undefined;
      if (speechId && speechBody !== undefined) speeches.set(speechId, speechBody);
    }
    return { blocks: dubBlocks(sequence, { assets, plans, speeches }), plans, wanted: JSON.stringify(missing) };
    // `loaded`: new body text was fetched from the cache; recompute once.
  }, [sequence, documents, assets, cache, loaded]);
  useEffect(() => {
    for (const [id, revision] of JSON.parse(wanted) as Array<[Id, string]>) cache.load(id, revision);
  }, [cache, wanted]);
  return useMemo(() => withRegen(blocks, plans, queuedSet(queued)), [blocks, plans, queued]);
}

/** The parts that vary with state. Position, corner radius, border style, clipping, and typography are in editor.css `.cc-clip` / `.cc-dub-block`; the font is inherited from the track (see lane in timeline.tsx). */
const block = style({
  borderWidth: { default: 1, isSelected: 2 },
  cursor: { default: 'grab', isLocked: 'not-allowed' },
  backgroundColor: {
    default: 'gray-50',
    ':hover': 'gray-75',
    isSelected: 'blue-100',
    isFast: { default: 'yellow-200', isSelected: 'yellow-300' },
  },
  borderColor: { default: 'gray-200', isFast: 'yellow-400', isQueued: 'gray-300', isSelected: 'blue-800' },
  color: { default: 'gray-800', isFast: 'yellow-1100', isQueued: 'gray-600' },
  opacity: { default: 1, isOff: 0.45, isMuted: 0.55 },
  // The stripes for sentences being re-dubbed (design draft `.tdub--queued`) live in editor.css, since style macros cannot draw gradients; here only the tokens are given.
  '--cc-dub-stripe': { type: 'backgroundColor', value: 'gray-100' },
  '--cc-dub-stripe-gap': { type: 'backgroundColor', value: 'gray-50' },
});
/** Speaker-color strip on the left edge (design draft `.tdub__sp`; the color is the speaker hue's edge-color tier). */
const speakerStrip = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  insetStart: 0,
  width: 3,
  backgroundColor: {
    hue: { blue: 'blue-400', green: 'green-400', orange: 'orange-400', purple: 'purple-400', magenta: 'magenta-400', indigo: 'indigo-400' },
  },
});
const blockText = style({
  flexGrow: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textDecoration: { default: 'none', isMuted: 'line-through' },
});
const rateBadge = style({
  flexShrink: 0,
  marginStart: 'auto',
  marginEnd: 4,
  paddingX: 4,
  borderRadius: 'sm',
  whiteSpace: 'nowrap',
  backgroundColor: { default: 'gray-200', isFast: 'yellow-400' },
  color: { default: 'gray-800', isFast: 'yellow-1100' },
});
/** Right-edge stretch handle (design draft `.thnd--r`): hit area is min(7, w/3) wide, with a thin speaker-colored bar inside. */
const stretchHandle = style({ position: 'absolute', top: 0, bottom: 0, insetEnd: 0, zIndex: 2, cursor: 'ew-resize' });
const stretchPill = style({
  position: 'absolute',
  top: 2,
  bottom: 2,
  insetEnd: 2,
  width: 4,
  borderRadius: 'full',
  opacity: { default: 0.85, ':hover': 1 },
  backgroundColor: {
    hue: { blue: 'blue-400', green: 'green-400', orange: 'orange-400', purple: 'purple-400', magenta: 'magenta-400', indigo: 'indigo-400' },
  },
});

/** Speed on the badge: 1.0× is not written. */
export function rateText(rate: number, fast: boolean): string {
  return showsRate(rate) ? COPY.rate(rate, fast) : '';
}

/** How this block looks while its right edge is being dragged: the instance's new speed change multiplied by the speed at synthesis time gives the new speed. */
export function stretchedLook(dub: DubBlock, speed: number): { rate: number; fast: boolean } {
  const rate = dub.tempo * speed;
  return { rate, fast: rate > DUB_FAST_RATE + 1e-9 };
}

/** One dub block (its position and width are computed from the gesture by the timeline and passed in). */
export function DubBlockView({
  dub,
  name,
  left,
  width,
  selected,
  locked,
  editable,
  off,
  active,
  stretchSpeed,
  style: extra,
  onPointerDown,
  onContextMenu,
  onStretchPointerDown,
}: {
  dub: DubBlock;
  /** Clip name: written on the block while the plan has not been fetched yet. */
  name: string;
  left: number;
  width: number;
  selected: boolean;
  locked: boolean;
  editable: boolean;
  /** The track it sits on is muted, or this item is disabled. */
  off: boolean;
  active: boolean;
  /** Dragging the right edge: the speed the instance is being dragged to. */
  stretchSpeed: number | null;
  style?: CSSProperties;
  onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void;
  onContextMenu(event: ReactMouseEvent<HTMLDivElement>): void;
  onStretchPointerDown(event: ReactPointerEvent<HTMLDivElement>): void;
}) {
  const queued = dub.queued === true;
  const look = stretchSpeed === null ? { rate: dub.rate, fast: dub.fast } : stretchedLook(dub, stretchSpeed);
  const rate = queued ? '' : rateText(look.rate, look.fast);
  const text = dub.text ?? name;
  // Blocks being re-dubbed get stripes and the text “重新生成中…”, with no badge and no stretch handle (the Runtime write-back will replace this item).
  const canStretch = editable && !locked && !queued;
  const version = dub.version ? REGEN.version(dub.version.k, dub.version.seed) : '';
  const fast = look.fast && !queued;
  return (
    <div
      className={`${block({ isSelected: selected, isFast: fast, isQueued: queued, isMuted: dub.muted, isOff: off, isLocked: locked })} cc-clip cc-dub-block${queued ? ' cc-dub-queued' : ''}`}
      style={{ left, width, ...extra }}
      data-active={active || undefined}
      title={
        queued
          ? REGEN.queuedTip(text)
          : COPY.tip({
              text,
              speaker: dub.speakerName,
              rate: [rate, version].filter(Boolean).join(' · '),
              muted: dub.muted,
              manual: dub.manual,
              editable: canStretch,
            })
      }
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}>
      <span className={speakerStrip({ hue: dub.hue })} />
      {width >= 28 ? <span className={blockText({ isMuted: dub.muted && !queued })}>{queued ? REGEN.queued : text}</span> : null}
      {rate && width >= 84 ? <span className={rateBadge({ isFast: fast })}>{rate}</span> : null}
      {canStretch && (width >= 24 || stretchSpeed !== null) ? (
        <div className={stretchHandle} style={{ width: Math.max(4, Math.min(7, width / 3)) }} onPointerDown={onStretchPointerDown}>
          <span className={stretchPill({ hue: dub.hue })} />
        </div>
      ) : null}
    </div>
  );
}

/** Title of the block menu: one sentence shows its translation (truncated if long); several sentences show the count (design draft model-dub.js `selectionTitle`). */
function menuTitle(chosen: readonly DubBlock[], name: string): string {
  if (chosen.length > 1) return COPY.selection(chosen.length);
  const text = chosen[0]?.text ?? name;
  return text.length > 22 ? `${text.slice(0, 22)}…` : text;
}

/**
 * Right-click menu for a dub block (design draft `DubBlockMenu`): acts on the selected sentences (if the right-clicked block is not in the selection, only that block counts).
 * Listen to this sentence (only when one sentence is selected); mute / unmute; regenerate these sentences (same translation and voice, new seed for synthesis); Edit translation and re-dub…; delete these sentences.
 * “Remove this dub group” has moved to the ⋯ on the dub track header (timeline-dub-head.tsx). Regenerating runs an online model, so it is only enabled on desktop, when the video is editable, when the dub plan for this group can be found, and when none of the selected sentences is being re-dubbed (the Web surface has no AI entry point).
 * Rendered inside the MenuTrigger of the timeline menu (timeline-menu.tsx), whose anchor and open state are managed there.
 */
export function DubBlockMenu({
  dub,
  blocks,
  sequence,
  documents,
  name,
}: {
  dub: DubBlock;
  blocks: ReadonlyMap<Id, DubBlock>;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  name: string;
}) {
  const actions = useEditorActions();
  const runtime = useRuntime();
  const editable = useVideo((s) => canEdit(s.video));
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const selection = useEditor((s) => s.selection);
  const busy = useDubRegen((s) => !!s.busy[dub.groupId]);
  const picked = selectedBlocks(selection, blocks);
  const chosen = picked.some((b) => b.itemId === dub.itemId) ? picked : [dub];
  const ids = chosen.map((b) => b.itemId);
  const n = chosen.length;
  const allMuted = chosen.every((b) => b.muted);
  const one = n === 1 ? sequence.items.find((item) => item.id === chosen[0]!.itemId) : undefined;
  const range = one ? itemRangeSeconds(one, sequence.fps) : null;
  const title = menuTitle(chosen, name);
  const desktop = runtime.host.platform !== 'web';
  const plan = planRecordOf(documents, dub.groupId);
  // The selection may span groups: re-dub only acts on the group of the block that was right-clicked.
  const units = [...new Set(chosen.flatMap((b) => (b.groupId === dub.groupId && b.unitId ? [b.unitId] : [])))];
  const inQueue = chosen.some((b) => b.queued);
  const canRegen = editable && !!plan && !!videoId && units.length > 0 && !inQueue && !busy;
  // Locked items can't be changed (the engine rejects it): if any selected sentence is locked, mute and delete are greyed out.
  const disabled = [...(editable ? (anyLocked(sequence, ids) ? ['mute', 'delete'] : []) : ['mute', 'delete']), ...(canRegen ? [] : ['regen', 'fit'])];

  const run = (key: string) => {
    switch (key) {
      case 'listen':
        if (range) auditionRange(actions, range.start, range.end);
        return;
      case 'mute':
        return void muteDubBlocks(actions, ids, !allMuted);
      case 'delete':
        return void deleteDubBlocks(actions, ids);
      case 'regen':
        if (videoId) void regenerateUnits(regenDeps(runtime, actions), { videoId, groupId: dub.groupId, units, planDocumentId: plan?.id ?? null });
        return;
      case 'fit':
        if (videoId) openDubFit({ videoId, groupId: dub.groupId, units });
        return;
    }
  };

  const regenHint = inQueue ? REGEN.inQueue : !editable ? REGEN.readOnly : REGEN.regenBlocksHint;
  return (
    <Menu aria-label={COPY.menuLabel(title)} disabledKeys={disabled} onAction={(key) => run(String(key))}>
      <MenuSection>
        <Header>
          <Heading>{title}</Heading>
        </Header>
        {range && one ? (
          <MenuItem id="listen" textValue={COPY.listen}>
            <PlayIcon />
            <Text slot="label">{COPY.listen}</Text>
            <Text slot="description">
              {COPY.listenHint(formatTimecode(range.start, sequence.fps), range.end - range.start, rateText(chosen[0]!.rate, chosen[0]!.fast))}
            </Text>
          </MenuItem>
        ) : null}
        <MenuItem id="mute" textValue={COPY.mute(allMuted, n)}>
          {allMuted ? <VolumeTwo /> : <VolumeOff />}
          <Text slot="label">{COPY.mute(allMuted, n)}</Text>
          <Text slot="description">{COPY.muteHint(allMuted)}</Text>
        </MenuItem>
      </MenuSection>
      {desktop ? (
        <MenuSection>
          <MenuItem id="regen" textValue={REGEN.regenBlocks(units.length || n)}>
            <RefreshIcon />
            <Text slot="label">{REGEN.regenBlocks(units.length || n)}</Text>
            <Text slot="description">{regenHint}</Text>
          </MenuItem>
          <MenuItem id="fit" textValue={REGEN.retext}>
            <EditIcon />
            <Text slot="label">{REGEN.retext}</Text>
            <Text slot="description">{inQueue ? REGEN.inQueue : REGEN.retextHint}</Text>
          </MenuItem>
        </MenuSection>
      ) : null}
      <MenuSection>
        <MenuItem id="delete" textValue={COPY.remove(n)}>
          <DeleteIcon />
          <Text slot="label">{COPY.remove(n)}</Text>
          <Text slot="description">{COPY.removeHint}</Text>
        </MenuItem>
      </MenuSection>
    </Menu>
  );
}
