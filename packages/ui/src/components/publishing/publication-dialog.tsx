'use client';

import { useEffect, useRef, useState } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { XIcon } from 'lucide-react';
import type { Id, PublicationDetail } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../cc/ui/dialog';
import { Skeleton } from '../../cc/ui/skeleton';
import { useRuntime } from '../../runtime/context.tsx';
import { unarchivePublication } from '../../runtime/publishing-commands.ts';
import { PublicationForm, usePublicationForm } from './publication-form.tsx';
import { PC } from './publishing-copy.ts';

/** Whether the dialog may close now (not while the draft is dirty or a write runs). */
interface CloseGuard {
  blocked: boolean;
}

/**
 * The publication dialog (design §2.4, agentcut's calendar dialog around `PublicationForm`): up to 70rem × 92dvh, 20px corners, two columns from
 * `lg`. It cannot close while the draft is dirty or a write runs: the close button hides, and Escape or a click outside is refused with the
 * footer's save-or-discard hint.
 */
export function PublicationDialog({
  publicationId,
  onClose,
  onOpenPublication,
}: {
  publicationId: Id | null;
  onClose: () => void;
  /** Opens another publication in this dialog (a new release). */
  onOpenPublication: (id: Id) => void;
}) {
  const guard = useRef<CloseGuard>({ blocked: false });
  const [refused, setRefused] = useState(0);
  return (
    <Dialog
      open={!!publicationId}
      onOpenChange={(open) => {
        if (open) return;
        if (guard.current.blocked) setRefused((n) => n + 1);
        else onClose();
      }}
    >
      <DialogContent
        data-cc
        showCloseButton={false}
        className="max-h-[92dvh] w-[min(70rem,calc(100%-2rem))] max-w-[calc(100%-2rem)] gap-5 overflow-y-auto pb-0 sm:max-w-[70rem]"
      >
        {publicationId ? (
          <DialogBody
            key={publicationId}
            publicationId={publicationId}
            guard={guard.current}
            refused={refused}
            onClose={onClose}
            onOpenPublication={onOpenPublication}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  publicationId,
  guard,
  refused,
  onClose,
  onOpenPublication,
}: {
  publicationId: Id;
  guard: CloseGuard;
  refused: number;
  onClose: () => void;
  onOpenPublication: (id: Id) => void;
}) {
  const runtime = useRuntime();
  const load = usePublicationForm(publicationId, onOpenPublication);
  const form = load.kind === 'ready' ? load.form : null;
  const blocked = !!form && (form.dirty || form.busy);
  const [shownRefusal] = useState(refused);
  useEffect(() => {
    guard.blocked = blocked;
  }, [guard, blocked]);
  useEffect(
    () => () => {
      guard.blocked = false;
    },
    [guard],
  );

  const archived = (p: PublicationDetail) => {
    onClose();
    ToastQueue.neutral(PC.form.archived(p.label), {
      timeout: 6000,
      actionLabel: PC.form.undoArchive,
      shouldCloseOnAction: true,
      onAction: () => {
        void unarchivePublication(runtime, p.id, p.revision).catch((e: Error) => ToastQueue.negative(e.message, { timeout: 5000 }));
      },
    });
  };

  return (
    <>
      <DialogHeader className="pr-10">
        <DialogTitle>{form?.saved.label || PC.form.fallbackTitle}</DialogTitle>
        <DialogDescription>{PC.form.lead}</DialogDescription>
      </DialogHeader>
      {!blocked ? (
        <Button type="button" variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={PC.form.close} onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      ) : null}
      {load.kind === 'loading' ? (
        <div role="status" aria-label={PC.form.loading} className="mb-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      ) : load.kind === 'failed' ? (
        <p role="alert" className="mb-6 text-sm text-destructive">
          {PC.form.loadFailed(load.message)}
        </p>
      ) : (
        <PublicationForm form={load.form} closeRefused={refused > shownRefusal} onArchived={archived} />
      )}
    </>
  );
}
