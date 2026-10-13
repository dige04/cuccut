import type { ComponentType } from 'react';
import { ACCESS_MODES, type AgentMode } from '@cuccut/protocol';
import { ActionButton, Menu, MenuItem, MenuTrigger, Text, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import Edit from '@react-spectrum/s2/icons/Edit';
import Lock from '@react-spectrum/s2/icons/Lock';
import LockOpen from '@react-spectrum/s2/icons/LockOpen';
import MagicWand from '@react-spectrum/s2/icons/MagicWand';
import Visibility from '@react-spectrum/s2/icons/Visibility';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { S } from './shell-copy.ts';
import { ACCESS_MODE_HINT, ACCESS_MODE_LABEL } from '../copy.ts';

/** Icons for the four levels (prototype data.js `agent.modes`: lock / edit / sparkle / unlock); the prototype did not draw “plan first”, so it uses visibility. */
export const MODE_ICON: Record<AgentMode, ComponentType> = {
  plan: Visibility,
  ask: Lock,
  autoAcceptEdits: Edit,
  auto: MagicWand,
  fullAccess: LockOpen,
};

/** Menu width 288; the description wraps as a whole block (prototype agent-thread.jsx `AccessPicker`). */
const menu = style({ width: 288, maxWidth: '[calc(100vw - 32px)]' });
/** The arrow sits after the text: it is placed inside Text, so it does not take the icon slot in front of ActionButton. */
const label = style({ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' });

/**
 * Access modes (architecture design §3.12, prototype agent-thread.jsx `AccessPicker`): all four levels are always selectable, and switching levels shows no confirmation dialog.
 * When collapsed it shows the icon plus the level name; when the input area is narrow (`compact`, product design §3.2.3) only the icon and arrow remain, and the level name stays in the accessibility label and tooltip.
 * Each menu row is an icon, the level name and one sentence of description, with a check on the current level.
 * “plan first” is listed only while it is the current level, and does not appear once you switch away (the prototype has only four levels).
 */
export function AccessPicker({ value, compact, onChange }: { value: AgentMode; compact?: boolean; onChange(mode: AgentMode): void }) {
  const Icon = MODE_ICON[value];
  const modes: readonly AgentMode[] = value === 'plan' ? ['plan', ...ACCESS_MODES] : ACCESS_MODES;
  const button = (
    <ActionButton size="S" UNSAFE_className="cc-pick" aria-label={S.accessPicker.current(ACCESS_MODE_LABEL[value])}>
      <Icon />
      <Text>
        <span className={label}>
          {compact ? null : (
            // Two lines like the agent chip beside it: what this is, small, over the current mode.
            <span className="cc-pick__lines">
              <span className="cc-pick__over">{S.accessPicker.label}</span>
              <span className="cc-pick__main">{ACCESS_MODE_LABEL[value]}</span>
            </span>
          )}
          <ChevronDown />
        </span>
      </Text>
    </ActionButton>
  );
  return (
    <MenuTrigger align="start" direction="top">
      {compact ? (
        <TooltipTrigger>
          {button}
          <Tooltip>{ACCESS_MODE_LABEL[value]}</Tooltip>
        </TooltipTrigger>
      ) : (
        button
      )}
      <Menu
        aria-label={S.accessPicker.label}
        size="M"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        styles={menu}
        onSelectionChange={(keys) => {
          const key = keys === 'all' ? undefined : [...keys][0];
          if (key && key !== value) onChange(key as AgentMode);
        }}>
        {modes.map((mode) => {
          const ModeIcon = MODE_ICON[mode];
          return (
            <MenuItem key={mode} id={mode} textValue={ACCESS_MODE_LABEL[mode]}>
              <ModeIcon />
              <Text slot="label">{ACCESS_MODE_LABEL[mode]}</Text>
              <Text slot="description">{ACCESS_MODE_HINT[mode]}</Text>
            </MenuItem>
          );
        })}
      </Menu>
    </MenuTrigger>
  );
}
