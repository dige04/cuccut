import type { RefObject } from 'react';
import type { AssetRecord, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { Captions, ImagePlus, Music2, Shapes, Type, type LucideIcon } from 'lucide-react';
import { Button } from '../../cc/ui/button.tsx';
import { useEditor, type PanelTab } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { useAddTextBox } from './text-panel.tsx';
import { Timeline, type TimelineHandle } from './timeline.tsx';
import { Transport } from './transport.tsx';
import { EDITOR_LAYOUT_COPY as L } from './editor-layout-copy.ts';

/**
 * The timeline in agentcut's solid card: the transport head, the tracks in a recessed well (they keep their own scroll),
 * and the row of things a video can be given, which land at the playhead. Text is added right away; the others open the
 * panel that holds them (the asset card on the left), where a pick is placed explicitly.
 */
export function TimelineCard({
  videoId,
  sequence,
  assets,
  documents,
  height,
  handle,
}: {
  videoId: Id | null;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  height: number;
  handle: RefObject<TimelineHandle | null>;
}) {
  return (
    <section aria-label={L.timeline} className="flex min-h-0 min-w-0 shrink-0 flex-col gap-2 rounded-3xl bg-card px-3 pt-2 pb-3 ring-1 ring-foreground/10">
      <Transport sequence={sequence} assets={assets} onZoom={(action) => handle.current?.zoom(action)} />
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl">
        <Timeline videoId={videoId} sequence={sequence} assets={assets} documents={documents} height={height} handle={handle} />
      </div>
      <AddRow sequence={sequence} />
    </section>
  );
}

const PANELS: { tab: PanelTab; label: () => string; tip: () => string; Icon: LucideIcon }[] = [
  { tab: 'image', label: () => L.addImage, tip: () => L.addImageTip, Icon: ImagePlus },
  { tab: 'audio', label: () => L.addMusic, tip: () => L.addMusicTip, Icon: Music2 },
  { tab: 'elements', label: () => L.addElement, tip: () => L.addElementTip, Icon: Shapes },
  { tab: 'subtitle', label: () => L.addCaptions, tip: () => L.addCaptionsTip, Icon: Captions },
];

/** agentcut's "Add: Text · Image · Music · Blank scene" row, mapped onto CucCut's own ways of adding. */
function AddRow({ sequence }: { sequence: Sequence }) {
  const editable = useVideo((s) => canEdit(s.video));
  const addText = useAddTextBox(sequence);
  return (
    <div data-cc className="@container flex flex-wrap items-center gap-x-3 gap-y-2">
      <div role="group" aria-label={L.add} className="flex flex-wrap items-center gap-1.5">
        <span aria-hidden className="pe-0.5 text-[11px] font-medium text-muted-foreground">
          {L.add}
        </span>
        <Button size="xs" variant="outline" disabled={!editable} title={editable ? L.addTextTip : L.readOnlyAdd} onClick={addText}>
          <Type />
          {L.addText}
        </Button>
        {PANELS.map(({ tab, label, tip, Icon }) => (
          <Button key={tab} size="xs" variant="outline" title={tip()} onClick={() => useEditor.getState().showPanel(tab)}>
            <Icon />
            {label()}
          </Button>
        ))}
      </div>
      <p className="ms-auto hidden truncate text-[11px] text-muted-foreground @min-[56rem]:block">{L.timelineHint}</p>
    </div>
  );
}
