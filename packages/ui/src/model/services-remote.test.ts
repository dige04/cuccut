import { describe, expect, it } from 'vitest';
import { RpcError, type DiscoveredNode, type ModelCapabilitiesView, type NodeHealth, type PairedNode } from '@cuccut/protocol';
import {
  formatPairingCode,
  hostPort,
  jobsLabel,
  localTranscribeModels,
  nodeCardView,
  normalizePairingCode,
  pairErrorMessage,
  pairingView,
  parseNodeAddress,
  remoteTaskRows,
  remoteTaskSummary,
  shareAddresses,
  shareClientMeta,
  unpairedNearby,
} from './services-remote.ts';

const NOW = Date.parse('2026-10-03T10:00:00Z');
const at = (ms: number) => new Date(NOW + ms).toISOString();

describe('sharing this Mac', () => {
  it('address is joined with the port, IPv6 wrapped in brackets; no address when not listening', () => {
    expect(shareAddresses({ addresses: ['192.168.1.31', '10.0.0.2'], port: 47610 })).toEqual(['192.168.1.31:47610', '10.0.0.2:47610']);
    expect(shareAddresses({ addresses: [], port: 47610 })).toEqual([]);
    expect(hostPort('fe80::1', 47610)).toBe('[fe80::1]:47610');
  });

  it('pairing code is grouped in threes; the countdown rounds up to seconds', () => {
    expect(formatPairingCode('481924')).toBe('481 924');
    const view = pairingView({ code: '481924', expiresAt: at(9 * 60_000 + 41_200) }, NOW);
    expect(view).toEqual({ kind: 'code', code: '481 924', hint: '在对方设备上输入这个码。9 分 42 秒后失效。' });
  });

  it('an expired pairing code counts as none, without waiting for the next poll', () => {
    expect(pairingView({ code: '481924', expiresAt: at(-1) }, NOW).kind).toBe('none');
    expect(pairingView(null, NOW).kind).toBe('none');
  });

  it('after too many wrong attempts, says until what time it is locked; once the lock passes, it counts as no code', () => {
    const until = at(5 * 60_000);
    const view = pairingView({ lockedUntil: until }, NOW);
    expect(view.kind).toBe('locked');
    const date = new Date(until);
    const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    expect(view.kind === 'locked' && view.text).toContain(`锁定到 ${clock}`);
    expect(pairingView({ lockedUntil: at(-1000) }, NOW).kind).toBe('none');
  });

  it('local transcription models count only model packs available in the local provider', () => {
    const capabilities = {
      transcribe: {
        default: null,
        effective: null,
        providers: [
          { providerId: 'local', kind: 'local', label: '本机', available: true, config: null, models: [
            { modelId: 'a', label: 'Whisper Large', available: true },
            { modelId: 'b', label: 'SenseVoice', available: false },
          ] },
          { providerId: 'openai', kind: 'online', label: '在线', available: true, config: null, models: [{ modelId: 'c', label: '在线模型' }] },
        ],
      },
    } as unknown as ModelCapabilitiesView;
    expect(localTranscribeModels(capabilities)).toEqual(['Whisper Large']);
    expect(localTranscribeModels(null)).toBeNull();
  });

  it('task row: transcription reads the real switch, not disabled when no model is installed, only warns; the other kinds are disabled with the reason given', () => {
    const rows = remoteTaskRows({ capabilities: { transcribe: { enabled: true } } }, []);
    expect(rows.map((r) => r.key)).toEqual(['asr', 'tts', 'image', 'separate', 'download', 'export']);
    expect(rows[0]).toMatchObject({ capability: 'transcribe', on: true, disabled: false, desc: '这台 Mac 还没装可用的转录模型，对方发来的这类任务会失败' });
    expect(rows[1]).toMatchObject({ capability: null, on: false, disabled: true, desc: '这个版本还不能共享这类任务' });
    expect(remoteTaskSummary(rows)).toBe('提供 1 / 1 类任务');

    const off = remoteTaskRows({ capabilities: { transcribe: { enabled: false } } }, ['Whisper Large']);
    expect(off[0]).toMatchObject({ on: false, desc: null, models: ['Whisper Large'] });
    expect(remoteTaskSummary(off)).toBe('提供 0 / 1 类任务');
    expect(remoteTaskRows({ capabilities: {} }, null)[0]).toMatchObject({ on: false, desc: null });
  });

  it('task count and a row for paired devices', () => {
    expect(jobsLabel({ running: 0, queued: 0 })).toBe('空闲');
    expect(jobsLabel({ running: 1, queued: 2 })).toBe('1 个任务在跑 · 2 个排队');
    expect(shareClientMeta({ clientId: 'c', name: 'MacBook', pairedAt: at(-3 * 3600_000), lastSeenAt: at(-5 * 60_000) }, NOW)).toBe(
      '3 小时前配对 · 5 分钟前见过',
    );
    expect(shareClientMeta({ clientId: 'c', name: 'MacBook', pairedAt: at(-10_000), lastSeenAt: null }, NOW)).toBe('刚刚配对 · 还没连过');
  });
});

const health = (patch: Partial<NodeHealth['capabilities']['transcribe']> = {}): NodeHealth => ({
  schema: 'cuccut.node-health/v1',
  nodeId: 'node_a',
  name: 'Studio',
  nodeProtocolVersion: 1,
  minNodeProtocolVersion: 1,
  runtimeVersion: '0.4.0',
  platform: { os: 'darwin', arch: 'arm64' },
  capabilities: {
    transcribe: {
      enabled: true,
      bundles: [
        { bundleId: 'w', backend: 'whisper', device: 'gpu', state: 'ready' },
        { bundleId: 's', backend: 'sense', device: 'cpu', state: 'installed' },
        { bundleId: 'x', backend: 'x', device: 'cpu', state: 'not-installed' },
      ],
      running: 0,
      queued: 0,
      ...patch,
    },
  },
});

const node = (patch: Partial<PairedNode> = {}): PairedNode => ({
  nodeId: 'node_a',
  alias: 'Studio',
  name: 'Studio',
  host: '192.168.1.31',
  port: 47610,
  pairedAt: at(-86400_000),
  health: health(),
  problem: null,
  ...patch,
});

describe('using other computers', () => {
  it('online nodes: address · OS · architecture · version · transcription model count', () => {
    expect(nodeCardView(node())).toEqual({
      address: '192.168.1.31:47610',
      tone: 'on',
      chip: { text: '在线', variant: 'positive' },
      meta: '192.168.1.31:47610 · macOS · arm64 · CucCut 0.4.0 · 转录 2',
      problem: null,
    });
    expect(nodeCardView(node({ health: health({ enabled: false }) })).meta).toContain('没有开放转录');
    expect(nodeCardView(node({ health: health({ running: 1, queued: 0 }) })).meta).toContain('1 个任务在跑');
  });

  it('unusable nodes explain why by their problem field', () => {
    const offline = nodeCardView(node({ health: null, problem: 'unreachable' }));
    expect(offline).toMatchObject({ tone: 'off', chip: { text: '离线' }, meta: '192.168.1.31:47610' });
    expect(offline.problem).toContain('连不上这台电脑');
    expect(nodeCardView(node({ problem: 'version' }))).toMatchObject({ tone: 'error', chip: { text: '版本不兼容', variant: 'notice' } });
    expect(nodeCardView(node({ health: null, problem: 'unpaired' })).problem).toContain('配对已经失效');
  });

  it('nearby computers exclude already paired ones', () => {
    const found: DiscoveredNode[] = [
      { name: 'Studio', host: '192.168.1.31', port: 47610, nodeId: 'node_a' },
      { name: 'Mini', host: '192.168.1.40', port: 47610, nodeId: 'node_b' },
      { name: 'Old', host: '192.168.1.31', port: 47610, nodeId: null },
    ];
    expect(unpairedNearby(found, [node()]).map((n) => n.name)).toEqual(['Mini']);
  });

  it('adding by address: default port, IPv6, protocol prefix and invalid input', () => {
    expect(parseNodeAddress(' 192.168.1.31 ')).toEqual({ host: '192.168.1.31', port: 47610 });
    expect(parseNodeAddress('studio.local:5000')).toEqual({ host: 'studio.local', port: 5000 });
    expect(parseNodeAddress('http://192.168.1.31:47610/')).toEqual({ host: '192.168.1.31', port: 47610 });
    expect(parseNodeAddress('[fe80::1]:47611')).toEqual({ host: 'fe80::1', port: 47611 });
    expect(parseNodeAddress('fe80::1')).toEqual({ host: 'fe80::1', port: 47610 });
    expect(parseNodeAddress('')).toEqual({ error: '填上那台电脑的地址' });
    expect(parseNodeAddress('192.168.1.31:99999')).toEqual({ error: '端口要填 1–65535 之间的数字' });
    expect(parseNodeAddress('192.168.1.31:abc')).toEqual({ error: '端口要填 1–65535 之间的数字' });
    expect(parseNodeAddress('a b')).toHaveProperty('error');
  });

  it('pairing code input tolerates spaces and hyphens', () => {
    expect(normalizePairingCode('481 924')).toBe('481924');
    expect(normalizePairingCode('481-924')).toBe('481924');
    expect(normalizePairingCode('48192')).toBeNull();
    expect(normalizePairingCode('48192a')).toBeNull();
  });

  it('pairing failure says what to do, by error code', () => {
    const rejected = (reason: string) => new RpcError('conflict', 'x', { code: 'REMOTE_NODE_REJECTED', reason });
    expect(pairErrorMessage(rejected('pairing-code-invalid'))).toContain('配对码不对');
    expect(pairErrorMessage(rejected('pairing-locked'))).toContain('锁定');
    expect(pairErrorMessage(new RpcError('conflict', 'x', { code: 'REMOTE_NODE_LOST', reason: 'unreachable' }))).toContain('连不上');
    expect(pairErrorMessage(new RpcError('internal', '节点的配对响应不合规'))).toBe('配对没有成功：节点的配对响应不合规');
  });
});
