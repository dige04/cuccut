import {
  framesToSeconds,
  localizeText,
  mediaTimeToSeconds,
  type AssetRecord,
  type DocumentRecord,
  type Id,
  type Sequence,
  type SequenceItem,
  type TimeQuantizationReceipt,
  type TransactionReceipt,
} from "@cuccut/protocol";
import { EditLabel } from "@cuccut/protocol/messages/ui";
import { useState, type ComponentType } from "react";
import {
  ActionButton,
  Button,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import AlignBottom from "@react-spectrum/s2/icons/AlignBottom";
import AlignCenter from "@react-spectrum/s2/icons/AlignCenter";
import AlignLeft from "@react-spectrum/s2/icons/AlignLeft";
import AlignMiddle from "@react-spectrum/s2/icons/AlignMiddle";
import AlignRight from "@react-spectrum/s2/icons/AlignRight";
import AlignTop from "@react-spectrum/s2/icons/AlignTop";
import Delete from "@react-spectrum/s2/icons/Delete";
import DistributeSpaceHorizontally from "@react-spectrum/s2/icons/DistributeSpaceHorizontally";
import DistributeSpaceVertically from "@react-spectrum/s2/icons/DistributeSpaceVertically";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { STAGE_TOOLBAR_COPY as MULTI } from "../../copy.ts";
import { formatFps, formatSeconds, itemLabel } from "../../model/editor.ts";
import {
  alignOperations,
  distributeOperations,
  type AlignEdge,
  type AlignTarget,
  type Axis,
} from "../../model/stage-align.ts";
import { isMainVideo } from "../../model/stage-hit.ts";
import { isPlaced, type PlacedItem } from "../../model/stage-pose.ts";
import { useEditor } from "../../state/editor-store.ts";
import { canEdit, useVideo } from "../../state/video-store.ts";
import { useEditorActions } from "./editor-context.tsx";
import { CaptionPage } from "./inspector-caption.tsx";
import {
  DangerButton,
  Note,
  PRow,
  Sec,
  SecHead,
  Seg,
} from "./inspector-controls.tsx";
import {
  CompositionPage,
  ConfettiPage,
  OtherElementPage,
  ProgressPage,
  ShapePage,
  StickerPage,
  TextPage,
  VisualizerPage,
  elementTitle,
} from "./inspector-elements.tsx";
import { GeometrySection } from "./inspector-geometry.tsx";
import { AudioPage, ImagePage, VideoItemPage } from "./inspector-media.tsx";
import { LockNotice } from "./inspector-sections.tsx";
import { PanelHead, panelBody } from "./panel-head.tsx";
import {
  applyArrangement,
  copySelection,
  deleteSelection,
  duplicateSelection,
} from "./timeline-commands.ts";
import { useItemEdit } from "./use-item-edit.ts";
import { INSPECTOR_COPY as IC } from "./inspector-copy.ts";
import { EDITOR_LAYOUT_COPY as L } from "./editor-layout-copy.ts";

const panel = style({ display: "flex", flexDirection: "column", gap: 8 });
const sub = style({
  font: "ui-sm",
  color: "gray-600",
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const card = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 16,
  padding: 12,
  borderRadius: "lg",
  backgroundColor: "gray-75",
  font: "ui-sm",
});
const cardHead = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
});
const muted = style({ font: "ui-xs", color: "gray-600" });
const delta = style({
  color: { default: "gray-700", isShifted: "orange-900" },
});

/** Page title (prototype panel-*.jsx). */
function pageTitle(item: SequenceItem): string {
  switch (item.type) {
    case "video":
      return IC.pageVideo;
    case "image":
      return IC.pageImage;
    case "audio":
      return IC.pageAudio;
    case "shape":
      return IC.shape;
    case "caption":
      return IC.pageCaption;
    default:
      return elementTitle(item);
  }
}

/**
 * Properties panel (product design §5.1, §5.8): when a clip is selected, it offers everything editable for that clip type (content → appearance → geometry → timing → delete);
 * the bottom of the panel is the receipt for the last change. Only mounted with something picked (inspector-column.tsx); the video as a whole is in Video settings. Values being dragged are overlaid on the preview only; they are committed on release (see use-item-edit).
 */
export function Inspector({
  sequence,
  assets,
  documents,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
}) {
  const selection = useEditor((s) => s.selection);
  const receipt = useVideo((s) => s.video?.lastReceipt ?? null);
  const selected = sequence.items.filter((item) => selection.includes(item.id));
  const single = selected.length === 1 ? selected[0]! : null;
  const title = single
    ? pageTitle(single)
    : selected.length > 1
      ? IC.selectedClips(selected.length)
      : IC.videoProperties;
  return (
    <>
      <PanelHead
        title={title}
        back={
          selected.length
            ? {
                label: L.clearSelection,
                onPress: () => useEditor.getState().select([]),
              }
            : undefined
        }
      />
      <div className={`${panelBody} cc-scroll`}>
        <div className={panel}>
          {single ? (
            <ItemPage
              key={single.id}
              item={single}
              sequence={sequence}
              assets={assets}
              documents={documents}
            />
          ) : selected.length > 1 ? (
            <Multiple
              items={selected}
              sequence={sequence}
              assets={assets}
              documents={documents}
            />
          ) : null}
          {receipt ? (
            <ReceiptCard receipt={receipt} sequence={sequence} />
          ) : null}
        </div>
      </div>
    </>
  );
}

/** Selected clip: name and lock hint, then the page for this kind of clip. */
function ItemPage({
  item,
  sequence,
  assets,
  documents,
}: {
  item: SequenceItem;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
}) {
  const editable = useVideo((s) => canEdit(s.video));
  const edit = useItemEdit(sequence, item);
  const track = sequence.tracks.find((t) => t.id === item.trackId);
  const canChange = editable && !item.locked && !track?.locked;
  const name = itemLabel(item, assets, documents);
  const props = { sequence, assets, edit, canChange };
  return (
    <>
      <p className={sub} title={name}>
        {name}
      </p>
      <LockNotice
        item={item}
        sequence={sequence}
        edit={edit}
        editable={editable}
      />
      {item.type === "video" ? (
        <VideoItemPage item={item} {...props} />
      ) : item.type === "image" ? (
        <ImagePage item={item} {...props} />
      ) : item.type === "audio" ? (
        <AudioPage item={item} {...props} />
      ) : item.type === "text" ? (
        <TextPage item={item} {...props} />
      ) : item.type === "shape" ? (
        <ShapePage item={item} {...props} />
      ) : item.type === "composition" ? (
        <CompositionPage item={item} {...props} />
      ) : item.type === "sticker" ? (
        <StickerPage item={item} {...props} />
      ) : item.type === "progress" ? (
        <ProgressPage item={item} {...props} />
      ) : item.type === "visualizer" ? (
        <VisualizerPage item={item} {...props} />
      ) : item.type === "confetti" ? (
        <ConfettiPage item={item} {...props} />
      ) : item.type === "caption" ? (
        <CaptionPage item={item} documents={documents} {...props} />
      ) : (
        <OtherElementPage item={item} {...props} />
      )}
    </>
  );
}

const ALIGN_EDGES: { edge: AlignEdge; label: string; Icon: ComponentType }[] = [
  { edge: "left", label: MULTI.alignLeft, Icon: AlignLeft },
  { edge: "hcenter", label: MULTI.alignHCenter, Icon: AlignCenter },
  { edge: "right", label: MULTI.alignRight, Icon: AlignRight },
  { edge: "top", label: MULTI.alignTop, Icon: AlignTop },
  { edge: "vcenter", label: MULTI.alignVCenter, Icon: AlignMiddle },
  { edge: "bottom", label: MULTI.alignBottom, Icon: AlignBottom },
];
const DISTRIBUTE: { axis: Axis; label: string; Icon: ComponentType }[] = [
  { axis: "x", label: MULTI.distributeX, Icon: DistributeSpaceHorizontally },
  { axis: "y", label: MULTI.distributeY, Icon: DistributeSpaceVertically },
];
const TARGETS: readonly { key: AlignTarget; label: string }[] = [
  { key: "selection", label: MULTI.toSelection },
  { key: "canvas", label: MULTI.toCanvas },
];
const toolRow = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
});
const pair = style({
  display: "grid",
  gridTemplateColumns: ["1fr", "1fr"],
  gap: 8,
});
const fill = style({ width: "full" });

/**
 * Multi-select panel (MultiSelectPanel in prototype panel-elements.jsx): only does what holds for every item: align, distribute, duplicate, delete.
 * Alignment and distribution use each item's rotated bounding box (model/stage-align), relative to the selection or the whole canvas; a whole batch is one transaction and one undo step;
 * the main video, audio, subtitles and locked clips are excluded. The geometry section is read-only and shows the first item.
 */
function Multiple({
  items,
  sequence,
  assets,
  documents,
}: {
  items: SequenceItem[];
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
}) {
  const actions = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const [relative, setRelative] = useState<AlignTarget>("selection");
  const locked = (item: SequenceItem) =>
    item.locked || !!sequence.tracks.find((t) => t.id === item.trackId)?.locked;
  const placed = items
    .filter(isPlaced)
    .filter((item) => !isMainVideo(item, sequence));
  const movable = placed.filter((item) => !locked(item));
  const skipped = items.length - movable.length;
  const first = placed[0];
  const canAlign =
    editable &&
    (relative === "canvas" ? movable.length >= 1 : movable.length >= 2);
  const canDistribute = editable && movable.length >= 3;
  const align = (edge: AlignEdge) =>
    void applyArrangement(
      actions,
      alignOperations(
        sequence.id,
        movable,
        edge,
        relative,
        sequence.canvas,
        assets,
      ),
      EditLabel.alignClips(),
      MULTI.aligned(movable.length),
      MULTI.inPlace,
    );
  const distribute = (axis: Axis) =>
    void applyArrangement(
      actions,
      distributeOperations(
        sequence.id,
        movable,
        axis,
        relative,
        sequence.canvas,
        assets,
      ),
      EditLabel.distributeClips(),
      MULTI.distributed(movable.length),
      MULTI.inPlace,
    );
  return (
    <>
      {first ? (
        <FirstGeometry
          item={first}
          sequence={sequence}
          assets={assets}
          name={itemLabel(first, assets, documents)}
        />
      ) : null}
      <SecHead first={!first}>{MULTI.align}</SecHead>
      <Sec>
        <PRow label={MULTI.alignTo}>
          <Seg<AlignTarget>
            label={MULTI.alignTo}
            value={relative}
            options={TARGETS}
            isDisabled={!editable}
            onChange={setRelative}
          />
        </PRow>
        <div className={toolRow}>
          {ALIGN_EDGES.map(({ edge, label, Icon }) => (
            <TooltipTrigger key={edge}>
              <ActionButton
                size="S"
                aria-label={label}
                isDisabled={!canAlign}
                onPress={() => align(edge)}
              >
                <Icon />
              </ActionButton>
              <Tooltip>{label}</Tooltip>
            </TooltipTrigger>
          ))}
        </div>
        {canAlign || !editable ? null : <Note>{MULTI.alignNeed}</Note>}
      </Sec>
      <SecHead>{MULTI.distribute}</SecHead>
      <Sec>
        <div className={toolRow}>
          {DISTRIBUTE.map(({ axis, label, Icon }) => (
            <ActionButton
              key={axis}
              size="S"
              isDisabled={!canDistribute}
              onPress={() => distribute(axis)}
            >
              <Icon />
              <Text>{label}</Text>
            </ActionButton>
          ))}
        </div>
        {canDistribute || !editable ? null : (
          <Note>{MULTI.distributeNeed}</Note>
        )}
      </Sec>
      {skipped > 0 ? <Note>{MULTI.skipped(skipped)}</Note> : null}
      <div className={pair}>
        <Button
          variant="secondary"
          size="S"
          styles={fill}
          isDisabled={!editable}
          onPress={() => void duplicateSelection(actions)}
        >
          {MULTI.duplicate}
        </Button>
        <Button
          variant="secondary"
          size="S"
          styles={fill}
          onPress={() => copySelection()}
        >
          {MULTI.copy}
        </Button>
      </div>
      <DangerButton
        isDisabled={!editable}
        onPress={() => void deleteSelection(actions)}
      >
        <Delete />
        <Text>{MULTI.removeAll(items.length)}</Text>
      </DangerButton>
      <Note>{MULTI.dragNote}</Note>
      <Note>{MULTI.hint}</Note>
    </>
  );
}

/** Geometry section when multiple items are selected: read-only, shows the first item (the prototype MultiSelectPanel does the same; multi-select does not do batch numeric editing). */
function FirstGeometry({
  item,
  sequence,
  assets,
  name,
}: {
  item: PlacedItem;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  name: string;
}) {
  const edit = useItemEdit(sequence, item);
  return (
    <>
      <GeometrySection
        item={item}
        sequence={sequence}
        assets={assets}
        edit={edit}
        isDisabled
      />
      <Note>{MULTI.firstGeometry(name)}</Note>
    </>
  );
}

function ReceiptCard({
  receipt,
  sequence,
}: {
  receipt: TransactionReceipt;
  sequence: Sequence;
}) {
  const changed = [
    receipt.createdIds.length ? IC.created(receipt.createdIds.length) : null,
    receipt.updatedIds.length ? IC.updated(receipt.updatedIds.length) : null,
    receipt.deletedIds.length ? IC.deleted(receipt.deletedIds.length) : null,
  ].filter((part): part is string => part !== null);
  const { oldDurationFrames, newDurationFrames } = receipt.impact;
  return (
    <section className={card} aria-label={IC.lastChange}>
      <div className={cardHead}>
        <strong>
          {IC.lastChangeLabel(localizeText(receipt.label, receipt.labelRef))}
        </strong>
        <span className={muted}>
          {IC.revisionChange(receipt.previousRevision, receipt.videoRevision)}
        </span>
      </div>
      {changed.length ? <span>{IC.changedObjects(changed)}</span> : null}
      {oldDurationFrames !== newDurationFrames ? (
        <span>
          {IC.durationChange(
            formatSeconds(framesToSeconds(oldDurationFrames, sequence.fps)),
            formatSeconds(framesToSeconds(newDurationFrames, sequence.fps)),
          )}
        </span>
      ) : null}
      {receipt.timeResolution.map((resolution, index) => (
        <TimeResolution key={index} resolution={resolution} />
      ))}
      <span className={muted}>
        {receipt.undo.available
          ? IC.undoAvailable
          : IC.undoUnavailable(
              localizeText(
                receipt.undo.unavailableReason,
                receipt.undo.unavailableReasonRef,
              ) ?? IC.unknownReason,
            )}
      </span>
    </section>
  );
}

/** Requested time vs. actual landing point (product design §5.8): seeing “10.000 s” should not hide that it actually lands at 10.010 s. */
function TimeResolution({
  resolution,
}: {
  resolution: TimeQuantizationReceipt;
}) {
  const requested =
    resolution.requested.unit === "seconds"
      ? IC.requestedSeconds(resolution.requested.value)
      : IC.requestedFrame(resolution.requested.value);
  const actual = mediaTimeToSeconds(resolution.actualTime);
  const shift = mediaTimeToSeconds(resolution.delta);
  const shifted = Math.abs(shift) > 1e-9;
  return (
    <span className={delta({ isShifted: shifted })}>
      {IC.resolution(
        requested,
        formatSeconds(actual),
        resolution.actualFrame,
        formatFps(resolution.editFps),
      )}
      {shifted
        ? IC.shiftMs(`${shift > 0 ? "+" : ""}${(shift * 1000).toFixed(1)}`)
        : ""}
    </span>
  );
}
