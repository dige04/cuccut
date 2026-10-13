import { beforeEach, describe, expect, it } from 'vitest';
import { useHelp } from './help-store.ts';

describe('useHelp', () => {
  beforeEach(() => useHelp.setState({ isOpen: false, session: 0, origin: null }));

  it('each open counts as a new session; opening again while open does not reset', () => {
    useHelp.getState().open();
    expect(useHelp.getState()).toMatchObject({ isOpen: true, session: 1 });
    useHelp.getState().open();
    expect(useHelp.getState().session).toBe(1);
    useHelp.getState().close();
    expect(useHelp.getState().isOpen).toBe(false);
    useHelp.getState().open();
    expect(useHelp.getState().session).toBe(2);
  });

  it('no source is recorded when there is no DOM', () => {
    useHelp.getState().open(null);
    expect(useHelp.getState().origin).toBeNull();
  });
});
