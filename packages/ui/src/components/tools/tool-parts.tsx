import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { ActionButton, Badge, Content, Heading, InlineAlert, Text } from '@react-spectrum/s2';
import ChevronLeft from '@react-spectrum/s2/icons/ChevronLeft';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { TextArea as RacTextArea, TextField as RacTextField } from 'react-aria-components';
import { useShell } from '../../state/shell-store.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { PAGE_COPY } from './tools-copy.ts';

/*
 * Layout shared by the tool workbenches (design file tools.css `.ttsw*`): sections of the form on the left, and a sticky record column on the right that stacks vertically when narrow;
 * at the top of a subpage, “← Tools”; on the right of the title, the status line, ⌘↵ and the primary button (the design puts these in a sticky nav bar, here they go in the page header).
 */

const back = style({ alignSelf: 'start' });
const actions = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, minWidth: 0, flexShrink: 1 });
const chipRow = style({ display: 'flex', flexWrap: 'wrap', gap: 8 });

/** Tool subpage: back to the overview, the title, a group of controls on the right of the header, and under the title a tag for “which service it runs on”. */
export function ToolPage({ title, bar, chip, children }: { title: string; bar?: ReactNode; chip?: ReactNode; children: ReactNode }) {
  const go = useShell((s) => s.go);
  return (
    <UtilityShell
      kind="tools"
      title={title}
      actions={bar ? <div className={actions}>{bar}</div> : undefined}
      before={
        <ActionButton isQuiet size="S" styles={back} onPress={() => go({ tab: 'tools' })}>
          <ChevronLeft />
          <Text>{PAGE_COPY.back}</Text>
        </ActionButton>
      }>
      {chip ? <div className={chipRow}>{chip}</div> : null}
      {children}
    </UtilityShell>
  );
}

// A reason may be a sentence: up to two lines beside the button, then the full text is in the tooltip.
const statusText = style({
  font: 'ui-sm',
  color: { default: 'gray-700', isBad: 'orange-1000' },
  minWidth: 0,
  maxWidth: '[360px]',
  lineClamp: 2,
  overflowWrap: 'anywhere',
});
const hotkey = style({ font: 'code-xs', color: 'gray-600', flexShrink: 0 });

/** The status line in the header (turns orange when a gate is not passed or there is a problem), and the keyboard shortcut hint. */
export function BarStatus({ text, bad, hint = true }: { text: string; bad: boolean; hint?: boolean }) {
  return (
    <>
      <span className={statusText({ isBad: bad })} title={text} role="status" aria-live="polite">
        {text}
      </span>
      {hint ? (
        <span className={hotkey} aria-hidden>
          {PAGE_COPY.hotkey}
        </span>
      ) : null}
    </>
  );
}

/** The tag under the header title (design file `Chip icon="remote" tone="notice"`). */
export function HeaderChip({ text, tone = 'notice' }: { text: string; tone?: 'notice' | 'neutral' }) {
  return (
    <Badge variant={tone} size="S" fillStyle="subtle">
      {text}
    </Badge>
  );
}

// ---- Workbench: form on the left, records on the right ----

const bench = style({ containerType: 'inline-size', minWidth: 0 });
const benchGrid = style({
  display: 'grid',
  gridTemplateColumns: { default: '[minmax(0, 1fr) 360px]', '@container (max-width: 760px)': '[minmax(0, 1fr)]' },
  gap: 24,
  alignItems: 'start',
});
const benchMain = style({ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 });
const benchSide = style({
  position: { default: 'sticky', '@container (max-width: 760px)': 'static' },
  top: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
});

/** A form column on the left and a 360-wide record column on the right (the right column is sticky); the content area stacks vertically when narrower than 760. */
export function Workbench({ main, side, sideLabel, onKeyDown }: { main: ReactNode; side: ReactNode; sideLabel: string; onKeyDown?: (e: KeyboardEvent) => void }) {
  return (
    <div className={bench}>
      <div className={benchGrid} onKeyDown={onKeyDown}>
        <div className={benchMain}>{main}</div>
        <aside className={benchSide} aria-label={sideLabel}>
          {side}
        </aside>
      </div>
    </div>
  );
}

/** ⌘↵ / Ctrl+↵: submits when pressed inside the form (the design attaches it to the whole workbench). */
export function submitOnModEnter(submit: () => void) {
  return (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };
}

const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingX: 20,
  paddingY: 16,
  borderRadius: '[24px]',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  minWidth: 0,
});
const sectionHead = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 });
const grow = style({ flexGrow: 1 });
const sectionTitle = style({ flexGrow: 1, margin: 0, font: 'ui', fontWeight: 'medium', color: 'gray-900' });

/** A section of the form (`.ttsw__sec`): a small heading, a link on the right, and the content below. */
export function Section({ title, aside, children, label }: { title?: string; aside?: ReactNode; children: ReactNode; label?: string }) {
  return (
    <section className={section} aria-label={label ?? title}>
      {title || aside ? (
        <div className={sectionHead}>
          {title ? <h2 className={sectionTitle}>{title}</h2> : <span className={grow} />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const row = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 32, minWidth: 0 });
const rowLabel = style({ flexShrink: 0, width: 64, font: 'ui-sm', color: 'gray-700' });
const indent = style({ marginStart: '[72px]', minWidth: 0 });

/** A row: a 64-wide label on the left, and the control on the right (`.ttsw__row` / `.ttsw__lab`). */
export function Row({ label, children, id }: { label?: string; children: ReactNode; id?: string }) {
  return (
    <div className={row}>
      {label !== undefined ? (
        <span className={rowLabel} id={id}>
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** An indented block aligned with the controls in a row (`.ttsw__indent`). */
export function Indent({ children }: { children: ReactNode }) {
  return <div className={indent}>{children}</div>;
}

/** Small-text note (`.t-detail-xs`). */
export const detail = style({ font: 'ui-xs', color: 'gray-600', minWidth: 0 });
export const detailGrow = style({ font: 'ui-xs', color: 'gray-600', minWidth: 0, flexGrow: 1 });
export const detailOver = style({ font: 'ui-xs', color: 'red-900', minWidth: 0, flexGrow: 1 });
export const hintText = style({ font: 'ui-sm', color: 'gray-600', margin: 0 });

const sideHead = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 });
const sideTitle = style({ flexGrow: 1, margin: 0, font: 'title-sm', color: 'gray-900' });
const sideFoot = style({ padding: 4, font: 'ui-xs', color: 'gray-600', margin: 0 });

/** Right column title: “Generation records” plus “N in progress” or “N items”, optionally with one more button. */
export function SideHead({ title, live, count, extra }: { title: string; live: string | null; count: string; extra?: ReactNode }) {
  return (
    <div className={sideHead}>
      <h2 className={sideTitle}>{title}</h2>
      {extra}
      {live ? (
        <Badge variant="accent" size="S" fillStyle="subtle">
          {live}
        </Badge>
      ) : (
        <span className={detail}>{count}</span>
      )}
    </div>
  );
}

/** The note at the bottom of the right column (`.ttsw__sidefoot`). */
export function SideFoot({ children }: { children: ReactNode }) {
  return <p className={sideFoot}>{children}</p>;
}

const gateActions = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 });

/** Gate card (design file `.aicard--warn`: “Connect X first”, “Download X first”): a one-line title, a short paragraph, and a row of buttons. */
export function Gate({ title, body, actions: buttons }: { title: string; body: ReactNode; actions?: ReactNode }) {
  return (
    <InlineAlert variant="notice">
      <Heading>{title}</Heading>
      <Content>
        {body}
        {buttons ? <div className={gateActions}>{buttons}</div> : null}
      </Content>
    </InlineAlert>
  );
}

const textField = style({ display: 'flex', flexDirection: 'column', minWidth: 0 });
const textBox = style({
  display: 'block',
  width: 'full',
  boxSizing: 'border-box',
  minHeight: { default: 160, isCompact: 96 },
  margin: 0,
  paddingX: 12,
  paddingY: 8,
  font: 'body-sm',
  color: 'gray-900',
  borderWidth: 1,
  borderStyle: 'solid',
  borderRadius: '[12px]',
  borderColor: { default: 'gray-300', isHovered: 'gray-400', isFocused: 'gray-600' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: 2,
  transition: 'default',
});

/**
 * The large text box in the workbench (design file `Field area` + `.ttsw__text`: at least six or seven lines tall, and it can be dragged taller). S2's TextArea grows with its content
 * and is only one line when empty, so here it is drawn with RAC's TextField + TextArea.
 */
export function ToolTextArea({
  label,
  value,
  onChange,
  placeholder,
  inputRef,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: Ref<HTMLTextAreaElement>;
  /** Shorter in the narrow column (the editor's right-side panel), about four lines. */
  compact?: boolean;
}) {
  return (
    <RacTextField aria-label={label} value={value} onChange={onChange} className={textField}>
      <RacTextArea
        ref={inputRef}
        placeholder={placeholder}
        // Recessed field (agentcut `--field-shadow`): a darker well rather than a lighter box.
        className={(rp) => `${textBox({ ...rp, isCompact: compact })} bg-black/15 shadow-(--field-shadow)`}
        style={{ resize: 'vertical' }}
      />
    </RacTextField>
  );
}

const linkButton = style({ flexShrink: 0 });

/** Small link on the right of a section header (design file `.viewall`). */
export function SectionLink({ children, onPress, isDisabled }: { children: ReactNode; onPress: () => void; isDisabled?: boolean }) {
  return (
    <ActionButton isQuiet size="XS" styles={linkButton} onPress={onPress} isDisabled={isDisabled}>
      <Text>{children}</Text>
    </ActionButton>
  );
}

// ---- Record cards ----

const record = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  borderRadius: '[20px]',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-200', isRunning: 'gray-500', isFailed: 'orange-400' },
  minWidth: 0,
});

/** One record card in the side column (`.ttsrec`); a running one gets a neutral ring (status never wears the accent). */
export function RecordCard({ running, failed, label, children }: { running?: boolean; failed?: boolean; label: string; children: ReactNode }) {
  return (
    <article className={record({ isRunning: !!running, isFailed: !!failed })} aria-label={label}>
      {children}
    </article>
  );
}

export const recordHead = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, minWidth: 0 });
export const recordIcon = style({ display: 'flex', flexShrink: 0, color: 'gray-800', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
export const recordTitle = style({
  flexGrow: 1,
  minWidth: 0,
  margin: 0,
  font: 'title-sm',
  color: 'gray-900',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
export const recordText = style({
  margin: 0,
  font: 'ui-sm',
  color: { default: 'gray-800', isOff: 'gray-500' },
  lineClamp: 2,
  overflowWrap: 'anywhere',
  userSelect: 'text',
});
export const recordRow = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0 });
