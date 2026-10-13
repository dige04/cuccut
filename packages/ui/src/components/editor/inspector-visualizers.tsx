import { useCallback, useEffect, useRef, useState } from 'react';
import { DialogTrigger, Popover } from '@react-spectrum/s2';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { ELEMENT_TILES, PROGRESS_KINDS, WAVE_KINDS, type ElementTile, type StyleKind } from '../../model/element-catalog.ts';
import { PROGRESS_STYLES } from '../../render/progress.ts';
import { num, type Json } from '../../render/text-style.ts';
import { WAVE_STYLES, waveStyleKey } from '../../render/visualizer.ts';
import { useEditor } from '../../state/editor-store.ts';
import { ElementThumb } from './element-thumb.tsx';
import { ColorField, Note, PRow, Sec, SecHead, ValueRow } from './inspector-controls.tsx';
import { INSPECTOR_COPY as IC } from './inspector-copy.ts';

/**
 * Parameters for progress bars and waveforms (design panel-element-style.jsx's color and style sections, and panel-element-edit.jsx's style catalog). The number and names of the color rows follow the style (the two rainbow-border styles have no rows at all). The “样式” (style) row opens a catalog with the same thumbnails as the elements page. Hover previews first, and a click commits. When the style changes, the primary and secondary colors (the waveform also has a dB window) are replaced with that style's defaults.
 */

export interface VisualParamProps {
  values: Json;
  isDisabled: boolean;
  /** Aspect ratio: the catalog thumbnails are laid out by it (the square style's side is 30% of the aspect ratio's short side). */
  canvas: { width: number; height: number };
  live(patch: Json): void;
  commit(patch: Json): void;
}

type Catalog = 'progress' | 'wave';

const drill = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: 'full',
  boxSizing: 'border-box',
  padding: 8,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-200', isHovered: 'gray-400' },
  backgroundColor: 'gray-25',
  textAlign: 'start',
  cursor: { default: 'pointer', isDisabled: 'default' },
  opacity: { default: 1, isDisabled: 0.5 },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  transition: 'default',
});
const drillThumb = style({
  display: 'block',
  flexShrink: 0,
  boxSizing: 'border-box',
  width: 56,
  height: 40,
  padding: 4,
  borderRadius: 'default',
  backgroundColor: 'gray-100',
});
const drillText = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 });
const drillName = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900' });
const drillNote = style({ font: 'ui-xs', color: 'gray-600' });
const drillChevron = style({ display: 'flex', color: 'gray-500', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const catalogBox = style({ display: 'flex', flexDirection: 'column', gap: 12, width: '[288px]' });
/** The same grid as the elements page: progress bars in three columns, with the bar styles spanning two columns; waveforms in two columns of 2:1 wide cells. */
const progressGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoFlow: 'row dense', gap: 8 });
const waveGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 });
const span2 = style({ gridColumnEnd: 'span 2' });
const tile = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
  cursor: 'pointer',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  borderRadius: 'lg',
  transform: { default: 'none', isPressed: 'scale(0.96)' },
  transition: 'default',
});
const face = style({
  display: 'block',
  boxSizing: 'border-box',
  width: 'full',
  flexGrow: { default: 0, shape: { stretch: 1 } },
  aspectRatio: { default: 'square', shape: { wave: '[2 / 1]', stretch: 'auto' } },
  minHeight: { default: 0, shape: { stretch: 48 } },
  padding: '[6px]',
  borderRadius: 'lg',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: { default: 'transparent', isSelected: 'blue-800' },
  backgroundColor: { default: 'gray-100', isHovered: 'gray-200' },
  transition: 'default',
});
const tileLabel = style({
  font: 'ui-xs',
  color: { default: 'gray-700', isSelected: 'gray-900' },
  fontWeight: { default: 'normal', isSelected: 'bold' },
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const tileOf = (catalog: Catalog, key: string): ElementTile | undefined => ELEMENT_TILES.find((t) => t.key === `${catalog}.${key}`);
const kindOf = (kinds: readonly StyleKind[], key: string): StyleKind => kinds.find((k) => k.key === key) ?? kinds[0]!;

/** Parameters written together with a style when it is chosen: the primary and secondary colors follow the style, and the waveform's dB window also follows the style (the oscilloscope and circular wave use the narrow −120 / −10 window). */
function stylePatch(catalog: Catalog, key: string): Json {
  if (catalog === 'wave') {
    const preset = WAVE_STYLES[key]!;
    return { style: key, mainColor: preset.mainColor, secondaryColor: preset.secondaryColor, minDb: preset.minDb, maxDb: preset.maxDb };
  }
  const preset = PROGRESS_STYLES[key]!;
  return { style: key, mainColor: preset.mainColor, secondaryColor: preset.secondaryColor };
}

/** Progress bar: color, style, range (start and end, 0–100%; the end may be less than the start, so it runs backward). */
export function ProgressParams(props: VisualParamProps) {
  const { values, isDisabled, live, commit } = props;
  const key = typeof values.style === 'string' && PROGRESS_STYLES[values.style] ? values.style : 'normal';
  const preset = PROGRESS_STYLES[key]!;
  return (
    <>
      <ColorRows kind={kindOf(PROGRESS_KINDS, key)} main={preset.mainColor} secondary={preset.secondaryColor} {...props} />
      <StylePicker catalog="progress" current={key} {...props} />
      <SecHead aside={IC.rangeAside}>{IC.progressRange}</SecHead>
      <Sec>
        <ValueRow
          label={IC.rangeStart}
          value={Math.round(num(values.startProgress, 0) * 100)}
          min={0}
          max={100}
          step={5}
          unit="%"
          isDisabled={isDisabled}
          onLive={(v) => live({ startProgress: v / 100 })}
          onCommit={(v) => commit({ startProgress: v / 100 })}
        />
        <ValueRow
          label={IC.rangeEnd}
          value={Math.round(num(values.endProgress, 1) * 100)}
          min={0}
          max={100}
          step={5}
          unit="%"
          isDisabled={isDisabled}
          onLive={(v) => live({ endProgress: v / 100 })}
          onCommit={(v) => commit({ endProgress: v / 100 })}
        />
      </Sec>
    </>
  );
}

/**
 * Waveform: color, style, controls (dB window minimum −120–0, maximum −40–60, smoothing 0–99%). The oscilloscope and circular wave draw the waveform, so they have no dB rows. The waveform listens to the sound playing at that moment. At 100% smoothing the spectrum would freeze on the first frame, so the maximum is capped at 99%.
 */
export function VisualizerParams(props: VisualParamProps) {
  const { values, isDisabled, live, commit } = props;
  const key = waveStyleKey(typeof values.style === 'string' ? values.style : 'bars') ?? 'bars';
  const preset = WAVE_STYLES[key]!;
  const minDb = num(values.minDb, preset.minDb);
  const maxDb = num(values.maxDb, preset.maxDb);
  return (
    <>
      <ColorRows kind={kindOf(WAVE_KINDS, key)} main={preset.mainColor} secondary={preset.secondaryColor} {...props} />
      <StylePicker catalog="wave" current={key} {...props} />
      <SecHead>{IC.controls}</SecHead>
      <Sec>
        {preset.hasControl ? (
          <>
            <ValueRow
              label={IC.minimum}
              value={minDb}
              min={-120}
              max={0}
              unit="dB"
              isDisabled={isDisabled}
              onLive={(v) => live({ minDb: Math.min(v, maxDb - 1) })}
              onCommit={(v) => commit({ minDb: Math.min(v, maxDb - 1) })}
            />
            <ValueRow
              label={IC.maximum}
              value={maxDb}
              min={-40}
              max={60}
              unit="dB"
              isDisabled={isDisabled}
              onLive={(v) => live({ maxDb: Math.max(v, minDb + 1) })}
              onCommit={(v) => commit({ maxDb: Math.max(v, minDb + 1) })}
            />
          </>
        ) : null}
        <ValueRow
          label={IC.smoothing}
          value={Math.round(num(values.smoothing, 0.8) * 100)}
          min={0}
          max={99}
          unit="%"
          isDisabled={isDisabled}
          onLive={(v) => live({ smoothing: v / 100 })}
          onCommit={(v) => commit({ smoothing: v / 100 })}
        />
      </Sec>
    </>
  );
}

/** Color section: one row per color (`mainColor`; the second color is `secondaryColor`). When this style has no color control, the section explains why. */
function ColorRows({ kind, main, secondary, values, isDisabled, live, commit }: VisualParamProps & { kind: StyleKind; main: string; secondary: string }) {
  if (!kind.colors.length) {
    return (
      <>
        <SecHead first>{IC.color}</SecHead>
        <Note>{IC.noColorControls(kind.label)}</Note>
      </>
    );
  }
  const fields = [
    { field: 'mainColor', fallback: main },
    { field: 'secondaryColor', fallback: secondary },
  ];
  return (
    <>
      <SecHead first>{IC.color}</SecHead>
      <Sec>
        {kind.colors.map((label, index) => {
          const { field, fallback } = fields[index]!;
          return (
            <PRow key={field} label={label}>
              <ColorField
                label={label}
                value={values[field]}
                fallback={fallback}
                isDisabled={isDisabled}
                onLive={(color) => live({ [field]: color })}
                onCommit={(color) => commit({ [field]: color })}
              />
            </PRow>
          );
        })}
      </Sec>
    </>
  );
}

/** Style section: the current style's thumbnail and name, plus “N 种 · 点开选” (N styles · click to choose). Clicking it opens the catalog. */
function StylePicker({ catalog, current, isDisabled, canvas, live, commit }: VisualParamProps & { catalog: Catalog; current: string }) {
  const [open, setOpen] = useState(false);
  const kinds = catalog === 'wave' ? WAVE_KINDS : PROGRESS_KINDS;
  const kind = kindOf(kinds, current);
  const thumb = tileOf(catalog, kind.key);
  return (
    <>
      <SecHead>{IC.style}</SecHead>
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <RACButton className={drill} isDisabled={isDisabled} aria-label={IC.styleTile(kind.label, kinds.length)}>
          <span className={drillThumb}>{thumb ? <ElementThumb tile={thumb} canvas={canvas} /> : null}</span>
          <span className={drillText}>
            <span className={drillName}>{kind.label}</span>
            <span className={drillNote}>{IC.styleCount(kinds.length)}</span>
          </span>
          <span className={drillChevron}>
            <ChevronRight />
          </span>
        </RACButton>
        <Popover placement="bottom" padding="default" aria-label={catalog === 'wave' ? IC.waveStyles : IC.progressStyles}>
          <StyleCatalog
            catalog={catalog}
            kinds={kinds}
            current={current}
            canvas={canvas}
            onPeek={(key) => live(stylePatch(catalog, key))}
            onPick={(key) => commit(stylePatch(catalog, key))}
            onClose={() => setOpen(false)}
          />
        </Popover>
      </DialogTrigger>
    </>
  );
}

/**
 * Hover preview in a catalog: `peek` records the draft that was overlaid, and `unpeek` removes it (clearing the editor's draft). The draft is also removed when the catalog unmounts (clicking outside, Esc, or the selection changing). `keep` is used when a click commits: the draft is kept until the new version arrives (on failure the editor discards the draft itself), so the picture does not flash back to the old style first.
 */
export function usePeekDraft(): { peek(): void; keep(): void; unpeek(): void } {
  const peeked = useRef(false);
  const unpeek = useCallback(() => {
    if (!peeked.current) return;
    peeked.current = false;
    useEditor.getState().clearDrafts();
  }, []);
  useEffect(() => unpeek, [unpeek]);
  return {
    peek: () => {
      peeked.current = true;
    },
    keep: () => {
      peeked.current = false;
    },
    unpeek,
  };
}

/**
 * Style catalog: the cell under the pointer is first overlaid on the preview as a draft. Moving out of the catalog or closing it removes the draft, and a click commits. The selection frame stays on the style that was current when the catalog opened and does not follow the hover. The value the properties page sees is overlaid with the draft, so during a hover it would otherwise become the hovered style.
 */
function StyleCatalog({
  catalog,
  kinds,
  current,
  canvas,
  onPeek,
  onPick,
  onClose,
}: {
  catalog: Catalog;
  kinds: readonly StyleKind[];
  current: string;
  canvas: { width: number; height: number };
  onPeek(key: string): void;
  /** Selecting a different style. (Clicking back on the style that was current when the catalog opened does not count.) */
  onPick(key: string): void;
  onClose(): void;
}) {
  const [opened] = useState(current);
  const { peek, keep, unpeek } = usePeekDraft();
  const wave = catalog === 'wave';
  return (
    <div className={catalogBox}>
      <div className={wave ? waveGrid : progressGrid} onPointerLeave={unpeek}>
        {kinds.map((kind) => {
          const item = tileOf(catalog, kind.key);
          if (!item) return null;
          const isSelected = kind.key === opened;
          const wide = !!item.wide;
          return (
            <RACButton
              key={kind.key}
              className={(state) => `${tile(state)}${wide ? ` ${span2}` : ''}`}
              aria-label={isSelected ? IC.current(kind.label) : kind.label}
              onHoverStart={() => {
                peek();
                onPeek(kind.key);
              }}
              onPress={() => {
                if (isSelected) {
                  unpeek();
                } else {
                  keep();
                  onPick(kind.key);
                }
                onClose();
              }}>
              {({ isHovered }) => (
                <>
                  <span className={face({ isHovered, isSelected, shape: wave ? 'wave' : wide ? 'stretch' : 'square' })}>
                    <ElementThumb tile={item} canvas={canvas} />
                  </span>
                  <span className={tileLabel({ isSelected })}>{kind.label}</span>
                </>
              )}
            </RACButton>
          );
        })}
      </div>
      <Note>
        {wave
          ? IC.waveNote
          : IC.progressNote}
      </Note>
    </div>
  );
}
