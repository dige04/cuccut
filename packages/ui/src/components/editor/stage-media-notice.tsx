import { Button } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import { iconStyle, lightDark, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { STAGE_MEDIA_COPY as C } from '../../model/stage-media.ts';
import type { StageMedia } from './use-stage-media.ts';

/** Overlays the picture and does not capture the pointer: clicking the picture still selects or deselects as usual (design draft `.stagemedia`). */
const layer = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  boxSizing: 'border-box',
  pointerEvents: 'none',
});
/** The area behind the picture is always black and cards are always dark: they do not flip with the light/dark theme. */
const card = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  gap: 4,
  maxWidth: 440,
  paddingX: 16,
  paddingY: 12,
  borderRadius: 'lg',
  backgroundColor: 'transparent-black-800',
  // The `font` shorthand sets a color of its own, so the color must be written after it.
  font: 'ui-sm',
  color: 'transparent-white-800',
  overflowWrap: 'anywhere',
});
const title = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'title-sm', color: 'white' });
const name = style({ color: 'transparent-white-900' });
const hint = style({ color: 'transparent-white-600' });
const failure = style({ color: lightDark('red-700', 'red-1000') });
const action = style({ marginTop: 4, pointerEvents: 'auto' });

/**
 * The persistent card in the middle of the picture when main media cannot be played (design draft stage.jsx `StageMediaNotice`). It does not go away during playback: captions and elements are still drawn around it.
 * On desktop there is one extra “relink…” (the design draft puts it in the ⋯ menu in Space; here it is moved onto the card, see model/stage-media.ts).
 */
export function StageMediaNotice({ media, frame }: { media: StageMedia; frame: { left: number; top: number; width: number; height: number } }) {
  const n = media.notice;
  if (!n) return null;
  return (
    <div className={layer} style={frame} role="alert" data-stage-media={n.kind}>
      <div className={card}>
        <div className={title}>
          <AlertTriangle styles={iconStyle({ size: 'S', color: 'notice' })} />
          {n.title}
        </div>
        <div className={name}>{n.name}</div>
        <div>{n.body}</div>
        {n.volume ? <div>{n.volume}</div> : null}
        {n.more ? <div>{n.more}</div> : null}
        {media.error ? (
          <div className={failure}>{media.error}</div>
        ) : media.busy ? (
          <div className={hint}>{C.relinking}</div>
        ) : n.hint ? (
          <div className={hint}>{n.hint}</div>
        ) : null}
        {n.relink ? (
          <div className={action}>
            <Button
              variant="primary"
              staticColor="white"
              size="S"
              isPending={media.busy}
              isDisabled={!media.canRelink}
              aria-label={C.label(n.relink.name)}
              onPress={media.relink}>
              {C.relink}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
