import AIMark from '@react-spectrum/s2/icons/AIMark';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import CloseCaptions from '@react-spectrum/s2/icons/CloseCaptions';
import Download from '@react-spectrum/s2/icons/Download';
import Export from '@react-spectrum/s2/icons/Export';
import HelpCircle from '@react-spectrum/s2/icons/HelpCircle';
import Layers from '@react-spectrum/s2/icons/Layers';
import Layout from '@react-spectrum/s2/icons/Layout';
import TextSize from '@react-spectrum/s2/icons/TextSize';
import Translate from '@react-spectrum/s2/icons/Translate';
import Upload from '@react-spectrum/s2/icons/Upload';
import Video from '@react-spectrum/s2/icons/Video';
import type { ComponentType } from 'react';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { HELP_COPY as COPY } from '../../copy.ts';
import type { HelpGuide, HelpIcon } from '../../model/help-guides.ts';
import { AgentIcon } from '../agent-icon.tsx';
import { EDGE, INSET, ROW_EDGE, ROW_FILL } from './dialog-fills.ts';

/** Guide icons (prototype model-help.js `icon`, swapped for S2 icons; the Agent uses a hand-drawn robot, same as the settings page). */
const ICONS: Record<HelpIcon, ComponentType> = {
  upload: Upload,
  captions: CloseCaptions,
  translate: Translate,
  export: Export,
  workspace: Layout,
  styles: TextSize,
  elements: Layers,
  video: Video,
  agent: AgentIcon,
  sparkle: AIMark,
  help: HelpCircle,
  download: Download,
};

/** Guide icon; the colour follows the surrounding text (the outer style sets `--iconPrimary` to currentColor; the prototype's icons are all currentColor). */
export function GuideIcon({ icon }: { icon: HelpIcon }) {
  const Icon = ICONS[icon];
  return <Icon />;
}

/** Guide and FAQ list rows (prototype .help-list / .help-row): icon, title and one-line summary, reading time, arrow. */
export function GuideList({ guides, onRead }: { guides: readonly HelpGuide[]; onRead(guide: HelpGuide): void }) {
  return (
    <div className={`${list} ${EDGE} ${INSET}`}>
      {guides.map((guide) => (
        <RACButton key={guide.id} className={(state) => `${row(state)} ${ROW_EDGE} ${ROW_FILL}`} onPress={() => onRead(guide)}>
          <span className={rowIcon}>
            <GuideIcon icon={guide.icon} />
          </span>
          <span className={rowText}>
            <strong className={rowTitle}>{guide.title}</strong>
            <small className={rowSummary}>{guide.summary}</small>
          </span>
          <span className={readTime}>{COPY.minutes(guide.minutes)}</span>
          <span className={chevron}>
            <ChevronRight />
          </span>
        </RACButton>
      ))}
    </div>
  );
}

/** Section heading row (prototype .help-section-heading): title on the left, one action or count on the right. */
export const sectionHeading = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12,
});
export const sectionTitle = style({ margin: 0, fontSize: 'ui-2xl', fontWeight: 'extra-bold', lineHeight: '[1.3]', color: 'gray-900' });
export const subTitle = style({ margin: 0, font: 'ui', fontWeight: 'bold', color: 'gray-900' });
export const intro = style({ marginTop: 8, marginBottom: 24, font: 'ui-sm', lineHeight: '[1.6]', color: 'gray-700' });
export const detail = style({ font: 'ui-sm', color: 'gray-600' });
export const kbd = style({ flexShrink: 0, font: 'code-xs', color: 'gray-600', whiteSpace: 'nowrap' });
/** Prototype .help-eyebrow: 12px bold blue text. */
export const eyebrow = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '[6px]',
  font: 'ui-sm',
  fontWeight: 'bold',
  color: 'blue-1000',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
/** Prototype .help-link: small blue text link, with an arrow. */
export const textLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
  font: 'ui-sm',
  color: 'blue-1000',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
  cursor: 'pointer',
  textDecoration: { default: 'none', isHovered: 'underline' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  borderRadius: 'sm',
});

/** Edge and fill from dialog-fills.ts. */
const list = style({ borderWidth: 1, borderStyle: 'solid', borderRadius: '[16px]', overflow: 'hidden' });
const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  boxSizing: 'border-box',
  width: 'full',
  padding: 16,
  borderWidth: 0,
  borderTopWidth: { default: 1, ':first-child': 0 },
  borderStyle: 'solid',
  textAlign: 'start',
  cursor: 'pointer',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: -3,
  transition: 'default',
});
const rowIcon = style({ display: 'grid', placeItems: 'center', flexShrink: 0, size: 32, color: 'gray-700', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const rowText = style({ flexGrow: 1, minWidth: 0 });
const rowTitle = style({ display: 'block', font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const rowSummary = style({ display: 'block', marginTop: 4, font: 'ui-sm', lineHeight: '[1.5]', color: 'gray-600' });
const readTime = style({
  display: { default: 'block', '@media (max-width: 760px)': 'none' },
  flexShrink: 0,
  font: 'ui-xs',
  color: 'gray-600',
  whiteSpace: 'nowrap',
});
const chevron = style({ display: 'flex', flexShrink: 0, color: 'gray-600', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
