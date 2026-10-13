import { describe, expect, it } from 'vitest';
import type { GrantRequestItem } from '@cuccut/protocol';
import { modelCallRisk, outboundGrantOf } from './outbound-grants.ts';

/** Risk levels of the model tools (architecture §3.12, §12.5). */

describe('modelCallRisk', () => {
  it('local is edit; outbound covered by grant is command; not covered is high; not enabled or unresolvable is command (rejected at submission)', () => {
    expect(modelCallRisk({ kind: 'local', enabled: true, granted: true })).toBe('edit');
    expect(modelCallRisk({ kind: 'online', enabled: true, granted: true })).toBe('command');
    expect(modelCallRisk({ kind: 'node', enabled: true, granted: true })).toBe('command');
    expect(modelCallRisk({ kind: 'online', enabled: true, granted: false })).toBe('high');
    expect(modelCallRisk({ kind: 'agent', enabled: true, granted: false })).toBe('high');
    expect(modelCallRisk({ kind: 'online', enabled: false, granted: false })).toBe('command');
    expect(modelCallRisk({ kind: null, enabled: false, granted: false })).toBe('command');
  });
});

describe('outboundGrantOf', () => {
  it('grant judgment result mapped to risk: local edit, node command, covered command, need grant high, not enabled command', () => {
    const item = { recipient: 'openai' } as GrantRequestItem;
    expect(modelCallRisk(outboundGrantOf({ status: 'none', kind: 'local' }))).toBe('edit');
    expect(modelCallRisk(outboundGrantOf({ status: 'none', kind: 'node' }))).toBe('command');
    expect(modelCallRisk(outboundGrantOf({ status: 'none', kind: 'online' }))).toBe('command');
    expect(modelCallRisk(outboundGrantOf({ status: 'none', kind: null }))).toBe('command');
    expect(modelCallRisk(outboundGrantOf({ status: 'covered', kind: 'online', grant: {} as never }))).toBe('command');
    expect(modelCallRisk(outboundGrantOf({ status: 'approval', kind: 'agent', item }))).toBe('high');
  });
});
