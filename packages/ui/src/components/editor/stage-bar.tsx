import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import type { AssetRecord, Id, Localized, Sequence } from "@cuccut/protocol";
import { EditLabel } from "@cuccut/protocol/messages/ui";
import {
  ActionButton,
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  DialogTrigger,
  Form,
  Heading,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  NumberField,
  Popover,
  Text,
  ToastQueue,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import AspectRatio from "@react-spectrum/s2/icons/AspectRatio";
import CloseCaptions from "@react-spectrum/s2/icons/CloseCaptions";
import SpeedFast from "@react-spectrum/s2/icons/SpeedFast";
import VolumeOff from "@react-spectrum/s2/icons/VolumeOff";
import VolumeOne from "@react-spectrum/s2/icons/VolumeOne";
import VolumeTwo from "@react-spectrum/s2/icons/VolumeTwo";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useLocale } from "react-aria/I18nProvider";
import { Slider, SliderThumb, SliderTrack } from "react-aria-components/Slider";
import {
  TooltipContext,
  TooltipTriggerStateContext,
} from "react-aria-components/Tooltip";
import {
  monitorGain,
  monitorLevel,
  toggleMute,
  type MonitorLevel,
} from "../../model/preview-volume.ts";
import {
  CANVAS_SIDE_MAX,
  ORIGINAL_RATIO,
  STAGE_RATIOS,
  customRatio,
  isPortrait,
  ratioText,
  safeBox,
  safeZones,
  sourceSize,
  stageRatioCanvas,
  stageRatioOf,
} from "../../model/stage-bar.ts";
import { useEditor } from "../../state/editor-store.ts";
import { PLAYBACK_RATES } from "../../state/player-store.ts";
import { canEdit, useVideo } from "../../state/video-store.ts";
import { P } from "../player/player-copy.ts";
import { S as SHELL } from "../shell-copy.ts";
import { useEditorActions } from "./editor-context.tsx";
import { FULLSCREEN_PLAYER_COPY as F } from "./fullscreen-player-copy.ts";
import { STAGE_BAR_COPY as S } from "./stage-bar-copy.ts";
import "./editor.css";

/*
 * The preview's viewing controls (prototype stage.jsx `StageBar`): they now sit in the timeline card's head (transport.tsx),
 * with the ones that do not fit in its overflow popover.
 *
 * - Ratio changes the video's canvas (`updateSequence`, short side kept, one undo step, the same change as Video settings);
 *   read-only videos grey it out. Under the list are "Custom…" and the portrait-only "Platform safe area". Safe area, rate
 *   and caption visibility are this window's viewing state (editor-store): not in the video, not in undo, not in exports.
 * - Volume is only the monitor volume (shared with ↑/↓, M and the fullscreen player), not the source.
 * - Rate is shared with the fullscreen player.
 */

/**
 * The platform safe area on a portrait canvas (prototype stage.jsx `SafeAreaOverlay`): three diagonally striped obscured areas, each with a label, and a dashed frame in the middle.
 * Drawn over the picture and does not capture the pointer. It is drawn only on the stage (fullscreen shows the clean final look).
 */
export function SafeAreaOverlay() {
  const pct = (r: { x: number; y: number; w: number; h: number }) => ({
    left: `${r.x}%`,
    top: `${r.y}%`,
    width: `${r.w}%`,
    height: `${r.h}%`,
  });
  return (
    <div className="cc-safearea" aria-hidden>
      {safeZones().map((zone) => (
        <div
          key={zone.key}
          className={`cc-safearea-zone cc-safearea-zone--${zone.key}`}
          style={pct(zone)}
        >
          <span className="cc-safearea-tag">{S.safeZones[zone.key]}</span>
        </div>
      ))}
      <div className="cc-safearea-box" style={pct(safeBox())} />
    </div>
  );
}

const chipText = style({ font: "ui-sm", whiteSpace: "nowrap" });
const volumeRow = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: 240,
});
// The slider is drawn like the media player's volume bar (media-player.tsx). S2's Slider always places a readout above the bar, but here the readout only appears in the hover tooltip.
const volumeSlider = style({ flexGrow: 1, minWidth: 0, paddingEnd: 8 });
const volumeTrack = style({
  position: "relative",
  height: 20,
  width: "full",
  cursor: "default",
});
const volumeRail = style({
  position: "absolute",
  insetX: 0,
  top: 8,
  height: 4,
  borderRadius: "full",
  backgroundColor: "gray-300",
});
const volumeFill = style({
  position: "absolute",
  insetStart: 0,
  top: 8,
  height: 4,
  borderRadius: "full",
  backgroundColor: "accent",
});
// react-aria gives the thumb translate(-50%, -50%): the top edge is placed on the bar's vertical midline, so the thumb sits exactly centered on the thin track.
const volumeThumb = style({
  top: "[50%]",
  size: 14,
  borderRadius: "full",
  backgroundColor: "white",
  borderWidth: 2,
  borderStyle: "solid",
  borderColor: "gray-800",
  boxShadow: "elevated",
  outlineStyle: { default: "none", isFocusVisible: "solid" },
  outlineColor: "focus-ring",
  outlineWidth: 2,
  outlineOffset: 2,
});
const customRow = style({ display: "flex", alignItems: "end", gap: 8 });
const customField = style({ width: 112 });
const colon = style({ font: "ui", color: "gray-700", paddingBottom: 8 });
const customNote = style({
  font: "ui-sm",
  color: { default: "gray-700", isInvalid: "negative" },
  marginTop: 12,
  marginBottom: 0,
});

// ---- Aspect ratio ----

export function RatioPicker({
  sequence,
  assets,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
}) {
  const { apply } = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const safeArea = useEditor((s) => s.safeArea);
  const setSafeArea = useEditor((s) => s.setSafeArea);
  const [custom, setCustom] = useState(false);
  const canvas = sequence.canvas;
  const original = useMemo(
    () => sourceSize(sequence, assets),
    [sequence, assets],
  );
  const current = stageRatioOf(canvas, original);
  const text = ratioText(canvas);
  const portrait = isPortrait(canvas);

  const change = (
    next: { width: number; height: number },
    ratio: string | Localized,
  ) =>
    apply(
      [{ type: "updateSequence", sequenceId: sequence.id, canvas: next }],
      EditLabel.aspectRatio({ ratio }),
    );
  const run = (key: string) => {
    if (key === "custom") return setCustom(true);
    if (key === "safe") return setSafeArea(!safeArea);
    const next = stageRatioCanvas(canvas, key, original);
    if (!next || (next.width === canvas.width && next.height === canvas.height))
      return;
    void change(next, key === ORIGINAL_RATIO ? EditLabel.originalRatio() : key);
  };
  const ratioKeys = [ORIGINAL_RATIO, ...STAGE_RATIOS.map((r) => r.key)];
  const disabled = [
    ...(editable ? [] : [...ratioKeys, "custom"]),
    ...(original ? [] : [ORIGINAL_RATIO]),
    ...(portrait ? [] : ["safe"]),
  ];
  const tip = editable ? S.ratio : S.ratioReadOnly;

  return (
    <>
      <MenuTrigger align="start" direction="top">
        <Tip label={tip}>
          <ActionButton size="S" isQuiet aria-label={`${S.ratio} ${text}`}>
            <AspectRatio />
            <Text UNSAFE_className="cc-tabular" styles={chipText}>
              {text}
            </Text>
          </ActionButton>
        </Tip>
        <Menu
          aria-label={S.ratio}
          disabledKeys={disabled}
          onAction={(key) => run(String(key))}
        >
          <MenuSection
            aria-label={S.ratio}
            selectionMode="single"
            selectedKeys={current ? [current] : []}
          >
            <MenuItem id={ORIGINAL_RATIO} textValue={S.original}>
              <Text slot="label">{S.original}</Text>
              <Text slot="description">
                {original
                  ? S.originalHint(ratioText(original))
                  : S.originalNone}
              </Text>
            </MenuItem>
            {STAGE_RATIOS.map((r) => (
              <MenuItem key={r.key} id={r.key} textValue={r.key}>
                <Text slot="label" UNSAFE_className="cc-tabular">
                  {r.key}
                </Text>
              </MenuItem>
            ))}
          </MenuSection>
          <MenuSection aria-label={S.custom}>
            <MenuItem id="custom" textValue={S.custom}>
              {S.custom}
            </MenuItem>
          </MenuSection>
          {/* Platform safe area: only clickable for portrait. The toggle is not stored in the document and not in undo history. */}
          <MenuSection
            aria-label={S.safeArea}
            selectionMode="multiple"
            selectedKeys={portrait && safeArea ? ["safe"] : []}
          >
            <MenuItem id="safe" textValue={S.safeArea}>
              <Text slot="label">{S.safeArea}</Text>
              <Text slot="description">
                {portrait ? S.safeAreaHint : S.safeAreaPortraitOnly}
              </Text>
            </MenuItem>
          </MenuSection>
        </Menu>
      </MenuTrigger>
      {custom ? (
        <CustomRatioDialog
          canvas={canvas}
          onApply={async (next, label) => {
            if (!(await change(next, label))) return false;
            ToastQueue.neutral(S.ratioApplied(label), { timeout: 3000 });
            return true;
          }}
          onClose={() => setCustom(false)}
        />
      ) : null}
    </>
  );
}

/** Custom aspect ratio (prototype “custom…”): two numbers. The short side stays the same and the resulting size is written below first; apply is blocked when the long side exceeds the engine's limit. */
function CustomRatioDialog({
  canvas,
  onApply,
  onClose,
}: {
  canvas: { width: number; height: number };
  onApply(
    next: { width: number; height: number },
    label: string,
  ): Promise<boolean>;
  onClose(): void;
}) {
  // State lives in the outer dialog wrapper: S2's Dialog renders children once in each of several slots.
  const [w, setW] = useState(21);
  const [h, setH] = useState(9);
  const [busy, setBusy] = useState(false);
  const result = customRatio(canvas, w, h);
  const label = result.ok ? ratioText(result.canvas) : "";
  const submit = async () => {
    if (!result.ok || busy) return;
    setBusy(true);
    try {
      if (await onApply(result.canvas, label)) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="S">
        {({ close }) => (
          <>
            <Heading slot="title">{S.customTitle}</Heading>
            <Content>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <div className={customRow}>
                  <NumberField
                    label={S.customWidth}
                    value={w}
                    onChange={setW}
                    minValue={0}
                    styles={customField}
                    autoFocus
                  />
                  <span className={colon}>:</span>
                  <NumberField
                    label={S.customHeight}
                    value={h}
                    onChange={setH}
                    minValue={0}
                    styles={customField}
                  />
                </div>
              </Form>
              <p
                className={customNote({ isInvalid: !result.ok })}
                role="status"
              >
                {result.ok
                  ? S.customSize(result.canvas.width, result.canvas.height)
                  : result.reason === "tooLong"
                    ? S.customTooLong(CANVAS_SIDE_MAX)
                    : S.customInvalid}
              </p>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={close}>
                {SHELL.common.cancel}
              </Button>
              <Button
                variant="accent"
                isDisabled={!result.ok}
                isPending={busy}
                onPress={() => void submit()}
              >
                {S.apply}
              </Button>
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}

// ---- Caption visibility ----

/** Hide or show captions on the stage: this only controls whether they are visible in this window. It does not change the caption track or affect export (whether to burn in captions is chosen separately in export). */
export function CaptionsToggle() {
  const hidden = useEditor((s) => s.captionsHidden);
  const setHidden = useEditor((s) => s.setCaptionsHidden);
  return (
    <Tip label={hidden ? S.showCaptions : S.hideCaptions}>
      <ToggleButton
        size="S"
        isQuiet
        aria-label={F.captions}
        isSelected={!hidden}
        onChange={(shown) => setHidden(!shown)}
      >
        <CloseCaptions />
      </ToggleButton>
    </Tip>
  );
}

// ---- Volume ----

/** The readout is written as “70%”: the hover tooltip shows it, and screen readers read it aloud too. */
const VOLUME_FORMAT: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "percent",
};

/** Listening volume (prototype stage.jsx's volume popover): the same as ↑/↓, M and the fullscreen player. It only controls how loud this window plays, and does not change the video's mix. */
export function VolumeControl() {
  const { engine } = useEditorActions();
  const [level, setLevelState] = useState<MonitorLevel>(() =>
    monitorLevel(engine.monitor),
  );
  useEffect(
    () => engine.onMonitor((gain) => setLevelState(monitorLevel(gain))),
    [engine],
  );
  const setLevel = (next: MonitorLevel) => engine.setMonitor(monitorGain(next));
  const VolumeIcon =
    level.muted || level.volume === 0
      ? VolumeOff
      : level.volume <= 50
        ? VolumeOne
        : VolumeTwo;

  return (
    <DialogTrigger>
      <Tip label={P.volume}>
        <ActionButton size="S" isQuiet aria-label={P.volume}>
          <VolumeIcon />
        </ActionButton>
      </Tip>
      <Popover placement="top end" aria-label={P.volume}>
        <div className={volumeRow}>
          <Tip label={level.muted ? P.unmuteTip : P.muteTip}>
            <ActionButton
              size="S"
              isQuiet
              aria-label={level.muted ? P.unmute : P.mute}
              onPress={() => setLevel(toggleMute(level))}
            >
              <VolumeIcon />
            </ActionButton>
          </Tip>
          <VolumeSlider
            value={level.muted ? 0 : level.volume}
            onChange={(volume) => setLevel({ volume, muted: false })}
          />
        </div>
      </Popover>
    </DialogTrigger>
  );
}

/**
 * Volume bar without a number: when the mouse hovers over the bar or drags the thumb, a tooltip above the thumb shows the current volume.
 * The tooltip is anchored to the whole bar, offset horizontally to the thumb's position, and follows it while dragging.
 * Step is 5 (the prototype uses 25 here): react-aria snaps controlled values to the step, and 70% reached with ↑/↓ in steps of 10 would be drawn as 75% on a bar with steps of 25.
 */
function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (volume: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { direction } = useLocale();
  return (
    <Slider
      aria-label={P.volume}
      className={volumeSlider}
      minValue={0}
      maxValue={100}
      step={5}
      value={value}
      formatOptions={VOLUME_FORMAT}
      onChange={onChange}
    >
      <SliderTrack ref={trackRef} className={volumeTrack}>
        {({ state, isHovered }) => {
          const percent = state.getThumbPercent(0);
          // How far the thumb center is from the bar center; the bar is mirrored when laid out right-to-left.
          const shift =
            ((direction === "rtl" ? 1 - percent : percent) - 0.5) *
            (trackRef.current?.clientWidth ?? 0);
          return (
            <>
              <div className={volumeRail} />
              <div
                className={volumeFill}
                style={{ width: `${percent * 100}%` }}
              />
              <SliderThumb className={volumeThumb} />
              <TrackTip
                anchorRef={trackRef}
                isOpen={isHovered || state.isThumbDragging(0)}
                crossOffset={shift}
              >
                {state.getThumbValueLabel(0)}
              </TrackTip>
            </>
          );
        }}
      </SliderTrack>
    </Slider>
  );
}

/**
 * An S2 tooltip whose open state is controlled by the caller and which is anchored to any element. TooltipTrigger needs a focusable trigger, and the slider's one is an input hidden inside the thumb that the mouse cannot reach. So here the open state and anchor are passed directly to react-aria's tooltip context. The tooltip is purely visual; screen readers read the value from the slider's aria-valuetext.
 */
function TrackTip({
  anchorRef,
  isOpen,
  crossOffset,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  crossOffset: number;
  children: string;
}) {
  const state = useMemo(
    () => ({
      isOpen,
      open: () => {},
      close: () => {},
      shouldSkipAnimation: false,
    }),
    [isOpen],
  );
  return (
    <TooltipTriggerStateContext.Provider value={state}>
      <TooltipContext.Provider value={{ triggerRef: anchorRef, crossOffset }}>
        <Tooltip>{children}</Tooltip>
      </TooltipContext.Provider>
    </TooltipTriggerStateContext.Provider>
  );
}

// ---- Playback speed ----

/** Playback speed (prototype `D.speeds`): shared with the fullscreen player. It only sets how fast this window plays; preview.tsx passes it to the engine. */
export function RatePicker() {
  const rate = useEditor((s) => s.rate);
  const setRate = useEditor((s) => s.setRate);
  return (
    <MenuTrigger align="start" direction="top">
      <Tip label={P.rate}>
        <ActionButton size="S" isQuiet aria-label={P.rateCurrent(rate)}>
          <SpeedFast />
          <Text
            UNSAFE_className="cc-tabular"
            styles={chipText}
          >{`${rate}×`}</Text>
        </ActionButton>
      </Tip>
      <Menu
        aria-label={P.rate}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[String(rate)]}
        onSelectionChange={(keys) => {
          const [next] = keys === "all" ? [] : [...keys];
          if (next !== undefined) setRate(Number(next));
        }}
      >
        {PLAYBACK_RATES.map((r) => (
          <MenuItem key={r} id={String(r)} textValue={`${r}×`}>
            {r === 1 ? P.rateNormal : `${r}×`}
          </MenuItem>
        ))}
      </Menu>
    </MenuTrigger>
  );
}

function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipTrigger placement="top">
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
