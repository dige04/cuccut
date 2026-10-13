import { useState } from 'react';
import { ActionButton, DialogTrigger, Popover, Switch, Text, ToggleButton } from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import RemoveCircle from '@react-spectrum/s2/icons/RemoveCircle';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import {
  CONFETTI_LIMITS,
  CONFETTI_RANGES,
  CONFETTI_SHAPES,
  CONFETTI_SHAPE_NAMES,
  CONFETTI_STYLES,
  confettiStyle,
  effectiveEmit,
  normalizeConfetti,
  randomSeed,
  switchConfettiStyle,
  type ConfettiEmit,
  type ConfettiProps,
} from '../../render/confetti.ts';
import type { Json } from '../../render/text-style.ts';
import { ConfettiThumb } from './element-thumb.tsx';
import { ColorField, Note, PRow, Sec, SecHead, Seg, ValueRow } from './inspector-controls.tsx';
import { usePeekDraft } from './inspector-visualizers.tsx';
import { INSPECTOR_COPY as IC } from './inspector-copy.ts';

/**
 * Confetti parameters (design panel-element-confetti.jsx): style → color → shape → particle motion → emission → randomness. Each edit fills in the whole parameter set, clamps it back into range, and writes it back (`normalizeConfetti`). Recipe-driven origin, direction and fan angle are written as null. Switching style returns to that style's defaults, keeping only the seed.
 */

interface ParamProps {
  values: Json;
  isDisabled: boolean;
  live(patch: Json): void;
  commit(patch: Json): void;
}

const styleRow = style({ display: 'flex', alignItems: 'center', gap: 12 });
/** Confetti cell (design .stile--cft): dark background with bright particles; darkens on hover and starts playing. */
const darkFace = style({
  display: 'block',
  boxSizing: 'border-box',
  flexShrink: 0,
  width: 'full',
  aspectRatio: 'square',
  overflow: 'hidden',
  borderRadius: 'lg',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: { default: 'transparent', isSelected: 'blue-800' },
  backgroundColor: { default: 'gray-800', isHovered: 'gray-700' },
  transition: 'default',
});
const currentTile = style({
  display: 'block',
  flexShrink: 0,
  width: 72,
  padding: 0,
  borderWidth: 0,
  borderRadius: 'lg',
  backgroundColor: 'transparent',
  cursor: { default: 'pointer', isDisabled: 'default' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
});
const styleText = style({ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 4, minWidth: 0 });
const styleName = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900' });
const styleNote = style({ font: 'ui-xs', color: 'gray-600' });
const catalogBox = style({ display: 'flex', flexDirection: 'column', gap: 12, width: '[288px]' });
const catalogGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 });
const catalogTile = style({
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
const tileLabel = style({
  font: 'ui-xs',
  color: { default: 'gray-700', isSelected: 'gray-900' },
  fontWeight: { default: 'normal', isSelected: 'bold' },
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const chips = style({ display: 'flex', flexWrap: 'wrap', gap: '[6px]' });
const seedText = style({ flexGrow: 1, minWidth: 0, font: 'code-sm', color: 'gray-800', overflow: 'hidden', textOverflow: 'ellipsis' });

export function ConfettiParams({ values, isDisabled, live: liveRaw, commit: commitRaw }: ParamProps) {
  const cf = normalizeConfetti(values);
  const recipe = confettiStyle(cf.style);
  const [open, setOpen] = useState(false);
  const next = (patch: Partial<ConfettiProps>): Json => ({ ...normalizeConfetti({ ...cf, ...patch }) });
  const live = (patch: Partial<ConfettiProps>) => liveRaw(next(patch));
  const commit = (patch: Partial<ConfettiProps>) => commitRaw(next(patch));
  const emit = (patch: Partial<ConfettiEmit>): Partial<ConfettiProps> => ({ emit: { ...cf.emit, ...patch } });
  const burst = cf.emit.mode === 'burst';
  const emitter = effectiveEmit(cf);
  const origin = cf.origin;
  const sameColors = cf.colors.join() === recipe.colors.join();
  const sameShapes = cf.shapes.join() === recipe.shapes.join();
  const R = CONFETTI_RANGES;

  /** Multiplier row: steps of 0.05, and the readout is the multiple (1 is the recipe unchanged; the section header states this). */
  const multiplier = (label: string, key: 'size' | 'speed' | 'gravity' | 'drift' | 'spin') => (
    <ValueRow
      label={label}
      value={cf[key]}
      min={R[key][0]}
      max={R[key][1]}
      step={0.05}
      digits={2}
      isDisabled={isDisabled}
      onLive={(v) => live({ [key]: Math.round(v * 100) / 100 })}
      onCommit={(v) => commit({ [key]: Math.round(v * 100) / 100 })}
    />
  );

  return (
    <>
      <SecHead first aside={recipe.from}>
        {IC.cfStyle}
      </SecHead>
      <div className={styleRow}>
        {/* The currently selected cell can also open the catalog; the catalog is attached to “更换款式” (change style). */}
        <RACButton className={currentTile} isDisabled={isDisabled} aria-label={IC.cfStyleTile(recipe.name)} onPress={() => setOpen(true)}>
          {({ isHovered }) => (
            <span className={darkFace({ isHovered })}>
              <ConfettiThumb styleKey={cf.style} playing={isHovered} />
            </span>
          )}
        </RACButton>
        <span className={styleText}>
          <span className={styleName}>{recipe.name}</span>
          <span className={styleNote}>
            {burst ? IC.cfBurst : IC.cfContinuous} · {CONFETTI_SHAPE_NAMES[cf.shapes[0]!]}
            {cf.shapes.length > 1 ? IC.cfMoreShapes(cf.shapes.length) : ''}
          </span>
          <DialogTrigger isOpen={open} onOpenChange={setOpen}>
            <ActionButton size="S" isDisabled={isDisabled}>
              {IC.cfChangeStyle}
            </ActionButton>
            <Popover placement="bottom" padding="default" aria-label={IC.cfStyles}>
              <ConfettiCatalog
                current={cf.style}
                onPeek={(key) => liveRaw({ ...switchConfettiStyle(cf, key) })}
                onPick={(key) => commitRaw({ ...switchConfettiStyle(cf, key) })}
                onClose={() => setOpen(false)}
              />
            </Popover>
          </DialogTrigger>
        </span>
      </div>

      <SecHead
        aside={`${cf.colors.length} / ${CONFETTI_LIMITS.colors}`}
        action={
          sameColors ? undefined : (
            <ActionButton isQuiet size="XS" isDisabled={isDisabled} onPress={() => commit({ colors: recipe.colors.slice() })}>
              {IC.cfReset}
            </ActionButton>
          )
        }>
        {IC.color}
      </SecHead>
      <Sec>
        {cf.colors.map((color, index) => {
          const withColor = (value: string) => ({ colors: cf.colors.map((c, i) => (i === index ? value : c)) });
          return (
            <PRow key={index} label={IC.cfColorN(index + 1)}>
              <ActionButton
                isQuiet
                size="S"
                aria-label={IC.cfRemoveColorN(index + 1)}
                isDisabled={isDisabled || cf.colors.length <= 1}
                onPress={() => commit({ colors: cf.colors.filter((_, i) => i !== index) })}>
                <RemoveCircle />
              </ActionButton>
              <ColorField
                label={IC.cfConfettiColorN(index + 1)}
                value={color}
                fallback={color}
                allowAlpha={false}
                isDisabled={isDisabled}
                onLive={(value) => live(withColor(value))}
                onCommit={(value) => commit(withColor(value))}
              />
            </PRow>
          );
        })}
        {cf.colors.length < CONFETTI_LIMITS.colors ? (
          <div>
            <ActionButton size="S" isDisabled={isDisabled} onPress={() => commit({ colors: [...cf.colors, cf.colors[cf.colors.length - 1]!] })}>
              <Add />
              <Text>{IC.cfAddColor}</Text>
            </ActionButton>
          </div>
        ) : null}
        <Note>{IC.cfColorsNote}</Note>
      </Sec>

      <SecHead
        aside={`${cf.shapes.length} / ${CONFETTI_SHAPES.length}`}
        action={
          sameShapes ? undefined : (
            <ActionButton isQuiet size="XS" isDisabled={isDisabled} onPress={() => commit({ shapes: recipe.shapes.slice() })}>
              {IC.cfReset}
            </ActionButton>
          )
        }>
        {IC.shape}
      </SecHead>
      <div className={chips} role="group" aria-label={IC.cfShapes}>
        {CONFETTI_SHAPES.map((shape) => {
          const on = cf.shapes.includes(shape);
          return (
            <ToggleButton
              key={shape}
              size="XS"
              isSelected={on}
              isDisabled={isDisabled}
              onChange={() => {
                // Keep at least one: the last one cannot be deselected.
                if (on && cf.shapes.length <= 1) return;
                commit({ shapes: on ? cf.shapes.filter((s) => s !== shape) : CONFETTI_SHAPES.filter((s) => s === shape || cf.shapes.includes(s)) });
              }}>
              {CONFETTI_SHAPE_NAMES[shape]}
            </ToggleButton>
          );
        })}
      </div>

      <SecHead aside={IC.cfMotionAside}>{IC.cfMotion}</SecHead>
      <Sec>
        {burst ? (
          <ValueRow
            label={IC.cfCount}
            value={cf.emit.count}
            min={R.count[0]}
            max={R.count[1]}
            unit={IC.cfUnit}
            isDisabled={isDisabled}
            onLive={(v) => live(emit({ count: Math.round(v) }))}
            onCommit={(v) => commit(emit({ count: Math.round(v) }))}
          />
        ) : (
          <ValueRow
            label={IC.cfDensity}
            value={cf.emit.rate}
            min={R.rate[0]}
            max={R.rate[1]}
            unit={IC.cfRateUnit}
            isDisabled={isDisabled}
            onLive={(v) => live(emit({ rate: Math.round(v) }))}
            onCommit={(v) => commit(emit({ rate: Math.round(v) }))}
          />
        )}
        {multiplier(IC.cfSize, 'size')}
        {multiplier(IC.cfSpeed, 'speed')}
        {multiplier(IC.cfGravity, 'gravity')}
        <ValueRow
          label={IC.cfWind}
          value={cf.wind}
          min={R.wind[0]}
          max={R.wind[1]}
          step={10}
          unit="px/s²"
          isDisabled={isDisabled}
          onLive={(v) => live({ wind: Math.round(v) })}
          onCommit={(v) => commit({ wind: Math.round(v) })}
        />
        {multiplier(IC.cfDrift, 'drift')}
        {multiplier(IC.cfSpin, 'spin')}
        <ValueRow
          label={IC.cfOpacity}
          value={Math.round(cf.opacity * 100)}
          min={0}
          max={100}
          unit="%"
          isDisabled={isDisabled}
          onLive={(v) => live({ opacity: Math.round(v) / 100 })}
          onCommit={(v) => commit({ opacity: Math.round(v) / 100 })}
        />
      </Sec>

      <SecHead aside={burst ? IC.cfEmitAsideBurst : IC.cfEmitAsideContinuous}>{IC.cfEmit}</SecHead>
      <Sec>
        <PRow label={IC.cfMode}>
          <Seg
            label={IC.cfEmitMode}
            value={cf.emit.mode}
            options={[
              { key: 'continuous', label: IC.cfContinuous },
              { key: 'burst', label: IC.cfBurst },
            ]}
            isDisabled={isDisabled}
            onChange={(mode) => commit(emit({ mode }))}
          />
        </PRow>
        {burst ? (
          <ValueRow
            label={IC.cfInterval}
            value={cf.emit.interval}
            min={R.interval[0]}
            max={R.interval[1]}
            step={0.5}
            digits={1}
            unit={IC.seconds}
            isDisabled={isDisabled}
            onLive={(v) => live(emit({ interval: Math.round(v * 2) / 2 }))}
            onCommit={(v) => commit(emit({ interval: Math.round(v * 2) / 2 }))}
          />
        ) : null}
        {burst && cf.emit.interval === 0 ? <Note>{IC.cfIntervalZero}</Note> : null}
        <PRow label={IC.cfSettle}>
          <Switch size="S" isSelected={cf.emit.settle} isDisabled={isDisabled} onChange={(settle) => commit(emit({ settle }))}>
            {cf.emit.settle ? IC.cfSettleOn : IC.cfSettleOff}
          </Switch>
        </PRow>
        <PRow label={IC.cfOrigin}>
          <Switch
            size="S"
            isSelected={!!origin}
            isDisabled={isDisabled}
            onChange={(on) =>
              commit(
                on
                  ? {
                      origin: { x: Math.round(emitter.x), y: Math.round(emitter.y) },
                      angle: Math.round(emitter.angle),
                      spread: Math.round(emitter.spread),
                    }
                  : { origin: null, angle: null, spread: null },
              )
            }>
            {origin ? IC.cfOriginCustom : emitter.multi ? IC.cfOriginRecipeMulti(recipe.emitters.length) : IC.cfOriginRecipe}
          </Switch>
        </PRow>
        {origin ? (
          <>
            <ValueRow
              label={IC.cfOriginX}
              value={origin.x}
              min={R.originX[0]}
              max={R.originX[1]}
              unit="%"
              isDisabled={isDisabled}
              onLive={(v) => live({ origin: { x: Math.round(v), y: origin.y } })}
              onCommit={(v) => commit({ origin: { x: Math.round(v), y: origin.y } })}
            />
            <ValueRow
              label={IC.cfOriginY}
              value={origin.y}
              min={R.originY[0]}
              max={R.originY[1]}
              unit="%"
              isDisabled={isDisabled}
              onLive={(v) => live({ origin: { x: origin.x, y: Math.round(v) } })}
              onCommit={(v) => commit({ origin: { x: origin.x, y: Math.round(v) } })}
            />
            <ValueRow
              label={IC.cfAngle}
              value={emitter.angle}
              min={R.angle[0]}
              max={R.angle[1]}
              unit="°"
              isDisabled={isDisabled}
              onLive={(v) => live({ angle: Math.round(v) })}
              onCommit={(v) => commit({ angle: Math.round(v) })}
            />
            <ValueRow
              label={IC.cfSpread}
              value={emitter.spread}
              min={R.spread[0]}
              max={R.spread[1]}
              unit="°"
              isDisabled={isDisabled}
              onLive={(v) => live({ spread: Math.round(v) })}
              onCommit={(v) => commit({ spread: Math.round(v) })}
            />
            <Note>{IC.cfAngleNote}</Note>
          </>
        ) : null}
      </Sec>

      <SecHead aside={IC.cfRandomAside}>{IC.cfRandom}</SecHead>
      <Sec>
        <PRow label={IC.cfSeed}>
          <span className={seedText} title={String(cf.seed)}>
            {cf.seed}
          </span>
          <ActionButton size="S" isDisabled={isDisabled} onPress={() => commit({ seed: randomSeed() })}>
            <Refresh />
            <Text>{IC.cfReseed}</Text>
          </ActionButton>
        </PRow>
      </Sec>
    </>
  );
}

/**
 * Style catalog (the design's style drawer; like the progress and waveform style catalogs, it is a popover here): ten cells with the same thumbnails as the elements page. Hover plays, the hovered style is previewed first, and a click commits. The selection frame stays on the style that was current when the catalog was opened.
 */
function ConfettiCatalog({ current, onPeek, onPick, onClose }: { current: string; onPeek(key: string): void; onPick(key: string): void; onClose(): void }) {
  const [opened] = useState(current);
  const { peek, keep, unpeek } = usePeekDraft();
  return (
    <div className={catalogBox}>
      <div className={catalogGrid} onPointerLeave={unpeek}>
        {CONFETTI_STYLES.map((item) => {
          const isSelected = item.key === opened;
          return (
            <RACButton
              key={item.key}
              className={catalogTile}
              aria-label={isSelected ? IC.current(item.name) : item.name}
              onHoverStart={() => {
                peek();
                onPeek(item.key);
              }}
              onPress={() => {
                if (isSelected) {
                  unpeek();
                } else {
                  keep();
                  onPick(item.key);
                }
                onClose();
              }}>
              {({ isHovered }) => (
                <>
                  <span className={darkFace({ isHovered, isSelected })}>
                    <ConfettiThumb styleKey={item.key} playing={isHovered} />
                  </span>
                  <span className={tileLabel({ isSelected })}>{item.name}</span>
                </>
              )}
            </RACButton>
          );
        })}
      </div>
      <Note>{IC.cfCatalogNote}</Note>
    </div>
  );
}
