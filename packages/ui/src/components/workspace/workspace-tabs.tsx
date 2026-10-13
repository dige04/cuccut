import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { newId } from '@cuccut/protocol';
import { Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import { Film, FileText, Folder, Globe, LayoutTemplate, MessageSquare, Palette, Plus, Shapes, X } from 'lucide-react';
import { cn } from 'cn';
import { Focusable, VisuallyHidden } from 'react-aria-components';
import { WORKSPACE_COPY } from '../../copy.ts';
import { TAB_PREVIEW_DELAY_MS, tabPreviewSubtitle } from '../../model/tab-preview.ts';
import {
  CONVERSATION_TAB,
  closeTab,
  dragOffsets,
  dragTarget,
  entryOfTarget,
  itemKey,
  tabKeyIndex,
  targetKey,
  webTitle,
  workspaceTitle,
  type TabRect,
  type WorkspaceItem,
} from '../../model/workspace.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { STATUS_WORD } from '../conversation-header.tsx';
import { HeaderButton } from '../session/header-button.tsx';
import { useWorkspaceOverlay } from './workspace-overlay.ts';
import { WorkspaceTabPreview } from './workspace-tab-preview.tsx';

/** The tab and its content panel point at each other (aria-controls on role=tab / aria-labelledby on role=tabpanel). */
export const workspaceTabId = (key: string) => `workspace-tab-${encodeURIComponent(key)}`;
export const workspacePanelId = (key: string) => `workspace-panel-${encodeURIComponent(key)}`;
/** The fixed first tab for the conversation in a single tab strip; defined in model/workspace.ts and re-exported here for the existing importers. */
export { CONVERSATION_TAB };

/** The conversation tab in the single tab strip (narrow window or full view): title, running / awaiting approval, and whether it is the currently selected one. */
export interface ConversationTabInfo {
  title: string;
  status: 'running' | 'waiting' | null;
  selected: boolean;
}

/** Tab name: an open video uses its latest name, a web page uses the page title, others use the Space entry, and if none is found, the last segment of the path. */
export function useWorkspaceTitle(): (item: WorkspaceItem) => string {
  const entries = useSpace((s) => s.entries);
  const webTitles = useShell((s) => s.webTitles);
  const openKey = useVideo((s) => (s.video ? targetKey(s.video.target) : null));
  const openName = useVideo((s) => s.video?.state?.video.name ?? s.video?.ref?.name ?? null);
  return (item) => {
    if (item.kind === 'files') return workspaceTitle(item);
    if (item.kind === 'web') return workspaceTitle(item, webTitles[item.id]);
    const live = item.kind === 'video' && openKey === targetKey(item.target) ? openName : null;
    return workspaceTitle(item, live ?? entryOfTarget(entries, item.target)?.name);
  };
}

const icon = 'size-3.5 shrink-0';

export function WorkspaceTabIcon({ item }: { item: WorkspaceItem }) {
  if (item.kind === 'video') return <Film aria-hidden className={icon} />;
  if (item.kind === 'web') return <Globe aria-hidden className={icon} />;
  if (item.kind === 'files') return <Folder aria-hidden className={icon} />;
  if (item.kind === 'slides') return <LayoutTemplate aria-hidden className={icon} />;
  if (item.kind === 'design') return <Shapes aria-hidden className={icon} />;
  if (item.kind === 'design-system') return <Palette aria-hidden className={icon} />;
  return <FileText aria-hidden className={icon} />;
}

/*
 * The tabs are compact pills inside the session's glass header (agentcut capsules): no glass of their own, only white
 * fills — a faint one on hover, a brighter one with the control highlight for the tab on screen.
 */
const strip = 'relative flex min-w-0 flex-1 items-center gap-1';
/** role=tablist: the session tab (single strip), a separator and the scrolling, draggable list. */
const tablist = 'cc-no-drag flex h-8 min-w-0 shrink items-center gap-1';
const list = 'flex h-8 min-w-0 shrink items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]';
const pill = (active: boolean, hovered: boolean) =>
  cn(
    'relative flex h-8 shrink-0 items-center rounded-full text-[13px] select-none transition-[background-color,color,box-shadow,transform] duration-150 motion-reduce:transition-none',
    active ? 'bg-white/12 text-foreground shadow-(--control-highlight)' : hovered ? 'bg-white/8 text-foreground' : 'bg-white/[0.04] text-muted-foreground',
  );
const tabItem = ({ isActive, isHovered, isDragging }: { isActive: boolean; isHovered: boolean; isDragging: boolean }) =>
  cn(
    pill(isActive, isHovered || isDragging),
    'w-44 max-w-44 min-w-24 shrink touch-none gap-0.5 pr-1 pl-3',
    isDragging && 'opacity-35 outline-2 -outline-offset-2 outline-white/40 outline-dashed',
  );
const tabTarget =
  'flex h-8 min-w-0 flex-1 cursor-default items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0';
const tabName = 'min-w-0 flex-1 truncate';
/** The close button always holds its place, so the title does not reflow when it appears; hidden it takes no clicks. */
const closeSlot = (shown: boolean) => cn('flex shrink-0', shown ? 'opacity-100' : 'pointer-events-none opacity-0');
const closeButton =
  'grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring';
const shield = 'fixed inset-0 z-[10000] cursor-grabbing select-none';
const ghost = (outside: boolean) =>
  cn(
    'pointer-events-none absolute flex h-8 items-center gap-2 rounded-full border bg-popover px-3 text-[13px] text-foreground shadow-(--glass-shadow-raised)',
    outside ? 'border-border opacity-60' : 'border-white/30',
  );
/** The session tab in a single strip (narrow window or full view): first, fixed, no close button. */
const conversationItem = ({ isActive, isHovered }: { isActive: boolean; isHovered: boolean }) =>
  cn(pill(isActive, isHovered), 'max-w-44 min-w-24 shrink px-3');
const conversationName = 'min-w-0 flex-1 truncate font-medium';
const glyph = 'relative flex shrink-0';
/**
 * Status dot: working is a soft white, waiting for approval the accent; the meaning is also in the hint and the
 * accessible name. The ring separates it from the glass behind the pill.
 */
const statusDot = (waiting: boolean) =>
  cn('absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-black/40', waiting ? 'bg-accent' : 'bg-foreground/70');
/** Between the session tab and the draggable tabs. */
const separator = 'mx-1 h-4 w-px shrink-0 self-center bg-white/15';

interface Drag {
  key: string;
  item: WorkspaceItem;
  element: HTMLElement;
  pointerId: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  width: number;
  offsetX: number;
  offsetY: number;
  scrollLeft: number;
  rects: TabRect[];
  active: boolean;
  target: { key: string; after: boolean } | null;
}

/** The tab for which the hover thumbnail card is shown: for a conversation tab, `item` is 'conversation'; `rect` is the rectangle measured when the pointer entered the tab. */
interface HoverTab {
  key: string;
  item: WorkspaceItem | 'conversation';
  title: string;
  rect: { left: number; bottom: number };
}

/** Hover callbacks for a tab: entering starts a 500 ms timer; leaving, pressing or starting a drag cancels it. */
interface HoverHandlers {
  onHoverStart: (rect: DOMRect) => void;
  onHoverEnd: () => void;
}

interface Preview {
  key: string;
  item: WorkspaceItem;
  width: number;
  x: number;
  y: number;
  offsets: Record<string, number>;
  valid: boolean;
}

/**
 * Workspace tab strip (prototype home-workspace.jsx `WorkspaceTabs`): browser-style tabs, with selecting and closing kept separate.
 * Keyboard: ←/→ cycle, Home/End, Enter/Space select, Delete closes, Alt+Shift+←/→ moves the tab; middle click closes;
 * drag to reorder: a drag only counts past 6px, and the tab drops on release; Esc / losing focus / switching away from the window cancels; the screen reader announces the drag as it goes. The “+” at the end opens a new tab (blank web tab).
 */
export function WorkspaceTabs({
  tabs,
  active,
  conversation,
}: {
  tabs: WorkspaceItem[];
  /** The selected tab; null when the conversation tab is selected in a single tab strip. */
  active: string | null;
  /** Pass only for a single tab strip (narrow window or full view): the conversation is a fixed tab at the front that cannot be dragged or closed, and no other tab can be placed in front of it. */
  conversation?: ConversationTabInfo;
}) {
  const title = useWorkspaceTitle();
  const selectPane = useShell((s) => s.selectPane);
  const showConversation = useShell((s) => s.showConversation);
  const closePane = useShell((s) => s.closePane);
  const openPane = useShell((s) => s.openPane);
  const movePane = useShell((s) => s.movePane);
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Register as an overlay while a tab is being dragged: the Electron web view makes way for now, so it does not cover the dragged tab.
  useWorkspaceOverlay(!!preview);
  const [announcement, announce] = useState('');
  const entries = useSpace((s) => s.entries);
  // Hover thumbnail card (product design §3.3): shown after the pointer rests for 500 ms; cancelled on leave, press or drag.
  const [hoverTab, setHoverTab] = useState<HoverTab | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const clearHover = () => {
    clearTimeout(hoverTimer.current);
    setHoverTab(null);
  };
  const hover = (key: string, item: WorkspaceItem | 'conversation', name: string): HoverHandlers => ({
    onHoverStart: (rect) => {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        if (!drag.current) setHoverTab({ key, item, title: name, rect: { left: rect.left, bottom: rect.bottom } });
      }, TAB_PREVIEW_DELAY_MS);
    },
    onHoverEnd: clearHover,
  });

  const narrow = !!conversation;
  useLayoutEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, tabs.length, narrow]);

  // When there is no tab to go to: in a single tab strip it falls to the conversation tab, and in side-by-side mode it falls to the conversation header's button.
  const focusTab = (key: string | null) => {
    const target = key
      ? document.getElementById(workspaceTabId(key))
      : narrow
        ? document.getElementById(workspaceTabId(CONVERSATION_TAB))
        : document.querySelector<HTMLElement>('[data-workspace-head] button');
    target?.focus();
  };

  const select = (item: WorkspaceItem) => selectPane(itemKey(item));
  const selectConversation = () => {
    showConversation();
    focusTab(CONVERSATION_TAB);
  };

  const close = (item: WorkspaceItem) => {
    const key = itemKey(item);
    const next = closeTab({ tabs, active }, key);
    closePane(key);
    // When the conversation tab is selected, closing other tabs does not carry the view away; focus returns to the conversation tab.
    requestAnimationFrame(() => focusTab(conversation?.selected ? CONVERSATION_TAB : next.active));
  };

  const finishDrag = () => {
    const current = drag.current;
    drag.current = null;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
    setPreview(null);
  };

  useEffect(() => {
    const cancel = () => {
      if (drag.current?.active) announce(WORKSPACE_COPY.dragCancelled);
      finishDrag();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape, true);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape, true);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  const updatePreview = () => {
    const current = drag.current;
    const element = listRef.current;
    if (!current?.active || !element) return;
    const bounds = element.getBoundingClientRect();
    // Slot positions are measured at press time; if the list scrolls, they are shifted together as a whole.
    const shift = element.scrollLeft - current.scrollLeft;
    const rects = current.rects.map((r) => ({ ...r, left: r.left - shift }));
    const inside =
      current.cy >= bounds.top - 24 && current.cy <= bounds.bottom + 24 && current.cx >= bounds.left - 24 && current.cx <= bounds.right + 24;
    current.target = inside ? dragTarget(rects, current.key, current.cx) : null;
    setPreview({
      key: current.key,
      item: current.item,
      width: current.width,
      x: Math.max(0, Math.min(window.innerWidth - current.width, current.cx - current.offsetX)),
      y: Math.max(4, Math.min(window.innerHeight - 40, current.cy - current.offsetY)),
      offsets: dragOffsets(rects, current.key, current.target),
      valid: inside,
    });
  };

  const autoScroll = () => {
    const current = drag.current;
    const element = listRef.current;
    if (!current?.active || !element) return;
    const bounds = element.getBoundingClientRect();
    if (current.cy >= bounds.top - 24 && current.cy <= bounds.bottom + 24) {
      const speed = current.cx < bounds.left + 32 ? -8 : current.cx > bounds.right - 32 ? 8 : 0;
      const before = element.scrollLeft;
      element.scrollLeft += speed;
      if (element.scrollLeft !== before) updatePreview();
    }
    scrollFrame.current = requestAnimationFrame(autoScroll);
  };

  const onPointerDown = (item: WorkspaceItem) => (event: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    clearHover();
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-tab-close]') || !listRef.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    drag.current = {
      key: itemKey(item),
      item,
      element: event.currentTarget,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cx: event.clientX,
      cy: event.clientY,
      width: box.width,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      scrollLeft: listRef.current.scrollLeft,
      rects: [...listRef.current.querySelectorAll<HTMLElement>('[data-workspace-tab]')].map((el) => {
        const rect = el.getBoundingClientRect();
        return { key: el.dataset.workspaceTab ?? '', left: rect.left, width: rect.width };
      }),
      active: false,
      target: null,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    if (!(event.buttons & 1)) return finishDrag();
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.cx = event.clientX;
    current.cy = event.clientY;
    if (!current.active) {
      clearHover();
      current.element.setPointerCapture(event.pointerId);
      current.active = true;
      suppressClick.current = true;
      announce(WORKSPACE_COPY.dragging(title(current.item)));
      scrollFrame.current = requestAnimationFrame(autoScroll);
    }
    event.preventDefault();
    updatePreview();
  };

  const onPointerUp = () => {
    const current = drag.current;
    if (current?.active && current.target) {
      movePane(current.key, current.target.key, current.target.after);
      announce(WORKSPACE_COPY.moved(title(current.item)));
    }
    finishDrag();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault();
      event.stopPropagation();
      if (drag.current.active) announce(WORKSPACE_COPY.dragCancelled);
      finishDrag();
      return;
    }
    const target = event.target as HTMLElement;
    if (target.getAttribute('role') !== 'tab') return;
    const onConversation = narrow && target.id === workspaceTabId(CONVERSATION_TAB);
    const index = tabs.findIndex((t) => workspaceTabId(itemKey(t)) === target.id);
    const item = tabs[index];
    if (!item && !onConversation) return;
    if (event.altKey && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      event.stopPropagation();
      // The conversation tab stays put; the first real tab also does not move left (tabs[-1] does not exist), so nothing can be placed in front of the conversation.
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const neighbor = tabs[index + offset];
      if (item && neighbor) {
        movePane(itemKey(item), itemKey(neighbor), offset > 0);
        announce(WORKSPACE_COPY.moved(title(item)));
      }
      return;
    }
    // ←/→ and Home/End move across “conversation + tabs”: in a single tab strip the conversation is index 0.
    const order = [...(narrow ? [CONVERSATION_TAB] : []), ...tabs.map(itemKey)];
    const next = tabKeyIndex(event.key, onConversation ? 0 : index + (narrow ? 1 : 0), order.length);
    if (next !== null) {
      event.preventDefault();
      event.stopPropagation();
      const key = order[next]!;
      if (key === CONVERSATION_TAB) showConversation();
      else selectPane(key);
      focusTab(key);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (item) select(item);
      else showConversation();
    } else if (item && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      event.stopPropagation();
      close(item);
    }
  };

  return (
    <div className={strip}>
      <div
        className={tablist}
        role="tablist"
        aria-label={WORKSPACE_COPY.tablist}
        aria-description={WORKSPACE_COPY.tablistHint}
        onKeyDownCapture={onKeyDown}>
        {conversation ? (
          <>
            <ConversationTab
              info={conversation}
              onSelect={selectConversation}
              {...hover(CONVERSATION_TAB, 'conversation', conversation.title)}
              onPress={clearHover}
            />
            <span className={separator} aria-hidden="true" />
          </>
        ) : null}
        {/* Only this section can be dragged and scrolled; drag slots measure only the `data-workspace-tab` elements here, and the conversation tab is naturally not among them. */}
        <div ref={listRef} className={list} role="presentation">
          {tabs.map((item) => {
            const key = itemKey(item);
            return (
              <TabItem
                key={key}
                item={item}
                name={title(item)}
                tip={item.kind === 'web' && item.url ? item.url : title(item)}
                isActive={active === key}
                isDragging={preview?.key === key}
                offset={preview ? (preview.offsets[key] ?? 0) : null}
                onPointerDown={onPointerDown(item)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerEnd={finishDrag}
                suppressClick={suppressClick}
                onSelect={() => {
                  select(item);
                  focusTab(key);
                }}
                onClose={() => close(item)}
                {...hover(key, item, title(item))}
              />
            );
          })}
        </div>
      </div>
      <HeaderButton label={WORKSPACE_COPY.add} className="cc-no-drag" onClick={() => openPane({ kind: 'web', id: newId('web'), url: '' })}>
        <Plus className="size-4" />
      </HeaderButton>
      <VisuallyHidden>
        <span role="status">{announcement}</span>
      </VisuallyHidden>
      {hoverTab && !preview ? (
        <WorkspaceTabPreview
          key={hoverTab.key}
          panelId={workspacePanelId(hoverTab.key)}
          rect={hoverTab.rect}
          title={hoverTab.title}
          subtitle={tabPreviewSubtitle(hoverTab.item, {
            title: hoverTab.title,
            conversation: WORKSPACE_COPY.conversation,
            newTab: webTitle(''),
            entries,
          })}
        />
      ) : null}
      {/* The mask is attached to body (same as the prototype). */}
      {preview
        ? createPortal(
            <div className={`${shield} cc-no-drag`} aria-hidden="true">
              <div className={ghost(!preview.valid)} style={{ left: preview.x, top: preview.y, width: preview.width }}>
                <WorkspaceTabIcon item={preview.item} />
                <span className={tabName}>{title(preview.item)}</span>
                <X aria-hidden className="size-3.5 shrink-0" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * The fixed first conversation tab in a single tab strip (narrow window or full view) (prototype home-workspace.jsx `ConversationTab`): conversation icon plus conversation title.
 * It has no `data-workspace-tab`, no drag handling and no close button; the tooltip states that it cannot be dragged or closed. While running / awaiting approval, a dot appears at the icon's top right, and the state is also written into the tooltip and the screen reader name, not only conveyed by colour.
 */
function ConversationTab({
  info,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onPress,
}: { info: ConversationTabInfo; onSelect: () => void; onPress: () => void } & HoverHandlers) {
  const [hovered, setHovered] = useState(false);
  const word = info.status ? STATUS_WORD[info.status] : null;
  return (
    <div
      role="presentation"
      className={conversationItem({ isActive: info.selected, isHovered: hovered && !info.selected })}
      onPointerEnter={(event) => {
        setHovered(true);
        onHoverStart(event.currentTarget.getBoundingClientRect());
      }}
      onPointerLeave={() => {
        setHovered(false);
        onHoverEnd();
      }}
      onPointerDownCapture={onPress}>
      {/* When the pointer hovers, the thumbnail card describes this tab, so its own tooltip does not appear; keyboard focus still shows the tooltip as before. */}
      <TooltipTrigger delay={500} isDisabled={hovered}>
        <Focusable>
          <div
            role="tab"
            id={workspaceTabId(CONVERSATION_TAB)}
            aria-controls={workspacePanelId(CONVERSATION_TAB)}
            aria-selected={info.selected}
            aria-label={WORKSPACE_COPY.conversationTabLabel(info.title, word)}
            tabIndex={info.selected ? 0 : -1}
            className={tabTarget}
            onClick={onSelect}>
            <span className={glyph}>
              <MessageSquare aria-hidden className={icon} />
              {info.status ? (
                <span className={statusDot(info.status === 'waiting')} />
              ) : null}
            </span>
            {/* The header already shows the session's title beside the strip; the pill just names the session view. */}
            <span className={conversationName}>{WORKSPACE_COPY.conversation}</span>
          </div>
        </Focusable>
        <Tooltip>{WORKSPACE_COPY.conversationTabTip(info.title, word)}</Tooltip>
      </TooltipTrigger>
    </div>
  );
}

function TabItem({
  item,
  name,
  tip,
  isActive,
  isDragging,
  offset,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerEnd,
  suppressClick,
  onSelect,
  onClose,
  onHoverStart,
  onHoverEnd,
}: HoverHandlers & {
  item: WorkspaceItem;
  name: string;
  tip: string;
  isActive: boolean;
  isDragging: boolean;
  offset: number | null;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerEnd: () => void;
  suppressClick: { current: boolean };
  onSelect: () => void;
  onClose: () => void;
}) {
  const key = itemKey(item);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  return (
    <div
      role="presentation"
      data-workspace-tab={key}
      className={tabItem({ isActive, isHovered: hovered && !isActive, isDragging })}
      style={offset !== null ? { transform: `translateX(${offset}px)` } : undefined}
      onPointerEnter={(event) => {
        setHovered(true);
        onHoverStart(event.currentTarget.getBoundingClientRect());
      }}
      onPointerLeave={() => {
        setHovered(false);
        onHoverEnd();
      }}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onPointerDownCapture={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onMouseDown={(event) => {
        // Do not enter the browser's auto-scroll when the middle button is pressed.
        if (event.button === 1) event.preventDefault();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault();
          onClose();
        }
      }}>
      {/* When the pointer hovers, the thumbnail card describes this tab, so its own tooltip does not appear; keyboard focus still shows the tooltip as before. */}
      <TooltipTrigger delay={500} isDisabled={hovered}>
        <Focusable>
          <div
            role="tab"
            id={workspaceTabId(key)}
            aria-controls={workspacePanelId(key)}
            aria-selected={isActive}
            aria-label={name}
            tabIndex={isActive ? 0 : -1}
            className={tabTarget}
            onClick={onSelect}>
            <WorkspaceTabIcon item={item} />
            <span className={tabName}>{name}</span>
          </div>
        </Focusable>
        <Tooltip>{tip}</Tooltip>
      </TooltipTrigger>
      <span data-tab-close className={closeSlot(isActive || hovered || focusWithin)}>
        <button type="button" className={closeButton} aria-label={WORKSPACE_COPY.close(name)} title={WORKSPACE_COPY.close(name)} onClick={onClose}>
          <X aria-hidden className="size-3.5" />
        </button>
      </span>
    </div>
  );
}
