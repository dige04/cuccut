import type { ReactNode } from 'react';
import { Button, Text } from '@react-spectrum/s2';
import Play from '@react-spectrum/s2/icons/Play';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { serviceQuickAction, serviceTone, type ServiceId, type ServiceLight, type ServiceState } from '../../model/services.ts';
import { ServiceIcon, StopIcon } from './service-icon.tsx';
import { COMMON_COPY } from './services-copy.ts';

/*
 * Shared blocks for the services pages (prototype designs/cuccut/app/page-services.jsx `ServiceCard` / `Lede`, services.css `.svc*`).
 * The card follows the prototype's `Card layer`: radius 10, gray-50 background, 1px gray-200 border.
 */

export const lede = style({ margin: 0, font: 'body-sm', color: 'gray-600' });
export const strong = style({ fontWeight: 'bold', color: 'gray-800' });
export const detail = style({ margin: 0, font: 'ui-sm', color: 'gray-600', overflowWrap: 'anywhere' });
export const detailXs = style({ margin: 0, font: 'ui-xs', color: 'gray-600' });
export const panel = style({
  boxSizing: 'border-box',
  paddingX: 20,
  paddingY: 16,
  marginTop: 12,
  borderRadius: '[24px]',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
/** Prototype `.t-section`: 11px bold, grey, slightly open letter-spacing. */
export const sectionTitle = style({ margin: 0, marginTop: 28, font: 'ui', fontWeight: 'medium', color: 'gray-900' });

const card = style({
  boxSizing: 'border-box',
  paddingX: 20,
  paddingY: 16,
  borderRadius: '[24px]',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const head = style({ display: 'flex', alignItems: 'center', gap: 12 });
const txt = style({ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 });
const title = style({ font: 'title-sm', color: 'gray-900' });
// The `font` shorthand with runtime conditions is compiled by the macro into a static string, so monospace or not is split into two classes.
const sub = style({ font: 'ui-sm', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const subMono = style({ font: 'code-sm', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const foot = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  columnGap: 12,
  rowGap: 4,
  marginTop: 12,
  paddingTop: 12,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-100',
});

/** Status block: 40×40, radius 10; green background when running, orange when in error, and the icon changes color with it (services.css `.svc__mark`). */
const mark = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  size: 40,
  borderRadius: '[16px]',
  backgroundColor: { tone: { off: 'gray-100', on: 'green-200', error: 'orange-200' } },
  color: { tone: { off: 'gray-700', on: 'green-1000', error: 'orange-1000' } },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});

export function ServiceMark({ id, state }: { id: ServiceId; state: ServiceState }) {
  const tone = serviceTone(state);
  return (
    // The mark graphic inside the icon block is uniformly 20px (product design §2.1)
    <span className={mark({ tone })} data-cc-icons="primary" aria-hidden="true">
      <ServiceIcon id={id} error={tone === 'error'} />
    </span>
  );
}

/** A 6px status light (services.css `.svclight`): grey = off, green = running, orange = error; one shade darker grey while starting or stopping. */
const lightDot = style({
  display: 'inline-block',
  flexShrink: 0,
  size: 6,
  borderRadius: 'full',
  backgroundColor: { tone: { off: 'gray-500', on: 'green-900', error: 'orange-900' }, busy: 'gray-600' },
});
const lightsRow = style({ display: 'inline-flex', alignItems: 'center', gap: 4 });

export function ServiceLightDot({ tone, busy = false }: { tone: ServiceLight['tone']; busy?: boolean }) {
  return <span className={lightDot({ tone, busy })} aria-hidden="true" />;
}

/** A row of lights next to the overview title, one per service (prototype `window.SvcLights`). */
export function ServiceLights({ lights }: { lights: ServiceLight[] }) {
  return (
    <span className={lightsRow} role="img" aria-label={COMMON_COPY.lightsLabel(lights.map((l) => l.label))}>
      {lights.map((l) => (
        <span key={l.id} title={l.label} style={{ display: 'inline-flex' }}>
          <ServiceLightDot tone={l.tone} busy={l.busy} />
        </span>
      ))}
    </span>
  );
}

/**
 * Service card at the top of the detail page: status block, title and subtitle line, one start/stop button, and a footer. The button depends on the state: when on, it offers stop; when off, start; on error, “Restart…”;
 * while starting or stopping, a disabled “In progress…”; and no button for services without a backend (the reason is written in the subtitle line).
 */
export function ServiceCard({
  id,
  state,
  heading,
  subline,
  mono = false,
  disabled = false,
  onFlip,
  footer,
  children,
}: {
  id: ServiceId;
  state: ServiceState;
  heading: ReactNode;
  subline: ReactNode;
  mono?: boolean;
  /** The start/stop button is greyed out when the Runtime is not connected. */
  disabled?: boolean;
  onFlip?: (on: boolean) => void;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={card}>
      <div className={head}>
        <ServiceMark id={id} state={state} />
        <span className={txt}>
          <span className={title}>{heading}</span>
          <span className={mono ? subMono : sub}>{subline}</span>
        </span>
        <FlipButton id={id} state={state} disabled={disabled} onFlip={onFlip} size="M" />
      </div>
      {children}
      {footer ? <div className={foot}>{footer}</div> : null}
    </section>
  );
}

/** Start/stop button (shared by the service card and the overview row). */
export function FlipButton({
  id,
  state,
  disabled,
  onFlip,
  size,
  primary = true,
}: {
  id: ServiceId;
  state: ServiceState;
  disabled: boolean;
  onFlip?: (on: boolean) => void;
  size: 'S' | 'M';
  /** The one tinted action of the view (a service's own page); lists of services keep every button neutral. */
  primary?: boolean;
}) {
  const action = serviceQuickAction(id, state);
  // Services with no backend get no start/stop button (the reason is written next to it), so it does not look like it is only temporarily unavailable.
  if (action.kind === 'unavailable') return null;
  if (action.kind === 'busy') {
    return (
      <Button variant="secondary" size={size} isDisabled>
        {action.label}
      </Button>
    );
  }
  if (action.kind === 'stop') {
    return (
      <Button variant="secondary" size={size} isDisabled={disabled} onPress={() => onFlip?.(false)}>
        <StopIcon />
        <Text>{action.label}</Text>
      </Button>
    );
  }
  return (
    <Button
      variant={primary ? 'accent' : 'secondary'}
      size={size}
      isDisabled={disabled || !onFlip}
      onPress={() => onFlip?.(true)}>
      <Play />
      <Text>{action.label}</Text>
    </Button>
  );
}
