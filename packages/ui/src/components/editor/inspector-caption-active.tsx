import { Switch } from '@react-spectrum/s2';
import { useEffect, useMemo, useRef } from 'react';
import { editWordStyle, lineBody } from '../../model/caption-presets.ts';
import type { CaptionStyleBody } from '../../model/caption-style-body.ts';
import {
  ACTIVE_MODES,
  SPOKEN_MODES,
  UNSPOKEN_MODES,
  activeForMode,
  inkOn,
  type ActiveMode,
  type ActiveWord,
} from '../../model/caption-word-animation.ts';
import type { Json, LineKind } from '../../render/text-style.ts';
import { useCaptionSection } from './caption-open.ts';
import { CAPTION_PANEL_COPY as P } from './caption-panel-copy.ts';
import { StyleCells } from './caption-style-cells.tsx';
import { INSPECTOR_COPY as IC } from './inspector-copy.ts';
import { ColorField, Note, PRow, Sec, SecHead, Seg, ValueRow } from './inspector-controls.tsx';

/** Input shared by the three sections “current word”, “motion” and “reverse”: how the style that this line overlays is read, and to whom the root style goes after editing (while dragging or on release). */
export interface WordSectionProps {
  root: Json;
  kind: LineKind;
  paired: boolean;
  isDisabled: boolean;
  onLive(next: Json): void;
  onCommit(next: Json): void;
}

/** Changes one word-level dimension and returns the root style after the edit (`editWordStyle`, which writes back only word-level keys). */
export function useWordEdit({ root, kind, paired }: Pick<WordSectionProps, 'root' | 'kind' | 'paired'>) {
  const body = useMemo(() => lineBody(root, kind), [root, kind]);
  const edit = (change: (b: CaptionStyleBody) => CaptionStyleBody) => editWordStyle(root, kind, paired, change);
  return { body, edit };
}

/** When the properties page is asked to scroll to this section (the caption toolbar's “animation”), it scrolls there and then clears the request. */
export function useSectionFocus() {
  const ref = useRef<HTMLDivElement>(null);
  const focus = useCaptionSection((s) => s.focus);
  useEffect(() => {
    if (focus !== 'active' || !ref.current) return;
    ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    useCaptionSection.setState({ focus: null });
  }, [focus]);
  return ref;
}

/**
 * Caption properties page “current word” (prototype panel-subactive.jsx; caption style model design §4 / §9): what the word being read looks like, and how words already read or not yet reached are handled. Each cell is a thumbnail of this line with that mode applied. Only word-level keys are changed; no appearance keys are touched. The translation has no per-word timing, so this section only shows an explanation.
 */
export function CaptionActiveSection(props: WordSectionProps) {
  const { root, kind, isDisabled, onLive, onCommit } = props;
  const ref = useSectionFocus();
  const { body, edit } = useWordEdit(props);
  const a = body.activeWord;
  const ink = body.surface.color;
  const cells = useMemo(
    () =>
      ACTIVE_MODES.map((mode) => ({
        key: mode,
        name: P.modes[mode],
        root: editWordStyle(root, kind, props.paired, (b) => ({ ...b, motion: undefined, activeWord: activeForMode(mode, b.activeWord, b.surface.color) })),
      })),
    [root, kind, props.paired],
  );
  if (kind === 'translation')
    return (
      <div ref={ref}>
        <SecHead>{P.active}</SecHead>
        <Sec>
          <Note>{P.noWordTiming}</Note>
        </Sec>
      </div>
    );

  const next = (change: Partial<ActiveWord>) => edit((b) => ({ ...b, activeWord: { ...b.activeWord, ...change } }));
  const live = (change: Partial<ActiveWord>) => onLive(next(change));
  const commit = (change: Partial<ActiveWord>) => onCommit(next(change));
  const isBox = a.mode === 'box';
  const sweep = a.mode === 'sweep';
  const needsColor = a.mode !== 'none' || a.spoken === 'tint';
  const colorOf = isBox ? a.box?.color : a.mode === 'none' ? a.spokenColor : a.color;
  const colorChange = (color: string): Partial<ActiveWord> =>
    isBox && a.box ? { box: { ...a.box, color }, color: inkOn(color) } : a.mode === 'none' ? { spokenColor: color } : { color };
  const sweepOf = a.sweep ?? { unit: 'grapheme' as const, guide: false, nextLine: false };

  return (
    <div ref={ref}>
      <SecHead>{P.active}</SecHead>
      <Sec>
        <StyleCells
          label={P.activeAria}
          cells={cells}
          value={a.mode}
          kind={kind}
          isDisabled={isDisabled}
          onPick={(mode) => onCommit(edit((b) => ({ ...b, activeWord: activeForMode(mode as ActiveMode, b.activeWord, ink) })))}
        />
        {needsColor ? (
          <PRow label={isBox ? P.boxColor : a.mode === 'none' ? P.tintColor : P.color}>
            <ColorField
              label={isBox ? P.boxColor : a.mode === 'none' ? P.tintColor : P.color}
              value={colorOf}
              fallback={ink}
              isDisabled={isDisabled}
              onLive={(color) => live(colorChange(color))}
              onCommit={(color) => commit(colorChange(color))}
            />
          </PRow>
        ) : null}
        {a.mode !== 'none' && !sweep ? (
          <ValueRow
            label={P.scale}
            value={a.scale ?? 1}
            min={1}
            max={1.3}
            step={0.01}
            digits={2}
            unit={P.times}
            isDisabled={isDisabled}
            onLive={(scale) => live({ scale })}
            onCommit={(scale) => commit({ scale })}
          />
        ) : null}
        {a.mode !== 'none' ? (
          <ValueRow
            label={P.transition}
            value={a.durationSeconds ?? 0.16}
            min={0}
            max={0.6}
            step={0.02}
            digits={2}
            unit={IC.seconds}
            isDisabled={isDisabled}
            onLive={(durationSeconds) => live({ durationSeconds })}
            onCommit={(durationSeconds) => commit({ durationSeconds })}
          />
        ) : null}
        <PRow label={P.spoken}>
          <Seg
            label={P.spoken}
            value={a.spoken}
            // The color sweep is itself a dye (§5), so no “dye color” option is offered.
            options={SPOKEN_MODES.filter((m) => !(sweep && m === 'tint')).map((m) => ({ key: m, label: P.spokenModes[m] }))}
            isDisabled={isDisabled}
            onChange={(spoken) => commit({ spoken })}
          />
        </PRow>
        <PRow label={P.unspoken}>
          <Seg
            label={P.unspoken}
            value={a.unspoken}
            options={UNSPOKEN_MODES.map((m) => ({ key: m, label: P.unspokenModes[m] }))}
            isDisabled={isDisabled}
            onChange={(unspoken) => commit({ unspoken })}
          />
        </PRow>
        {sweep ? (
          <>
            <PRow label={P.sweepUnit}>
              <Seg
                label={P.sweepUnit}
                value={sweepOf.unit}
                options={(['grapheme', 'word'] as const).map((u) => ({ key: u, label: P.sweepUnits[u] }))}
                isDisabled={isDisabled}
                onChange={(unit) => commit({ sweep: { ...sweepOf, unit } })}
              />
            </PRow>
            <PRow label={P.guide}>
              <Switch size="S" isSelected={sweepOf.guide} isDisabled={isDisabled} onChange={(guide) => commit({ sweep: { ...sweepOf, guide } })}>
                {P.guideNote}
              </Switch>
            </PRow>
            <PRow label={P.nextLine}>
              <Switch
                size="S"
                isSelected={sweepOf.nextLine}
                isDisabled={isDisabled}
                onChange={(nextLine) => commit({ sweep: { ...sweepOf, nextLine } })}>
                {P.nextLineNote}
              </Switch>
            </PRow>
          </>
        ) : null}
      </Sec>
    </div>
  );
}
