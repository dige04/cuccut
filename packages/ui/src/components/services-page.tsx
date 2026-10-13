import { McpServicePage } from './services/mcp-service.tsx';
import { ModelApiServicePage } from './services/model-api-service.tsx';
import { RemotePage } from './services/remote-page.tsx';
import { ServicesOverview } from './services/services-overview.tsx';
import { useSharePolling } from './services/use-share-status.ts';
import { WebServicePage } from './services/web-service.tsx';

/**
 * Services (product design §2.1; architecture design §4.8; prototype designs/cuccut/app/page-services.jsx `ServicesPage`): the four services CucCut provides on this Mac for other apps or devices to connect to—
 * MCP service, remote compute, Web service, model API. With no `service`, it shows the overview; with one, it shows the detail page for that item.
 * An unrecognized `service` (including the old `runtime` and agent engine) falls back to the overview. The Runtime card moves to `services/runtime-card.tsx` and is mounted under Settings › Diagnostics.
 * The status of MCP, Web and model API comes from the `services` topic (subscribed permanently by the rail). Remote compute is polled separately for shared status while the page is open and the window is in the foreground
 * (the node protocol has no topic subscription; see use-share-status.ts).
 */
export function ServicesPage({ service }: { service?: string }) {
  useSharePolling();
  if (service === 'remote') return <RemotePage />;
  if (service === 'mcp') return <McpServicePage />;
  if (service === 'web') return <WebServicePage />;
  if (service === 'model-api') return <ModelApiServicePage />;
  return <ServicesOverview />;
}
