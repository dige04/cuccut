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

/** 剪缝那一行的文字：还收着时说收着多长，都铺开了说铺开了几句。 */
export function foldText(fold: ShortsFold): string {
  if (fold.count > 0) {
    const length = formatDuration(fold.seconds * 1000);
    return fold.side === 'before' ? S.foldBefore(length) : S.foldAfter(length);
  }
  return fold.side === 'before' ? S.foldBeforeOpen(fold.total) : S.foldAfterOpen(fold.total);
}

/**
 * 子视频文稿里片段外收起来的那一截（原型 panel-transcript-cut.jsx `ShortsFoldSeam`，产品设计 §5.10）：「前面 / 后面 X 已剪掉」，
 * 「展开 N 句」一次铺出靠近片段的一批，铺开过的可以「收起」。没有整截恢复的按钮：要放回哪句点哪句。
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
