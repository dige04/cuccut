import { ActionButton } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { HOME_COPY } from '../../copy.ts';
import { S } from '../shell-copy.ts';

// A line of small text plus a quiet button below the tray, left-aligned with the tray's contents (prototype `.pslot-hint`); when nothing is left to fill in, the row takes no height.
const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: { default: 4, isEmpty: 0 },
  paddingX: 4,
  minWidth: 0,
});
const text = style({ minWidth: 0, font: 'ui-sm', color: 'gray-700', lineHeight: '[1.5]' });

/**
 * Fill-in hint (template pack spec §5.5; prototype new-agent.jsx `SlotHint`): when the input box still contains placeholders, a line below the box says how many are left and which ones. Sending works without filling them in. “填下一处” (Fill next) returns focus to the input box and selects the next placeholder (same as Tab). When nothing is left to fill in, only an empty status region is kept, so screen readers are not interrupted when the last one is filled, and the message is announced as usual the next time it appears.
 */
export function SlotHint({ labels, onNext }: { labels: readonly string[]; onNext(): void }) {
  return (
    <div className={row({ isEmpty: !labels.length })} role="status">
      {labels.length ? (
        <>
          <span className={text}>{HOME_COPY.slotsLeft(labels.length, S.list(labels))}</span>
          <ActionButton isQuiet size="S" onPress={onNext}>
            {HOME_COPY.fillNextSlot}
          </ActionButton>
        </>
      ) : null}
    </div>
  );
}
