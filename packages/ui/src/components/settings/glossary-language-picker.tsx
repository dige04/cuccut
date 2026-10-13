import { Picker, PickerItem } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { languageLabel, languageOptions } from '../../model/library-glossary.ts';

/** The dropdown key for “Any language” (任意语言) (the language itself is null). */
const ANY = '*';

const picker = style({ width: 192, flexShrink: 0 });

/**
 * Language dropdown for glossaries (design mockup `LangPick`): a few commonly used languages, plus the current value if it is not among them. When `any`, the first item is “Any language” (任意语言) (null).
 */
export function LanguagePicker({
  label,
  value,
  any = false,
  isDisabled,
  onChange,
}: {
  label: string;
  value: string | null;
  any?: boolean;
  isDisabled?: boolean;
  onChange(tag: string | null): void;
}) {
  const items = [
    ...(any ? [{ key: ANY, label: languageLabel(null) }] : []),
    ...languageOptions([value]).map((tag) => ({ key: tag, label: languageLabel(tag) })),
  ];
  return (
    <Picker
      aria-label={label}
      size="S"
      styles={picker}
      items={items}
      isDisabled={isDisabled}
      selectedKey={value ?? (any ? ANY : null)}
      onSelectionChange={(key) => {
        if (key === null) return;
        const next = key === ANY ? null : String(key);
        if (next !== value) onChange(next);
      }}>
      {(item) => <PickerItem id={item.key}>{item.label}</PickerItem>}
    </Picker>
  );
}
