import { useLayoutEffect, useState } from 'react';

/**
 * Whether this part of the tree is on screen. The editor pane stays mounted inside a hidden `<Activity>` when its tab is
 * not the current one; layout effects are torn down there, so this turns false and whatever the pane portals into the
 * session layout (header actions, inspector) leaves with it instead of lingering for a pane nobody sees.
 */
export function usePaneActive(): boolean {
  const [active, setActive] = useState(false);
  useLayoutEffect(() => {
    setActive(true);
    return () => setActive(false);
  }, []);
  return active;
}
