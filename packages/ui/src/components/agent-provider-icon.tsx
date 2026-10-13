import type { ComponentProps, FunctionComponent } from 'react';
import { createIcon } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { DriverInfo } from '@cuccut/protocol';
import { agentIcon, type AgentIconSpec } from '../model/agent-choice.ts';
import anthropic from './vendor-icons/anthropic.svg';
import codex from './vendor-icons/codex.svg';
import cursor from './vendor-icons/cursor.svg';
import githubcopilot from './vendor-icons/githubcopilot.svg';
import google from './vendor-icons/google.svg';
import moonshot from './vendor-icons/moonshot.svg';
import opencode from './vendor-icons/opencode.svg';
import pi from './vendor-icons/pi.svg';
import xai from './vendor-icons/xai.svg';

/*
 * Agent icons (product design §3.2.3): the SVGs in `vendor-icons/` are lobe-icons files copied verbatim (MIT; attribution is in
 * THIRD_PARTY_NOTICES.md at the repo root).
 * Wrapped with createIcon and drawn on a 20 grid; when placed in the icon slot of ActionButton and MenuItem it is positioned like the S2 workflow icons and shows at 16px in the compact level (app.css);
 * single-colour icons are filled with currentColor as a mask (they fade along with the row when it is disabled), colour icons are drawn as they are, and user-added Agents are drawn with the first letter of their name.
 */
const FILES: Readonly<Record<string, string>> = { anthropic, codex, cursor, githubcopilot, google, moonshot, opencode, pi, xai };

const letterBox = style({ fill: 'gray-200' });
const letterText = style({ fill: 'gray-800' });

type IconComponent = FunctionComponent<ComponentProps<ReturnType<typeof createIcon>>>;
const cache = new Map<string, IconComponent>();

function iconFor(spec: AgentIconSpec): IconComponent {
  const key = spec.kind === 'letter' ? `letter:${spec.letter}` : `${spec.mono ? 'mono' : 'color'}:${spec.file}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let icon: IconComponent;
  if (spec.kind === 'letter') {
    icon = createIcon((props) => (
      <svg {...props} viewBox="0 0 20 20">
        <rect className={letterBox} x="1" y="1" width="18" height="18" rx="4" />
        <text className={letterText} x="10" y="14.2" textAnchor="middle" fontSize="11" fontWeight="700">
          {spec.letter}
        </text>
      </svg>
    ));
  } else {
    const src = FILES[spec.file] ?? '';
    icon = spec.mono
      ? createIcon((props) => (
          <svg
            {...props}
            viewBox="0 0 20 20"
            style={{
              ...props.style,
              maskImage: `url("${src}")`,
              WebkitMaskImage: `url("${src}")`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
            }}>
            <rect width="20" height="20" fill="currentColor" />
          </svg>
        ))
      : createIcon((props) => (
          <svg {...props} viewBox="0 0 20 20">
            <image href={src} width="20" height="20" />
          </svg>
        ));
  }
  cache.set(key, icon);
  return icon;
}

/** An Agent's icon; `slot` and similar props pass through to the S2 icon (by default it goes into the `icon` slot). */
export function AgentProviderIcon({
  driver,
  ...props
}: { driver: Pick<DriverInfo, 'id' | 'name'> & { source?: DriverInfo['source'] } } & ComponentProps<IconComponent>) {
  const Icon = iconFor(agentIcon(driver));
  return <Icon {...props} />;
}
