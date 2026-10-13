import { templateSlots, templateUnfilledText } from '@cuccut/protocol';

/*
 * Pending slots in a prompt (template pack spec §5.5; product design §3.2.1; prototype designs/cuccut/app/model-prompt-slots.js).
 * The template's brief and the work example's prompt.md mark where the user should fill in content with `{{label}}`; the input box draws it as an S2 placeholder token, which is replaced as soon as the user types.
 * The draft is always a single string (placeholders kept as-is, written `{{label}}`). This module handles the round trip between the string and the fragments:
 * - Fragments → string must be the strict inverse of string → fragments, otherwise usePromptValue would keep rebuilding.
 * - A label is the raw text between `{{` and `}}`, not trimmed. An empty `{{}}`, an unclosed `{{`, or one containing braces or newlines is kept as plain text.
 * Text handed to the Agent (`[label]`), the label list and the example sentence reuse templateUnfilledText / templateSlots / templateExampleText from @cuccut/protocol.
 */

/**
 * Placeholder syntax, consistent with `TEMPLATE_SLOT` in @cuccut/protocol template.ts (that side exports no regex and has no function that slices fragments by position).
 * prompt-slots.test.ts cross-checks templateSlots / templateUnfilledText to confirm both sides recognize the same set of placeholders.
 */
const SLOT = /\{\{([^{}\n]+)\}\}/g;

export type SlotPart = { type: 'text'; text: string } | { type: 'slot'; label: string };

/** Text → fragments: text and placeholders alternate. Produces no empty text fragments; an empty string returns []. */
export function slotParts(text: string): SlotPart[] {
  const out: SlotPart[] = [];
  let at = 0;
  for (const m of text.matchAll(SLOT)) {
    if (m.index > at) out.push({ type: 'text', text: text.slice(at, m.index) });
    out.push({ type: 'slot', label: m[1]! });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ type: 'text', text: text.slice(at) });
  return out;
}

/** Unfilled placeholder labels in the text: de-duplicated, in order of first occurrence. */
export function slotLabels(text: string): string[] {
  return [...new Set(templateSlots(text))];
}

/** Text handed to the Agent: unfilled `{{label}}` is written as `[label]`, so the Agent knows where to ask first (spec §5.5). */
export function slotsForAgent(text: string): string {
  return templateUnfilledText(text);
}

/** When recognizing what was filled in, take a few characters before and after the slot as anchors; the filled value is capped at a few characters (`filledSlot`). */
const SLOT_CONTEXT = 6;
const FILLED_MAX = 32;

/**
 * Which value the user filled into the first `{{label}}` in `template` (prototype model-prompt-slots.js `filled`; used by quick start to remember the last filled value).
 * Looks in `text` for the few characters immediately before and after the placeholder, and takes the text between them. If the surrounding text was edited, the placeholder is gone, the filled value is blank, it spans lines, or it is too long, returns null.
 */
export function filledSlot(template: string, label: string, text: string): string | null {
  const parts = slotParts(template);
  const i = parts.findIndex((x) => x.type === 'slot' && x.label === label);
  if (i < 0) return null;
  const prev = parts[i - 1];
  const next = parts[i + 1];
  const before = prev?.type === 'text' ? prev.text.slice(-SLOT_CONTEXT) : '';
  const after = next?.type === 'text' ? next.text.slice(0, SLOT_CONTEXT) : '';
  if (!before || !after) return null;
  const from = text.indexOf(before);
  if (from < 0) return null;
  const start = from + before.length;
  const end = text.indexOf(after, start);
  if (end < 0) return null;
  const value = text.slice(start, end).trim();
  return value && value.length <= FILLED_MAX && !/[\n{}[\]]/.test(value) ? value : null;
}

/** Replaces the first `{{label}}` in `template` with `value` (quick start reuses the last filled value). */
export function fillSlot(template: string, label: string, value: string): string {
  return template.replace(`{{${label}}}`, () => value);
}

/* ---------- Interchange with S2 PromptFieldValue fragments ----------
   S2's placeholder token is {type: 'token', text: label, value: {type: 'placeholder', placeholderType: 'text'}}: drawn in placeholder style, a click selects the whole token, typing replaces it, and Tab / Shift+Tab move between tokens.
   Only structural types are used here; @react-spectrum/ai is not imported (the model layer is tested in node). */

export interface PromptSegmentLike {
  type: 'text' | 'token';
  text: string;
  value?: unknown;
}

export interface SlotToken {
  type: 'token';
  text: string;
  value: { type: 'placeholder'; placeholderType: 'text' };
}

export type PromptSegmentOut = { type: 'text'; text: string } | SlotToken;

function tokenValue(segment: PromptSegmentLike): { type?: unknown; placeholderType?: unknown; url?: unknown } | null {
  return segment.type === 'token' && segment.value && typeof segment.value === 'object' ? (segment.value as never) : null;
}

/** Whether this is a placeholder token for an unfilled slot. */
export function isSlotToken(segment: PromptSegmentLike | null | undefined): boolean {
  const value = segment ? tokenValue(segment) : null;
  return !!value && value.type === 'placeholder' && value.placeholderType === 'text';
}

/** Draft string → PromptFieldValue fragments. Only drafts swapped in from outside go through here; `{{x}}` typed by the user does not go through it and stays plain text, as before. */
export function toPromptSegments(text: string): PromptSegmentOut[] {
  return slotParts(text).map((x) =>
    x.type === 'slot'
      ? { type: 'token', text: x.label, value: { type: 'placeholder', placeholderType: 'text' } }
      : { type: 'text', text: x.text },
  );
}

/**
 * PromptFieldValue fragments → draft string: placeholder tokens are written back as `{{label}}`, link tokens write the full address (same as S2 PromptFieldValue's toString), and everything else takes its text. S2's own toString writes placeholder tokens as the bare label, which loses their placeholder nature.
 */
export function fromPromptSegments(segments: readonly PromptSegmentLike[]): string {
  return segments
    .map((segment) => {
      if (isSlotToken(segment)) return `{{${segment.text}}}`;
      const value = tokenValue(segment);
      if (value && value.type === 'url' && typeof value.url === 'string') return value.url;
      return segment.text;
    })
    .join('');
}

/** “Fill the next one”: from fragment index `from`, looks for the next placeholder token onward; wraps around to the start at the end; returns -1 if there is none. */
export function nextSlotIndex(segments: readonly PromptSegmentLike[], from: number): number {
  const n = segments.length;
  const start = Number.isInteger(from) ? from : -1;
  for (let k = 1; k <= n; k++) {
    const i = (((start + k) % n) + n) % n;
    if (isSlotToken(segments[i])) return i;
  }
  return -1;
}
