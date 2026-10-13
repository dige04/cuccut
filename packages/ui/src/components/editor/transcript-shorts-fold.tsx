import { ActionButton } from '@react-spectrum/s2';
import Cut from '@react-spectrum/s2/icons/Cut';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { formatDuration } from '../../model/format.ts';
import type { ShortsFold } from '../../model/shorts-fold.ts';
import { SHORTS_COPY as S } from './shorts-copy.ts';

const seam = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28, paddingTop: 8, font: 'ui-xs', color: 'gray-600' });
const icon = style({ display: 'flex', flexShrink: 0, color: 'gray-500' });
const label = style({ flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const line = style({ flexGrow: 1, minWidth: 16, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'gray-300', borderBottomWidth: 0, borderStartWidth: 0, borderEndWidth: 0 });
const acts = style({ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 });

/** The line text of a fold seam: while still folded, say how long it is; once spread out, say how many sentences were revealed. */
export function foldText(fold: ShortsFold): string {
  if (fold.count > 0) {
    const length = formatDuration(fold.seconds * 1000);
    return fold.side === 'before' ? S.foldBefore(length) : S.foldAfter(length);
  }
  return fold.side === 'before' ? S.foldBeforeOpen(fold.total) : S.foldAfterOpen(fold.total);
}

/**
 * The folded-out part of a sub-video transcript (prototype panel-transcript-cut.jsx `ShortsFoldSeam`, product design §5.10): “前面 / 后面 X 已剪掉” (X sentences before / after have been cut). “Expand N sentences” reveals one batch close to the clip at a time, and an expanded part can be “collapsed.” There is no button to restore the whole run at once: click each sentence to put it back.
 */
export function ShortsFoldSeam({ fold, onMore, onCollapse }: { fold: ShortsFold; onMore(): void; onCollapse(): void }) {
  const text = foldText(fold);
  return (
    <div className={seam} role="group" aria-label={text}>
      <span className={icon}>
        <Cut />
      </span>
      <span className={label} title={text}>
        {text}
      </span>
      <span className={line} aria-hidden />
      <span className={acts}>
        {fold.count > 0 ? (
          <ActionButton size="XS" isQuiet onPress={onMore}>
            {fold.shown ? S.expandMore(fold.next) : S.expand(fold.next)}
          </ActionButton>
        ) : null}
        {fold.shown ? (
          <ActionButton size="XS" isQuiet onPress={onCollapse}>
            {S.collapse}
          </ActionButton>
        ) : null}
      </span>
    </div>
  );
}
