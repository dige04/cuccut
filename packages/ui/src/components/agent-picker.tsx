import type { DriverId, DriverInfo } from '@cuccut/protocol';
import { useRef, useState, type ComponentRef, type CSSProperties } from 'react';
import { ActionButton, Header, Heading, Menu, MenuItem, MenuSection, MenuTrigger, SubmenuTrigger, Text } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Checkmark from '@react-spectrum/s2/icons/Checkmark';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import Download from '@react-spectrum/s2/icons/Download';
import Settings from '@react-spectrum/s2/icons/Settings';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { S } from './shell-copy.ts';
import { AGENT_PICKER } from '../copy.ts';
import { AgentProviderIcon } from './agent-provider-icon.tsx';
import {
  compactHarnessLabel,
  currentEffort,
  draftSelection,
  effectiveModel,
  effortLabel,
  effortRows,
  harnessLabel,
  modelChange,
  modelLabel,
  modelRows,
  providerRows,
  type AgentChange,
} from '../model/agent-choice.ts';
import { useShell } from '../state/shell-store.ts';

/** 320 wide (agentcut `ProviderModelPicker`). */
const menu = style({ width: 320, maxWidth: '[calc(100vw - 32px)]' });
/**
 * The menu opens upward from the composer. Its height is capped at the room between the page's glass header and the
 * trigger, so it scrolls instead of sliding over the header (never glass on glass). The header (32px window strip plus
 * the 56px bar and its margins) ends near 88px; keep 16px under it.
 */
const HEADER_CLEARANCE = 104;
const MIN_MENU_HEIGHT = 200;
function menuCapFor(trigger: Element | null | undefined): CSSProperties | undefined {
  if (!trigger) return undefined;
  return { maxHeight: Math.max(MIN_MENU_HEIGHT, trigger.getBoundingClientRect().top - HEADER_CLEARANCE) };
}
const label = style({ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 });
const labelText = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: { default: '[180px]', isCompact: '[120px]' },
});
/** The check on the current row at the first level: the icon slot holds the Agent icon, so the check goes to the right of the name, before the submenu arrow (the prototype ui-spectrum.jsx places it the same way). */
const rowCheck = style({ display: 'flex', alignItems: 'center', color: 'accent' });

export interface AgentPickerProps {
  drivers: readonly DriverInfo[] | null;
  /** The Agent in use: the one on the session, or the choice on the new-session draft, or else the default one. */
  driverId: DriverId | null;
  /** null = the Agent's default model. */
  model: string | null;
  /** null = the model's own default reasoning effort. */
  effort: string | null;
  /** Once the session has had a task, the Agent is fixed to this one; other Agents show the reason and cannot be picked. */
  lockedTo: DriverId | null;
  /** When narrow, the Agent keeps only its icon and the model keeps only its tier name (`compactHarnessLabel`). */
  compact?: boolean;
  onChange(change: AgentChange): void;
}

/**
 * Coding Agent · model · reasoning effort (prototype agent-picker.jsx, model-agent.js `providerRows` / `modelRows`).
 * The first level has one row per Agent: usable ones expand to a second level for choosing the model and reasoning effort; unusable ones state the reason, and clicking goes to 设置 › Agent (Settings › Agent).
 */
export function AgentPicker({ drivers, driverId, model, effort, lockedTo, compact, onChange }: AgentPickerProps) {
  const go = useShell((s) => s.go);
  const list = drivers ?? [];
  const current = list.find((d) => d.id === driverId) ?? null;
  const rows = providerRows(list, driverId, model, lockedTo);
  const goSettings = () => go({ tab: 'settings', section: 'agent' });
  const triggerRef = useRef<ComponentRef<typeof ActionButton>>(null);
  const [menuCap, setMenuCap] = useState<CSSProperties | undefined>(undefined);
  // agentcut's picker chip says one thing on two lines: the agent, small, over the model.
  const over = current ? current.name : AGENT_PICKER.group;
  const main = !current
    ? AGENT_PICKER.detecting
    : compact
      ? compactHarnessLabel(current, model)
      : model === null
        ? AGENT_PICKER.defaultMark
        : modelLabel(current, model);

  return (
    <MenuTrigger
      align="end"
      direction="top"
      onOpenChange={(isOpen) => {
        if (isOpen) setMenuCap(menuCapFor(triggerRef.current?.UNSAFE_getDOMNode()));
      }}>
      <ActionButton ref={triggerRef} size="S" UNSAFE_className="cc-pick" aria-label={S.agentPicker.current(harnessLabel(current, model))}>
        {current ? <AgentProviderIcon driver={current} /> : null}
        <Text>
          <span className={label}>
            <span className="cc-pick__lines">
              {compact ? null : <span className="cc-pick__over">{over}</span>}
              <span className={`cc-pick__main ${labelText({ isCompact: !!compact })}`}>{main}</span>
            </span>
            <ChevronDown />
          </span>
        </Text>
      </ActionButton>
      <Menu
        aria-label={S.agentPicker.label}
        size="M"
        styles={menu}
        UNSAFE_style={menuCap}
        disabledKeys={rows.filter((r) => r.locked).map((r) => `driver:${r.id}`)}
        onAction={(key) => {
          if (key === 'settings' || String(key).startsWith('setup:')) goSettings();
        }}>
        <MenuSection>
          <Header>
            <Heading>{AGENT_PICKER.group}</Heading>
          </Header>
          {rows.map((row) => {
            const driver = list.find((d) => d.id === row.id)!;
            // Prototype: each row starts with the Agent's icon, with a check to the right of the current one's name; unusable rows end with a “download / warning / settings” icon depending on the reason (usable rows end with S2's built-in submenu arrow).
            const item = (id: string) => (
              <MenuItem key={id} id={id} textValue={row.name}>
                <AgentProviderIcon driver={driver} />
                <Text slot="label">{row.name}</Text>
                {row.selected && row.ready && !row.locked ? (
                  <Text slot="value">
                    <span className={rowCheck}>
                      <Checkmark />
                    </span>
                  </Text>
                ) : null}
                <Text slot="description">{row.sub}</Text>
                {row.ready ? null : row.state === 'missing' ? (
                  <Download slot="descriptor" />
                ) : row.state === 'attention' ? (
                  <AlertTriangle slot="descriptor" />
                ) : (
                  <Settings slot="descriptor" />
                )}
              </MenuItem>
            );
            if (row.locked) return item(`driver:${row.id}`);
            if (!row.ready) return item(`setup:${row.id}`);
            // The current Agent uses the choice on the session; other Agents show what they would use if switched to (their default in preferences).
            const own = row.selected ? { model, effort } : draftSelection(driver, undefined);
            return (
              <SubmenuTrigger key={row.id}>
                {item(`driver:${row.id}`)}
                <ModelMenu
                  driver={driver}
                  current={row.selected}
                  model={own.model}
                  effort={own.effort}
                  cap={menuCap}
                  onChange={onChange}
                />
              </SubmenuTrigger>
            );
          })}
        </MenuSection>
        <MenuSection>
          <MenuItem id="settings" textValue={AGENT_PICKER.settings}>
            <Settings />
            <Text slot="label">{AGENT_PICKER.settings}</Text>
            <Text slot="description">{AGENT_PICKER.settingsSub}</Text>
          </MenuItem>
        </MenuSection>
      </Menu>
    </MenuTrigger>
  );
}

/** Second level: the first item is labelled “Model”, meaning the Agent's default model, followed by its model list; below that are the reasoning effort options for this model (omitted if there are none). */
function ModelMenu({
  driver,
  current,
  model,
  effort,
  cap,
  onChange,
}: {
  driver: DriverInfo;
  current: boolean;
  model: string | null;
  effort: string | null;
  cap: CSSProperties | undefined;
  onChange(change: AgentChange): void;
}) {
  const active = effectiveModel(driver, model);
  const efforts = effortRows(active);
  const currentId = currentEffort(active, effort);
  const currentLabel = currentId ? effortLabel(currentId, active?.efforts.find((e) => e.id === currentId)?.label) : null;
  // Another Agent's menu checks what it would use if switched to. Choosing that checked row changes no selection, so for
  // those menus every row switches through its action instead (an action runs whether or not the row is selected).
  const pick = (change: AgentChange) => (current ? undefined : () => onChange(change));
  return (
    <Menu aria-label={S.agentPicker.models(driver.name)} size="M" styles={menu} UNSAFE_style={cap}>
      <MenuSection
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[`model:${model ?? ''}`]}
        onSelectionChange={(keys) => {
          const key = keys === 'all' ? undefined : String([...keys][0] ?? '');
          if (!current || !key?.startsWith('model:')) return;
          const next = key.slice('model:'.length) || null;
          onChange(modelChange(driver, next, effort));
        }}>
        <Header>
          <Heading>{AGENT_PICKER.models}</Heading>
        </Header>
        {modelRows(driver, model).map((row) => (
          <MenuItem
            key={row.model ?? ''}
            id={`model:${row.model ?? ''}`}
            textValue={row.label}
            onAction={pick(modelChange(driver, row.model, effort))}>
            <Text slot="label">{row.label}</Text>
            {row.sub ? <Text slot="description">{row.sub}</Text> : null}
          </MenuItem>
        ))}
      </MenuSection>
      {efforts.length ? (
        <MenuSection
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={currentId ? [`effort:${currentId}`] : []}
          onSelectionChange={(keys) => {
            const key = keys === 'all' ? undefined : String([...keys][0] ?? '');
            if (!current || !key?.startsWith('effort:')) return;
            onChange({ driverId: driver.id, model, effort: key.slice('effort:'.length) });
          }}>
          <Header>
            <Heading>{AGENT_PICKER.effort(currentLabel ?? AGENT_PICKER.defaultMark)}</Heading>
          </Header>
          {efforts.map((row) => (
            <MenuItem
              key={row.id}
              id={`effort:${row.id}`}
              textValue={row.label}
              onAction={pick({ driverId: driver.id, model, effort: row.id })}>
              <Text slot="label">{row.label}</Text>
              {row.sub ? <Text slot="description">{row.sub}</Text> : null}
            </MenuItem>
          ))}
        </MenuSection>
      ) : null}
    </Menu>
  );
}
