import type { ReactNode } from 'react';
import { Badge } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { ModelChip } from '../../model/models-local.ts';
import { PANEL } from '../settings/settings-ui.tsx';

/*
 * Layout shared by several pages of the model page (design mocks settings-cloud.css, settings-local.css, page-settings.css):
 * section title + description (.cloud-h / .cloud-desc), card layer (.card--layer), settings row (.setrow), tags, and dashed empty state (.vlib-empty).
 */

const heading = style({ display: 'flex', alignItems: 'start', gap: 12, marginTop: 32, marginBottom: 12 });
const headingFirst = style({ display: 'flex', alignItems: 'start', gap: 12, marginTop: 0, marginBottom: 12 });
const headingText = style({ flexGrow: 1, minWidth: 0 });
const headingTitle = style({ margin: 0, font: 'title-sm', color: 'gray-900' });
const headingDesc = style({ marginTop: 4, marginBottom: 0, font: 'ui-sm', color: 'gray-600' });
/** Buttons on the right must not squeeze the description onto two lines (in a narrow window, “Add custom provider” wraps). */
const headingAction = style({ flexShrink: 0, whiteSpace: 'nowrap' });

/** Section title with one sentence of description; a button may sit on the right. */
export function Lede({ title, desc, action, first = false }: { title: string; desc?: ReactNode; action?: ReactNode; first?: boolean }) {
  return (
    <div className={first ? headingFirst : heading}>
      <div className={headingText}>
        <h2 className={headingTitle}>{title}</h2>
        {desc ? <p className={headingDesc}>{desc}</p> : null}
      </div>
      {action ? <div className={headingAction}>{action}</div> : null}
    </div>
  );
}

const card = style({
  paddingX: 20,
  marginBottom: 8,
  minWidth: 0,
});

/** Card layer. */
export function Card({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className={`${card} ${PANEL}`} aria-label={label}>
      {children}
    </section>
  );
}

const row = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 12,
  paddingY: 12,
  borderTopWidth: 0,
  borderXWidth: 0,
  borderBottomWidth: { default: 1, ':last-child': 0 },
  borderStyle: 'solid',
  borderColor: 'gray-100',
});
const rowText = style({ flexGrow: 1, flexBasis: 0, minWidth: 200 });
const rowLabel = style({ font: 'ui', fontWeight: 'medium', color: 'gray-900' });
const rowDesc = style({ marginTop: 4, font: 'ui-sm', color: 'gray-600', overflowWrap: 'anywhere' });
const rowControl = style({ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 });

/** One settings row: name and description on the left, control on the right. */
export function SettingRow({ label, desc, children }: { label: string; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className={row}>
      <div className={rowText}>
        <div className={rowLabel}>{label}</div>
        {desc ? <div className={rowDesc}>{desc}</div> : null}
      </div>
      {children ? <div className={rowControl}>{children}</div> : null}
    </div>
  );
}

/** A row of tags (default, loaded, the reason it is unavailable…). */
export function Chips({ chips }: { chips: readonly ModelChip[] }) {
  return (
    <>
      {chips.map((chip) => (
        <Badge key={chip.label} variant={chip.tone} size="S" fillStyle="subtle">
          {chip.label}
        </Badge>
      ))}
    </>
  );
}

const empty = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  paddingX: 24,
  paddingY: 32,
  borderWidth: 1,
  borderStyle: 'dashed',
  borderColor: 'gray-300',
  borderRadius: '[24px]',
  textAlign: 'center',
});
const emptyIcon = style({ display: 'flex', color: 'gray-600', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const emptyTitle = style({ margin: 0, font: 'title-sm', color: 'gray-900' });
const emptyBody = style({ margin: 0, maxWidth: '[460px]', font: 'ui-sm', color: 'gray-600' });
const emptyActions = style({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 });
const emptyNote = style({ margin: 0, maxWidth: '[460px]', font: 'ui-xs', color: 'gray-600' });

/** Dashed-frame empty state: optional icon, title, one sentence, optional button and a note. */
export function EmptyCard({
  icon,
  title,
  body,
  actions,
  note,
}: {
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className={empty}>
      {icon ? (
        <span className={emptyIcon} aria-hidden>
          {icon}
        </span>
      ) : null}
      <h3 className={emptyTitle}>{title}</h3>
      <p className={emptyBody}>{body}</p>
      {actions ? <div className={emptyActions}>{actions}</div> : null}
      {note ? <p className={emptyNote}>{note}</p> : null}
    </div>
  );
}

const status = style({ margin: 0, paddingY: 24, font: 'ui-sm', color: 'gray-600' });

/** One sentence shown when not yet connected to the Runtime or the view has not arrived. */
export function PageStatus({ children }: { children: ReactNode }) {
  return (
    <p className={status} role="status">
      {children}
    </p>
  );
}
