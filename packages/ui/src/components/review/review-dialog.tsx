import { useEffect } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { Id } from '@cuccut/protocol';
import { ShieldCheck, XIcon } from 'lucide-react';
import { create } from 'zustand';
import { Button } from '../../cc/ui/button.tsx';
import { Dialog, DialogContent } from '../../cc/ui/dialog.tsx';
import { REVIEW_COPY as C } from './review-copy.ts';
import { ReviewPanel } from './review-panel.tsx';

/**
 * "What correct looks like" (docs/cuccut/m2-review-gate.md §2.1): the review of the open video, in a solid 20px dialog
 * that scrolls inside. It has no route: the header's Video menu, the export note and the export rejection's "Open the
 * review" all open it through `openReview(videoId)`, as the Video menu opens the video settings.
 */

const useReviewDialog = create<{ videoId: Id | null }>(() => ({ videoId: null }));

/** Open the review of a video; the dialog shows it when that video is the one open in the editor. */
export function openReview(videoId: Id): void {
  useReviewDialog.setState({ videoId });
}

export function closeReview(): void {
  useReviewDialog.setState({ videoId: null });
}

/** Dialogs mounted per video: the request to show a video's review lasts only while a dialog for that video is mounted. */
const mounted = new Map<Id, number>();

/**
 * Keeps the request from outliving the editor of its video: when the last dialog for a video unmounts (the editor moved to
 * another video, or closed), a request still naming it is dropped, so coming back to that video later does not pop the
 * review open by itself. Checked a tick later, so a remount of the same video (or a request for the video the editor is
 * about to show) keeps it.
 */
function useReleaseOnUnmount(videoId: Id): void {
  useEffect(() => {
    mounted.set(videoId, (mounted.get(videoId) ?? 0) + 1);
    return () => {
      const left = (mounted.get(videoId) ?? 1) - 1;
      if (left > 0) mounted.set(videoId, left);
      else mounted.delete(videoId);
      setTimeout(() => {
        if (!mounted.has(videoId) && useReviewDialog.getState().videoId === videoId) closeReview();
      }, 0);
    };
  }, [videoId]);
}

/** Mounted beside the video settings dialog in the editor; `sequenceId` is the sequence the editor shows (the review's default is the root). */
export function ReviewDialog({ videoId, sequenceId }: { videoId: Id; sequenceId: Id | null }) {
  const open = useReviewDialog((s) => s.videoId === videoId);
  useReleaseOnUnmount(videoId);
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : closeReview())}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(720px,calc(100dvh-48px))] w-[min(560px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(560px,calc(100%-2rem))]">
        {open ? (
          <div data-cc className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-start gap-3 px-6 pt-5 pb-3">
              <ShieldCheck aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
              <DialogPrimitive.Title className="min-w-0 flex-1 font-heading text-xl leading-snug font-medium text-foreground">{C.title}</DialogPrimitive.Title>
              <Button variant="ghost" size="icon-sm" aria-label={C.close} title={C.close} onClick={closeReview}>
                <XIcon aria-hidden />
              </Button>
            </header>
            <div className="cc-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              <ReviewPanel videoId={videoId} sequenceId={sequenceId} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
