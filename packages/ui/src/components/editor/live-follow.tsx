import { useEffect, useRef, useState } from 'react';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };

/*
 * Shared pieces of the live lists shown during transcription (prototype panels.jsx `LiveTranscript`, the EditView in panel-subtitle.jsx during transcription, ui.css `.liveskel`,
 * `.livejump`): the live transcript in the script panel and the live caption card in the subtitle panel follow the same rule. New items follow to the latest; scrolling up stops following and shows “Back to latest”;
 * when there are no items yet, three skeleton cards and one line of hint are drawn, with no fake data.
 */

/** Within this many pixels of the bottom counts as “at the latest”, and follow-scrolling continues. */
const FOLLOW_SLACK = 24;

const skeleton = style({ display: 'flex', flexDirection: 'column', gap: 12 });
const skeletonRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '[6px]',
  paddingX: 8,
  paddingY: 8,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const skeletonHead = style({ width: 64, height: 12, borderRadius: 'sm', backgroundColor: 'gray-200' });
const skeletonLine = style({ height: 14, borderRadius: 'sm', backgroundColor: 'gray-100' });
const hintText = style({ font: 'ui-xs', color: 'gray-600', margin: 0, paddingX: 4 });
/** “Back to latest” (prototype `.livejump`): floats at the bottom center when scrolling up has stopped following. */
const jump = style({
  position: 'absolute',
  insetStart: '50%',
  bottom: 16,
  translateX: '-50%',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  height: 32,
  paddingX: 12,
  borderWidth: 0,
  borderRadius: 'full',
  backgroundColor: 'gray-900',
  font: 'ui-sm',
  color: 'gray-25',
  fontWeight: 'bold',
  boxShadow: 'elevated',
  cursor: 'pointer',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});

/**
 * Scrolls down to follow the latest item: when `count` changes (a new item arrives), the panel resizes, or the layout settles a beat late, the view sticks to the bottom while following. When the user scrolls up and leaves the bottom,
 * following stops; `toLatest` returns to the bottom and resumes following. `bodyRef` is attached to the scrolling layer, and `onScroll` is attached to its scroll events.
 */
export function useFollowLatest(count: number) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;
  useEffect(() => {
    const element = bodyRef.current;
    if (element && follow) element.scrollTop = element.scrollHeight;
  }, [count, follow]);
  const some = count > 0;
  useEffect(() => {
    const element = bodyRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (followRef.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [some]);
  const onScroll = () => {
    const element = bodyRef.current;
    if (!element) return;
    const atEnd = element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_SLACK;
    if (atEnd !== follow) setFollow(atEnd);
  };
  const toLatest = () => {
    setFollow(true);
    const element = bodyRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  };
  return { bodyRef, follow, onScroll, toLatest };
}

/** No items yet: three skeleton cards and one line of hint (no promise of when results will appear, since some services only return everything together when they finish). */
export function LiveSkeleton({ hint }: { hint: string }) {
  return (
    <div className={skeleton}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={skeletonRow} aria-hidden>
          <span className={skeletonHead} />
          <span className={skeletonLine} />
          <span className={skeletonLine} style={{ width: '62%' }} />
        </div>
      ))}
      <p className={hintText}>{hint}</p>
    </div>
  );
}

/** “Back to latest”, floating at the bottom center of the list while following is stopped; placed in the outer list wrapper (the positioning context). */
export function JumpToLatest({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <button type="button" className={jump} onClick={onPress}>
      <ChevronDown />
      {label}
    </button>
  );
}
