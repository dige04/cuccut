import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tabPreviewPosition } from '../../model/tab-preview.ts';
import { useWorkspaceOverlay } from './workspace-overlay.ts';

/*
 * The hover card (agentcut popover surface: solid, 16px corners, hairline, raised shadow). Width 280, the same as
 * model/tab-preview.ts `TAB_PREVIEW_WIDTH`. It hangs off <body>, outside the S2 provider, so it sets its own font.
 */
const card =
  'pointer-events-none fixed z-[60] box-border w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-popover p-1.5 font-sans text-sm text-foreground shadow-(--glass-shadow-raised)';
/** The thumbnail; the clone's scaling is in app.css `.cc-tab-preview-image`. A pane that could not be copied shows none. */
const image =
  'relative h-[175px] overflow-hidden rounded-xl bg-background [--cc-tab-preview-line:transparent] data-[empty]:hidden';
const titleText = 'block truncate px-2 pt-2 text-xs font-medium';
const pathText = 'block truncate px-2 pt-0.5 pb-1.5 text-[11px] text-muted-foreground';

/**
 * Tab hover thumbnail card (product design §3.3 “tab strip”; prototype home-shell-chrome.jsx `WorkspaceTabPreview`): clones the tab's panel into a non-interactive copy and scales it down proportionally into the card. Web frames, audio/video and scripts are removed; canvases are copied pixel by pixel. If the panel cannot be found, the card is left blank. The embedded native web view is not in the DOM and cannot be captured, so that area is also left blank. While the card is shown, the web view makes way (`workspace-overlay.ts`); otherwise it would cover the card.
 */
export function WorkspaceTabPreview({
  panelId,
  rect,
  title,
  subtitle,
}: {
  panelId: string;
  rect: { left: number; bottom: number };
  title: string;
  subtitle: string;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  // While mounted (after 500 ms of hover), register as an overlay: the Electron embedded web view is hidden for now, the same as for a menu.
  useWorkspaceOverlay(true);
  useLayoutEffect(() => {
    const pane = document.getElementById(panelId);
    const host = target.current;
    if (!pane || !host) {
      setEmpty(true);
      return;
    }
    const copy = pane.cloneNode(true) as HTMLElement;
    for (const name of ['hidden', 'id', 'role', 'aria-labelledby', 'aria-controls', 'tabindex']) copy.removeAttribute(name);
    copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    copy.querySelectorAll('iframe, video, audio, script').forEach((el) => el.remove());
    copy.querySelectorAll<HTMLElement>('[hidden]').forEach((el) => {
      el.hidden = false;
    });
    for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('[style]')]) {
      if (el.style.getPropertyPriority('display') === 'important') el.style.removeProperty('display');
    }
    copy.inert = true;
    copy.setAttribute('aria-hidden', 'true');
    copy.classList.add('cc-tab-preview-clone');
    const originals = pane.querySelectorAll('canvas');
    copy.querySelectorAll('canvas').forEach((el, i) => {
      const source = originals[i];
      if (!source) return;
      try {
        el.width = source.width;
        el.height = source.height;
        el.getContext('2d')?.drawImage(source, 0, 0);
      } catch {
        // The canvas is tainted by cross-origin content or has no 2D context: this area is left blank.
      }
    });
    host.replaceChildren(copy);
    setEmpty(false);
  }, [panelId]);
  return createPortal(
    <div className={card} role="tooltip" style={tabPreviewPosition(rect, window.innerWidth)} data-tab-preview="">
      <div ref={target} className={`${image} cc-tab-preview-image`} data-empty={empty || undefined} />
      <strong className={titleText}>{title}</strong>
      <span className={pathText}>{subtitle}</span>
    </div>,
    document.body,
  );
}
