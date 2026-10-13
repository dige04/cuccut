import { useEffect, useState, type ReactNode } from 'react';
import type {
  CompositionItem,
  ConfettiItem,
  CounterProps,
  ProgressItem,
  ShapeItem,
  StickerItem,
  TextItem,
  VisualItem,
  VisualizerItem,
} from '@cuccut/protocol';
import { ActionButton, Picker, PickerItem, TextArea } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { hasEffects } from '../../model/effects-panel.ts';
import { SHAPE_CHOICES } from '../../model/element-catalog.ts';
import { colorParts, editableTextStyle, patchShape, patchTextStyle, withAlpha } from '../../model/property-values.ts';
import { STICKER_TEMPLATES } from '../../render/sticker-templates.ts';
import { asObject, num, type Json } from '../../render/text-style.ts';
import { Card, ColorField, Note, PRow, Sec, SecHead, Seg, ValueRow } from './inspector-controls.tsx';
import { EffectsSection } from './inspector-effects.tsx';
import { GeometrySection } from './inspector-geometry.tsx';
import { DeleteItem, OpacityRow, SoundSection, TimeSection, type ItemPageProps } from './inspector-sections.tsx';
import { TransitionSection } from './inspector-transition.tsx';
import { TextStyleEditor } from './inspector-text-style.tsx';
import { ConfettiParams } from './inspector-confetti.tsx';
import { ProgressParams, VisualizerParams } from './inspector-visualizers.tsx';
import { INSPECTOR_COPY as IC } from './inspector-copy.ts';

const textArea = style({ width: 'full' });
const shapePicker = style({ flexGrow: 1, minWidth: 0 });
const dots = style({ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' });

/** The trailing sections of the clip page: after appearance come effects (for clips with `fx`), transition, geometry, time and delete. */
function Tail(props: ItemPageProps<VisualItem>) {
  return (
    <>
      {hasEffects(props.item) ? <EffectsSection {...props} item={props.item} /> : null}
      <TransitionSection {...props} />
      <GeometrySection item={props.item} sequence={props.sequence} assets={props.assets} edit={props.edit} isDisabled={!props.canChange} />
      <TimeSection {...props} />
      <DeleteItem {...props} />
    </>
  );
}

/** Edit text: the text, the style (the same set as captions), and opacity. */
export function TextPage(props: ItemPageProps<TextItem>) {
  if (props.item.counter) return <CounterPage {...props} counter={props.item.counter} />;
  const { item, sequence, edit, canChange } = props;
  const editable = editableTextStyle(item.style);
  const current = asObject(item.style);
  const patch = (p: Json) => patchTextStyle(item.style, p);
  return (
    <>
      <SecHead first>{IC.text}</SecHead>
      <Sec>
        <TextBody
          text={item.text ?? ''}
          isDisabled={!canChange}
          onCommit={(text) => edit.commit([{ type: 'setText', sequenceId: sequence.id, itemId: item.id, text }])}
        />
      </Sec>
      <SecHead>{IC.style}</SecHead>
      <Sec>
        {editable ? (
          <TextStyleEditor
            style={current}
            isDisabled={!canChange}
            onLive={(p) => edit.live({ style: patch(p) })}
            onCommit={(p) => edit.commit([{ type: 'setStyle', sequenceId: sequence.id, itemId: item.id, style: patch(p) }])}
          />
        ) : (
          <Note>{IC.textSchema(String(current.schema))}</Note>
        )}
        <OpacityRow {...props} />
      </Sec>
      <Tail {...props} />
    </>
  );
}

/** Text box: commits on blur (⌘↩ also commits), Esc discards. */
function TextBody({ text, isDisabled, onCommit }: { text: string; isDisabled: boolean; onCommit(text: string): void }) {
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const commit = () => {
    if (draft !== text) onCommit(draft);
  };
  return (
    <TextArea
      aria-label={IC.text}
      styles={textArea}
      value={draft}
      isDisabled={isDisabled}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) commit();
        if (event.key === 'Escape') setDraft(text);
      }}
    />
  );
}

/** Shape: kind, fill and stroke (color, opacity, thickness), corner radius, and opacity. Stroke width and corner radius are pixels at a 540 short side. */
export function ShapePage(props: ItemPageProps<ShapeItem>) {
  const { item, sequence, edit, canChange } = props;
  const shape = asObject(item.shape);
  const disabled = !canChange;
  const live = (p: Json) => edit.live({ shape: patchShape(item.shape, p) });
  const commit = (p: Json) =>
    edit.commit([{ type: 'setStyle', sequenceId: sequence.id, itemId: item.id, shape: patchShape(item.shape, p) }]);
  const fill = colorParts(shape.fill, '#00000000');
  const stroke = colorParts(shape.stroke, '#00000000');
  const corners = Array.isArray(shape.cornerRadius) ? shape.cornerRadius : [shape.cornerRadius];
  const corner = num(corners[0], 0);
  return (
    <>
      <SecHead first>{IC.shape}</SecHead>
      <Sec>
        <PRow label={IC.shape}>
          <Picker
            aria-label={IC.shape}
            size="S"
            styles={shapePicker}
            selectedKey={SHAPE_CHOICES.some((choice) => choice.key === shape.shape) ? String(shape.shape) : 'rect'}
            isDisabled={disabled}
            onSelectionChange={(kind) => kind !== null && kind !== shape.shape && commit({ shape: kind })}>
            {SHAPE_CHOICES.map((choice) => (
              <PickerItem key={choice.key} id={choice.key}>
                {choice.label}
              </PickerItem>
            ))}
          </Picker>
        </PRow>
        <Card title={IC.fill}>
          <PRow label={IC.color}>
            <ColorField
              label={IC.fillColor}
              value={shape.fill}
              fallback="#3B63FB"
              allowAlpha={false}
              isDisabled={disabled}
              onLive={(hex) => live({ fill: withAlpha(hex, fill.alpha || 1, '#3B63FB') })}
              onCommit={(hex) => commit({ fill: withAlpha(hex, fill.alpha || 1, '#3B63FB') })}
            />
          </PRow>
          <ValueRow
            label={IC.opacity}
            value={Math.round(fill.alpha * 100)}
            min={0}
            max={100}
            unit="%"
            isDisabled={disabled}
            onLive={(v) => live({ fill: withAlpha(shape.fill, v / 100, '#3B63FB') })}
            onCommit={(v) => commit({ fill: withAlpha(shape.fill, v / 100, '#3B63FB') })}
          />
        </Card>
        <Card title={IC.stroke}>
          <PRow label={IC.color}>
            <ColorField
              label={IC.strokeColor}
              value={shape.stroke}
              fallback="#FFFFFF"
              allowAlpha={false}
              isDisabled={disabled}
              onLive={(hex) => live({ stroke: withAlpha(hex, stroke.alpha || 1, '#FFFFFF') })}
              onCommit={(hex) => commit({ stroke: withAlpha(hex, stroke.alpha || 1, '#FFFFFF') })}
            />
          </PRow>
          <ValueRow
            label={IC.opacity}
            value={Math.round(stroke.alpha * 100)}
            min={0}
            max={100}
            unit="%"
            isDisabled={disabled}
            onLive={(v) => live({ stroke: withAlpha(shape.stroke, v / 100, '#FFFFFF') })}
            onCommit={(v) => commit({ stroke: withAlpha(shape.stroke, v / 100, '#FFFFFF') })}
          />
          <ValueRow
            label={IC.strokeWidth}
            value={num(shape.strokeWidth, 0)}
            min={0}
            max={40}
            isDisabled={disabled}
            onLive={(strokeWidth) => live({ strokeWidth })}
            onCommit={(strokeWidth) => commit({ strokeWidth })}
          />
        </Card>
        {shape.shape === 'rect' ? (
          <ValueRow
            label={IC.corner}
            value={corner}
            min={0}
            max={72}
            isDisabled={disabled}
            onLive={(c) => live({ cornerRadius: [c, c, c, c] })}
            onCommit={(c) => commit({ cornerRadius: [c, c, c, c] })}
          />
        ) : null}
        <OpacityRow {...props} />
      </Sec>
      <Tail {...props} />
    </>
  );
}

/** Title of the generated-type element pages (stickers, counters, progress bars, waveforms). Counters share their category name with timeline blocks. */
export function elementTitle(item: VisualItem): string {
  switch (item.type) {
    case 'sticker':
      return item.sticker.source === 'asset' ? IC.titleAnimatedSticker : IC.titleSticker;
    case 'text':
      return item.counter ? IC.titleCounter : IC.titleText;
    case 'progress':
      return IC.titleProgress;
    case 'visualizer':
      return IC.titleVisualizer;
    case 'confetti':
      return IC.titleConfetti;
    case 'draw':
      return IC.titleDraw;
    case 'placeholder':
      return IC.titlePlaceholder;
    case 'whiteboard':
      return IC.titleWhiteboard;
    default:
      return IC.titleComposition;
  }
}

/** How kind parameters (`sticker`, `progress`, `visualizer`, `confetti`) are changed: dragging overlays the preview, and on release `setProps` replaces the whole object. When one item changes, the rest are copied over unchanged. */
function kindParams(props: ItemPageProps<VisualItem>, values: Json) {
  const { item, sequence, edit, canChange } = props;
  return {
    values,
    live: (p: Json) => edit.live({ props: { ...values, ...p } }),
    commit: (p: Json) => edit.commit([{ type: 'setProps', sequenceId: sequence.id, itemId: item.id, props: { ...values, ...p } }]),
    isDisabled: !canChange,
  };
}

/** Generated-type element page: parameters first, then appearance (opacity), geometry and time. */
function ElementPage({ children, ...props }: ItemPageProps<VisualItem> & { children: ReactNode }) {
  return (
    <>
      {children}
      <SecHead>{IC.appearance}</SecHead>
      <Sec>
        <OpacityRow {...props} />
      </Sec>
      <Tail {...props} />
    </>
  );
}

/** Sticker: template stickers can change color; animated stickers choose a play mode. */
export function StickerPage(props: ItemPageProps<StickerItem>) {
  const params = kindParams(props, asObject(props.item.sticker));
  return (
    <ElementPage {...props}>
      {props.item.sticker.source === 'asset' ? <LottieParams {...params} /> : <StickerParams {...params} />}
    </ElementPage>
  );
}

/** Progress bar. */
export function ProgressPage(props: ItemPageProps<ProgressItem>) {
  return (
    <ElementPage {...props}>
      <ProgressParams {...kindParams(props, asObject(props.item.progress))} canvas={props.sequence.canvas} />
    </ElementPage>
  );
}

/** Waveform. */
export function VisualizerPage(props: ItemPageProps<VisualizerItem>) {
  return (
    <ElementPage {...props}>
      <VisualizerParams {...kindParams(props, asObject(props.item.visualizer))} canvas={props.sequence.canvas} />
    </ElementPage>
  );
}

/** Confetti. */
export function ConfettiPage(props: ItemPageProps<ConfettiItem>) {
  return (
    <ElementPage {...props}>
      <ConfettiParams {...kindParams(props, asObject(props.item.confetti))} />
    </ElementPage>
  );
}

/** Counter (text with a timer readout): the timing method and clock face go through `setText` with `counter`, and the number's style goes through `setStyle`. */
function CounterPage(props: ItemPageProps<TextItem> & { counter: CounterProps }) {
  const { item, sequence, edit, canChange, counter } = props;
  const values: Json = { ...counter, style: asObject(item.style) };
  const live = (p: Json) => {
    if (p.style !== undefined) edit.live({ style: asObject(p.style) });
  };
  const commit = (p: Json) => {
    const { style: nextStyle, ...rest } = p;
    if (nextStyle !== undefined) edit.commit([{ type: 'setStyle', sequenceId: sequence.id, itemId: item.id, style: asObject(nextStyle) }]);
    if (Object.keys(rest).length)
      edit.commit([{ type: 'setText', sequenceId: sequence.id, itemId: item.id, counter: { ...counter, ...rest } as CounterProps }]);
  };
  return (
    <ElementPage {...props}>
      <CounterParams values={values} live={live} commit={commit} isDisabled={!canChange} />
    </ElementPage>
  );
}

/** Elements that do not yet have a dedicated page in the properties panel (hand-drawn, placeholder box, whiteboard): only appearance, geometry and time are offered. */
export function OtherElementPage(props: ItemPageProps<VisualItem>) {
  return (
    <ElementPage {...props}>
      <SecHead first>{IC.params}</SecHead>
      <Note>{IC.paramsReadOnly(elementTitle(props.item))}</Note>
    </ElementPage>
  );
}

/** Composition: code-package parameters must be validated against its Schema. The engine does not support this yet, so it is read-only. Then audio (if any), opacity, geometry and time. */
export function CompositionPage(props: ItemPageProps<CompositionItem>) {
  return (
    <>
      <SecHead first>{IC.params}</SecHead>
      <Note>{IC.compositionReadOnly}</Note>
      <SoundSection {...props} />
      <SecHead>{IC.appearance}</SecHead>
      <Sec>
        <OpacityRow {...props} />
      </Sec>
      <Tail {...props} />
    </>
  );
}

interface ParamProps {
  values: Json;
  isDisabled: boolean;
  live(patch: Json): void;
  commit(patch: Json): void;
}

/** Sticker: one color dot for each color in the template. Color changes are written to `fillOverrides` (keys are the template's original colors). */
function StickerParams({ values, isDisabled, live, commit }: ParamProps) {
  const templateId = typeof values.templateId === 'string' ? values.templateId : '';
  const layers = STICKER_TEMPLATES[templateId];
  const overrides = asObject(values.fillOverrides);
  const sources = [...new Set((layers ?? []).flatMap((layer) => [layer.fill, layer.stroke]).filter((c): c is string => !!c))];
  const overrideOf = (source: string) => Object.entries(overrides).find(([from]) => from.toLowerCase() === source.toLowerCase());
  const withOverride = (source: string, color: string) => {
    const next = Object.fromEntries(Object.entries(overrides).filter(([from]) => from.toLowerCase() !== source.toLowerCase()));
    return { fillOverrides: { ...next, [source]: color } };
  };
  return (
    <>
      <SecHead
        first
        aside={templateId || undefined}
        action={
          Object.keys(overrides).length ? (
            <ActionButton isQuiet size="XS" isDisabled={isDisabled} onPress={() => commit({ fillOverrides: {} })}>
              {IC.restoreColors}
            </ActionButton>
          ) : undefined
        }>
        {IC.color}
      </SecHead>
      <Sec>
        {layers ? (
          <div className={dots}>
            {sources.map((source) => (
              <ColorField
                key={source}
                label={IC.replaceColor(source)}
                value={overrideOf(source)?.[1] ?? source}
                fallback={source}
                isDisabled={isDisabled}
                onLive={(color) => live(withOverride(source, color))}
                onCommit={(color) => commit(withOverride(source, color))}
              />
            ))}
          </div>
        ) : (
          <Note>{IC.stickerUnknown(templateId)}</Note>
        )}
      </Sec>
    </>
  );
}

const LOOPS = [
  {
    key: 'loop',
    get label() {
      return IC.loopLoop;
    },
  },
  {
    key: 'once',
    get label() {
      return IC.loopOnce;
    },
  },
  {
    key: 'hold',
    get label() {
      return IC.loopHold;
    },
  },
] as const;

/** Lottie: loop, play once (stopping on the last frame), or freeze on the first frame. */
function LottieParams({ values, isDisabled, commit }: ParamProps) {
  const loop = values.loop === 'once' || values.loop === 'hold' ? values.loop : 'loop';
  return (
    <>
      <SecHead first>{IC.playback}</SecHead>
      <Sec>
        <Seg label={IC.playMode} value={loop} options={LOOPS} isDisabled={isDisabled} onChange={(key) => commit({ loop: key })} />
      </Sec>
    </>
  );
}

const MODES = [
  {
    key: 'countdown',
    get label() {
      return IC.countdown;
    },
  },
  {
    key: 'countup',
    get label() {
      return IC.countup;
    },
  },
] as const;
const FORMATS = [
  {
    key: 's',
    get label() {
      return IC.formatS;
    },
  },
  {
    key: 'mm:ss',
    get label() {
      return IC.formatMmss;
    },
  },
  {
    key: 'hh:mm:ss',
    get label() {
      return IC.formatHmmss;
    },
  },
] as const;

/** Counter: countdown or count-up, clock face format, and the number's text style (the same set as text clips). */
function CounterParams({ values, isDisabled, live, commit }: ParamProps) {
  const style = asObject(values.style);
  return (
    <>
      <SecHead first>{IC.titleCounter}</SecHead>
      <Sec>
        <PRow label={IC.timing}>
          <Seg
            label={IC.timingMode}
            value={values.mode === 'countup' ? 'countup' : 'countdown'}
            options={MODES}
            isDisabled={isDisabled}
            onChange={(mode) => commit({ mode })}
          />
        </PRow>
        <PRow label={IC.clockFace}>
          <Seg
            label={IC.clockFace}
            value={values.format === 'mm:ss' || values.format === 'hh:mm:ss' ? values.format : 's'}
            options={FORMATS}
            isDisabled={isDisabled}
            onChange={(format) => commit({ format })}
          />
        </PRow>
      </Sec>
      <SecHead>{IC.style}</SecHead>
      <Sec>
        <TextStyleEditor
          style={style}
          isDisabled={isDisabled}
          onLive={(p) => live({ style: { ...style, ...p } })}
          onCommit={(p) => commit({ style: { ...style, ...p } })}
        />
      </Sec>
    </>
  );
}
