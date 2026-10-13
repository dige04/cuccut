import { useEffect, useState, type ReactNode } from 'react';
import type { Id, ServiceLevel, ServiceRequestRecord, ServiceStatus } from '@cuccut/protocol';
import { ActionButton, Button, Checkbox, Text, TextField, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import Copy from '@react-spectrum/s2/icons/Copy';
import Lock from '@react-spectrum/s2/icons/Lock';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { agoLabel } from '../../model/format.ts';
import { outcomeLabel, requestLine } from '../../model/services-mcp.ts';
import { isPortError, parsePort, runtimeServiceId, SERVICE_DEFAULT_PORT, servicePorts, serviceBusy, statusState, type ServiceId } from '../../model/services.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useServices } from '../../state/services-store.ts';
import { useShare } from '../../state/share-store.ts';
import { useNow } from '../use-now.ts';
import { detail, detailXs } from './service-card.tsx';
import { COMMON_COPY } from './services-copy.ts';
import { copyText, useConfigureService } from './use-service-actions.ts';

/*
 * Parts shared by the three pages MCP / Model API / Web (prototype designs/cuccut/app/services.css `.svc__sec` / `.svc__panel` / `.svc__line` /
 * `.svc__fix` / `.svc__port`, ui.css `.setrow` and `.agset-code`; the `Row` in page-services.jsx and the “Connect” and “Recent requests” blocks).
 */

const sec = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 28, paddingX: 4 });
const secTitle = style({ flexGrow: 1, margin: 0, font: 'ui', fontWeight: 'medium', color: 'gray-900' });

/** Section heading (prototype `.t-section.svc__sec`), with an optional status line on the right. */
export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className={sec}>
      <h3 className={secTitle}>{title}</h3>
      {aside ? (
        <span className={detailXs} role="status">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

/** Prototype ui.css `.setrow`: label and description on the left, control on the right, with a 1px gray-100 divider. */
const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingY: '[10px]',
  borderTopWidth: 0,
  borderXWidth: 0,
  borderBottomWidth: { default: 1, ':last-child': 0 },
  borderStyle: 'solid',
  borderColor: 'gray-100',
});
const rowName = style({ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, flexShrink: 1, minWidth: 0 });
const rowLabel = style({ font: 'ui', fontWeight: 'medium', color: { default: 'gray-900', isDim: 'gray-600' } });
const rowDesc = style({ font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere' });
const rowTail = style({ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 });

export function SetRow({ label, desc, dim = false, children }: { label: ReactNode; desc?: ReactNode; dim?: boolean; children?: ReactNode }) {
  return (
    <div className={row}>
      <span className={rowName}>
        <span className={rowLabel({ isDim: dim })}>{label}</span>
        {desc ? <span className={rowDesc}>{desc}</span> : null}
      </span>
      {children ? <span className={rowTail}>{children}</span> : null}
    </div>
  );
}

const plannedRow = style({ display: 'flex', alignItems: 'start', gap: 8, marginTop: 8, font: 'ui-xs', color: 'gray-600' });
const plannedIcon = iconStyle({ size: 'S', color: 'neutral', marginTop: 2 });

/** The sentence next to a greyed-out control: why this version cannot do it (same approach as `plannedReason` on the tools page; written honestly). */
export function PlannedNote({ children }: { children: ReactNode }) {
  return (
    <p className={plannedRow}>
      <Lock styles={plannedIcon} />
      <span>{children}</span>
    </p>
  );
}

/** Prototype `.agset-code`: one line of monospace text plus a copy button. */
const code = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
  paddingStart: 12,
  paddingEnd: 4,
  paddingY: 4,
  borderRadius: '[12px]',
  backgroundColor: 'gray-75',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const codeLabel = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-600' });
const codeText = style({ flexGrow: 1, minWidth: 0, font: 'code-sm', color: 'gray-900', overflowWrap: 'anywhere', userSelect: 'text' });

export function CodeLine({ label, value, copyLabel, what }: { label?: string; value: string; copyLabel: string; what: string }) {
  return (
    <div className={code}>
      {label ? <span className={codeLabel}>{label}</span> : null}
      <code className={codeText}>{value}</code>
      <TooltipTrigger delay={400}>
        <ActionButton isQuiet size="S" aria-label={copyLabel} onPress={() => copyText(value, what)}>
          <Copy />
        </ActionButton>
        <Tooltip>{copyLabel}</Tooltip>
      </TooltipTrigger>
    </div>
  );
}

/** Multi-line configuration snippet (JSON or environment variables), read-only and selectable. */
const pre = style({
  margin: 0,
  marginTop: 8,
  padding: 12,
  borderRadius: '[12px]',
  backgroundColor: 'gray-75',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  font: 'code-xs',
  color: 'gray-800',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  userSelect: 'text',
});

export function Snippet({ text }: { text: string }) {
  return <pre className={pre}>{text}</pre>;
}

const actionsRow = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 });
export function ActionsRow({ children }: { children: ReactNode }) {
  return <div className={actionsRow}>{children}</div>;
}

/** The status and connection of one Runtime service (shared across pages). */
export function useServiceStatus(id: Exclude<ServiceId, 'remote'>) {
  const runtimeId = runtimeServiceId(id);
  const status = useServices((s) => s.services.find((x) => x.serviceId === runtimeId));
  const ready = useServices((s) => s.ready);
  const connected = useConnection((s) => s.state.status === 'connected');
  return { status, ready, connected, state: statusState(status) };
}

// ---- Port, auto-start, remedies on error ----

const portField = style({ width: 96 });

/**
 * Port row (prototype `.svc__port`): commits on blur or Enter. If it clashes with another CucCut service, it says right away which one it is.
 * The Runtime takes effect immediately: if the service is running, it restarts on the new port (the prototype would require stopping the service first; this one does not). It cannot be changed while starting or stopping.
 */
export function PortRow({ id, status }: { id: Exclude<ServiceId, 'remote'>; status: ServiceStatus }) {
  const configure = useConfigureService();
  const services = useServices((s) => s.services);
  const share = useShare((s) => s.status);
  const connected = useConnection((s) => s.state.status === 'connected');
  const port = status.port ?? SERVICE_DEFAULT_PORT[id];
  const [draft, setDraft] = useState(String(port));
  const [error, setError] = useState('');
  useEffect(() => setDraft(String(port)), [port]);
  const busy = serviceBusy(statusState(status));
  const commit = () => {
    const parsed = parsePort(draft, id, servicePorts(services, share));
    if (parsed.error !== undefined) return setError(parsed.error);
    setError('');
    if (parsed.port !== port) void configure({ serviceId: runtimeServiceId(id), port: parsed.port }, COMMON_COPY.portSaved(parsed.port));
  };
  const live = status.state === 'on';
  return (
    <SetRow
      label={COMMON_COPY.portLabel}
      desc={error || (busy ? COMMON_COPY.portBusy : live ? COMMON_COPY.portLive : COMMON_COPY.portIdle(SERVICE_DEFAULT_PORT[id]))}>
      <TextField
        aria-label={COMMON_COPY.portLabel}
        size="S"
        inputMode="numeric"
        styles={portField}
        value={draft}
        isInvalid={!!error}
        isDisabled={busy || !connected}
        onChange={(v) => {
          setDraft(v);
          setError('');
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
    </SetRow>
  );
}

/** “Start automatically when CucCut opens” (starts with the Runtime; the `autostart` of `services.configure`). */
export function AutostartCheckbox({ id, status }: { id: Exclude<ServiceId, 'remote'>; status: ServiceStatus }) {
  const configure = useConfigureService();
  const connected = useConnection((s) => s.state.status === 'connected');
  return (
    <Checkbox
      size="S"
      isSelected={status.autostart}
      isDisabled={!connected}
      onChange={(autostart) => void configure({ serviceId: runtimeServiceId(id), autostart })}>
      {COMMON_COPY.autostart}
    </Checkbox>
  );
}

const fix = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 12,
  paddingX: 12,
  paddingY: 8,
  borderRadius: '[12px]',
  backgroundColor: 'gray-75',
});
const grow = style({ flexGrow: 1, minWidth: 0 });

/** Remedy line on the card in case of error (prototype `.svc__fix`): try another port, or switch back to the default port with one click. Shown only when the cause is the port. */
export function ErrorFix({ id, status }: { id: Exclude<ServiceId, 'remote'>; status: ServiceStatus }) {
  const configure = useConfigureService();
  const connected = useConnection((s) => s.state.status === 'connected');
  const fallback = SERVICE_DEFAULT_PORT[id];
  if (!isPortError(status)) return null;
  return (
    <div className={fix}>
      <span className={`${detail} ${grow}`}>{COMMON_COPY.errorFix}</span>
      {status.port !== fallback ? (
        <Button
          variant="secondary"
          size="S"
          isDisabled={!connected}
          onPress={() => void configure({ serviceId: runtimeServiceId(id), port: fallback }, COMMON_COPY.portReset(fallback))}>
          {COMMON_COPY.resetPort}
        </Button>
      ) : null}
    </div>
  );
}

// ---- Allowed operations (three tiers) ----

/** Three equal-width columns; becomes one column when narrow (prototype services.css `.svc__access3`). */
const levels = style({
  display: 'grid',
  gridTemplateColumns: { default: '1fr', sm: ['1fr', '1fr', '1fr'] },
  gap: 8,
  marginTop: 12,
});
/** One tier (prototype settings-agent.css `.agm-access__option`; the selected one has a blue background and blue border). */
const levelOption = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  gap: 2,
  padding: 12,
  borderRadius: '[16px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-300', isHovered: 'gray-400', isSelected: 'blue-900', isDisabled: 'gray-200' },
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isSelected: 'blue-100', isDisabled: 'transparent' },
  textAlign: 'start',
  cursor: 'default',
  transition: 'default',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: 2,
});
const levelTitle = style({ font: 'ui', fontWeight: 'bold', color: { default: 'gray-900', isDisabled: 'disabled' } });
const levelDesc = style({ font: 'ui-xs', color: { default: 'gray-600', isDisabled: 'disabled' } });

/**
 * Three access tiers (prototype `.agm-access.svc__access3`, choose one of three): react-aria's ToggleButtonGroup (same as the aspect-ratio picker in tools/image-tool.tsx).
 * S2's SelectBoxGroup fits only one item in its horizontal row, and its vertical layout does not show descriptions, so it is not used. Takes effect immediately.
 */
export function LevelChoice({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: ServiceLevel;
  options: readonly { level: ServiceLevel; title: string; desc: string }[];
  disabled: boolean;
  onChange: (level: ServiceLevel) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      className={levels}
      selectionMode="single"
      disallowEmptySelection
      isDisabled={disabled}
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next !== undefined && next !== value) onChange(next as ServiceLevel);
      }}>
      {options.map((o) => (
        <ToggleButton key={o.level} id={o.level} className={(rp) => levelOption(rp)}>
          {({ isDisabled }) => (
            <>
              <span className={levelTitle({ isDisabled })}>{o.title}</span>
              <span className={levelDesc({ isDisabled })}>{o.desc}</span>
            </>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

// ---- Recent requests ----

const line = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
  paddingY: 8,
  borderTopWidth: 0,
  borderXWidth: 0,
  borderBottomWidth: { default: 1, ':last-child': 0 },
  borderStyle: 'solid',
  borderColor: 'gray-100',
});
const call = style({ flexGrow: 1, minWidth: 0, font: 'code-sm', color: 'gray-800', overflowWrap: 'anywhere' });
const meta = style({ flexShrink: 0, font: 'ui-xs', color: { default: 'gray-600', isBad: 'negative' } });

/** Recent external requests (the Runtime keeps the latest 20, newest first): tool · target video, caller · how long ago · result. Does not include the parameter body. */
export function RequestList({ records, nameOf }: { records: readonly ServiceRequestRecord[]; nameOf: (id: Id) => string | undefined }) {
  const now = useNow(60_000);
  if (!records.length) return <p className={detail}>{COMMON_COPY.noRequests}</p>;
  return (
    <div>
      {records.map((r, i) => (
        <div key={`${r.at}-${i}`} className={line}>
          <code className={call}>{requestLine(r, nameOf)}</code>
          <span className={meta({ isBad: r.outcome !== 'ok' })}>
            {COMMON_COPY.requestMeta(r.clientName, agoLabel(r.at, now), outcomeLabel(r.outcome))}
          </span>
        </div>
      ))}
    </div>
  );
}
