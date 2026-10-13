import { Picker, PickerItem, Switch, Text } from '@react-spectrum/s2';
import { DEFAULT_LOUDNESS_TARGET } from '@cuccut/protocol';
import { dbChoices, formatDb, LUFS_CHOICES, loudnessNote, TRUE_PEAK_CHOICES, type LoudnessForm } from '../../model/export-settings.ts';
import { EXPORT_COPY } from './export-copy.ts';
import { Note, Quick, QuickField, Sec } from './export-parts.tsx';

/**
 * The "Loudness" section (design mockup export-loudness.jsx, feature short film §5.3): one copy on the video page and one on the audio page, sharing one state, off by default.
 * When on, the whole mix is normalized to the target loudness, and the true peak does not exceed the ceiling (`LoudnessTarget`, the R128 mastering chain of the render worker).
 * The mockup's default peak is −1.2 dBTP; here the Runtime default of −1.5 dBTP is used (`DEFAULT_LOUDNESS_TARGET`), and both presets can be chosen.
 */
export function ExportLoudness({ value, onChange }: { value: LoudnessForm; onChange: (next: LoudnessForm) => void }) {
  const set = (patch: Partial<LoudnessForm>) => onChange({ ...value, ...patch });
  return (
    <>
      <Sec>{EXPORT_COPY.loudness}</Sec>
      <Quick>
        <QuickField label={EXPORT_COPY.loudnessSwitch}>
          <Switch size="S" aria-label={EXPORT_COPY.loudnessSwitch} isSelected={value.on} onChange={(on) => set({ on })} />
        </QuickField>
        {value.on ? (
          <>
            <QuickField label={EXPORT_COPY.loudnessTarget}>
              <Picker
                size="S"
                aria-label={EXPORT_COPY.loudnessTarget}
                selectedKey={String(value.lufs)}
                onSelectionChange={(key) => key !== null && set({ lufs: Number(key) })}>
                {dbChoices(LUFS_CHOICES, value.lufs).map((x) => (
                  <PickerItem key={x} id={String(x)} textValue={`${formatDb(x)} LUFS`}>
                    <Text slot="label">{formatDb(x)} LUFS</Text>
                    {x === DEFAULT_LOUDNESS_TARGET.integratedLufs ? <Text slot="description">{EXPORT_COPY.defaultMark}</Text> : null}
                  </PickerItem>
                ))}
              </Picker>
            </QuickField>
            <QuickField label={EXPORT_COPY.truePeak}>
              <Picker
                size="S"
                aria-label={EXPORT_COPY.truePeak}
                selectedKey={String(value.truePeak)}
                onSelectionChange={(key) => key !== null && set({ truePeak: Number(key) })}>
                {dbChoices(TRUE_PEAK_CHOICES, value.truePeak).map((x) => (
                  <PickerItem key={x} id={String(x)} textValue={`${formatDb(x)} dBTP`}>
                    <Text slot="label">{formatDb(x)} dBTP</Text>
                    {x === DEFAULT_LOUDNESS_TARGET.truePeakDb ? <Text slot="description">{EXPORT_COPY.defaultMark}</Text> : null}
                  </PickerItem>
                ))}
              </Picker>
            </QuickField>
          </>
        ) : null}
      </Quick>
      <Note>{loudnessNote(value)}</Note>
    </>
  );
}
