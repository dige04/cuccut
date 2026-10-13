import {
  SINGLE_SIDED_TRANSITION_KINDS,
  framesToSeconds,
  type EditOperation,
  type Easing,
  type Rate,
  type Sequence,
  type SequenceItem,
  type Transition,
  type TransitionKind,
} from '@cuccut/protocol';
import { decimalSeconds } from './property-values.ts';
import { M } from './transition-panel-copy.ts';

/**
 * Pure logic for the “Transition” section of the properties page (video format spec §3.9; commands `setTransition` / `removeTransition`).
 *
 * A picture clip has two edges: the start (“In”, where the transition's `rightItemId` is this clip) and the end (“Out”, where `leftItemId` is this clip). An edge
 * holds at most one transition. When a neighbour that abuts it on the same track exists, the edge can be made a two-sided transition (“Join”: a transition between the two neighbours); otherwise it is a one-sided transition,
 * and the other side is transparent, showing the track below. A one-sided transition can only be centred, and cannot cross-fade audio (the engine rejects it).
 */

export type TransitionSlot = 'in' | 'out';
export type TransitionChoice = TransitionKind | 'none';
export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

/** A group of options: keys are fixed, names are read in the current language. */
function options<K extends string>(keys: readonly K[], labels: () => Record<K, string>): readonly { key: K; label: string }[] {
  return keys.map((key) => ({
    key,
    get label() {
      return labels()[key];
    },
  }));
}

export const SLOTS: readonly { key: TransitionSlot; label: string }[] = options(['in', 'out'], () => M.slot);

/** Transition tiles on the page, in design-draft order. “Color overlay” and “Push” are the two kinds that the format has but the design draft does not draw; they can only be two-sided (joined with a neighbour). */
export const TRANSITION_CHOICES: readonly { key: TransitionChoice; label: string }[] = options(
  ['none', 'dissolve', 'wipe', 'slide', 'zoom', 'dip-to-color', 'push'],
  () => M.choice,
);

/** Direction: which way the picture moves for a push; defaults to `right`. */
export const DIRECTIONS: readonly { key: TransitionDirection; label: string }[] = options(['right', 'left', 'down', 'up'], () => M.direction);

export const EASINGS: readonly { key: Easing; label: string }[] = options(['linear', 'ease-in', 'ease-out', 'ease-in-out'], () => M.easing);

/** Duration (seconds) of a newly added transition, same as the design draft. */
export const DEFAULT_SECONDS = 0.5;
export const DEFAULT_DIRECTION: TransitionDirection = 'right';
export const DEFAULT_DIP_COLOR = '#000000';
/** The engine's upper limit. */
export const MAX_SECONDS = 10;

/** Clips that can take a transition: picture clips (audio and captions cannot). */
export function isTransitionable(item: SequenceItem): item is Exclude<SequenceItem, { type: 'audio' | 'caption' }> {
  return item.type !== 'audio' && item.type !== 'caption';
}

/** The transition on this edge. */
export function slotTransition(sequence: Sequence, itemId: string, slot: TransitionSlot): Transition | undefined {
  return (sequence.transitions ?? []).find((t) => (slot === 'in' ? t.rightItemId === itemId : t.leftItemId === itemId));
}

/** Picture clips on the outer side of this edge, abutting on the same track (the neighbours that can form a two-sided transition). */
export function slotNeighbor(sequence: Sequence, item: SequenceItem, slot: TransitionSlot): SequenceItem | undefined {
  if (!isTransitionable(item)) return undefined;
  const from = item.span.fromFrame;
  const end = from + item.span.durationFrames;
  return sequence.items.find(
    (other) =>
      other.id !== item.id &&
      other.trackId === item.trackId &&
      isTransitionable(other) &&
      (slot === 'in' ? other.span.fromFrame + other.span.durationFrames === from : other.span.fromFrame === end),
  );
}

/** Range of the duration slider (seconds): the design draft uses 0.1 to min(2, clip length / 2); exact input can go up to the clip length (no more than 10 seconds), and the engine rejects anything beyond that. */
export function durationLimits(item: SequenceItem, fps: Rate): { min: number; max: number; hardMax: number } {
  const length = isTransitionable(item) ? framesToSeconds(item.span.durationFrames, fps) : 0;
  const max = Math.max(0, Math.min(2, length / 2));
  const frame = framesToSeconds(1, fps);
  return { min: Math.min(Math.max(0.1, frame), max), max, hardMax: Math.max(max, Math.min(MAX_SECONDS, length)) };
}

/** What this edge looks like on the page: the chosen kind, parameters, duration, easing, whether it joins a neighbour, and audio cross-fade. */
export interface SlotState {
  kind: TransitionChoice;
  /** Unrecognised kind (written by another version): no tile is selected on the page. */
  unknownKind?: string;
  direction: TransitionDirection;
  color: string;
  seconds: number;
  easing: Easing;
  joined: boolean;
  audioCrossfade: boolean;
}

export function slotState(sequence: Sequence, item: SequenceItem, slot: TransitionSlot): SlotState {
  const t = slotTransition(sequence, item.id, slot);
  if (!t) {
    return {
      kind: 'none',
      direction: DEFAULT_DIRECTION,
      color: DEFAULT_DIP_COLOR,
      seconds: DEFAULT_SECONDS,
      easing: 'linear',
      joined: !!slotNeighbor(sequence, item, slot),
      audioCrossfade: false,
    };
  }
  const known = TRANSITION_CHOICES.some((choice) => choice.key === t.kind && choice.key !== 'none');
  const direction = t.params?.direction;
  const color = t.params?.color;
  return {
    kind: known ? (t.kind as TransitionKind) : 'none',
    ...(known ? {} : { unknownKind: t.kind }),
    direction: DIRECTIONS.some((d) => d.key === direction) ? (direction as TransitionDirection) : DEFAULT_DIRECTION,
    color: typeof color === 'string' ? color : DEFAULT_DIP_COLOR,
    seconds: framesToSeconds(t.durationFrames, sequence.fps),
    easing: t.easing,
    joined: !!t.leftItemId && !!t.rightItemId,
    audioCrossfade: !!t.audioCrossfade,
  };
}

/** Parameters each kind takes (the engine validates strictly per kind and rejects even one extra field): only color overlay takes a colour and only push takes a direction; the rest have no parameters. */
export function transitionParams(kind: TransitionKind, state: Pick<SlotState, 'direction' | 'color'>): Record<string, unknown> | undefined {
  switch (kind) {
    case 'dip-to-color':
      return { color: state.color };
    case 'push':
      return { direction: state.direction };
    default:
      return undefined;
  }
}

/** Whether this kind of transition can be one-sided (no neighbour, other side transparent): color overlay and push can only be two-sided. */
export function singleSided(kind: TransitionChoice): boolean {
  return kind === 'none' || SINGLE_SIDED_TRANSITION_KINDS.includes(kind);
}

/** Whether the kind takes a direction. */
export const directed = (kind: TransitionChoice) => kind === 'push';

/** The clip has sound (sound from the video itself, or synthesized sound): “audio cross-fade” only makes sense when both sides have sound. */
export function hasSound(item: SequenceItem | undefined): boolean {
  return item?.type === 'video' || (item?.type === 'composition' && !!item.audio);
}

/**
 * Writes the transition on this edge. Choosing “None” removes the existing one; anything else is `setTransition`: for a two-sided transition (joined with a neighbour) it keeps the placement of the existing two-sided transition,
 * otherwise it is centred. A one-sided transition gets no placement other than centred, and does not cross-fade audio. Duration is given in decimal seconds, and the engine snaps it to the nearest frame.
 */
export function slotOperations(sequence: Sequence, item: SequenceItem, slot: TransitionSlot, next: SlotState): EditOperation[] {
  const existing = slotTransition(sequence, item.id, slot);
  if (next.kind === 'none') return existing ? [{ type: 'removeTransition', sequenceId: sequence.id, transitionId: existing.id }] : [];
  const neighbor = next.joined ? slotNeighbor(sequence, item, slot) : undefined;
  const sides = neighbor
    ? slot === 'in'
      ? { leftItemId: neighbor.id, rightItemId: item.id }
      : { leftItemId: item.id, rightItemId: neighbor.id }
    : slot === 'in'
      ? { rightItemId: item.id }
      : { leftItemId: item.id };
  const params = transitionParams(next.kind, next);
  const twoSided = !!neighbor;
  // Kinds that can only be two-sided cannot be written without a neighbour (the engine rejects it), so those tiles are greyed out on the page.
  if (!twoSided && !singleSided(next.kind)) return [];
  const keepPlacement = twoSided && existing?.leftItemId && existing.rightItemId ? existing.placement : 'center';
  return [
    {
      type: 'setTransition',
      sequenceId: sequence.id,
      ...sides,
      kind: next.kind,
      ...(params ? { params } : {}),
      duration: { unit: 'seconds', value: decimalSeconds(next.seconds) },
      alignment: 'nearest-frame',
      easing: next.easing,
      placement: keepPlacement,
      ...(twoSided && next.audioCrossfade && hasSound(item) && hasSound(neighbor) ? { audioCrossfade: true } : {}),
    },
  ];
}
