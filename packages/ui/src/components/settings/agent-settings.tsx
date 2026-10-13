import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import DeviceLaptop from '@react-spectrum/s2/icons/DeviceLaptop';
import Lock from '@react-spectrum/s2/icons/Lock';
import { iconStyle } from '@react-spectrum/s2/style' with { type: 'macro' };
import { AgentAdvanced } from './agent-advanced.tsx';
import { AGENT_COPY, AGENT_FACTS } from './agent-copy.ts';
import { AgentProviders } from './agent-providers.tsx';
import { TILE } from './settings-ui.tsx';

const FACT_ICON = { cli: DeviceLaptop, plan: CheckmarkCircle, ask: Lock } as const;

const factIconSize = iconStyle({ size: 'S' });

/**
 * Settings › Agent providers (AgentSection in the design mockup page-settings-agent.jsx): the title and one-line summary are drawn by the settings page’s SectionHeader. Here come three facts,
 * then the provider content, with “Advanced and troubleshooting” at the bottom. No more tabs. Skills and Agent permissions each have their own page (Settings › Skills, Settings › Privacy & permissions).
 */
export function AgentSettings() {
  return (
    <>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 @3xl:grid-cols-3" aria-label={AGENT_COPY.factsLabel}>
        {AGENT_FACTS.map((item) => {
          const Icon = FACT_ICON[item.key];
          return (
            <li key={item.key} className={`${TILE} flex items-start gap-2.5 px-4 py-3`}>
              <span className="flex shrink-0 pt-0.5 text-muted-foreground [--iconPrimary:currentColor]" aria-hidden>
                <Icon styles={factIconSize} />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">{item.title}</div>
                <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <AgentProviders />
      <AgentAdvanced />
    </>
  );
}
