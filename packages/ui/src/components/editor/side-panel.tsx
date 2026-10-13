import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  AssetRecord,
  DocumentRecord,
  Id,
  Sequence,
} from "@cuccut/protocol";
import {
  Captions,
  Film,
  Image,
  Music2,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Shapes,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Tabs, TabsList, TabsTrigger } from "../../cc/ui/tabs.tsx";
import { useRuntime } from "../../runtime/context.tsx";
import {
  hostPanelTab,
  PANEL_WIDTH_DEFAULT,
  useEditor,
  type PanelTab,
} from "../../state/editor-store.ts";
import { AiToolsPanel } from "./ai-tools-panel.tsx";
import { BrandPanel } from "./brand-panel.tsx";
import { ElementsPanel } from "./elements-panel.tsx";
import { clearCutOrigin } from "./shorts-entry.ts";
import { MediaPanel } from "./media-panel.tsx";
import { PanelTitleNamed } from "./panel-head.tsx";
import { SubtitlePanel } from "./subtitle-panel.tsx";
import { TextPanel } from "./text-panel.tsx";
import { TranscriptPanel } from "./transcript-panel.tsx";
import { ELEMENTS_COPY as EL } from "./elements-copy.ts";
import { EDITOR_LAYOUT_COPY as L } from "./editor-layout-copy.ts";

/** A tab of the panel card (`props` is not one any more: the inspector has its own column). */
type CardTab = Exclude<PanelTab, "props">;
type Group = "script" | "media" | "elements" | "ai";

/** Tabs in rail order; `aitools` is desktop only (product design §5.10). */
const TABS: {
  key: CardTab;
  group: Group;
  label: () => string;
  Icon: LucideIcon;
}[] = [
  {
    key: "transcript",
    group: "script",
    label: () => EL.tabTranscript,
    Icon: ScrollText,
  },
  {
    key: "subtitle",
    group: "script",
    label: () => EL.tabSubtitle,
    Icon: Captions,
  },
  { key: "video", group: "media", label: () => EL.tabVideo, Icon: Film },
  { key: "image", group: "media", label: () => EL.tabImage, Icon: Image },
  { key: "audio", group: "media", label: () => EL.tabAudio, Icon: Music2 },
  {
    key: "elements",
    group: "elements",
    label: () => EL.elements,
    Icon: Shapes,
  },
  { key: "text", group: "elements", label: () => EL.text, Icon: Type },
  { key: "brand", group: "elements", label: () => EL.tabBrand, Icon: Palette },
  { key: "aitools", group: "ai", label: () => EL.tabAiTools, Icon: Sparkles },
];

const GROUPS: { key: Group; label: () => string }[] = [
  { key: "script", label: () => L.groupScript },
  { key: "media", label: () => L.groupMedia },
  { key: "elements", label: () => L.groupElements },
  { key: "ai", label: () => L.groupAi },
];

/** A tab's name in the current language (also used by the shorts banner). */
export function panelTabLabel(tab: PanelTab): string {
  if (tab === "props") return EL.tabProps;
  return TABS.find((t) => t.key === tab)?.label() ?? tab;
}

/** Where the card lands when the stored tab is one it does not show. */
const FALLBACK_TAB: CardTab = "transcript";
/** Below this window width the card starts folded into the rail (agentcut opens the asset browser on demand). */
const COLLAPSE_BELOW = 1440;
/** The same for the pane itself: in a session with its list and chat open, the pane is narrow even in a wide window. */
const PANE_COLLAPSE_BELOW = 1000;
/** The width default only applies to the first editor of this page load; after that the person's choice stands. */
let widthDefaultApplied = false;

function cardTab(tab: PanelTab, web: boolean): CardTab {
  const shown = hostPanelTab(tab, web);
  return shown === "props" ? FALLBACK_TAB : shown;
}

/**
 * The editor's left card (agentcut's asset browser): a pill segmented control over CucCut's panels, grouped as Script,
 * Media, Elements and AI, with the group's panels as chips under it. Folded, it is a slim capsule of icons so every panel
 * stays one click away. Opening a panel from anywhere (`showPanel`) unfolds it; the selection's properties no longer
 * live here — they have the inspector column, which is always on screen.
 */
export function SidePanel({
  sequence,
  assets,
  documents,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
}) {
  const web = useRuntime().host.platform === "web";
  const tab = useEditor((s) => cardTab(s.panelTab, web));
  const width = useEditor((s) => s.panelWidth);
  const hidden = useEditor((s) => s.panelHidden);
  const showPanel = useEditor((s) => s.showPanel);
  const cardRef = useRef<HTMLElement>(null);

  // A layout effect so a card that starts folded never paints open first.
  useLayoutEffect(() => {
    if (!widthDefaultApplied) {
      widthDefaultApplied = true;
      const pane =
        cardRef.current?.parentElement?.clientWidth ?? window.innerWidth;
      if (window.innerWidth < COLLAPSE_BELOW || pane < PANE_COLLAPSE_BELOW)
        useEditor.setState({ panelHidden: true });
    }
    // A tab stored by an older build may still be the properties page: the card shows its fallback instead.
    if (useEditor.getState().panelTab === "props")
      useEditor.setState({ panelTab: FALLBACK_TAB });
  }, []);

  const open = (key: CardTab) => {
    // Picking a panel by hand (even the transcript again) means the banner's "came from" no longer applies (§5.10).
    clearCutOrigin();
    showPanel(key);
  };
  const tabs = TABS.filter(({ key }) => hostPanelTab(key, web) === key);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0]!;
  const groups = GROUPS.filter((g) => tabs.some((t) => t.group === g.key));
  const siblings = tabs.filter((t) => t.group === current.group);

  if (hidden) {
    return (
      <nav
        data-cc
        aria-label={L.panels}
        className="flex shrink-0 flex-col items-center gap-1 self-start rounded-full bg-card p-1.5 ring-1 ring-foreground/10"
      >
        <RailButton label={L.showPanels} onClick={() => showPanel(tab)}>
          <PanelLeftOpen />
        </RailButton>
        <span aria-hidden className="my-1 h-px w-5 bg-white/10" />
        {tabs.map(({ key, label, Icon }) => (
          <RailButton key={key} label={label()} onClick={() => open(key)}>
            <Icon />
          </RailButton>
        ))}
      </nav>
    );
  }

  return (
    <>
      <section
        ref={cardRef}
        aria-label={L.panels}
        className="flex min-h-0 min-w-0 shrink-[1000] flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10"
        style={{ width, minWidth: 300 }}
      >
        <div data-cc className="flex shrink-0 flex-col gap-2 px-3 pt-3">
          <div className="flex items-center gap-2">
            <Tabs
              className="min-w-0 flex-1"
              value={current.group}
              onValueChange={(group: Group) => {
                const first = tabs.find((t) => t.group === group);
                if (first && first.group !== current.group) open(first.key);
              }}
            >
              <TabsList aria-label={L.panels} className="w-full">
                {groups.map((g) => (
                  <TabsTrigger
                    key={g.key}
                    value={g.key}
                    className="min-w-0 px-2 text-[13px]"
                  >
                    <span className="truncate">{g.label()}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <RailButton label={L.hidePanels} onClick={() => showPanel(null)}>
              <PanelLeftClose />
            </RailButton>
          </div>
          {siblings.length > 1 ? (
            <Tabs
              value={current.key}
              onValueChange={(key: CardTab) => open(key)}
            >
              <TabsList
                variant="line"
                aria-label={L.groupTabs(
                  groups.find((g) => g.key === current.group)?.label() ?? "",
                )}
                className="h-8 w-full justify-start gap-1 p-0"
              >
                {siblings.map(({ key, label, Icon }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="h-7 flex-none rounded-full border-transparent px-2.5 text-xs after:hidden data-active:bg-white/10 data-active:shadow-(--control-highlight) group-data-[variant=line]/tabs-list:data-active:bg-white/10"
                  >
                    <Icon className="size-3.5" />
                    {label()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col"
          aria-label={EL.currentTool}
          role="region"
        >
          <PanelTitleNamed.Provider value={true}>
            {tab === "transcript" ? (
              <TranscriptPanel
                sequence={sequence}
                assets={assets}
                documents={documents}
              />
            ) : tab === "subtitle" ? (
              <SubtitlePanel
                sequence={sequence}
                assets={assets}
                documents={documents}
              />
            ) : tab === "elements" ? (
              <ElementsPanel sequence={sequence} />
            ) : tab === "text" ? (
              <TextPanel sequence={sequence} />
            ) : tab === "brand" ? (
              <BrandPanel
                sequence={sequence}
                assets={assets}
                documents={documents}
              />
            ) : tab === "aitools" ? (
              <AiToolsPanel sequence={sequence} documents={documents} />
            ) : (
              <MediaPanel kind={tab} sequence={sequence} assets={assets} />
            )}
          </PanelTitleNamed.Provider>
        </div>
      </section>
      <PanelSeam panel={cardRef} />
    </>
  );
}

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 motion-reduce:transition-none",
        "hover:bg-white/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4",
      )}
    >
      {children}
    </button>
  );
}

/** Drag the gap right of the card to widen it; narrower than the fold line folds it; double-click restores the default. */
function PanelSeam({
  panel: panelRef,
}: {
  panel: { current: HTMLElement | null };
}) {
  const dragPanel = useEditor((s) => s.dragPanel);
  const width = useEditor((s) => s.panelWidth);
  const start = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const resize = (clientX: number) => {
    if (start.current)
      dragPanel(start.current.width + (clientX - start.current.x));
  };
  const stop = () => {
    start.current = null;
    setDragging(false);
  };
  return (
    <div
      className="group/seam relative -mx-4 w-4 shrink-0 cursor-col-resize touch-none"
      role="separator"
      aria-orientation="vertical"
      aria-label={EL.resizePanel}
      aria-valuenow={width}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        // Start from the card's real width: in a narrow window it can be narrower than the stored one.
        start.current = {
          x: event.clientX,
          width: panelRef.current?.offsetWidth ?? width,
        };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current && event.buttons === 0) stop();
        else resize(event.clientX);
      }}
      onPointerUp={(event) => {
        // Count where it was let go too: fast drags coalesce pointermove events.
        resize(event.clientX);
        stop();
      }}
      onLostPointerCapture={stop}
      onDoubleClick={() => dragPanel(PANEL_WIDTH_DEFAULT)}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-8 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-primary/70 opacity-0 transition-opacity duration-150 group-hover/seam:opacity-100",
          dragging && "opacity-100",
        )}
      />
    </div>
  );
}
