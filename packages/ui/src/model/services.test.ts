import { describe, expect, it } from 'vitest';
import { RpcError, type ServiceStatus } from '@cuccut/protocol';
import {
  browserLabel,
  findService,
  isPortError,
  isServiceId,
  parsePort,
  runtimeServiceId,
  runtimeTone,
  SERVICE_IDS,
  serviceErrorMessage,
  serviceLights,
  servicePorts,
  serviceQuickAction,
  servicesAlert,
  serviceStateLabel,
  serviceStates,
  servicesSummary,
  serviceTone,
  shareState,
  statusState,
  uiServiceId,
  webSessionMeta,
  type ServiceStates,
} from './services.ts';

const share = (enabled: boolean, listening: boolean) => ({ enabled, listening });
const states = (remote: ServiceStates['remote'], rest: Partial<ServiceStates> = {}): ServiceStates => ({
  mcp: 'off',
  remote,
  web: 'off',
  'model-api': 'off',
  ...rest,
});

function status(serviceId: ServiceStatus['serviceId'], patch: Partial<ServiceStatus> = {}): ServiceStatus {
  return {
    serviceId,
    label: serviceId,
    available: true,
    state: 'off',
    error: null,
    autostart: false,
    port: null,
    endpoint: null,
    policy: serviceId === 'node' || serviceId === 'web' ? null : { videos: 'all', level: 'ask' },
    clients: [],
    recentRequests: [],
    ...patch,
  };
}

describe('service catalog', () => {
  it('four items in the order MCP / remote compute / Web / model API; unknown keys do not count as services', () => {
    expect(SERVICE_IDS).toEqual(['mcp', 'remote', 'web', 'model-api']);
    expect(isServiceId('model-api')).toBe(true);
    expect(isServiceId('runtime')).toBe(false);
    expect(isServiceId(undefined)).toBe(false);
  });

  it('the remote compute in the UI is the Runtime\'s node service; the others share their names', () => {
    expect(runtimeServiceId('remote')).toBe('node');
    expect(runtimeServiceId('model-api')).toBe('model-api');
    expect(uiServiceId('node')).toBe('remote');
    expect(uiServiceId('web')).toBe('web');
    expect(findService([status('node', { state: 'on' })], 'remote')?.state).toBe('on');
  });
});

describe('runtime state', () => {
  it('remote compute: starting or stopping takes priority, then on but not listening is error, on and listening is running', () => {
    expect(shareState(null, null)).toBe('off');
    expect(shareState(share(false, false), null)).toBe('off');
    expect(shareState(share(true, true), null)).toBe('on');
    expect(shareState(share(true, false), null)).toBe('error');
    expect(shareState(share(true, false), 'stopping')).toBe('stopping');
    expect(shareState(null, 'starting')).toBe('starting');
  });

  it('Runtime service: treated as off when not read; what this version does not provide is \'not available yet\'; the rest follow the Runtime', () => {
    expect(statusState(undefined)).toBe('off');
    expect(statusState({ available: false, state: 'off' })).toBe('unavailable');
    expect(statusState({ available: true, state: 'error' })).toBe('error');
  });

  it('all four are computed together: MCP / Web / model API read the services topic; remote compute uses its shared state when present, otherwise the node service projection', () => {
    const services = [status('mcp', { state: 'on' }), status('web', { state: 'error' }), status('node', { state: 'on' })];
    expect(serviceStates(services, null, null)).toEqual({ mcp: 'on', remote: 'on', web: 'error', 'model-api': 'off' });
    expect(serviceStates(services, share(false, false), null).remote).toBe('off');
    expect(serviceStates(services, null, 'stopping').remote).toBe('stopping');
    expect(serviceStates([status('model-api', { available: false })], null, null)['model-api']).toBe('unavailable');
  });
});

describe('status light and status word', () => {
  it('green = running, orange = error, everything else is gray', () => {
    expect(serviceTone('on')).toBe('on');
    expect(serviceTone('error')).toBe('error');
    expect(serviceTone('starting')).toBe('off');
    expect(serviceTone('unavailable')).toBe('off');
  });

  it('remote compute says \'shared\', the others say \'running\', and unavailable ones say \'not available yet\'', () => {
    expect(serviceStateLabel('remote', 'on')).toBe('正在共享');
    expect(serviceStateLabel('remote', 'error')).toBe('共享意外停止');
    expect(serviceStateLabel('web', 'error')).toBe('启动失败');
    expect(serviceStateLabel('model-api', 'on')).toBe('运行中');
    expect(serviceStateLabel('mcp', 'unavailable')).toBe('尚未提供');
  });

  it('one light per sidebar item; the one starting or stopping shows busy', () => {
    const lights = serviceLights(states('starting', { 'model-api': 'on' }));
    expect(lights.map((l) => l.id)).toEqual(['mcp', 'remote', 'web', 'model-api']);
    expect(lights.map((l) => l.busy)).toEqual([false, true, false, false]);
    expect(lights[1]?.label).toBe('远端算力 · 正在开始共享…');
    expect(lights[3]).toMatchObject({ tone: 'on', label: '模型接口 · 运行中' });
  });
});

describe('overview summary and rail badge', () => {
  it('errors come first, then the running count; when all are off, says \'none started\'', () => {
    expect(servicesSummary(states('off'))).toEqual({ text: '全部未启动', tone: 'off' });
    expect(servicesSummary(states('on', { mcp: 'on' }))).toEqual({ text: '2 项运行中', tone: 'on' });
    expect(servicesSummary(states('on', { web: 'error' }))).toEqual({ text: '1 项出错', tone: 'error' });
    expect(servicesSummary(states('starting', { mcp: 'unavailable' }))).toEqual({ text: '全部未启动', tone: 'off' });
  });

  it('badge: errors take priority; without errors, it lights up when requests await confirmation; null when neither', () => {
    expect(servicesAlert(states('error'))).toBe('服务，1 项出错');
    expect(servicesAlert(states('error'), 2)).toBe('服务，1 项出错');
    expect(servicesAlert(states('on'), 2)).toBe('服务，2 个请求等你确认');
    expect(servicesAlert(states('on'))).toBeNull();
  });
});

describe('quick-action button at the end of the row', () => {
  it('on shows stop, off shows start, error shows \'Restart…\', starting or stopping shows a spinner, unavailable shows nothing', () => {
    expect(serviceQuickAction('remote', 'on')).toEqual({ kind: 'stop', label: '停止共享' });
    expect(serviceQuickAction('remote', 'error')).toEqual({ kind: 'start', label: '重新开始共享' });
    expect(serviceQuickAction('model-api', 'off')).toEqual({ kind: 'start', label: '启动服务' });
    expect(serviceQuickAction('web', 'stopping')).toEqual({ kind: 'busy', label: '正在停止…' });
    expect(serviceQuickAction('web', 'unavailable')).toEqual({ kind: 'unavailable', label: '启动服务' });
  });
});

describe('port', () => {
  it('accepts only integers from 1024 to 65535; when colliding with another CucCut service, says which one', () => {
    expect(parsePort(' 8080 ', 'web', {})).toEqual({ port: 8080 });
    expect(parsePort('80', 'web', {}).error).toBe('端口要填 1024–65535 之间的数字');
    expect(parsePort('70000', 'web', {}).error).toBe('端口要填 1024–65535 之间的数字');
    expect(parsePort('80a', 'web', {}).error).toBe('端口要填 1024–65535 之间的数字');
    expect(parsePort('47620', 'web', { mcp: 47620 }).error).toBe('47620 已经留给「MCP 服务」，换一个端口');
    expect(parsePort('47622', 'web', { web: 47622 })).toEqual({ port: 47622 });
  });

  it('only a failure to listen counts as a port issue; other causes do not point to the port', () => {
    expect(isPortError({ errorRef: { key: 'rcServices.portInUse', params: { port: 47622 } } })).toBe(true);
    expect(isPortError({ errorRef: { key: 'rcServices.cannotListen', params: { port: 47620, reason: 'EACCES' } } })).toBe(true);
    expect(isPortError({ errorRef: { key: 'rcWeb.clientNotBuilt' } })).toBe(false);
    expect(isPortError({})).toBe(false);
  });

  it('each service\'s configured port: remote compute follows the shared state', () => {
    const ports = servicePorts([status('mcp', { port: 47620 }), status('node', { port: 1 })], { port: 47610 });
    expect(ports).toEqual({ mcp: 47620, remote: 47610 });
  });
});

describe('wording for failed actions', () => {
  it('\'not provided\' and \'not running\' are written in plain language; the rest use the Runtime\'s message', () => {
    expect(serviceErrorMessage(new RpcError('conflict', 'x', { code: 'SERVICE_NOT_AVAILABLE' }))).toBe('这个版本的 CucCut Runtime 还没有提供这项服务');
    expect(serviceErrorMessage(new RpcError('conflict', 'x', { code: 'SERVICE_NOT_RUNNING' }))).toBe('服务没有开着，先启动它');
    expect(serviceErrorMessage(new RpcError('invalid-request', '端口不对'))).toBe('端口不对');
    expect(serviceErrorMessage('坏了')).toBe('坏了');
  });
});

describe('browser sessions', () => {
  it('recognizes the browser and OS from User-Agent; says \'browser\' when unrecognized', () => {
    const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
    const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0';
    expect(browserLabel(chrome)).toBe('Chrome · macOS');
    expect(browserLabel(safari)).toBe('Safari · macOS');
    expect(browserLabel(edge)).toBe('Edge · Windows');
    expect(browserLabel('curl/8.0')).toBe('浏览器');
    expect(browserLabel(null)).toBe('浏览器');
  });

  it('subline: connection count · last active how long ago · expires at what time', () => {
    const now = Date.parse('2026-10-03T08:00:00Z');
    const expires = new Date(now + 3 * 3_600_000);
    const hhmm = `${String(expires.getHours()).padStart(2, '0')}:${String(expires.getMinutes()).padStart(2, '0')}`;
    expect(webSessionMeta({ connections: 2, lastUsedAt: new Date(now - 3 * 60_000).toISOString(), expiresAt: expires.toISOString() }, now)).toBe(
      `2 个连接 · 3 分钟前活跃 · ${hhmm} 过期`,
    );
    expect(webSessionMeta({ connections: 0, lastUsedAt: new Date(now).toISOString(), expiresAt: 'x' }, now)).toBe('没有连接 · 刚刚活跃');
  });
});

describe('CucCut Runtime', () => {
  it('only protocol incompatibility counts as an error', () => {
    expect(runtimeTone('connected')).toBe('on');
    expect(runtimeTone('disconnected')).toBe('off');
    expect(runtimeTone('incompatible')).toBe('error');
  });
});
