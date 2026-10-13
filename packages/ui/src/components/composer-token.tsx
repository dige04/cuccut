import type { ReactNode } from 'react';
import { ActionButton } from '@react-spectrum/s2';
import Close from '@react-spectrum/s2/icons/Close';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };

// The tag takes only the width of its content (prototype `.home-template-token`, `.cins-token`): × is the smallest button and the icon is one size smaller; long names are truncated and do not stretch the input box.
const chip = style({
  display: 'inline-flex',
  alignSelf: 'start',
  alignItems: 'center',
  gap: '[6px]',
  maxWidth: 'full',
  paddingStart: 8,
  paddingEnd: '[2px]',
  paddingY: '[2px]',
  borderRadius: 'default',
  backgroundColor: 'gray-100',
  font: 'ui-sm',
  color: 'gray-800',
  boxSizing: 'border-box',
});
const chipText = style({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 });
const chipNote = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-600' });
const closeIcon = iconStyle({ size: 'XS' });

/** A removable tag above the input text: templates, local assets and picked skills share one look. */
export function ComposerToken({
  icon,
  label,
  title,
  note,
  removeLabel,
  onRemove,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  /** Full description shown on hover (for example, the full path of an asset). */
  title?: string;
  /** A faint one-line description after the name (on the AI tools page, “how this tool works”). */
  note?: string;
  removeLabel: string;
  onRemove(): void;
  onOpen?: () => void;
}) {
  return (
    <span className={chip} title={title ?? label}>
      {onOpen ? (
        <ActionButton slot={null} size="S" isQuiet aria-label={label} onPress={onOpen}>
          {icon}
          <span className={chipText}>{label}</span>
        </ActionButton>
      ) : (
        <>
          {icon}
          <span className={chipText}>{label}</span>
        </>
      )}
      {note ? <span className={chipNote}>{note}</span> : null}
      <ActionButton isQuiet size="XS" aria-label={removeLabel} onPress={onRemove}>
        <Close styles={closeIcon} data-cc-icons="own" />
      </ActionButton>
    </span>
  );
}

/** A row of tags (templates and assets on the start page, skills on the session input box). */
export const composerTokenList = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 });
