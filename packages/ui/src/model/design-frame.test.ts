import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import { designFrameUrl, designSystemPath } from './design-frame.ts';

const at = (hostname: string, port = '24399') => ({ protocol: 'http:', hostname, port });

describe('designFrameUrl', () => {
  it('Web 的相对地址换到另一个回环主机名，端口不变', () => {
    expect(designFrameUrl('/design/g1/', at('127.0.0.1'))).toBe('http://localhost:24399/design/g1/');
    expect(designFrameUrl('/design/g1/', at('localhost'))).toBe('http://127.0.0.1:24399/design/g1/');
    expect(designFrameUrl('/design/g1/', at('localhost', ''))).toBe('http://127.0.0.1/design/g1/');
    expect(designFrameUrl('/design-system/g1/', at('127.0.0.1'))).toBe('http://localhost:24399/design-system/g1/');
  });

  it('页面不在这两个主机名上时换不了，不退回同源', () => {
    expect(designFrameUrl('/design/g1/', at('example.com'))).toBeNull();
    expect(designFrameUrl('/design/g1/', at('[::1]'))).toBeNull();
    expect(designFrameUrl('/design-system/g1/', at('example.com'))).toBeNull();
  });

  it('桌面端网关的绝对地址原样用', () => {
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

  it('按路径打开的用 FileTarget.path', () => {
    expect(designSystemPath({ conversationId: 'c1', path: 'brand' }, [])).toBe('brand');
    expect(designSystemPath({ projectId: 'p1', path: 'systems/brand' }, [entry])).toBe('systems/brand');
  });

  it('按 Space 条目打开的用条目的相对路径，找不到条目时不带', () => {
    expect(designSystemPath({ entryId: 'e1' }, [entry])).toBe('systems/brand');
    expect(designSystemPath({ entryId: 'missing' }, [entry])).toBeNull();
    // An entry outside the source directory: relPath is only a display name
    expect(designSystemPath({ entryId: 'e1' }, [{ ...entry, source: { projectId: null, conversationId: null } }])).toBeNull();
  });
});
