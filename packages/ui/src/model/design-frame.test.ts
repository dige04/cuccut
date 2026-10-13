import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import { designFrameUrl, designSystemPath } from './design-frame.ts';

const at = (hostname: string, port = '24399') => ({ protocol: 'http:', hostname, port });

describe('designFrameUrl', () => {
  it('web relative address is swapped to another loopback hostname, port unchanged', () => {
    expect(designFrameUrl('/design/g1/', at('127.0.0.1'))).toBe('http://localhost:24399/design/g1/');
    expect(designFrameUrl('/design/g1/', at('localhost'))).toBe('http://127.0.0.1:24399/design/g1/');
    expect(designFrameUrl('/design/g1/', at('localhost', ''))).toBe('http://127.0.0.1/design/g1/');
    expect(designFrameUrl('/design-system/g1/', at('127.0.0.1'))).toBe('http://localhost:24399/design-system/g1/');
  });

  it('cannot swap when the page is not on either of the two hostnames; does not fall back to same-origin', () => {
    expect(designFrameUrl('/design/g1/', at('example.com'))).toBeNull();
    expect(designFrameUrl('/design/g1/', at('[::1]'))).toBeNull();
    expect(designFrameUrl('/design-system/g1/', at('example.com'))).toBeNull();
  });

  it('desktop gateway absolute address is used as is', () => {
    expect(designFrameUrl('http://127.0.0.1:51234/design/g1/', at('example.com'))).toBe('http://127.0.0.1:51234/design/g1/');
  });
});

describe('designSystemPath', () => {
  const entry: SpaceEntry = {
    id: 'e1',
    kind: 'design-system',
    name: 'Brand',
    fileName: 'brand',
    source: { projectId: 'p1', conversationId: null },
    relPath: 'systems/brand',
    size: 0,
    lastActivityAt: '2026-10-01T00:00:00.000Z',
    status: null,
    user: { favorite: false, displayName: null, trashedAt: null },
  };

  it('opening by path uses FileTarget.path', () => {
    expect(designSystemPath({ conversationId: 'c1', path: 'brand' }, [])).toBe('brand');
    expect(designSystemPath({ projectId: 'p1', path: 'systems/brand' }, [entry])).toBe('systems/brand');
  });

  it('opening by Space item uses the item\'s relative path; omitted when the item is not found', () => {
    expect(designSystemPath({ entryId: 'e1' }, [entry])).toBe('systems/brand');
    expect(designSystemPath({ entryId: 'missing' }, [entry])).toBeNull();
    // An entry outside the source directory: relPath is only a display name
    expect(designSystemPath({ entryId: 'e1' }, [{ ...entry, source: { projectId: null, conversationId: null } }])).toBeNull();
  });
});
