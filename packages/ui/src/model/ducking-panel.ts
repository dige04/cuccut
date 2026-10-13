import { engineRanges, lazyObject } from '@cuccut/editor-wasm';
import { mediaTimeToSeconds, type DuckingRule, type EditOperation, type Id, type Sequence, type SequenceItem } from '@cuccut/protocol';
import { trackRows } from './editor.ts';
import { decimalSeconds } from './property-values.ts';

/**
 * Pure logic for the property panel's “lower original”. This is the ducking in video format spec §3.9; the commands are `setDucking` / `removeDucking`.
 *
 * Ducking is a rule on the sequence. During the time the trigger group (a track or clip, or someone speaking) makes sound, the target group is lowered by `depth` dB. From a lowered clip, the property panel looks for the first rule in which the target group includes it, either by naming it directly or by naming the track it sits on. A newly created rule names only this clip, and its trigger group is another track with sound. When turned off, rules that name only this clip are deleted directly. Rules that also lower other clips are only disabled (turning it off disables them too, and the page says so).
 */

const DUCKING = lazyObject(() => engineRanges().ducking);

/** The engine defaults (used when `setDucking` does not give them; the `editor-wasm` value ranges): lower by 10 dB, 0.02 s ramp down, 0.35 s ramp up. */
export const DUCK_DEFAULTS = lazyObject(() => DUCKING.defaults);

/** The slider range (design) and the upper limit for exact input (the engine's ranges: lower by 0–60 dB, ramps 0–5 s). */
export const DUCK_LIMITS = lazyObject(
  () =>
    ({
      depth: { min: 1, max: 30, hardMax: DUCKING.depth[1] },
      attack: { min: 0, max: 1, hardMax: DUCKING.time[1] },
      release: { min: 0, max: 2, hardMax: DUCKING.time[1] },
    }) as const,
);

/** Clips that can be lowered: audio, and video (its own sound). */
export function isDuckable(item: SequenceItem): boolean {
  return item.type === 'audio' || item.type === 'video';
}

/** Whether a clip makes sound. Only sounding clips in the trigger group take effect. */
function sounds(item: SequenceItem): boolean {
  if (!item.enabled) return false;
  if (item.type === 'audio') return true;
  if (item.type === 'video') return item.embeddedAudio.enabled;
  return item.type === 'composition' && !!item.audio?.enabled;
}

/** The first rule that lowers this clip (one naming it first, then one naming the track it sits on). */
export function duckingRuleFor(sequence: Sequence, item: SequenceItem): DuckingRule | undefined {
  const rules = sequence.ducking ?? [];
  return rules.find((r) => r.target.itemIds?.includes(item.id)) ?? rules.find((r) => r.target.trackIds?.includes(item.trackId));
}

/** The rule lowers only this clip (it can be deleted directly when turned off). */
export function isOwnRule(rule: DuckingRule, item: SequenceItem): boolean {
  return !rule.target.trackIds?.length && rule.target.itemIds?.length === 1 && rule.target.itemIds[0] === item.id;
}

/** The options for “ducked under”: other tracks with sounding clips (a clip's own track cannot both trigger and be lowered). */
export function triggerOptions(sequence: Sequence, item: SequenceItem): { key: Id; label: string }[] {
  const sounding = new Set(sequence.items.filter((other) => other.trackId !== item.trackId && sounds(other)).map((other) => other.trackId));
  return trackRows(sequence)
    .filter((row) => sounding.has(row.track.id))
    .map((row) => ({ key: row.track.id, label: row.label }));
}

/** When the rule's trigger group is exactly one track, that track. When it names clips or several tracks, null (no item is selected on the page, and this is stated there). */
export function singleTrigger(rule: DuckingRule): Id | null {
  const t = rule.trigger;
  return t.kind === 'items' && !t.itemIds?.length && t.trackIds?.length === 1 ? t.trackIds[0]! : null;
}

/** The rule's reading (seconds). */
export function ruleValues(rule: DuckingRule): { depth: number; attack: number; release: number } {
  return { depth: rule.depth, attack: mediaTimeToSeconds(rule.attack), release: mediaTimeToSeconds(rule.release) };
}

export function isDefault(rule: DuckingRule): boolean {
  const v = ruleValues(rule);
  return (
    v.depth === DUCK_DEFAULTS.depth &&
    Math.abs(v.attack - DUCK_DEFAULTS.attack) < 1e-9 &&
    Math.abs(v.release - DUCK_DEFAULTS.release) < 1e-9
  );
}

/** On: an existing (disabled) rule is re-enabled. Otherwise a new rule is created that names only this clip, placed under the `trigger` track. */
export function enableOperations(sequence: Sequence, item: SequenceItem, trigger: Id): EditOperation[] {
  const rule = duckingRuleFor(sequence, item);
  if (rule) return rule.enabled ? [] : [{ type: 'setDucking', sequenceId: sequence.id, ruleId: rule.id, enabled: true }];
  return [{ type: 'setDucking', sequenceId: sequence.id, trigger: { kind: 'items', trackIds: [trigger] }, target: { itemIds: [item.id] } }];
}

/** Off: the rule that only lowers this clip is deleted. Rules that also lower other clips are disabled. */
export function disableOperations(sequence: Sequence, item: SequenceItem): EditOperation[] {
  const rule = duckingRuleFor(sequence, item);
  if (!rule) return [];
  if (isOwnRule(rule, item)) return [{ type: 'removeDucking', sequenceId: sequence.id, ruleId: rule.id }];
  return rule.enabled ? [{ type: 'setDucking', sequenceId: sequence.id, ruleId: rule.id, enabled: false }] : [];
}

/** Change one item of the rule: switch the trigger track, how much to lower, and the ramp-down and ramp-up durations (decimal seconds). */
export function changeOperation(
  sequence: Sequence,
  rule: DuckingRule,
  change: { trigger?: Id; depth?: number; attack?: number; release?: number },
): EditOperation {
  return {
    type: 'setDucking',
    sequenceId: sequence.id,
    ruleId: rule.id,
    ...(change.trigger !== undefined ? { trigger: { kind: 'items' as const, trackIds: [change.trigger] } } : {}),
    ...(change.depth !== undefined ? { depth: change.depth } : {}),
    ...(change.attack !== undefined ? { attack: decimalSeconds(change.attack) } : {}),
    ...(change.release !== undefined ? { release: decimalSeconds(change.release) } : {}),
  };
}

/** Restore the defaults. */
export function resetOperation(sequence: Sequence, rule: DuckingRule): EditOperation {
  return changeOperation(sequence, rule, { ...DUCK_DEFAULTS });
}
