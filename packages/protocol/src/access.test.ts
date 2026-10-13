import { describe, expect, it } from 'vitest';
import {
  AGENT_MODES,
  RISK_LEVELS,
  SERVICE_LEVELS,
  decideApproval,
  decideServiceApproval,
  normalizeAgentMode,
  type AgentMode,
  type ApprovalVerdict,
  type RiskLevel,
} from './index.ts';
import { methodParamSchemas } from './schemas.ts';

describe('decision table for access modes and risk levels', () => {
  const table: Record<AgentMode, Record<RiskLevel, ApprovalVerdict>> = {
    plan: { read: 'allow', edit: 'deny', command: 'ask', high: 'deny' },
    ask: { read: 'allow', edit: 'ask', command: 'ask', high: 'ask' },
    autoAcceptEdits: { read: 'allow', edit: 'allow', command: 'ask', high: 'ask' },
    auto: { read: 'allow', edit: 'allow', command: 'allow', high: 'ask' },
    fullAccess: { read: 'allow', edit: 'allow', command: 'allow', high: 'allow' },
  };

  it('each mode × each risk level', () => {
    for (const mode of AGENT_MODES) {
      for (const risk of RISK_LEVELS) expect(decideApproval(mode, risk), `${mode}/${risk}`).toBe(table[mode][risk]);
    }
  });

  it('levels for external services: ask confirms each time, auto runs directly, read is query-only', () => {
    const expected: Record<(typeof SERVICE_LEVELS)[number], Record<RiskLevel, ApprovalVerdict>> = {
      read: { read: 'allow', edit: 'deny', command: 'deny', high: 'deny' },
      ask: { read: 'allow', edit: 'ask', command: 'ask', high: 'ask' },
      auto: { read: 'allow', edit: 'allow', command: 'allow', high: 'allow' },
    };
    for (const level of SERVICE_LEVELS) {
      for (const risk of RISK_LEVELS) expect(decideServiceApproval(level, risk), `${level}/${risk}`).toBe(expected[level][risk]);
    }
  });

  it('old values are mapped to new values', () => {
    expect(normalizeAgentMode('controlled')).toBe('ask');
    expect(normalizeAgentMode('authorized')).toBe('fullAccess');
    expect(normalizeAgentMode('plan')).toBe('plan');
    for (const mode of AGENT_MODES) expect(normalizeAgentMode(mode)).toBe(mode);
  });

  it('protocol parameters accept new and old values, reject unrecognized ones', () => {
    const send = methodParamSchemas['conversations.send'];
    const update = methodParamSchemas['conversations.update'];
    for (const mode of [...AGENT_MODES, 'controlled', 'authorized']) {
      expect(send.safeParse({ conversationId: 'c', text: 'hi', commandId: 'k', autonomy: mode }).success, mode).toBe(true);
      expect(send.safeParse({ conversationId: 'c', text: 'hi', commandId: 'k', accessMode: mode }).success, mode).toBe(true);
      expect(update.safeParse({ conversationId: 'c', accessMode: mode }).success, mode).toBe(true);
    }
    expect(send.safeParse({ conversationId: 'c', text: 'hi', commandId: 'k', accessMode: 'yolo' }).success).toBe(false);
    expect(update.safeParse({ conversationId: 'c', accessMode: null }).success).toBe(true);
    expect(methodParamSchemas['approvals.list'].safeParse({}).success).toBe(true);
    expect(methodParamSchemas['approvals.respond'].safeParse({ approvalId: 'a', decision: 'allow' }).success).toBe(true);
    expect(methodParamSchemas['approvals.respond'].safeParse({ approvalId: 'a', decision: 'accept' }).success).toBe(false);
  });
});
