import { useEffect, useState } from 'react';
import type { Id, ReviewBlock } from '@cuccut/protocol';
import { Button } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { useRuntime } from '../../runtime/context.tsx';
import { useSetting } from '../../state/settings-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { openReview } from '../review/review-dialog.tsx';
import { REVIEW_COPY } from '../review/review-copy.ts';
import { ShieldCheckIcon } from '../review/review-icon.tsx';

/**
 * The review note on the export popover's Video page (docs/cuccut/m2-review-gate.md §2.2), beside the font note: when
 * the gate is on and the project tier has open critical findings, a neutral notice says how many things would stop this
 * export, with "Open the review". It is read (`review.check`, nothing written) when the page opens and again after each
 * edit. The Export button stays the one primary and is not disabled: the Runtime decides, and its refusal explains itself.
 */

const note = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
  font: 'ui-xs',
  color: 'gray-800',
  minWidth: 0,
  overflowWrap: 'anywhere',
});
const icon = style({ display: 'flex', flexShrink: 0, color: 'gray-700' });
const grow = style({ flexGrow: 1, minWidth: 0 });

export function ExportReviewNote({ videoId, sequenceId, onLeave }: { videoId: Id; sequenceId: Id | null; onLeave?: () => void }) {
  const runtime = useRuntime();
  const gate = useSetting('review.gate') !== false;
  const revision = useVideo((s) => (s.video?.videoId === videoId ? (s.video.state?.video.revision ?? null) : null));
  const [block, setBlock] = useState<ReviewBlock | null>(null);

  useEffect(() => {
    if (!gate) {
      setBlock(null);
      return;
    }
    let cancelled = false;
    runtime.reviewCheck(videoId, sequenceId ?? undefined).then(
      (outcome) => !cancelled && setBlock(outcome.blocks),
      // The note is advice: if the check cannot be read, the export's own refusal still speaks.
      () => !cancelled && setBlock(null),
    );
    return () => {
      cancelled = true;
    };
  }, [runtime, videoId, sequenceId, revision, gate]);

  if (!gate || !block || !block.findings.length) return null;
  return (
    <div className={note} role="status">
      <span className={icon}>
        <ShieldCheckIcon />
      </span>
      <span className={grow}>{REVIEW_COPY.exportNote(block.findings.length)}</span>
      <Button
        variant="secondary"
        size="S"
        onPress={() => {
          onLeave?.();
          openReview(videoId);
        }}>
        {REVIEW_COPY.openReview}
      </Button>
    </div>
  );
}
