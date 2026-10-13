import type { ReactNode } from 'react';
import type { Id } from '@cuccut/protocol';
import { CircleAlert, CircleCheck, CircleHelp, CircleX } from 'lucide-react';
import { Badge } from '../../cc/ui/badge.tsx';
import { badgeOf, type ReviewBadge as BadgeKind } from '../../model/review.ts';
import { useReview } from '../../state/review-store.ts';
import { REVIEW_COPY as C } from './review-copy.ts';

/**
 * A video's review verdict as a neutral badge (docs/cuccut/m2-review-gate.md §2.4): "Holds", "Worth a look", "Blocked"
 * or "Not checked", read from the `review` topic's summaries. A status never wears the accent: the badge is neutral and
 * only its icon carries the colour. With `onOpen` it is a button (the shorts page opens that short and its review).
 */

const ICON: Record<BadgeKind, ReactNode> = {
  passed: <CircleCheck aria-hidden className="text-success" />,
  findings: <CircleAlert aria-hidden className="text-warning" />,
  failed: <CircleX aria-hidden className="text-destructive" />,
  notReviewed: <CircleHelp aria-hidden className="text-muted-foreground" />,
};

export function ReviewBadge({ videoId, onOpen }: { videoId: Id; onOpen?: () => void }) {
  const kind = badgeOf(useReview((s) => s.results[videoId]));
  const face = (
    <>
      {ICON[kind]}
      {C.badge[kind]}
    </>
  );
  return (
    <span data-cc className="contents">
      {onOpen ? (
        <Badge variant="outline" render={<button type="button" onClick={onOpen} title={C.openReview} />} className="cursor-pointer hover:bg-white/10">
          {face}
        </Badge>
      ) : (
        <Badge variant="outline">{face}</Badge>
      )}
    </span>
  );
}
