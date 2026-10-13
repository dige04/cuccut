import { SegmentedControl, SegmentedControlItem } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { HELP_COPY as COPY, SHORTCUT_SHEET_COPY } from '../../copy.ts';
import { keyLabel } from '../../model/key-labels.ts';
import { KeyCombo } from '../settings/settings-ui.tsx';
import { ROW_EDGE } from './dialog-fills.ts';
import { intro, sectionHeading, sectionTitle } from './help-guide-list.tsx';

/**
 * 快捷键页（原型 help-center.jsx 的 `section === 'keys'`）：和编辑器的快捷键清单（shortcut-sheet）同一份 rows，
 * 不另抄；macOS 与 Windows / Linux 的写法切换照原型 `keyLabel`。
 */
export function HelpKeys({ mac, onPlatform }: { mac: boolean; onPlatform(mac: boolean): void }) {
  return (
    <>
      <div className={sectionHeading}>
        <h2 className={sectionTitle}>{COPY.keysTitle}</h2>
        <SegmentedControl aria-label={COPY.keysPlatform} selectedKey={mac ? 'mac' : 'other'} onSelectionChange={(key) => onPlatform(key === 'mac')}>
          <SegmentedControlItem id="mac">{COPY.mac}</SegmentedControlItem>
          <SegmentedControlItem id="other">{COPY.other}</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <p className={intro}>{COPY.keysIntro}</p>
      <div>
        {SHORTCUT_SHEET_COPY.rows.map(([label, keys]) => (
          <div key={label} className={`${row} ${ROW_EDGE}`}>
            <span className={name}>{label}</span>
            <KeyCombo keys={keyLabel(keys, mac)} />
          </div>
        ))}
      </div>
    </>
  );
}

// Keycaps as in Settings › Shortcuts (settings-ui.tsx `KeyCombo`); the row edge from dialog-fills.ts.
const row = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  paddingY: 8,
  borderWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  font: 'ui-sm',
  color: 'gray-800',
});
const name = style({ minWidth: 0 });
