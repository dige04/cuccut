import { useState } from 'react';
import { PromptFieldValue } from '@react-spectrum/ai';
import { fromPromptSegments, nextSlotIndex, toPromptSegments } from '../model/prompt-slots.ts';

/** Draft string → PromptFieldValue: `{{label}}` becomes a placeholder token (template pack spec §5.5), and the cursor goes to the end of the last segment. */
function valueOf(text: string): PromptFieldValue {
  const segments = toPromptSegments(text);
  const last = segments.length - 1;
  return new PromptFieldValue(segments).withCaretPosition(
    last >= 0 ? { index: last, offset: segments[last]!.text.length } : { index: 0, offset: 0 },
  );
}

/**
 * The next placeholder token after the selected segment `from` (searching from the start once the end is reached); returns the input unchanged when there is no placeholder token.
 * `from` defaults to the back end of the selection: when a token is selected, the search continues after it.
 */
export function selectNextSlot(value: PromptFieldValue, from = value.selectedRange.end.index): PromptFieldValue {
  const i = nextSlotIndex(value.segments, from);
  if (i < 0) return value;
  const range = new PromptFieldValue.SelectedRange({ index: i, offset: 0 }, { index: i, offset: value.segments[i]!.text.length });
  return value.withSelectedRange(range);
}

/**
 * The bridge between the string draft and the PromptField value (prototype ui.jsx PromptField).
 * Text the user types is kept as-is in PromptFieldValue, so the cursor and undo are not lost. The value is rebuilt from the new string, with the cursor at the end, only when the draft is replaced from outside (initial prefill, template fill-in, cleared after sending, put back after a failed send). `{{label}}` in the draft is drawn as a placeholder token and serialized back to `{{label}}` (S2's toString writes it as the label, which would lose the placeholder). A `{{x}}` the user typed is not rebuilt and stays as plain text.
 */
export function usePromptValue(
  text: string,
  onText: (text: string) => void,
): [PromptFieldValue, (value: PromptFieldValue) => void, (from?: number) => void] {
  const [state, setState] = useState(() => ({ text, value: valueOf(text) }));
  let current = state;
  if (text !== state.text) {
    current = { text, value: valueOf(text) };
    setState(current);
  }
  const onChange = (value: PromptFieldValue) => {
    const next = fromPromptSegments(value.segments);
    setState({ text: next, value });
    if (next !== text) onText(next);
  };
  // “Fill next” and selecting the next placeholder after filling a draft with placeholders only change the selection, not the text; they compute from the latest value in state (so they can run in a timer).
  // `from`: which segment to search after. When the input is refocused, TokenField resets the cursor from the DOM, so the caller must record the original position before focusing.
  const selectSlot = (from?: number) => setState((s) => ({ ...s, value: selectNextSlot(s.value, from) }));
  return [current.value, onChange, selectSlot];
}

/**
 * Focuses the input inside a PromptField (or the element wrapping it), with the cursor at the end, so typing continues the existing draft.
 * The input is contenteditable: TokenField only writes the cursor back to the DOM while focused, and a programmatic focus would land at the start;
 * so after focusing, the DOM selection is moved to the end directly, and TokenField follows it through selectionchange to update the cursor.
 */
export function focusPromptEnd(container: Element | null | undefined) {
  const input = container?.querySelector<HTMLElement>('[role="textbox"]');
  if (!input) return;
  input.focus();
  const selection = window.getSelection();
  selection?.selectAllChildren(input);
  selection?.collapseToEnd();
}
