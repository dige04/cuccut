import { useState } from 'react';
import { ActionButton, ColorSwatch, ColorSwatchPicker, Text, ToastQueue, parseColor, type Color } from '@react-spectrum/s2';
import Brand from '@react-spectrum/s2/icons/Brand';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { colorCss, normalizeColor } from '../../model/library-brand.ts';
import { libraryErrorText } from '../../model/library-entry.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { putLibraryEntry } from '../../runtime/library-commands.ts';
import { useBrandColors } from '../use-library-entry.ts';
import { BRAND_COPY as IB } from './brand-copy.ts';

const group = style({ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 8 });
const title = style({ font: 'ui-xs', fontWeight: 'bold', color: 'gray-600' });

/** Color value as `#RRGGBB[AA]` (uppercase), in the same form the brand library uses. */
function hexOf(color: Color): string {
  const rgb = color.toFormat('rgb');
  const byte = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  const alpha = rgb.getChannelValue('alpha');
  const hex = `#${byte(rgb.getChannelValue('red'))}${byte(rgb.getChannelValue('green'))}${byte(rgb.getChannelValue('blue'))}`;
  return (alpha >= 1 ? hex : `${hex}${byte(alpha * 255)}`).toUpperCase();
}

/**
 * “Brand colors” in the color picker (mockup panel-shared.jsx color picker): colors from the brand library, one click to use. Below, “Store to brand colors” stores the current color in the brand library, so color pickers elsewhere can use it. Opacity follows the brand color (the caller drops it when `allowAlpha` is false).
 */
export function BrandSwatches({ color, allowAlpha, onPick }: { color: Color; allowAlpha: boolean; onPick(next: Color): void }) {
  const runtime = useRuntime();
  const colors = useBrandColors();
  const [saving, setSaving] = useState(false);
  const current = hexOf(allowAlpha ? color : color.withChannelValue('alpha', 1));
  const saved = colors.some((c) => normalizeColor(c.value) === current);
  const save = async () => {
    setSaving(true);
    try {
      await putLibraryEntry(runtime, { library: 'brand', content: { name: current, kind: 'color', value: current } });
      ToastQueue.positive(IB.savedToColors(current), { timeout: 4000 });
    } catch (error) {
      ToastQueue.negative(libraryErrorText(IB.actionSaveToColors, error), { timeout: 6000 });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={group}>
      <span className={title}>{IB.brandColors}</span>
      {colors.length ? (
        <ColorSwatchPicker
          aria-label={IB.brandColors}
          size="XS"
          rounding="default"
          density="compact"
          value={color.toString('hex')}
          onChange={(next) => onPick(next)}>
          {colors.map((c) => (
            <ColorSwatch key={c.id} color={parseColor(colorCss(c.value))} colorName={c.name} />
          ))}
        </ColorSwatchPicker>
      ) : null}
      <ActionButton size="S" isQuiet isDisabled={saved} isPending={saving} onPress={() => void save()}>
        <Brand />
        <Text>{saved ? IB.inBrandColors : IB.saveToColors}</Text>
      </ActionButton>
      {/* The picker's existing common colors follow: marked so they are not mistaken for part of the brand colors. */}
      <span className={title}>{IB.commonColors}</span>
    </div>
  );
}
