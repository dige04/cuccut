import { useRef, useState } from "react";
import type { Sequence } from "@cuccut/protocol";
import {
  Button,
  Text,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import Add from "@react-spectrum/s2/icons/Add";
import ChevronRight from "@react-spectrum/s2/icons/ChevronRight";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Button as RACButton } from "react-aria-components";
import { frameAt } from "../../model/editor.ts";
import { spanAtPlayhead } from "../../model/new-items.ts";
import {
  BLANK_TEXT_SECONDS,
  PEEK,
  TEXT_CATEGORIES,
  blankTextLayer,
  preferredLayer,
  presetLayers,
  presetsOf,
  type MeasureText,
  type TextCategory,
  type TextPreset,
} from "../../model/text-presets.ts";
import { useEditor } from "../../state/editor-store.ts";
import { canEdit, useVideo } from "../../state/video-store.ts";
import { PresetThumb } from "./element-thumb.tsx";
import { SecHead } from "./inspector-controls.tsx";
import { PanelChips, PanelHead, panelBody } from "./panel-head.tsx";
import { withTextMeasure } from "./text-measure.ts";
import { useInsertVisual, type InsertRequest } from "./use-insert-visual.ts";
import { ELEMENTS_COPY as EL } from "./elements-copy.ts";

/** Six-column grid: font-style cards span three columns (two per row), scene cards span two columns (three per row). */
const grid = style({
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 8,
});
const card = style({
  position: "relative",
  display: "block",
  gridColumnEnd: { default: "span 3", isScene: "span 2" },
  padding: 0,
  borderWidth: 0,
  borderRadius: "lg",
  overflow: "hidden",
  cursor: { default: "pointer", isDisabled: "default" },
  opacity: { default: 1, isDisabled: 0.5 },
  outlineStyle: { default: "none", isFocusVisible: "solid" },
  outlineColor: "focus-ring",
  outlineWidth: 2,
  transform: { default: "none", isPressed: "scale(0.97)" },
  transition: "default",
});
const face = style({
  display: "block",
  width: "full",
  height: { default: 78, isScene: "auto" },
  aspectRatio: { isScene: "[16 / 9]" },
});
/** The card shows what the exported picture looks like: a dark gradient background (prototype .tpm). */
const FACE_BACKGROUND = "linear-gradient(135deg, #3B4252 0%, #1F2430 100%)";
const badge = style({
  position: "absolute",
  top: 4,
  insetEnd: 4,
  paddingX: 4,
  borderRadius: "sm",
  backgroundColor: "gray-25",
  color: "gray-800",
  fontSize: "[10px]",
  lineHeight: "[14px]",
  fontWeight: "bold",
});
const viewAll = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: 0,
  borderWidth: 0,
  backgroundColor: "transparent",
  font: "ui-xs",
  color: "blue-1000",
  cursor: "pointer",
  "--iconPrimary": { type: "fill", value: "currentColor" },
});
const addRow = style({
  display: "flex",
  flexDirection: "column",
  marginBottom: 4,
});

/** A preset's name in the notice: use its first text item. */
function presetName(preset: TextPreset): string {
  const text = preset.layers.find((layer) => layer.kind === "text")?.text ?? "";
  const line = text.split("\n")[0]!.trim();
  return line.length > 12 ? `${line.slice(0, 12)}…` : line || EL.text;
}

/** Create a set of texts of `seconds` at the playhead as it is at the moment of the press. */
function useTextCreate(sequence: Sequence) {
  const insert = useInsertVisual();
  const latest = useRef(sequence);
  latest.current = sequence;
  return async (
    seconds: number,
    build: (
      current: Sequence,
      measure: MeasureText,
    ) => Omit<InsertRequest, "span">,
  ) => {
    const playhead = useEditor.getState().playhead;
    let made: { current: Sequence; request: Omit<InsertRequest, "span"> };
    try {
      made = await withTextMeasure((measureOn) => {
        const current = latest.current;
        return { current, request: build(current, measureOn(current.canvas)) };
      });
    } catch (error) {
      ToastQueue.negative(EL.addTextFailed((error as Error).message), {
        timeout: 5000,
      });
      return;
    }
    const { current, request } = made;
    await insert(current, {
      span: spanAtPlayhead(current, frameAt(playhead, current.fps), seconds),
      ...request,
    });
  };
}

type TextCreate = ReturnType<typeof useTextCreate>;

/** A blank text box at the playhead through `create`: shared by the panel's "Add text box" and `useAddTextBox`. */
function addTextBox(create: TextCreate): void {
  void create(BLANK_TEXT_SECONDS, (current, measure) => ({
    layers: [blankTextLayer(current.canvas, measure)],
    label: EL.textBox,
    trackName: EL.text,
  }));
}

/** A blank text box at the playhead: the timeline card's Add · Text. */
export function useAddTextBox(sequence: Sequence): () => void {
  const create = useTextCreate(sequence);
  return () => addTextBox(create);
}

/**
 * Text panel (prototype §13.5, 51 presets): “添加文本框” (add text box) adds four categories of presets; “全部” (all) shows only the first few cells of each category.
 * Clicking a cell creates this group of text at the playhead (multi-layer text appears staggered) and selects the first text item. The box is measured by the render kernel: if the kernel has not loaded yet or is reloading, wait for it,
 * then create using the sequence as it is at that point (the sequence may have changed while waiting); if the kernel fails to load, show a notice and create nothing.
 */
export function TextPanel({ sequence }: { sequence: Sequence }) {
  const [category, setCategory] = useState<TextCategory>("all");
  const editable = useVideo((s) => canEdit(s.video));
  const create = useTextCreate(sequence);
  const addBlank = () => addTextBox(create);
  const sections = TEXT_CATEGORIES.filter(
    (c) => c.key !== "all" && (category === "all" || c.key === category),
  ) as {
    key: Exclude<TextCategory, "all">;
    label: string;
  }[];

  const addPreset = (preset: TextPreset) =>
    void create(preset.duration, (current, measure) => ({
      layers: presetLayers(preset, current.canvas, current.fps, measure),
      label: EL.textPresetLabel(presetName(preset)),
      trackName: EL.text,
      selectLayer: preferredLayer(preset),
    }));

  return (
    <>
      <PanelHead title={EL.text} />
      <PanelChips<TextCategory>
        label={EL.textCategories}
        items={TEXT_CATEGORIES}
        value={category}
        onChange={setCategory}
      />
      <div className={`${panelBody} cc-scroll`}>
        {category === "all" ? (
          <div className={addRow}>
            <Button
              variant="secondary"
              isDisabled={!editable}
              onPress={addBlank}
            >
              <Add />
              <Text>{EL.addTextBox}</Text>
            </Button>
          </div>
        ) : null}
        {sections.map((section, index) => {
          const all = presetsOf(section.key);
          const list = category === "all" ? all.slice(0, PEEK) : all;
          return (
            <div key={section.key}>
              <SecHead
                first={index === 0 && category !== "all"}
                aside={EL.presetCount(all.length)}
                action={
                  category === "all" && all.length > PEEK ? (
                    <RACButton
                      className={viewAll}
                      onPress={() => setCategory(section.key)}
                    >
                      {EL.viewAll}
                      <ChevronRight />
                    </RACButton>
                  ) : null
                }
              >
                {section.label}
              </SecHead>
              <div className={grid}>
                {list.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    sequence={sequence}
                    editable={editable}
                    onAdd={() => addPreset(preset)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PresetCard({
  preset,
  sequence,
  editable,
  onAdd,
}: {
  preset: TextPreset;
  sequence: Sequence;
  editable: boolean;
  onAdd(): void;
}) {
  const isScene = preset.layout === "scene";
  const members = preset.layers.length;
  return (
    <TooltipTrigger delay={600}>
      <RACButton
        className={(state) => card({ ...state, isScene })}
        aria-label={EL.addPreset(presetName(preset))}
        isDisabled={!editable}
        onPress={onAdd}
      >
        <span
          className={face({ isScene })}
          style={{ background: FACE_BACKGROUND }}
        >
          <PresetThumb preset={preset} fps={sequence.fps} />
        </span>
        {members > 1 ? (
          <span className={badge}>{EL.layers(members)}</span>
        ) : null}
      </RACButton>
      <Tooltip>
        {members > 1
          ? EL.layersInTurn(presetName(preset), members)
          : presetName(preset)}
      </Tooltip>
    </TooltipTrigger>
  );
}
