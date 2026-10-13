import { useMemo, useState } from 'react';
import { editWordStyle } from '../../model/caption-presets.ts';
import {
  MOTION_PRESETS,
  MOTION_STAGES,
  MOTION_UNITS,
  hasMotion,
  isSpokenPreset,
  motionEffect,
  type Motion,
  type MotionEffect,
  type MotionStage,
} from '../../model/caption-style-body.ts';
import { normalizeActive } from '../../model/caption-word-animation.ts';
import { CAPTION_PANEL_COPY as P } from './caption-panel-copy.ts';
import { StyleCells } from './caption-style-cells.tsx';
import { useWordEdit, type WordSectionProps } from './inspector-caption-active.tsx';
import { INSPECTOR_COPY as IC } from './inspector-copy.ts';
import { Note, PRow, Sec, SecHead, Seg, ValueRow } from './inspector-controls.tsx';

const NONE = '';

/**
 * Caption properties page “动效” (motion) (prototype panel-submotion.jsx; caption style model design §5 / §9): for the entry, exit and loop phases, pick one for each. Once selected, its unit, duration and strength can be adjusted. Each cell is a thumbnail with only this motion applied to this line (the current word is unchanged).
 *
 * The trigger is decided by the motion itself. The “念到时” (on reading) ones, such as drop-in, float-in and page-turn, belong to the continuous track of the per-word animation catalog, and the core draws them word by word as they are read. The rest are `textMotion`, which trigger on appearance. The Studio style has no other place to record a trigger, so here it is only shown and cannot be changed. The translation has no per-word timing, so the “念到时” (on reading) ones are not offered.
 */
export function CaptionMotionSection(props: WordSectionProps) {
  const { root, kind, paired, isDisabled, onLive, onCommit } = props;
  const [stage, setStage] = useState<MotionStage>('in');
  const { body, edit } = useWordEdit(props);
  const source = kind === 'original';
  const motion: Motion = body.motion ?? {};
  const e = motion[stage] ?? null;

  const withStage = (m: Motion, effect: MotionEffect | null): Motion | undefined => {
    const out: Motion = { ...m };
    if (effect) out[stage] = effect;
    else delete out[stage];
    return hasMotion(out) ? out : undefined;
  };
  const presets = MOTION_PRESETS[stage].filter((p) => source || !isSpokenPreset(p.key));
  const cells = useMemo(
    () =>
      [{ key: NONE, effect: null }, ...presets.map((p) => ({ key: p.key, effect: motionEffect(stage, p.key) }))].map(({ key, effect }) => ({
        key,
        name: key ? (P.presets[key] ?? key) : P.noMotion,
        root: editWordStyle(root, kind, paired, (b) => ({
          ...b,
          activeWord: normalizeActive({ mode: 'none' }),
          motion: effect ? { [stage]: effect } : undefined,
        })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- presets are determined by stage and source
    [root, kind, paired, stage, source],
  );

  const write = (effect: MotionEffect | null) => edit((b) => ({ ...b, motion: withStage(b.motion ?? {}, effect) }));
  const tune = (patch: Partial<MotionEffect>) => (e ? write({ ...e, ...patch }) : root);
  const catalog = !!e && isSpokenPreset(e.preset);
  const stageLabel = (s: MotionStage) => {
    const own = motion[s];
    return own ? `${P.stages[s]} · ${P.presets[own.preset] ?? own.preset}` : P.stages[s];
  };

  return (
    <>
      <SecHead>{P.motion}</SecHead>
      <Sec>
        <Seg<MotionStage> label={P.motion} value={stage} options={MOTION_STAGES.map((s) => ({ key: s, label: stageLabel(s) }))} onChange={setStage} />
        <StyleCells
          label={P.stageAria(P.stages[stage])}
          cells={cells}
          value={e?.preset ?? NONE}
          kind={kind}
          isDisabled={isDisabled}
          onPick={(key) => onCommit(write(key ? motionEffect(stage, key, source ? undefined : { trigger: 'enter' }) : null))}
        />
        {!e ? (
          <Note>{P.emptyStage[stage]}</Note>
        ) : catalog ? (
          <>
            {stage === 'in' ? (
              <PRow label={P.trigger}>
                <Seg label={P.trigger} value="spoken" options={[{ key: 'spoken', label: P.triggers.spoken }]} isDisabled onChange={() => undefined} />
              </PRow>
            ) : null}
            <ValueRow
              label={P.intensity}
              value={Math.round((e.intensity ?? 1) * 100)}
              min={0}
              max={150}
              step={5}
              unit="%"
              isDisabled={isDisabled}
              onLive={(v) => onLive(tune({ intensity: v / 100 }))}
              onCommit={(v) => onCommit(tune({ intensity: v / 100 }))}
            />
            <Note>{P.catalogNote}</Note>
          </>
        ) : (
          <>
            <PRow label={P.unit}>
              <Seg
                label={P.unit}
                value={e.unit}
                options={MOTION_UNITS.map((u) => ({ key: u, label: P.units[u] }))}
                isDisabled={isDisabled}
                onChange={(unit) => onCommit(tune({ unit }))}
              />
            </PRow>
            {stage === 'in' ? (
              <PRow label={P.trigger}>
                <Seg
                  label={P.trigger}
                  value="enter"
                  // “念到时” (on reading) is offered only for the source-language line. Studio's textMotion only recognizes on-appearance, so this cell is locked.
                  options={[
                    { key: 'enter', label: P.triggers.enter },
                    ...(source ? [{ key: 'spoken', label: P.triggers.spoken }] : []),
                  ]}
                  isDisabled
                  onChange={() => undefined}
                />
              </PRow>
            ) : null}
            <ValueRow
              label={P.duration}
              value={e.durationSeconds}
              min={0.02}
              max={stage === 'loop' ? 3 : 1.2}
              step={0.02}
              digits={2}
              unit={IC.seconds}
              isDisabled={isDisabled}
              onLive={(durationSeconds) => onLive(tune({ durationSeconds }))}
              onCommit={(durationSeconds) => onCommit(tune({ durationSeconds }))}
            />
            <ValueRow
              label={P.intensity}
              value={Math.round((e.intensity ?? 1) * 100)}
              min={0}
              max={150}
              step={5}
              unit="%"
              isDisabled={isDisabled}
              onLive={(v) => onLive(tune({ intensity: v / 100 }))}
              onCommit={(v) => onCommit(tune({ intensity: v / 100 }))}
            />
          </>
        )}
      </Sec>
    </>
  );
}
