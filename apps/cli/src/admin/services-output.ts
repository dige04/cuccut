import {
  ONLINE_CAPABILITIES,
  SERVICE_IDS,
  SERVICE_LEVELS,
  WEB_METHOD_PATTERN,
  type McpConnectionInfo,
  type ModelApiAlias,
  type ModelApiConnectionInfo,
  type OnlineCapability,
  type ServiceClient,
  type ServiceConfigureParams,
  type ServiceId,
  type ServiceLevel,
  type ServiceStatus,
  type WebAccessLink,
  type WebSession,
} from '@cuccut/protocol';
import { M } from './services-copy.ts';

/**
 * Arguments and output of `cuccut services` (Architecture design §4.8). Split out of main.ts so it can be tested on its own.
 * Whether a value is valid is ultimately decided by the Runtime. Here we recognize service names, levels and switches, and give readable usage errors. The token is printed only once, on `add-client`.
 * Clients for the subcommands are separate for the MCP service and the model API service (`mcp …`, `model-api …`), and their tokens are not interchangeable.
 */

/** Services that have their own clients. */
export type ClientService = 'mcp' | 'model-api';

export type ServicesCommand =
  | { kind: 'list' }
  | { kind: 'start' | 'stop'; serviceId: ServiceId }
  | { kind: 'configure'; params: ServiceConfigureParams }
  | { kind: 'add-client'; service: ClientService; name: string }
  | { kind: 'clients'; service: ClientService }
  | { kind: 'revoke'; service: ClientService; clientId: string }
  | { kind: 'connection'; service: ClientService; clientId?: string }
  | { kind: 'aliases' }
  | { kind: 'alias'; alias: ModelApiAlias }
  | { kind: 'unalias'; alias: string }
  | { kind: 'web-sessions' }
  | { kind: 'web-revoke'; sessionId: string };

export interface ServicesFlags {
  port?: string | undefined;
  level?: string | undefined;
  videos?: string | undefined;
  autostart?: string | undefined;
  routeOnline?: string | undefined;
  routeNodes?: string | undefined;
  routeAgent?: string | undefined;
  maxConcurrent?: string | undefined;
  readOnly?: string | undefined;
  methods?: string | undefined;
}

function requireService(id: string | undefined): ServiceId {
  if (!id) throw new Error(M.usage);
  if (!(SERVICE_IDS as readonly string[]).includes(id)) throw new Error(M.unknownService(id, SERVICE_IDS));
  return id as ServiceId;
}

export function parseServicesArgs(args: string[], flags: ServicesFlags = {}): ServicesCommand {
  const [action, target, ...extra] = args;
  if (action === undefined || action === 'status' || action === 'list') {
    if (target !== undefined) throw new Error(M.usage);
    return { kind: 'list' };
  }
  if (action === 'start' || action === 'stop') {
    if (extra.length > 0) throw new Error(M.usage);
    return { kind: action, serviceId: requireService(target) };
  }
  if (action === 'configure') {
    if (extra.length > 0) throw new Error(M.usage);
    return { kind: 'configure', params: parseConfigure(requireService(target), flags) };
  }
  if (action === 'mcp' || action === 'model-api') {
    const service: ClientService = action;
    const [arg, ...more] = extra;
    if (target === 'add-client') {
      const name = extra.join(' ').trim();
      if (!name) throw new Error(M.addClientUsage(service));
      return { kind: 'add-client', service, name };
    }
    if (target === 'clients' && arg === undefined) return { kind: 'clients', service };
    if (target === 'revoke' && arg && more.length === 0) return { kind: 'revoke', service, clientId: arg };
    if (target === 'connection' && more.length === 0) {
      return arg ? { kind: 'connection', service, clientId: arg } : { kind: 'connection', service };
    }
    if (service === 'model-api') {
      if (target === 'aliases' && arg === undefined) return { kind: 'aliases' };
      if (target === 'unalias' && arg && more.length === 0) return { kind: 'unalias', alias: arg };
      if (target === 'alias') return { kind: 'alias', alias: parseAlias(extra) };
    }
  }
  if (action === 'web') {
    const [arg, ...more] = extra;
    if (target === 'sessions' && arg === undefined) return { kind: 'web-sessions' };
    if (target === 'revoke' && arg && more.length === 0) return { kind: 'web-revoke', sessionId: arg };
  }
  throw new Error(M.usage);
}

/** `alias whisper-1 transcribe local`, `alias tts-1 synthesizeSpeech openai/gpt-4o-mini-tts`. When no model is given, the default model of that Provider is used. */
function parseAlias(args: string[]): ModelApiAlias {
  const [alias, capability, target, ...more] = args;
  if (!alias || !capability || !target || more.length > 0) throw new Error(M.aliasUsage(ONLINE_CAPABILITIES));
  if (!(ONLINE_CAPABILITIES as readonly string[]).includes(capability)) {
    throw new Error(M.unknownCapability(capability, ONLINE_CAPABILITIES));
  }
  const slash = target.indexOf('/');
  const providerId = slash < 0 ? target : target.slice(0, slash);
  const modelId = slash < 0 ? null : target.slice(slash + 1);
  if (!providerId || modelId === '') throw new Error(M.aliasUsage(ONLINE_CAPABILITIES));
  return { alias, capability: capability as OnlineCapability, providerId, modelId };
}

function onOff(flag: string, value: string): boolean {
  if (value !== 'on' && value !== 'off') throw new Error(M.onOff(flag));
  return value === 'on';
}

function parseConfigure(serviceId: ServiceId, flags: ServicesFlags): ServiceConfigureParams {
  const params: ServiceConfigureParams = { serviceId };
  if (flags.port !== undefined) {
    const port = Number(flags.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(M.portRange);
    params.port = port;
  }
  if (flags.level !== undefined) {
    if (!(SERVICE_LEVELS as readonly string[]).includes(flags.level)) throw new Error(M.levelChoice(SERVICE_LEVELS));
    params.level = flags.level as ServiceLevel;
  }
  if (flags.videos !== undefined) {
    if (flags.videos === 'all') params.videos = 'all';
    else {
      const ids = flags.videos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) throw new Error(M.videosFormat);
      params.videos = { ids: [...new Set(ids)] };
    }
  }
  if (flags.autostart !== undefined) {
    if (flags.autostart !== 'on' && flags.autostart !== 'off') throw new Error(M.onOff('--autostart'));
    params.autostart = flags.autostart === 'on';
  }
  const routing: NonNullable<ServiceConfigureParams['routing']> = {};
  if (flags.routeOnline !== undefined) routing.online = onOff('--route-online', flags.routeOnline);
  if (flags.routeNodes !== undefined) routing.nodes = onOff('--route-nodes', flags.routeNodes);
  if (flags.routeAgent !== undefined) routing.agent = onOff('--route-agent', flags.routeAgent);
  if (Object.keys(routing).length > 0) params.routing = routing;
  if (flags.maxConcurrent !== undefined) {
    const n = Number(flags.maxConcurrent);
    if (!Number.isInteger(n) || n < 1 || n > 64) throw new Error(M.maxConcurrentRange);
    params.maxConcurrentPerClient = n;
  }
  if ((params.routing || params.maxConcurrentPerClient !== undefined) && serviceId !== 'model-api') {
    throw new Error(M.routingOnlyModelApi);
  }
  if (flags.readOnly !== undefined) {
    if (flags.readOnly !== 'on' && flags.readOnly !== 'off') throw new Error(M.onOff('--read-only'));
    params.readOnly = flags.readOnly === 'on';
  }
  if (flags.methods !== undefined) {
    if (flags.methods === 'default') params.methods = null;
    else {
      const methods = flags.methods
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const bad = methods.filter((m) => !WEB_METHOD_PATTERN.test(m));
      if (methods.length === 0 || bad.length > 0) throw new Error(M.methodsFormat);
      params.methods = [...new Set(methods)];
    }
  }
  if ((params.readOnly !== undefined || params.methods !== undefined) && serviceId !== 'web') {
    throw new Error(M.webOnlyFlags);
  }
  if (Object.keys(params).length === 1) throw new Error(M.nothingToConfigure);
  return params;
}

/** One service: the first line is its name, status and address; below are its config and recent requests. */
export function formatService(service: ServiceStatus): string[] {
  if (!service.available) return [M.notProvided(service.serviceId, service.label)];
  const where = service.endpoint ?? (service.port !== null ? M.port(service.port) : '');
  const lines = [`${service.serviceId}  ${service.label}  ${M.states[service.state]}${where ? `  ${where}` : ''}`];
  if (service.error) lines.push(M.reason(service.error));
  if (service.serviceId === 'node') {
    lines.push(M.nodeHint);
    return lines;
  }
  lines.push(M.autostart(service.autostart));
  if (service.policy && service.serviceId === 'model-api') {
    // The model API service has no video scope. ask means each generation request is confirmed one by one.
    lines.push(M.level(service.policy.level === 'ask' ? M.levelAskModelApi : M.levels[service.policy.level]));
  } else if (service.policy) {
    const { videos, level } = service.policy;
    const scope = videos === 'all' ? M.allVideos : M.someVideos(videos.ids);
    lines.push(M.levelScope(M.levels[level], scope));
  }
  if (service.modelApi) {
    const { routing, maxConcurrentPerClient, aliases } = service.modelApi;
    const routes = [
      M.routeLocal,
      ...(routing.online ? [M.routeOnline] : []),
      ...(routing.nodes ? [M.routeNodes] : []),
      ...(routing.agent ? [M.routeAgent] : []),
    ];
    lines.push(M.routing(routes, maxConcurrentPerClient));
    lines.push(M.aliases(aliases.map(formatAliasTarget)));
  }
  if (service.serviceId === 'mcp' || service.serviceId === 'model-api') lines.push(M.clientCount(service.clients.length));
  if (service.web) {
    lines.push(M.web(service.web.readOnly, service.web.methods));
    lines.push(M.browserSessions(service.clients.length));
  }
  for (const request of service.recentRequests.slice(0, 5)) {
    lines.push(
      `  ${request.at}  ${request.clientName}  ${request.tool}${request.videoId ? `  ${request.videoId}` : ''}  ${request.outcome}`,
    );
  }
  return lines;
}

export function formatServices(services: ServiceStatus[]): string[] {
  return services.flatMap(formatService);
}

function formatAliasTarget(alias: ModelApiAlias): string {
  return M.aliasTarget(alias.alias, alias.providerId, alias.modelId, alias.capability);
}

export function formatAliases(aliases: ModelApiAlias[]): string[] {
  if (aliases.length === 0) return [M.noAliases];
  return aliases.map(formatAliasTarget);
}

export function formatClients(clients: ServiceClient[], service: ClientService = 'mcp'): string[] {
  if (clients.length === 0) return [M.noClients(service)];
  return clients.map((c) => M.client(c.clientId, c.name, c.createdAt, c.lastUsedAt));
}

/** New client: the token is printed only this once and cannot be looked up later. */
export function formatNewClient(client: ServiceClient, token: string, info: McpConnectionInfo | ModelApiConnectionInfo): string[] {
  return [
    M.clientCreated(client.name, client.clientId),
    M.tokenOnce(token),
    M.address('url' in info ? info.url : info.baseUrl),
    M.bearerHeader,
    ...(info.notice ? [info.notice] : []),
  ];
}

/** Connection info and config snippet. Contains no plaintext token. */
export function formatConnectionInfo(info: McpConnectionInfo | ModelApiConnectionInfo): string[] {
  return [
    M.address('url' in info ? info.url : info.baseUrl),
    M.header(info.headers.Authorization),
    M.interfaceVersion(info.interfaceVersion),
    ...(info.notice ? [info.notice] : []),
    M.snippetIntro,
    info.snippet,
  ];
}

export function formatWebSessions(sessions: WebSession[]): string[] {
  if (sessions.length === 0) return [M.noWebSessions];
  return sessions.map(
    (s) => M.webSession(s.sessionId, s.createdAt, s.lastUsedAt, s.expiresAt, s.connections) + (s.userAgent ? `  ${s.userAgent}` : ''),
  );
}

/** Access link: usable only once, and valid for a few minutes. When a video is given, says where the link leads. */
export function formatAccessLink(link: WebAccessLink, video: string | null = null): string[] {
  return [link.url, ...(video ? [M.accessLinkVideo(video)] : []), M.accessLinkNote(link.expiresAt)];
}

/**
 * An access link is split into the login page address without the code, and the code. The link's shape is `http://127.0.0.1:<port><path and query>#code=<code>`. The path and query
 * stay in the login page address (when going straight to a video it is `/home?video=…`), and after logging in you return to it.
 */
export function splitAccessLink(url: string): { loginUrl: string; code: string } {
  const match = /^(http:\/\/[^/#?]+\/[^#\s]*)#code=([A-Za-z0-9_-]+)$/.exec(url);
  if (!match) throw new Error(M.badAccessLink);
  return { loginUrl: match[1]!, code: match[2]! };
}

/** `--launch`: the browser opens the login page without the code. The code is printed only in the terminal, for the user to paste into the login page. */
export function formatLaunchCode(loginUrl: string, code: string, expiresAt: string, video: string | null = null): string[] {
  return [M.accessCode(code), ...(video ? [M.accessLinkVideo(video)] : []), M.launchNote(loginUrl, expiresAt)];
}

/** The command that opens an address in the system's default browser. */
export function browserCommand(platform: NodeJS.Platform, url: string): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '""', url] };
  return { command: 'xdg-open', args: [url] };
}

/** The Runtime method that `cuccut web open` calls (replaced with a fake in tests). */
export interface WebOpenClient {
  start(): Promise<ServiceStatus>;
  createAccessLink(): Promise<WebAccessLink>;
}

/**
 * `cuccut web open`: make sure the Web service is running → generate an access link (when a video is given, it goes straight to that video's editor) → print it. If the service cannot start (for example, the port is in use or the client is not built), throws the reason.
 *
 * With `launch`, the link carrying the code is not handed to the browser. Opening the browser passes arguments through the processes `open` / `xdg-open` / `cmd`, and other local users and programs
 * can see them in the process list. The browser opens the login page without the code, and the code is printed only in the terminal, for the user to paste into the login page's input box.
 */
export async function webOpen(
  client: WebOpenClient,
  options: { launch: boolean; video?: string | null; launcher: (url: string) => Promise<void>; print: (line: string) => void },
): Promise<void> {
  const service = await client.start();
  if (service.state !== 'on') throw new Error(M.webNotStarted(service.error ?? service.state));
  const link = await client.createAccessLink();
  const video = options.video ?? null;
  if (!options.launch) {
    for (const line of formatAccessLink(link, video)) options.print(line);
    return;
  }
  const { loginUrl, code } = splitAccessLink(link.url);
  for (const line of formatLaunchCode(loginUrl, code, link.expiresAt, video)) options.print(line);
  await options.launcher(loginUrl);
}
