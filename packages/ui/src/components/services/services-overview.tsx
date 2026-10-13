import { ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { REMOTE_COPY, SERVICE_COPY, SERVICES_PAGE_COPY } from '../../copy.ts';
import { mcpScope, mcpSub, scopeVideos } from '../../model/services-mcp.ts';
import { shareAddresses } from '../../model/services-remote.ts';
import {
  findService,
  SERVICE_IDS,
  serviceBusy,
  serviceLights,
  servicesSummary,
  serviceStateLabel,
  serviceTone,
  type ServiceId,
  type ServiceState,
} from '../../model/services.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useServices } from '../../state/services-store.ts';
import { useShare } from '../../state/share-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { FlipButton, ServiceLightDot, ServiceLights, ServiceMark } from './service-card.tsx';
import { useFlipService } from './use-service-actions.ts';
import { useServiceStates } from './use-share-status.ts';

/* Services overview (agentcut workspace page): one solid card per service with its status dot, what it is doing right now,
   a start/stop button in place, and the card itself leading to the service's page. */

export function ServicesOverview() {
  const states = useServiceStates();
  const summary = servicesSummary(states);
  return (
    <UtilityShell
      kind="services"
      title={SERVICES_PAGE_COPY.title}
      blurb={SERVICES_PAGE_COPY.lede}
      actions={
        <span data-cc className="flex items-center gap-3">
          <ServiceLights lights={serviceLights(states)} />
          <span
            className={cn(
              'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium',
              summary.tone === 'error' ? 'bg-orange-400/12 text-orange-300' : 'bg-white/8 text-foreground/85',
            )}>
            {summary.text}
          </span>
        </span>
      }>
      <ul data-cc className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SERVICE_IDS.map((id) => (
          <ServiceItem key={id} id={id} state={states[id]} />
        ))}
      </ul>
    </UtilityShell>
  );
}

/**
 * One line of secondary text: on error, it says the cause. Remote compute when on says the node name and address; MCP says the access scope and permissions (prototype `mcpSub`); Web and model API when on say the address.
 * Where the Runtime does not provide something, it says why; otherwise it says what this service does.
 */
function useItemDetail(id: ServiceId, state: ServiceState): string {
  const share = useShare((s) => s.status);
  const status = useServices((s) => findService(s.services, id));
  const entries = useSpace((s) => s.entries);
  if (state === 'unavailable') return SERVICES_PAGE_COPY.unavailableDetail;
  if (id === 'remote') {
    if (state === 'error') return share?.error ?? status?.error ?? REMOTE_COPY.subErrorFallback;
    if (state === 'on' && share) return `${share.name} · ${shareAddresses(share)[0] ?? REMOTE_COPY.noAddress}`;
    return SERVICE_COPY.remote.desc;
  }
  if (state === 'error') return status?.error ?? SERVICE_COPY[id].desc;
  if (id === 'mcp' && status?.policy) {
    const videos = scopeVideos(entries);
    const names = new Map(videos.map((v) => [v.videoId, v.name] as const));
    return mcpSub(state, mcpScope(status.policy.videos, videos.length, (v) => names.get(v)), status.policy.level);
  }
  if (state === 'on' && status?.endpoint) return status.endpoint;
  return SERVICE_COPY[id].desc;
}

function ServiceItem({ id, state }: { id: ServiceId; state: ServiceState }) {
  const connected = useConnection((s) => s.state.status === 'connected');
  const flip = useFlipService(id);
  const detail = useItemDetail(id, state);
  const copy = SERVICE_COPY[id];
  return (
    <li className="group/svc relative flex min-w-0 flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10 transition-[background-color,box-shadow] duration-150 hover:bg-secondary hover:ring-foreground/20 motion-reduce:transition-none">
      <div className="flex min-w-0 items-start gap-3">
        <ServiceMark id={id} state={state} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* The name is the card's link; it covers the whole card, the start/stop button sits above it. */}
            <RouteLink
              route={{ tab: 'services', service: id }}
              label={SERVICES_PAGE_COPY.open(copy.name)}
              className="text-sm font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
              {copy.name}
            </RouteLink>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-muted-foreground">{copy.scope}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <ServiceLightDot tone={serviceTone(state)} busy={serviceBusy(state)} />
            <span className="shrink-0 text-foreground/85">{serviceStateLabel(id, state)}</span>
          </div>
        </div>
        <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground" title={detail}>
        {detail}
      </p>
      {state === 'unavailable' ? null : (
        <div className="relative z-10 flex">
          <FlipButton id={id} state={state} size="S" primary={false} disabled={!connected} onFlip={flip} />
        </div>
      )}
    </li>
  );
}
