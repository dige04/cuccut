import { describe, expect, it } from 'vitest';
import { WORKSPACE_OVERLAY_ATTRIBUTE, createWorkspaceOverlays } from './workspace-overlay.ts';

function fakeBody() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  };
}

describe('feature-area overlay registration', () => {
  it('body carries a marker while any overlay is registered, and it is removed once all are undone', () => {
    const body = fakeBody();
    const overlays = createWorkspaceOverlays(() => body);
    expect(body.attributes.has(WORKSPACE_OVERLAY_ATTRIBUTE)).toBe(false);
    const peek = overlays.register();
    const card = overlays.register();
    expect(body.attributes.has(WORKSPACE_OVERLAY_ATTRIBUTE)).toBe(true);
    peek();
    expect(body.attributes.has(WORKSPACE_OVERLAY_ATTRIBUTE)).toBe(true);
    card();
    expect(body.attributes.has(WORKSPACE_OVERLAY_ATTRIBUTE)).toBe(false);
    expect(overlays.count()).toBe(0);
  });

  it('calling an undo function repeatedly undoes only once, and does not prematurely remove another\'s marker', () => {
    const body = fakeBody();
    const overlays = createWorkspaceOverlays(() => body);
    const drag = overlays.register();
    const peek = overlays.register();
    drag();
    drag();
    expect(overlays.count()).toBe(1);
    expect(body.attributes.has(WORKSPACE_OVERLAY_ATTRIBUTE)).toBe(true);
    peek();
    expect(body.attributes.has(WORKSPACE_OVERLAY_ATTRIBUTE)).toBe(false);
  });

  it('without document (Node) only counts', () => {
    const overlays = createWorkspaceOverlays(() => null);
    const release = overlays.register();
    expect(overlays.count()).toBe(1);
    release();
    expect(overlays.count()).toBe(0);
  });
});
