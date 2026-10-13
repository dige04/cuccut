import { describe, expect, it } from 'vitest';
import type { Grant } from '@cuccut/protocol';
import { useGrants } from './grants-store.ts';

const grant = (grantId: string, state: Grant['state'] = 'active'): Grant =>
  ({ grantId, state, recipient: 'openai', dataKinds: ['document'], scope: { videoId: null } }) as Grant;

describe('grants mirror', () => {
  it('snapshot replaces; upsert replaces or appends by ID; removed deletes', () => {
    const s = useGrants.getState();
    s.replace({ grants: [grant('a'), grant('b')] });
    useGrants.getState().apply({ type: 'grant.upsert', grant: grant('a', 'revoked') });
    useGrants.getState().apply({ type: 'grant.upsert', grant: grant('c') });
    useGrants.getState().apply({ type: 'grant.removed', grantId: 'b' });
    expect(useGrants.getState().ready).toBe(true);
    expect(useGrants.getState().grants.map((g) => [g.grantId, g.state])).toEqual([
      ['a', 'revoked'],
      ['c', 'active'],
    ]);
  });
});
