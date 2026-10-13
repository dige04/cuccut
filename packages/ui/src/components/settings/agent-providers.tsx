import { useEffect, useState } from 'react';
import { isBuiltinDriverId, type DriverId } from '@cuccut/protocol';
import { ActionButton, Button, Disclosure, DisclosurePanel, DisclosureTitle, ProgressBar, Text, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import Code from '@react-spectrum/s2/icons/Code';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { agoLabel } from '../../model/format.ts';
import { configureAgent, detectAgents, watchAgentSetup } from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { HOME, useShell } from '../../state/shell-store.ts';
import { AgentCatalogSection } from './agent-catalog-section.tsx';
import { AGENT_COPY, AGENT_FAQ, MORE_PROVIDERS, providersMeta } from './agent-copy.ts';
import { PANEL, PANEL_HOVER, RowPanel, SubHeading } from './settings-ui.tsx';
import { AgentProviderCard } from './agent-provider-card.tsx';
import { M } from './general-settings-copy.ts';
import { agentOverview, groupDrivers, isInstalled, moreSummary, setupDoneToast } from './agent-setup.ts';

// Status card (.agset-status in settings-agent.css): the card itself is a neutral layer; only the 40px icon block on the left changes color with status.
const status = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
  padding: 20,
});
const statusIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  size: 40,
  borderRadius: '[12px]',
  backgroundColor: { default: 'gray-100', isReady: 'green-200', isAttention: 'orange-200' },
  color: { default: 'gray-700', isReady: 'green-1000', isAttention: 'orange-1000' },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const statusText = style({ flexGrow: 1, flexBasis: 0, minWidth: 220 });
const statusTitle = style({ margin: 0, font: 'title-sm', color: 'gray-900' });
const statusBody = style({ marginTop: 4, marginBottom: 0, font: 'ui-sm', color: 'gray-700' });
const empty = style({ padding: 20, font: 'ui-sm', color: 'gray-600' });
/** Why the toggles and buttons on the card are greyed out in the browser: start/stop, detect and install all need `agents.*` commands outside the web allowlist. Commands can still be copied. */
const webNote = style({ margin: 0, font: 'ui-sm', color: 'gray-800' });
const meta = style({ font: 'ui-xs', color: 'gray-600', textAlign: 'end' });
// The toggle for the collapsed “More” section (.agset-more in settings-agent.css): a single outlined button. Once expanded, another card of the same kind follows below it.
const more = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: 'full',
  paddingX: 20,
  paddingY: 12,
  borderWidth: 0,
  font: 'ui-sm',
  color: 'gray-800',
  textAlign: 'start',
  cursor: 'default',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: 2,
  '--iconPrimary': { type: 'fill', value: 'gray-700' },
});
const moreText = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const moreTitle = style({ font: 'ui-xs', fontWeight: 'bold', color: 'gray-900' });
const moreSub = style({ font: 'ui-xs', color: 'gray-600' });
const moreAct = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-700' });
const catalog = style({ minWidth: 0 });
const faq = style({ minWidth: 0 });
// Each FAQ item is separated from the next by a divider line; no line is drawn above the first (.agset-disclosure).
// The dividers between items are drawn by the panel (`RowPanel` in settings-ui.tsx).
const faqItem = style({ paddingY: 4 });
const faqBody = style({ margin: 0, font: 'ui-sm', color: 'gray-700' });
const faqLink = style({ marginTop: 8 });

/**
 * Agent providers (page-settings-agent.jsx:112-157, product design §7.6): the status card, one card per agent, the “More” collapsible section, add more agents, and FAQ.
 * The main list holds the detected built-in agents that are always shown, plus user-added ones. The four agents tucked into “More” are collapsed when not detected, and move into the main list by themselves once installed.
 */
export function AgentProviders() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const connected = useConnection((s) => s.state.status === 'connected');
  const drivers = useConnection((s) => s.drivers);
  // A Driver still on its first probe with no results has no card to draw, so the progress bar above shows detection in progress.
  const checking = useConnection((s) => s.checking);
  const go = useShell((s) => s.go);
  const [expanded, setExpanded] = useState<DriverId | null>(null);
  const [scanning, setScanning] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Install and upgrade commands run from the settings page. While this page is open it subscribes to their output and results. When one finishes successfully (the Runtime has re-detected), a short message pops up.
  useEffect(
    () =>
      watchAgentSetup(runtime, (run, view) => {
        const now = view?.drivers.find((d) => d.id === run.driverId);
        const toast = now ? setupDoneToast(run, now) : null;
        if (toast) ToastQueue[toast.tone](toast.text, { timeout: 4000 });
      }),
    [runtime],
  );

  const groups = groupDrivers(drivers ?? []);
  const list = [...groups.main, ...groups.more];
  // Agents that are not ready yet, while a Driver has not reached a conclusion during its first probe (same as `homeGate`): the status card is not shown yet.
  const settled = !!drivers && (!checking.length || drivers.some((d) => d.state === 'ready'));
  const overview = drivers && settled ? agentOverview(drivers) : null;
  // Agents still on their first probe have no source to show: built-in ones count as built-in, newly added ones count as added.
  const pendingAdded = checking.filter((id) => !isBuiltinDriverId(id)).length;
  const checkedAt = list.map((d) => d.checkedAt).sort().at(-1);

  const rescan = async () => {
    setScanning(true);
    try {
      const view = await detectAgents(runtime);
      const n = view.drivers.filter(isInstalled).length;
      ToastQueue.neutral(AGENT_COPY.scanDone(n), { timeout: 3000 });
    } catch (error) {
      ToastQueue.negative(AGENT_COPY.scanFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setScanning(false);
    }
  };

  const heroAct = async () => {
    if (!overview?.driverId) return;
    if (overview.action === 'start') return go(HOME);
    if (overview.action === 'open') return setExpanded(overview.driverId);
    if (overview.action === 'enable') {
      setEnabling(true);
      try {
        await configureAgent(runtime, overview.driverId, { enabled: true });
      } catch (error) {
        ToastQueue.negative(AGENT_COPY.enableFailed((error as Error).message), { timeout: 5000 });
      } finally {
        setEnabling(false);
      }
    }
  };

  return (
    <>
      {overview ? (
        <section className={`${status} ${PANEL}`} aria-label={AGENT_COPY.statusLabel}>
          <span className={statusIcon({ isReady: overview.state === 'ready', isAttention: overview.state === 'attention' })} aria-hidden>
            {overview.state === 'ready' ? <CheckmarkCircle /> : overview.state === 'attention' ? <AlertTriangle /> : <Code />}
          </span>
          <div className={statusText}>
            <h2 className={statusTitle}>{overview.title}</h2>
            <p className={statusBody}>{overview.body}</p>
          </div>
          {overview.cta ? (
            <Button variant="accent" isDisabled={overview.action === 'enable' && (web || !connected || enabling)} onPress={() => void heroAct()}>
              {overview.cta}
            </Button>
          ) : null}
        </section>
      ) : null}

      <SubHeading
        title={AGENT_COPY.providersHeading}
        hint={AGENT_COPY.providersHint}
        action={
          <ActionButton isQuiet size="S" isDisabled={web || !connected || scanning} onPress={() => void rescan()}>
            <Refresh />
            <Text>{scanning ? AGENT_COPY.scanning : AGENT_COPY.rescan}</Text>
          </ActionButton>
        }
      />
      {/* The note, the scan progress, the lists and the count sit close together under the heading. */}
      <div className="flex min-w-0 flex-col gap-2">
      {web ? <p className={webNote}>{M.webViewOnly}</p> : null}
      {scanning || checking.length ? (
        <ProgressBar aria-label={AGENT_COPY.scanProgress} isIndeterminate size="S" styles={style({ width: 'full' })} />
      ) : null}
      <RowPanel label={AGENT_COPY.providersHeading} flush>
        {drivers === null || (groups.main.length === 0 && checking.length) ? (
          <div className={empty}>{connected ? AGENT_COPY.scanning : AGENT_COPY.emptyDisconnected}</div>
        ) : list.length === 0 ? (
          <div className={empty}>{AGENT_COPY.emptyNoDrivers}</div>
        ) : groups.main.length === 0 ? (
          <div className={empty}>{AGENT_COPY.emptyNoneFound}</div>
        ) : (
          groups.main.map((driver) => (
            <AgentProviderCard
              key={driver.id}
              driver={driver}
              connected={connected}
              open={expanded === driver.id}
              onToggle={(open) => setExpanded(open ? driver.id : null)}
            />
          ))
        )}
      </RowPanel>
      {groups.more.length ? (
        <>
          <RACButton className={`${more} ${PANEL_HOVER}`} aria-expanded={showMore} aria-controls="agent-more-providers" onPress={() => setShowMore((v) => !v)}>
            {showMore ? <ChevronDown /> : <ChevronRight />}
            <span className={moreText}>
              <span className={moreTitle}>{MORE_PROVIDERS.title(groups.more.length)}</span>
              <span className={moreSub}>{MORE_PROVIDERS.sub(moreSummary(groups.more))}</span>
            </span>
            <span className={moreAct}>{showMore ? MORE_PROVIDERS.collapse : MORE_PROVIDERS.expand}</span>
          </RACButton>
          {showMore ? (
            <div id="agent-more-providers">
              <RowPanel label={MORE_PROVIDERS.title(groups.more.length)} flush>
                {groups.more.map((driver) => (
                  <AgentProviderCard
                    key={driver.id}
                    driver={driver}
                    connected={connected}
                    open={expanded === driver.id}
                    onToggle={(open) => setExpanded(open ? driver.id : null)}
                  />
                ))}
              </RowPanel>
            </div>
          ) : null}
        </>
      ) : null}
      {list.length ? (
        <div className={meta}>
          {providersMeta(
            checkedAt ? agoLabel(checkedAt) : null,
            groups.builtin + checking.length - pendingAdded,
            groups.added + pendingAdded,
            groups.found,
          )}
        </div>
      ) : null}
      </div>

      <div className={catalog}>
        <AgentCatalogSection onAdded={setExpanded} />
      </div>

      <div className={faq}>
        <RowPanel label={AGENT_COPY.faqLabel}>
          {AGENT_FAQ.map((item) => (
            <div key={item.key} className={faqItem}>
              <Disclosure isQuiet size="S">
                <DisclosureTitle>{item.title}</DisclosureTitle>
                <DisclosurePanel>
                  <p className={faqBody}>{item.body}</p>
                  {item.link === 'models' ? (
                    <div className={faqLink}>
                      <ActionButton isQuiet size="S" onPress={() => go({ tab: 'models', category: 'llm', page: 'cloud' })}>
                        {AGENT_COPY.goCloudModels}
                      </ActionButton>
                    </div>
                  ) : item.link === 'skills' ? (
                    <div className={faqLink}>
                      <ActionButton isQuiet size="S" onPress={() => go({ tab: 'settings', section: 'skills' })}>
                        {AGENT_COPY.goSkills}
                      </ActionButton>
                    </div>
                  ) : null}
                </DisclosurePanel>
              </Disclosure>
            </div>
          ))}
        </RowPanel>
      </div>
    </>
  );
}
