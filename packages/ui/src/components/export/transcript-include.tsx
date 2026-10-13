import { Checkbox } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { EXPORT_COPY } from './export-copy.ts';

/** The five switches for what the transcript includes, in this order (mockup model-transcript.js `TEXT_OPTS`). */
export type TranscriptIncludeKey = 'frontmatter' | 'chapters' | 'timestamps' | 'speakers' | 'skipCut';
const KEYS: readonly TranscriptIncludeKey[] = ['frontmatter', 'chapters', 'timestamps', 'speakers', 'skipCut'];

const checks = style({ display: 'flex', flexWrap: 'wrap', columnGap: 16, rowGap: 4 });

/**
 * The five transcript switches: the Transcript page of the export and the copy settings of the transcript panel share one set of words and one order (mockup transcript-copy.jsx `TxTextChecks`).
 * A ticked box shows the effective value; a disabled switch shows how it looks when it is not in effect.
 */
export function TranscriptIncludeChecks({
  value,
  disabled,
  onChange,
}: {
  value: Record<TranscriptIncludeKey, boolean>;
  disabled?: Partial<Record<TranscriptIncludeKey, boolean>>;
  onChange(key: TranscriptIncludeKey, on: boolean): void;
}) {
  return (
    <div className={checks}>
      {KEYS.map((key) => (
        <Checkbox key={key} size="S" isDisabled={!!disabled?.[key]} isSelected={value[key]} onChange={(on) => onChange(key, on)}>
          {EXPORT_COPY[key]}
        </Checkbox>
      ))}
    </div>
  );
}
