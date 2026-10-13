import {
  defineMessages,
  MCP_DEFAULT_PORT,
  MODEL_API_DEFAULT_PORT,
  NODE_DEFAULT_PORT,
  WEB_DEFAULT_PORT,
  type ServiceId as RuntimeServiceId,
  type ServiceStatus,
  type ShareStatus,
  type WebSession,
} from '@cuccut/protocol';
import { SERVICE_COPY, SERVICE_STATE_COPY, SERVICES_PAGE_COPY } from '../copy.ts';
import { agoLabel } from './format.ts';
import { zhHans } from './services.zh-Hans.ts';
import { zhHant } from './services.zh-Hant.ts';
import { ja } from './services.ja.ts';
import { ko } from './services.ko.ts';
import { es } from './services.es.ts';
import { fr } from './services.fr.ts';
import { de } from './services.de.ts';
import { nl } from './services.nl.ts';
import { ptBR } from './services.pt-BR.ts';
import { it } from './services.it.ts';
import { ru } from './services.ru.ts';
import { pl } from './services.pl.ts';
import { tr } from './services.tr.ts';
import { vi } from './services.vi.ts';

/**
 * Pure model for “Services” (product design §2.1; architecture design §4.8; prototype designs/cuccut/app/model-services.js).
 * A service = a resident process on this Mac, held by CucCut and waiting for others to connect in: MCP service, remote compute, web service, model API service.
 * This only computes: the service catalog (mapping between UI IDs and Runtime IDs), the unified state (off / starting / stopping / on / error, plus unavailable, which Runtime does not provide), status dots and status words, the overview summary, quick buttons, the rail badge, and port validation.
 * State is read from the `services` topic (services-store); remote compute also has `nodes.share.status` polling (more detailed: addresses, pairing code). When both exist, the latter wins.
 */

/** The services model's own copy: port validation, browser sessions, and the status words on the Runtime card (translations are in `services.<language>.ts`). */
const en = {
  portRange: 'Enter a port number between 1024 and 65535',
  portTaken: (port: number, service: string) => `${port} is already used by “${service}”; choose another port`,
  browser: 'Browser',
  sessionMeta: (connections: number, ago: string, expires: string | null) =>
    [connections ? `${connections} ${connections === 1 ? 'connection' : 'connections'}` : 'No connections', `Active ${ago}`, expires ? `Expires at ${expires}` : null]
      .filter(Boolean)
      .join(' · '),
  runtime: { connected: 'Connected', incompatible: 'Incompatible version', disconnected: 'Not connected' },
};
export type ServicesMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Service status light: green = running, orange = error, grey = off or absent (also grey while starting or stopping, with a pulse; it does not rely on colour alone). */
export type ServiceTone = 'on' | 'error' | 'off';

export type ServiceId = keyof typeof SERVICE_COPY;

/** The order is the sidebar and overview order: the prototype's three items stay as they are, and the model API (a section of the web service page in the prototype) follows web service. */
export const SERVICE_IDS: readonly ServiceId[] = ['mcp', 'remote', 'web', 'model-api'];

/** The UI calls the node service “Remote compute” (route /services/remote); Runtime calls it `node`. */
export function runtimeServiceId(id: ServiceId): RuntimeServiceId {
  return id === 'remote' ? 'node' : id;
}

export function uiServiceId(id: RuntimeServiceId): ServiceId {
  return id === 'node' ? 'remote' : id;
}

export type ServicePhase = 'starting' | 'stopping';

export type ServiceState = 'off' | 'starting' | 'stopping' | 'on' | 'error' | 'unavailable';

export type ServiceStates = Record<ServiceId, ServiceState>;

export function isServiceId(value: string | undefined): value is ServiceId {
  return value !== undefined && (SERVICE_IDS as readonly string[]).includes(value);
}

/**
 * Runtime state of remote compute: starting or stopping takes priority; enabled but not listening (e.g. the port is taken) is error; enabled and listening is running; otherwise it is off.
 * Not yet read (`null`) counts as off.
 */
export function shareState(status: Pick<ShareStatus, 'enabled' | 'listening'> | null, phase: ServicePhase | null): ServiceState {
  if (phase) return phase;
  if (!status?.enabled) return 'off';
  return status.listening ? 'on' : 'error';
}

/** Runtime state of one service: unavailable if this version does not provide it; not yet read counts as off. */
export function statusState(status: Pick<ServiceStatus, 'available' | 'state'> | undefined): ServiceState {
  if (!status) return 'off';
  if (!status.available) return 'unavailable';
  return status.state;
}

export function findService(services: readonly ServiceStatus[], id: ServiceId): ServiceStatus | undefined {
  const runtimeId = runtimeServiceId(id);
  return services.find((s) => s.serviceId === runtimeId);
}

/**
 * The state of the four services right now. Remote compute: local starting/stopping first, then `nodes.share.status` (polled, more recent), then the projection of the node service from the `services` topic.
 */
export function serviceStates(
  services: readonly ServiceStatus[],
  share: Pick<ShareStatus, 'enabled' | 'listening'> | null,
  sharePhase: ServicePhase | null,
): ServiceStates {
  const remote = sharePhase || share ? shareState(share, sharePhase) : statusState(findService(services, 'remote'));
  return {
    mcp: statusState(findService(services, 'mcp')),
    remote,
    web: statusState(findService(services, 'web')),
    'model-api': statusState(findService(services, 'model-api')),
  };
}

export function serviceTone(state: ServiceState): ServiceTone {
  if (state === 'on') return 'on';
  return state === 'error' ? 'error' : 'off';
}

export function serviceBusy(state: ServiceState): boolean {
  return state === 'starting' || state === 'stopping';
}

/** Status word: remote compute says “共享”（sharing); the others say “运行”（running). */
export function serviceStateLabel(id: ServiceId, state: ServiceState): string {
  if (state === 'unavailable') return SERVICE_STATE_COPY.unavailable;
  return (id === 'remote' ? SERVICE_STATE_COPY.share : SERVICE_STATE_COPY.service)[state];
}

export interface ServiceLight {
  id: ServiceId;
  tone: ServiceTone;
  busy: boolean;
  /** Sidebar row hint and screen-reader text: “远端算力 · 正在共享”（Remote compute · sharing） */
  label: string;
}

/** One signal light per service, in catalog order. */
export function serviceLights(states: ServiceStates): ServiceLight[] {
  return SERVICE_IDS.map((id) => ({
    id,
    tone: serviceTone(states[id]),
    busy: serviceBusy(states[id]),
    label: `${SERVICE_COPY[id].name} · ${serviceStateLabel(id, states[id])}`,
  }));
}

export interface ServicesSummary {
  text: string;
  tone: 'error' | 'on' | 'off';
}

/** Small line beside the overview title: if something has errored, say so first; otherwise say how many are running; if all are off, say “全部未启动”（all not started). Services not offered are not counted. */
export function servicesSummary(states: ServiceStates): ServicesSummary {
  const all = SERVICE_IDS.map((id) => states[id]);
  const errors = all.filter((s) => s === 'error').length;
  const running = all.filter((s) => s === 'on').length;
  if (errors) return { text: SERVICES_PAGE_COPY.errors(errors), tone: 'error' };
  if (running) return { text: SERVICES_PAGE_COPY.running(running), tone: 'on' };
  return { text: SERVICES_PAGE_COPY.allOff, tone: 'off' };
}

/**
 * Badge on the rail's “Services” (prototype apprail.jsx `badge`): lights up when a service has errored, and also when external client requests are waiting for confirmation (service approvals, 50-second time limit), so the user does not miss them when not on the MCP service page. Returns the wording for screen readers; null if there is none.
 */
export function servicesAlert(states: ServiceStates, pendingApprovals = 0): string | null {
  const summary = servicesSummary(states);
  if (summary.tone === 'error') return SERVICES_PAGE_COPY.railAlert(summary.text);
  return pendingApprovals > 0 ? SERVICES_PAGE_COPY.railApprovals(pendingApprovals) : null;
}

export type ServiceQuickAction =
  | { kind: 'start' | 'stop'; label: string }
  | { kind: 'busy'; label: string }
  | { kind: 'unavailable'; label: string };

/**
 * Quick button at the end of a service row: when on, offers stop; when off, offers start; when errored, offers “重新…”（restart…); while starting or stopping, a spinning disabled button; services that are not offered get no button, and the row's sub-line says why.
 */
export function serviceQuickAction(id: ServiceId, state: ServiceState): ServiceQuickAction {
  const copy = SERVICE_COPY[id];
  if (state === 'starting') return { kind: 'busy', label: copy.starting };
  if (state === 'stopping') return { kind: 'busy', label: copy.stopping };
  if (state === 'unavailable') return { kind: 'unavailable', label: copy.start };
  if (state === 'on') return { kind: 'stop', label: copy.stop };
  return { kind: 'start', label: state === 'error' ? SERVICES_PAGE_COPY.restart(copy.start) : copy.start };
}

/**
 * One sentence shown to the person when a service operation fails: services not in this version (`SERVICE_NOT_AVAILABLE`) and services not running (`SERVICE_NOT_RUNNING`) are explained in plain words; others follow the Runtime message.
 */
export function serviceErrorMessage(error: unknown): string {
  const details = (error as { details?: unknown } | null)?.details;
  const code = details && typeof details === 'object' ? (details as { code?: unknown }).code : undefined;
  if (code === 'SERVICE_NOT_AVAILABLE') return SERVICES_PAGE_COPY.unavailableDetail;
  if (code === 'SERVICE_NOT_RUNNING') return SERVICES_PAGE_COPY.notRunning;
  return error instanceof Error ? error.message : String(error);
}

// ---- Port (prototype model-services.js `parsePort`) ----

/** The default port for each service (Runtime constants): when it is taken, the service enters error; the port is not switched. */
export const SERVICE_DEFAULT_PORT: Readonly<Record<ServiceId, number>> = {
  mcp: MCP_DEFAULT_PORT,
  remote: NODE_DEFAULT_PORT,
  web: WEB_DEFAULT_PORT,
  'model-api': MODEL_API_DEFAULT_PORT,
};

export type PortParse = { port: number; error?: undefined } | { error: string; port?: undefined };

/**
 * Port input → `{port}` or `{error}`. Accepts only integers from 1024 to 65535; if it collides with the port configured for another CucCut service on this Mac, it says directly which one.
 * `others`: the ports other services are configured with right now.
 */
export function parsePort(text: string, self: ServiceId, others: Partial<Record<ServiceId, number | null>>): PortParse {
  const t = text.trim();
  if (!/^\d{1,5}$/.test(t)) return { error: M.portRange };
  const n = Number(t);
  if (n < 1024 || n > 65535) return { error: M.portRange };
  for (const id of SERVICE_IDS) {
    if (id !== self && others[id] === n) return { error: M.portTaken(n, SERVICE_COPY[id].name) };
  }
  return { port: n };
}

/** The port each service is configured with (used to check collisions in the overview); remote compute takes its port from the shared state. */
export function servicePorts(services: readonly ServiceStatus[], share: Pick<ShareStatus, 'port'> | null): Partial<Record<ServiceId, number | null>> {
  const ports: Partial<Record<ServiceId, number | null>> = {};
  for (const status of services) ports[uiServiceId(status.serviceId)] = status.port;
  if (share) ports.remote = share.port;
  return ports;
}

/** The two reasons Runtime listening can fail (`listenError` in service-clients.ts): the port is already in use, or it cannot listen on the port. */
const PORT_ERRORS = new Set(['rcServices.portInUse', 'rcServices.cannotListen']);

/**
 * Whether the error is about the port (checked by the keys of `errorRef`). Only then does it give the “try another port” suggestion and “revert to the default port”. For other causes (e.g. the web client was not built), it shows Runtime's exact words without pointing the user the wrong way.
 */
export function isPortError(status: Pick<ServiceStatus, 'errorRef'>): boolean {
  return !!status.errorRef && PORT_ERRORS.has(status.errorRef.key);
}

// ---- Browser ----

/** Recognizes which browser it is from the User-Agent at login (the web service session list); says “浏览器”（browser) when it cannot tell. */
export function browserLabel(userAgent: string | null): string {
  if (!userAgent) return M.browser;
  const ua = userAgent;
  const os = /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : null;
  const name = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  if (!name) return M.browser;
  return os ? `${name} · ${os}` : name;
}

/** Sub-line of a browser session: “2 个连接 · 3 分钟前活跃 · 21:40 过期”（2 connections · active 3 minutes ago · expires 21:40). Sessions are valid for 12 hours from login. */
export function webSessionMeta(session: Pick<WebSession, 'connections' | 'lastUsedAt' | 'expiresAt'>, now: number): string {
  const at = new Date(session.expiresAt);
  const expires = Number.isNaN(at.getTime()) ? null : `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return M.sessionMeta(session.connections, agoLabel(session.lastUsedAt, now), expires);
}

// ---- CucCut Runtime (the Runtime card reused by Settings › Diagnostics) ----

export function runtimeTone(status: string): ServiceTone {
  if (status === 'connected') return 'on';
  return status === 'incompatible' ? 'error' : 'off';
}

export function runtimeStateLabel(status: string): string {
  if (status === 'connected') return M.runtime.connected;
  return status === 'incompatible' ? M.runtime.incompatible : M.runtime.disconnected;
}
