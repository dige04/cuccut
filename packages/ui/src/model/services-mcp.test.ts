import { describe, expect, it } from 'vitest';
import {
  MCP_SERVICE_TOOL_NAMES,
  type GrantRequestItem,
  type PendingApproval,
  type ServiceApproval,
  type SpaceEntry,
} from '@cuccut/protocol';
import {
  approvalGrants,
  approvalSecondsLeft,
  grantLine,
  levelTitle,
  liveApprovalCount,
  liveApprovals,
  MCP_TOOLS,
  mcpScope,
  mcpSub,
  mcpToolTitle,
  outcomeLabel,
  pickedScope,
  requestLine,
  scopeVideos,
  toolGate,
  toolsSummary,
} from './services-mcp.ts';

function video(id: string, name: string, patch: Partial<SpaceEntry> = {}): SpaceEntry {
  return {
    id: `e-${id}`,
    kind: 'video',
    name,
    fileName: `${name}.mp4`,
    source: { projectId: 'p1', conversationId: null },
    relPath: `${name}.mp4`,
    size: 1,
    lastActivityAt: '2026-10-01T00:00:00.000Z',
    status: null,
    user: { favorite: false, displayName: null, trashedAt: null },
    ref: { videoId: id },
    ...patch,
  };
}

const names: Record<string, string> = { v1: '发布会', v2: '访谈' };
const nameOf = (id: string) => names[id];

describe('sharing scope', () => {
  it('selectable videos: only video entries in the project that are not in the trash, sorted by name, each counted once; a renamed video uses its new name', () => {
    const entries = [
      video('v2', '访谈'),
      video('v1', 'raw', { user: { favorite: false, displayName: '发布会', trashedAt: null } }),
      video('v1', '发布会-副本'),
      video('v3', '旧片', { user: { favorite: false, displayName: null, trashedAt: '2026-10-02T00:00:00.000Z' } }),
      video('v4', '散片', { source: { projectId: null, conversationId: 'c1' } }),
      { ...video('v5', '图'), kind: 'image' as const },
    ];
    expect(scopeVideos(entries)).toEqual([
      { videoId: 'v1', name: '发布会' },
      { videoId: 'v2', name: '访谈' },
    ]);
  });

  it('summary line: all writes the total, one writes its name (the ID when not found), several writes the count, an empty list says so directly', () => {
    expect(mcpScope('all', 3, nameOf)).toBe('所有视频（3）');
    expect(mcpScope({ ids: ['v1'] }, 3, nameOf)).toBe('「发布会」');
    expect(mcpScope({ ids: ['vx'] }, 3, nameOf)).toBe('「vx」');
    expect(mcpScope({ ids: ['v1', 'v2'] }, 3, nameOf)).toBe('其中 2 个视频');
    expect(mcpScope({ ids: [] }, 3, nameOf)).toBe('没有开放任何视频');
  });

  it('after checking: all checked equals all; de-duplicates and drops unknown entries; when none are left it is an empty list and does not silently widen', () => {
    const all = ['v1', 'v2', 'v3'];
    expect(pickedScope(['v1', 'v2', 'v3'], all)).toBe('all');
    expect(pickedScope(['v2', 'v2', 'vx'], all)).toEqual({ ids: ['v2'] });
    expect(pickedScope([], all)).toEqual({ ids: [] });
    expect(pickedScope([], [])).toEqual({ ids: [] });
  });

  it('service card subline: when on, says what is shared; when off, says what will be shared after starting; while starting or stopping, only says the scope', () => {
    expect(levelTitle('ask')).toBe('修改前询问');
    expect(mcpSub('on', '所有视频（3）', 'read')).toBe('所有视频（3） · 只读 · 需要令牌');
    expect(mcpSub('off', '「发布会」', 'auto')).toBe('启动后开放「发布会」 · 直接放行 · 需要令牌');
    expect(mcpSub('starting', '「发布会」', 'auto')).toBe('「发布会」');
  });
});

describe('tool catalog', () => {
  it('the catalog follows the protocol constants; unrecognized tool names are written as is', () => {
    expect(MCP_TOOLS.map((t) => t.name)).toEqual(MCP_SERVICE_TOOL_NAMES.map((t) => t.name));
    expect(mcpToolTitle('edits_apply')).toBe('修改视频');
    expect(mcpToolTitle('mystery')).toBe('mystery');
    const groupOf = (name: string) => MCP_TOOLS.find((t) => t.name === name)!.group;
    expect([groupOf('videos_list'), groupOf('edits_apply'), groupOf('download'), groupOf('jobs_cancel'), groupOf('speak')]).toEqual([
      'read',
      'edit',
      'job',
      'job',
      'generate',
    ]);
  });

  it('destination: reads answer directly; writes are not offered in read-only mode, the ask tier asks before calling, the allow tier runs directly', () => {
    const read = MCP_TOOLS.find((t) => t.name === 'videos_list')!;
    const write = MCP_TOOLS.find((t) => t.name === 'export')!;
    expect(toolGate(read, 'read')).toBe('answer');
    expect(toolGate(write, 'read')).toBe('hidden');
    expect(toolGate(write, 'ask')).toBe('ask');
    expect(toolGate(write, 'auto')).toBe('auto');
  });

  it('a line beside the section title: how many are offered and how many need asking', () => {
    const total = MCP_TOOLS.length;
    const reads = MCP_TOOLS.filter((t) => t.access === 'read').length;
    expect(toolsSummary('read')).toBe(`提供 ${reads} / ${total} 个工具 · 全部只读`);
    expect(toolsSummary('ask')).toBe(`提供 ${total} / ${total} 个工具 · ${total - reads} 个调用前询问`);
    expect(toolsSummary('auto')).toBe(`提供 ${total} / ${total} 个工具 · 不需要确认`);
  });
});

describe('recent requests', () => {
  it('result: success and common refusals are written in plain language; others show the error code as is', () => {
    expect(outcomeLabel('ok')).toBe('成功');
    expect(outcomeLabel('SERVICE_APPROVAL_DENIED')).toBe('没有放行');
    expect(outcomeLabel('VIDEO_NOT_FOUND')).toBe('视频不在范围里');
    expect(outcomeLabel('INTERNAL')).toBe('INTERNAL');
  });

  it('one line: tool and video name; a video not in the list is written as its ID', () => {
    const base = { at: '2026-10-03T08:00:00Z', clientId: 'c1', clientName: 'Claude', outcome: 'ok' };
    expect(requestLine({ ...base, tool: 'videos_list', videoId: null }, nameOf)).toBe('videos_list');
    expect(requestLine({ ...base, tool: 'edits_apply', videoId: 'v1' }, nameOf)).toBe('edits_apply · 「发布会」');
    expect(requestLine({ ...base, tool: 'edits_apply', videoId: 'vx' }, nameOf)).toBe('edits_apply · 「vx」');
  });
});

describe('service approvals', () => {
  const now = Date.parse('2026-10-03T08:00:00Z');
  const approval = (approvalId: string, serviceId: ServiceApproval['serviceId'], secondsLeft: number): ServiceApproval => ({
    approvalId,
    serviceId,
    clientId: 'c1',
    clientName: 'Claude',
    tool: 'export',
    video: { videoId: 'v1', name: '发布会' },
    summary: '导出',
    createdAt: new Date(now - 10_000).toISOString(),
    expiresAt: new Date(now + secondsLeft * 1000).toISOString(),
  });

  it('remaining seconds round up; 0 when expired or the date is invalid', () => {
    expect(approvalSecondsLeft({ expiresAt: new Date(now + 1500).toISOString() }, now)).toBe(2);
    expect(approvalSecondsLeft({ expiresAt: new Date(now - 1).toISOString() }, now)).toBe(0);
    expect(approvalSecondsLeft({ expiresAt: 'x' }, now)).toBe(0);
  });

  it('only this service\'s approvals that have not expired; the rail badge counts approvals for all services', () => {
    const list = [approval('a1', 'mcp', 30), approval('a2', 'mcp', 0), approval('a3', 'model-api', 20)];
    expect(liveApprovals(list, 'mcp', now).map((a) => a.approvalId)).toEqual(['a1']);
    expect(liveApprovals(list, 'model-api', now).map((a) => a.approvalId)).toEqual(['a3']);
    expect(liveApprovalCount(list, now)).toBe(2);
  });

  const grant: GrantRequestItem = {
    capability: 'transcribe',
    dataKinds: ['audio'],
    recipient: 'openai',
    videoId: 'v1',
    purpose: '转录',
    reason: 'none',
    cost: 'unknown',
    estimate: null,
    maxCalls: null,
  };

  it('outbound authorization is looked up by approvalId in the unified tasks-topic list; empty when absent', () => {
    const pending = [{ approvalId: 'a1', grants: [grant] }, { approvalId: 'a2' }] as PendingApproval[];
    expect(approvalGrants(pending, 'a1')).toEqual([grant]);
    expect(approvalGrants(pending, 'a2')).toEqual([]);
    expect(approvalGrants(pending, 'a9')).toEqual([]);
  });

  it('one line for an outbound authorization: data, recipient, purpose; include the amount when there is an estimate', () => {
    expect(grantLine(grant)).toBe('要把音频发给 openai（转录）');
    expect(grantLine({ ...grant, dataKinds: ['transcript', 'document'], estimate: { amount: '0.02', currency: 'USD' } })).toBe(
      '要把文稿与译文、文本与提示词发给 openai（转录） · 约 0.02 USD',
    );
  });
});
