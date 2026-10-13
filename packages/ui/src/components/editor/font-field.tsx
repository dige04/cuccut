import { useState } from 'react';
import { ActionButton, DialogTrigger, Picker, PickerItem, Popover, Text } from '@react-spectrum/s2';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { SYSTEM_FONT, fontLabel } from '../../model/font-library.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { FontLibraryList } from './font-library-list.tsx';
import { PRow } from './inspector-controls.tsx';
import { FONT_COPY as FC } from './font-copy.ts';

/**
 * Font box (product design §5.9 “Fonts”; prototype panel-font-picker.jsx): the text styles of the properties page (text, timer-type elements, captions) and the font cell of the stage toolbar share it. On desktop it is one table, combining built-in, local, downloaded and on-demand families (font-library-list.tsx). On the properties page it expands below the font row (the prototype's `inline`); in the toolbar it is a popover. The Web entry's browser session has no `fonts.*`, so it keeps the original few fixed fonts.
 */

/** Fixed fonts for the Web entry: the few the renderer recognizes (aliases in text-style.ts), plus common Chinese system fonts. Current values that are not recognized are listed too. */
export const FONTS: { id: string; label: string }[] = [
  {
    id: SYSTEM_FONT,
    get label() {
      return FC.systemFont;
    },
  },
  {
    id: 'PingFang SC',
    get label() {
      return FC.pingFang;
    },
  },
  {
    id: 'Songti SC',
    get label() {
      return FC.songti;
    },
  },
  {
    id: 'Kaiti SC',
    get label() {
      return FC.kaiti;
    },
  },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Bebas Neue', label: 'Bebas Neue' },
  { id: 'Lexend Deca', label: 'Lexend Deca' },
  { id: 'Source Serif 4', label: 'Source Serif 4' },
];
export const FONT_ALIASES: Record<string, string> = {
  montserrat: 'Montserrat',
  bebas: 'Bebas Neue',
  lexend: 'Lexend Deca',
  serif: 'Source Serif 4',
};

/** `fontFamily` in the text style → the font box's current value (if unset, the system font; old aliases are replaced with the family name). */
export function currentFont(raw: unknown): string {
  const value = typeof raw === 'string' && raw.trim() ? raw : SYSTEM_FONT;
  return FONT_ALIASES[value] ?? value;
}

const grow = style({ flexGrow: 1, minWidth: 0 });
const field = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexGrow: 1,
  minWidth: 0,
  height: 24,
  paddingStart: 8,
  paddingEnd: 4,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: { default: 'gray-200', isHovered: 'gray-300', isFocusVisible: 'blue-800', isDisabled: 'gray-100' },
  borderRadius: 'default',
  backgroundColor: 'gray-25',
  font: 'ui-sm',
  color: { default: 'gray-800', isDisabled: 'disabled' },
  outlineStyle: 'none',
  cursor: 'default',
});
const fieldText = style({
  flexGrow: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'start',
});
const fieldIcon = style({ flexShrink: 0, display: 'flex', color: 'gray-600' });
const inlinePanel = style({ marginTop: '[6px]', marginBottom: 8 });
const quietText = style({ maxWidth: 112, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

interface FontFieldProps {
  /** The raw `fontFamily` in the text style (it may be absent, or an old alias). */
  value: unknown;
  isDisabled?: boolean;
  onChange(family: string): void;
}

/** The “Font” row on the properties page: click to expand a table below it; selecting an entry collapses it. */
export function FontField({ value, isDisabled = false, onChange }: FontFieldProps) {
  const web = useRuntime().host.platform === 'web';
  const font = currentFont(value);
  const [open, setOpen] = useState(false);
  if (web) {
    return (
      <PRow label={FC.font}>
        <FixedFontPicker font={font} isDisabled={isDisabled} onChange={onChange} />
      </PRow>
    );
  }
  return (
    <>
      <PRow label={FC.font}>
        <RACButton
          className={field}
          isDisabled={isDisabled}
          aria-expanded={open}
          aria-label={FC.fontValue(FC.font, fontLabel(font))}
          onPress={() => setOpen(!open)}>
          <span className={fieldText}>{fontLabel(font)}</span>
          <span className={fieldIcon}>
            <ChevronDown />
          </span>
        </RACButton>
      </PRow>
      {open && !isDisabled ? (
        <div className={inlinePanel}>
          <FontLibraryList
            value={font}
            inline
            onPick={(family) => {
              setOpen(false);
              if (family !== font) onChange(family);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

/** The font cell of the stage toolbar: a quiet button; clicking it opens a popover (prototype stage-toolbar.jsx's 268px dropdown). */
export function ToolbarFontField({ value, isDisabled = false, onChange, label }: FontFieldProps & { label: string }) {
  const web = useRuntime().host.platform === 'web';
  const font = currentFont(value);
  const [open, setOpen] = useState(false);
  if (web) return <FixedFontPicker font={font} isDisabled={isDisabled} onChange={onChange} quiet label={label} />;
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <ActionButton isQuiet size="S" isDisabled={isDisabled} aria-label={FC.fontValue(label, fontLabel(font))}>
        <Text>
          <span className={quietText}>{fontLabel(font)}</span>
        </Text>
        <ChevronDown />
      </ActionButton>
      <Popover placement="bottom" aria-label={label}>
        <FontLibraryList
          value={font}
          onPick={(family) => {
            setOpen(false);
            if (family !== font) onChange(family);
          }}
        />
      </Popover>
    </DialogTrigger>
  );
}

/** Web entry: the original few fixed fonts (the browser session has no `fonts.*`, so it cannot download or list local fonts). */
function FixedFontPicker({
  font,
  isDisabled,
  onChange,
  quiet = false,
  label = FC.font,
}: {
  font: string;
  isDisabled: boolean;
  onChange(family: string): void;
  quiet?: boolean;
  label?: string;
}) {
  const fonts = FONTS.some((f) => f.id === font) ? FONTS : [...FONTS, { id: font, label: font }];
  return (
    <Picker
      aria-label={label}
      size="S"
      isQuiet={quiet}
      styles={quiet ? undefined : grow}
      isDisabled={isDisabled}
      value={font}
      onChange={(key) => key !== null && key !== font && onChange(String(key))}>
      {fonts.map((f) => (
        <PickerItem key={f.id} id={f.id}>
          {f.label}
        </PickerItem>
      ))}
    </Picker>
  );
}
