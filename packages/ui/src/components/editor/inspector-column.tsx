import { useMemo } from "react";
import type {
  AssetRecord,
  DocumentRecord,
  Id,
  Sequence,
} from "@cuccut/protocol";
import { MousePointerClick, Settings2 } from "lucide-react";
import { IntoSessionSlot } from "../../cc/components/session-slots.tsx";
import { Button } from "../../cc/ui/button.tsx";
import { useEditor } from "../../state/editor-store.ts";
import { Inspector } from "./inspector.tsx";
import { openVideoSettings } from "./video-settings.tsx";
import { EDITOR_LAYOUT_COPY as L } from "./editor-layout-copy.ts";

/**
 * The selection inspector (agentcut's right column): in a session it goes under the chat (the `inspector` slot); anywhere
 * else it is a column of the pane. It is about the selection and nothing else — with nothing picked it says so and points
 * at Video settings, where the video as a whole is edited.
 */
export function InspectorColumn({
  sequence,
  assets,
  documents,
  active,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  active: boolean;
}) {
  const itemIds = useMemo(
    () => new Set(sequence.items.map((item) => item.id)),
    [sequence],
  );
  // Only ids that are on this sequence count: a selection left over from an edit that removed its clips is nothing picked.
  const picked = useEditor((s) => s.selection.some((id) => itemIds.has(id)));
  if (!active) return null;
  const content = picked ? (
    <section
      aria-label={L.inspector}
      data-inspector
      data-editor-scope
      className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10"
    >
      <Inspector sequence={sequence} assets={assets} documents={documents} />
    </section>
  ) : (
    <NothingPicked />
  );
  return (
    <IntoSessionSlot
      name="inspector"
      fallback={
        <aside
          aria-label={L.inspector}
          className="flex min-h-0 w-[300px] shrink-0 flex-col"
        >
          {content}
        </aside>
      }
    >
      {content}
    </IntoSessionSlot>
  );
}

/** agentcut's dashed hint for an empty selection. */
function NothingPicked() {
  return (
    <div
      data-cc
      className="shrink-0 rounded-3xl border border-dashed border-white/15 p-4 text-xs leading-relaxed text-muted-foreground"
    >
      <MousePointerClick aria-hidden className="mb-3 size-4" />
      <p>{L.nothingPicked}</p>
      <p className="mt-2">{L.videoWhole}</p>
      <Button
        variant="outline"
        size="xs"
        className="mt-3"
        onClick={openVideoSettings}
      >
        <Settings2 />
        {L.videoSettings}
      </Button>
    </div>
  );
}
