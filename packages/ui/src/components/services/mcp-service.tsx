import { useEffect, useMemo, useState } from 'react';
import { localizeText, type Id, type McpConnectionInfo, type ServiceStatus } from '@cuccut/protocol';
import { Badge, Button, Header, Heading, Menu, MenuItem, MenuSection, MenuTrigger, Switch, Text } from '@react-spectrum/s2';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import Copy from '@react-spectrum/s2/icons/Copy';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { SERVICE_COPY, SERVICES_PAGE_COPY } from '../../copy.ts';
import { MCP_LEVELS, mcpScope, mcpSub, pickedScope, scopeVideos, levelTitle } from '../../model/services-mcp.ts';
import { serviceBusy, serviceStateLabel } from '../../model/services.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useSpace } from '../../state/space-store.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { McpTools } from './mcp-tools.tsx';
import { detail, detailXs, panel, ServiceCard } from './service-card.tsx';
import { ServiceApprovals } from './service-approval-card.tsx';
import { ServiceClients } from './service-clients.tsx';
import {
  ActionsRow,
  AutostartCheckbox,
  CodeLine,
  ErrorFix,
  LevelChoice,
  PlannedNote,
  PortRow,
  RequestList,
  SectionHead,
  SetRow,
  Snippet,
  useServiceStatus,
} from './service-parts.tsx';
import { COMMON_COPY, MCP_COPY } from './services-copy.ts';
import { copyText, useConfigureService, useFlipService } from './use-service-actions.ts';

/*
 * MCP service detail page (prototype designs/cuccut/app/page-services.jsx `McpServicePage`; architecture design §4.8, §12.8).
 * Reads and writes `services.*` and `services.mcp.*`: start/stop, connection info, client tokens, recent requests, access scope, allowed operations, port and auto-start.
 * Differences from the prototype:
 * - The prototype says “To change the video, permission or token settings, stop the service first.” The Runtime reads policy anew on every request, so changes made while running take effect immediately, and nothing is locked;
 * - The prototype uses one global token that can be switched off. The Runtime issues tokens per client and always requires them, so “Requires access token” is on and greyed out, and tokens are issued under “Clients and tokens”;
 * - The prototype's “connected clients” are live connections. The Runtime only has issued clients and their last-used time, with no online status;
 * - “Check service” is greyed out: the Runtime does not provide a health check to the UI.
 */

const pickerBtn = style({ marginTop: 8 });
const labelBlock = style({ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 });
const labelFirst = style({ display: 'flex', flexDirection: 'column', gap: 4 });
const labelText = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const related = style({ margin: 0, marginTop: 24, font: 'ui-sm', color: 'gray-600' });
const notice = style({ margin: 0, marginTop: 8, font: 'ui-xs', color: 'gray-600' });

export function McpServicePage() {
  const { status, ready, connected, state } = useServiceStatus('mcp');
  const flip = useFlipService('mcp');
  const entries = useSpace((s) => s.entries);
  const videos = useMemo(() => scopeVideos(entries), [entries]);
  const nameOf = useMemo(() => {
    const names = new Map(videos.map((v) => [v.videoId, v.name] as const));
    return (id: Id) => names.get(id);
  }, [videos]);

  const policy = status?.policy ?? { videos: 'all' as const, level: 'ask' as const };
  const scope = mcpScope(policy.videos, videos.length, nameOf);
  const copy = SERVICE_COPY.mcp;

  let heading: string = MCP_COPY.off;
  let subline: string = mcpSub(state, scope, policy.level);
  if (!status) subline = connected ? SERVICES_PAGE_COPY.loading : SERVICES_PAGE_COPY.disconnected;
  else if (state === 'unavailable') {
    heading = SERVICES_PAGE_COPY.unavailableTitle(copy.name);
    subline = COMMON_COPY.unavailableSub;
  } else if (state === 'on') heading = MCP_COPY.on;
  else if (state === 'error') {
    heading = MCP_COPY.error;
    subline = localizeText(status.error, status.errorRef) ?? COMMON_COPY.errorFix;
  } else if (serviceBusy(state)) heading = serviceStateLabel('mcp', state);

  const usable = !!status && state !== 'unavailable';

  return (
    <UtilityShell
      kind="services"
      flow
      blurb={MCP_COPY.lede}
      title={MCP_COPY.title}
      actions={
        <Badge size="S" fillStyle="subtle" variant="neutral">
          {copy.scope}
        </Badge>
      }>
      <ServiceCard
        id="mcp"
        state={state}
        heading={heading}
        subline={subline}
        disabled={!connected || !ready || !usable}
        onFlip={flip}
        footer={
          usable && status ? (
            <>
              <AutostartCheckbox id="mcp" status={status} />
              <span className={detailXs}>{COMMON_COPY.stopsWithApp}</span>
            </>
          ) : undefined
        }>
        {state === 'error' && status ? <ErrorFix id="mcp" status={status} /> : null}
      </ServiceCard>

      {usable && status ? (
        <>
          <ServiceApprovals serviceId="mcp" />
          <McpConnect status={status} />

          <SectionHead title={MCP_COPY.clientsTitle} />
          <section className={panel}>
            <ServiceClients kind="mcp" clients={status.clients} disabled={!connected} />
          </section>

          <SectionHead title={COMMON_COPY.section.requests} />
          <section className={panel}>
            <RequestList records={status.recentRequests} nameOf={nameOf} />
          </section>

          <McpAccess status={status} videos={videos} scope={scope} />
          <McpTools level={policy.level} />

          <SectionHead title={COMMON_COPY.section.settings} />
          <section className={panel}>
            <PortRow id="mcp" status={status} />
          </section>
        </>
      ) : null}

      <p className={related}>
        {SERVICES_PAGE_COPY.mcpRelated}{' '}
        {/* A neutral inline link: the page's one yellow element is its Start action. */}
        <RouteLink route={{ tab: 'settings', section: 'skills' }} className="rounded-sm text-foreground underline decoration-foreground/40 underline-offset-2 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {SERVICES_PAGE_COPY.mcpRelatedLink}
        </RouteLink>
      </p>
    </UtilityShell>
  );
}

/** “Connect”: address, configuration snippet (the token is a placeholder), copy. When the service is not running, the Runtime still provides the address and snippet, with an extra hint. */
function McpConnect({ status }: { status: ServiceStatus }) {
  const runtime = useRuntime();
  const [info, setInfo] = useState<McpConnectionInfo | null>(null);
  useEffect(() => {
    let alive = true;
    runtime
      .mcpConnectionInfo()
      .then((next) => alive && setInfo(next))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [runtime, status.port, status.state]);
  const url = status.endpoint ?? info?.url ?? null;
  return (
    <>
      <SectionHead title={COMMON_COPY.section.connect} />
      <section className={panel}>
        <p className={detail}>{MCP_COPY.connectHint}</p>
        {url ? <CodeLine value={url} copyLabel={MCP_COPY.copyAddress} what={MCP_COPY.address} /> : null}
        {info ? (
          <>
            <Snippet text={info.snippet} />
            <p className={notice}>{info.notice ?? MCP_COPY.snippetNote}</p>
          </>
        ) : null}
        <ActionsRow>
          <Button variant="secondary" size="S" isDisabled={!info} onPress={() => info && copyText(info.snippet, MCP_COPY.snippetLabel)}>
            <Copy />
            <Text>{MCP_COPY.copySnippet}</Text>
          </Button>
          <Button variant="secondary" fillStyle="outline" size="S" isDisabled>
            <Refresh />
            <Text>{MCP_COPY.check}</Text>
          </Button>
        </ActionsRow>
        <PlannedNote>{MCP_COPY.checkReason}</PlannedNote>
      </section>
    </>
  );
}

/** “Allowed operations” and “Accessible videos”: changes made while running also take effect immediately (the Runtime reads policy anew on every request). */
function McpAccess({ status, videos, scope }: { status: ServiceStatus; videos: { videoId: Id; name: string }[]; scope: string }) {
  const configure = useConfigureService();
  const policy = status.policy ?? { videos: 'all' as const, level: 'ask' as const };
  const all = videos.map((v) => v.videoId);
  const picked = policy.videos === 'all' ? [] : policy.videos.ids;
  const setVideos = (next: typeof policy.videos) => void configure({ serviceId: 'mcp', videos: next }, MCP_COPY.scopeSaved);
  return (
    <>
      <SectionHead title={MCP_COPY.accessSection} aside={COMMON_COPY.liveNote} />
      <section className={panel}>
        <div className={labelFirst}>
          <span className={labelText}>{MCP_COPY.scopeTitle}</span>
          <span className={detail}>{MCP_COPY.scopeDesc}</span>
        </div>
        <MenuTrigger>
          <Button variant="secondary" size="S" styles={pickerBtn}>
            <Text>{scope}</Text>
            <ChevronDown />
          </Button>
          <Menu aria-label={MCP_COPY.scopeTitle}>
            <MenuSection
              selectionMode="single"
              selectedKeys={policy.videos === 'all' ? ['all'] : []}
              onSelectionChange={(keys) => {
                if (keys === 'all' || keys.has('all')) setVideos('all');
              }}>
              <MenuItem id="all" textValue={MCP_COPY.scopeAll}>
                <Text slot="label">{MCP_COPY.scopeAll}</Text>
                <Text slot="description">{MCP_COPY.scopeAllSub(videos.length)}</Text>
              </MenuItem>
            </MenuSection>
            <MenuSection
              selectionMode="multiple"
              selectedKeys={picked}
              onSelectionChange={(keys) => setVideos(keys === 'all' ? 'all' : pickedScope([...keys].map(String), all))}>
              <Header>
                <Heading>{MCP_COPY.scopePick}</Heading>
              </Header>
              {videos.length ? (
                videos.map((v) => (
                  <MenuItem key={v.videoId} id={v.videoId} textValue={v.name}>
                    <Text slot="label">{v.name}</Text>
                  </MenuItem>
                ))
              ) : (
                <MenuItem id="none" textValue={MCP_COPY.scopeNone} isDisabled>
                  <Text slot="label">{MCP_COPY.scopeNone}</Text>
                </MenuItem>
              )}
            </MenuSection>
          </Menu>
        </MenuTrigger>

        <div className={labelBlock}>
          <span className={labelText}>{COMMON_COPY.levelLabel}</span>
          <span className={detail}>{MCP_COPY.levelDesc}</span>
        </div>
        <LevelChoice
          label={COMMON_COPY.levelLabel}
          value={policy.level}
          options={MCP_LEVELS}
          disabled={false}
          onChange={(level) => void configure({ serviceId: 'mcp', level }, COMMON_COPY.levelSaved(levelTitle(level)))}
        />

        <SetRow label={COMMON_COPY.needToken} desc={COMMON_COPY.needTokenDesc} dim>
          <Switch size="S" aria-label={COMMON_COPY.needToken} isSelected isDisabled />
        </SetRow>
        <PlannedNote>{COMMON_COPY.needTokenFixed}</PlannedNote>
      </section>
    </>
  );
}
