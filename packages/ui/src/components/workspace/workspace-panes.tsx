import { Activity, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { FileTarget, Id } from '@cuccut/protocol';
import { ProgressCircle } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { WORKSPACE_COPY } from '../../copy.ts';
import { itemKey, targetKey, type WorkspaceItem } from '../../model/workspace.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useEditor } from '../../state/editor-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { VideoEditor } from '../editor/video-editor.tsx';
import { FilePane } from '../file-pane.tsx';
import { ProjectFiles } from './project-files.tsx';
import { DesignPane } from './design-pane.tsx';
import { DesignSystemPane } from './design-system-pane.tsx';
import { SlidesPane } from './slides-pane.tsx';
import { WebTab } from './web-tab.tsx';
import { WORKSPACE_OVERLAY_ATTRIBUTE } from './workspace-overlay.ts';
import { workspacePanelId, workspaceTabId } from './workspace-tabs.tsx';

/** Prototype home-workspace.css `.home-workspace__panes` / `.home-workspace__pane`: hidden panes use display none (the flex from the style macro would override [hidden]). */
const panes = style({
  position: 'relative',
  display: { default: 'flex', isHidden: 'none' },
  flexDirection: 'column',
  flexGrow: 1,
  minWidth: 0,
  minHeight: 0,
});
/**
 * The open tab sits in a solid card in the centre of the session layout (agentcut: content surfaces stay solid). The
 * video editor lays out its own cards (assets, preview, timeline), so around it the area stays bare.
 */
const PANES_CARD = 'overflow-hidden rounded-3xl border border-border/60 bg-card';
const pane = style({
  display: { default: 'flex', isHidden: 'none' },
  flexDirection: 'column',
  flexGrow: 1,
  minWidth: 0,
  minHeight: 0,
  outlineStyle: { default: 'none', ':focus-visible': 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
  outlineOffset: -2,
});
const centered = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  flexGrow: 1,
  padding: 24,
  font: 'ui',
  color: 'gray-600',
  textAlign: 'center',
});

/**
 * The workspace area's content (product design §3.3, prototype home-workspace.jsx `HomeWorkspace` panes): each tab gets one role=tabpanel, which is hidden but not unmounted when it is not the current tab.
 * There is only one video editor. It follows the open video, not a particular tab or conversation: switching tabs or conversations does not close the video. The editor is collapsed with React 19's `<Activity>` (playback paused, effects and shortcuts stopped, while selection, playhead and undo stack are kept).
 * Web tabs stay mounted all the time (the native view is created when mounted and destroyed when unmounted), and when hidden only `active={false}` is passed.
 * Verified in browser preview: switching back and forth between a video tab and a file tab keeps the editor as the same DOM node with the playhead unchanged, and no videos.open / close is sent; videos.close is sent only when the video tab is closed. Not verified on desktop (Electron).
 */
export function WorkspacePanes({
  conversationId,
  book,
  tabs,
  active,
  visible,
}: {
  conversationId: Id | null;
  /** The key for this group of tabs (`workspaceKey`): the whole group is replaced when the conversation changes. */
  book: string;
  tabs: WorkspaceItem[];
  active: string | null;
  /** The right-hand area is shown (there is a current tab and it is not collapsed). */
  visible: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const covered = useCovered(rootRef);
  const parkedWidth = useShownWidth(rootRef, visible);
  // When the whole right-hand area is collapsed, slides or design-canvas tabs must not use display none: the layout inside the editor iframe would all measure as 0, and the scale would flicker when it comes back (see `Pane`).
  // Instead, stack it under the conversation column at its pre-collapse width, invisible; other tabs still use display none each. A pane that starts collapsed (its width was never measured) keeps the old behaviour.
  const park = !visible && parkedWidth.current !== undefined && tabs.some(isEditorTab);
  const openKey = useVideo((s) => (s.video ? targetKey(s.video.target) : null));
  const current = visible ? tabs.find((t) => itemKey(t) === active) : undefined;
  // The current tab is the open video: the editor slot takes over this tab's panel id.
  const editorKey = current?.kind === 'video' && targetKey(current.target) === openKey ? itemKey(current) : null;

  return (
    <div
      ref={rootRef}
      // Keyed on the tab's kind, not on the editor being ready, so a video tab does not lose its card once it loads.
      className={`${panes({ isHidden: !visible && !park })} ${current?.kind === 'video' ? '' : PANES_CARD}`}
      style={park ? { ...PARKED_AREA, width: parkedWidth.current } : undefined}>
      {tabs.map((item) => {
        const key = itemKey(item);
        if (key === editorKey) return null;
        const shown = visible && key === active;
        return (
          <Pane key={`${book}:${key}`} paneKey={key} shown={shown} keepLayout={isEditorTab(item)}>
            <PaneContent item={item} conversationId={conversationId} book={book} shown={shown} webVisible={!covered} />
          </Pane>
        );
      })}
      {openKey ? <EditorPane paneKey={editorKey} /> : null}
    </div>
  );
}

/** Tabs that hold an editor iframe (slides, design canvas, design system): keep the layout when hidden. */
function isEditorTab(item: WorkspaceItem): boolean {
  return item.kind === 'slides' || item.kind === 'design' || item.kind === 'design-system';
}

const PARKED: CSSProperties = { position: 'absolute', inset: 0, visibility: 'hidden' };
/** The collapsed right-hand area sits at the right of the content area; its width is given separately (the width from before collapsing). */
const PARKED_AREA: CSSProperties = { position: 'absolute', top: 0, bottom: 0, right: 0, visibility: 'hidden', pointerEvents: 'none' };

/** The width while the right-hand area is shown; after collapsing, the last value is kept (without triggering a re-render). */
function useShownWidth(ref: RefObject<HTMLElement | null>, shown: boolean): RefObject<number | undefined> {
  const width = useRef<number | undefined>(undefined);
  useEffect(() => {
    const element = ref.current;
    if (!shown || !element) return;
    const observer = new ResizeObserver(() => {
      width.current = element.getBoundingClientRect().width;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, shown]);
  return width;
}

/**
 * The panel for one tab. When hidden, the player inside is stopped (the web view hides itself through WebTab according to `active`).
 *
 * `keepLayout` (slides tab): when hidden, it does not use display none. When the editor's iframe is shown again it would first measure a wrong size, and the scale would flicker for about 1 second.
 * Instead it stacks under the current tab at the same size and is simply invisible: visibility hidden takes no pointer events and is not in the Tab order or the screen reader.
 */
function Pane({ paneKey, shown, keepLayout, children }: { paneKey: string; shown: boolean; keepLayout?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shown) return;
    ref.current?.querySelectorAll<HTMLMediaElement>('video, audio').forEach((media) => media.pause());
  }, [shown]);
  return (
    <div
      ref={ref}
      id={workspacePanelId(paneKey)}
      role="tabpanel"
      aria-labelledby={workspaceTabId(paneKey)}
      tabIndex={0}
      className={pane({ isHidden: !shown && !keepLayout })}
      style={!shown && keepLayout ? PARKED : undefined}>
      {children}
    </div>
  );
}

/** The editor slot: stays mounted while a video is open; when it is not the current tab, Activity collapses it and resets the playback state. */
function EditorPane({ paneKey }: { paneKey: string | null }) {
  const shown = paneKey !== null;
  useEffect(() => {
    // When collapsed, the engine's effect cleanup stops playback (dispose → pause); the playback state in the store is reset to match, so on return it does not show as playing.
    if (!shown) useEditor.getState().setPlaying(false);
  }, [shown]);
  const panel = paneKey !== null ? { id: workspacePanelId(paneKey), role: 'tabpanel', 'aria-labelledby': workspaceTabId(paneKey), tabIndex: 0 } : {};
  return (
    <div {...panel} className={pane({ isHidden: !shown })}>
      <Activity mode={shown ? 'visible' : 'hidden'}>
        <VideoEditor />
      </Activity>
    </div>
  );
}

function PaneContent({
  item,
  conversationId,
  book,
  shown,
  webVisible,
}: {
  item: WorkspaceItem;
  conversationId: Id | null;
  book: string;
  shown: boolean;
  webVisible: boolean;
}) {
  const setWebUrl = useShell((s) => s.setWebUrl);
  const setWebTitle = useShell((s) => s.setWebTitle);
  switch (item.kind) {
    case 'video':
      // The video tab has just been switched to, and the editor has not yet loaded this video (the open is sent on the next tick).
      return shown ? <Opening /> : null;
    case 'file':
      return <FilePane active={shown} fileNameHint={item.name} target={item.target} conversationId={conversationId} />;
    case 'files':
      return conversationId ? <ConversationFiles conversationId={conversationId} /> : <div className={centered}>{WORKSPACE_COPY.filesNoConversation}</div>;
    case 'web':
      return (
        <WebTab
          item={item}
          active={shown}
          visible={webVisible}
          onUrlChange={(url) => setWebUrl(book, item.id, url)}
          onTitleChange={(title) => setWebTitle(item.id, title)}
        />
      );
    case 'slides':
      return <SlidesPane target={item.target} conversationId={conversationId} active={shown} />;
    case 'design':
      return <DesignPane target={item.target} conversationId={conversationId} active={shown} />;
    case 'design-system':
      return <DesignSystemPane target={item.target} conversationId={conversationId} active={shown} />;
  }
}

function Opening() {
  return (
    <div className={centered}>
      <ProgressCircle isIndeterminate aria-label={WORKSPACE_COPY.opening} />
      <span>{WORKSPACE_COPY.opening}</span>
    </div>
  );
}

/**
 * Project files: clicking a file opens a single-file tab, clicking a video opens a video tab. Conversations that belong to a project are located by project instead (`{projectId, path}`): the list's root is the project directory, it is the same tab that Space opens, and the agent context is also computed per project.
 */
function ConversationFiles({ conversationId }: { conversationId: Id }) {
  const projectId = useDirectory((s) => s.conversations.find((c) => c.id === conversationId)?.projectId ?? null);
  const scoped = (target: FileTarget): FileTarget => (projectId && 'conversationId' in target ? { projectId, path: target.path } : target);
  return (
    <ProjectFiles
      conversationId={conversationId}
      onOpenFile={(target) => useShell.getState().openPane({ kind: 'file', target: scoped(target) })}
      onOpenVideo={(target) => useShell.getState().openVideo(scoped(target))}
      onOpenSlides={(target) => useShell.getState().openPane({ kind: 'slides', target: scoped(target) })}
      onOpenDesign={(target) => useShell.getState().openPane({ kind: 'design', target: scoped(target) })}
      onOpenDesignSystem={(target) => useShell.getState().openPane({ kind: 'design-system', target: scoped(target) })}
    />
  );
}

/**
 * The native web view always sits above the UI: when an overlay covers the workspace area, it makes way for now (the whole view is hidden; no partial clipping). When React Aria opens a modal dialog, menu or Popover, it adds aria-hidden (or inert) to the other nodes under body; the workspace area counts as covered in that case. Tooltips do not add it, so they do not count.
 * Overlays without these attributes (the drag masks for tabs and splits, the sidebar flyout, the tab thumbnail card) register through `workspace-overlay.ts`, and body carries `data-workspace-overlay` while they are shown. The sidebar flyout appears only after 100 ms and the thumbnail card only after 500 ms, so passing over the Rail or ordinarily hovering a tab does not make the web view flicker.
 * Not verified: browser preview has no web view (it shows “This environment cannot embed web pages”), so this path only works on desktop.
 */
function useCovered(ref: RefObject<HTMLElement | null>): boolean {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const check = () => {
      const element = ref.current;
      const hidden = !!element?.closest('[aria-hidden="true"], [inert]');
      setCovered(hidden || document.body.hasAttribute(WORKSPACE_OVERLAY_ATTRIBUTE));
    };
    // Direct children of body (popups) being added or removed; any node's aria-hidden / inert changes; changes to overlay registrations on body.
    const portals = new MutationObserver(check);
    portals.observe(document.body, { childList: true });
    const hiding = new MutationObserver(check);
    hiding.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'inert', WORKSPACE_OVERLAY_ATTRIBUTE],
    });
    check();
    return () => {
      portals.disconnect();
      hiding.disconnect();
    };
  }, [ref]);
  return covered;
}
