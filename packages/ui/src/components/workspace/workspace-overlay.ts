import { useLayoutEffect } from 'react';

/**
 * Registration of overlays that sit over the workspace area but are not modal (the Electron embedded web view makes way for them).
 *
 * The native web view (the host's `WebContentsView`) is always painted above the renderer's DOM, so DOM overlays cannot cover it. Menus, modal dialogs and Popovers add aria-hidden / inert to the other nodes, and `useCovered` in `workspace-panes.tsx` uses that to hide the whole web view. Overlays without these attributes (the drag masks for tabs and splits, the sidebar flyout, the tab thumbnail card) register here while shown: when the count is greater than 0, `document.body` carries `data-workspace-overlay`, and `useCovered` sees it and hides the web view too; it is restored once all are withdrawn. The whole view is hidden; no partial clipping.
 *
 * The sidebar flyout appears only after the pointer rests on a Rail entry for 100 ms, and the thumbnail card only after 500 ms on a tab. Passing over the Rail or ordinarily hovering a tab does not register, so the web view does not flicker.
 */
export const WORKSPACE_OVERLAY_ATTRIBUTE = 'data-workspace-overlay';

interface OverlayTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** The counter itself: `target` is the element the attribute is set on (defaults to `document.body`; a fake one in tests). */
export function createWorkspaceOverlays(target: () => OverlayTarget | null) {
  let count = 0;
  const sync = () => {
    const element = target();
    if (!element) return;
    if (count > 0) element.setAttribute(WORKSPACE_OVERLAY_ATTRIBUTE, '');
    else element.removeAttribute(WORKSPACE_OVERLAY_ATTRIBUTE);
  };
  return {
    /** Register an overlay; returns an undo function (calling it more than once undoes only once). */
    register(): () => void {
      count += 1;
      sync();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count -= 1;
        sync();
      };
    },
    count: () => count,
  };
}

const overlays = createWorkspaceOverlays(() => (typeof document === 'undefined' ? null : document.body));

export const registerWorkspaceOverlay = overlays.register;

/** While `active` is true, register as an overlay (undone on unmount or when it turns false). Registration happens in the layout phase, so it paints in the same frame as the overlay. */
export function useWorkspaceOverlay(active: boolean): void {
  useLayoutEffect(() => (active ? registerWorkspaceOverlay() : undefined), [active]);
}
