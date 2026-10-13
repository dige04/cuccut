'use client';

import { useEffect, useRef } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { isValidTimezone } from '@cuccut/protocol';
import { dueToasts } from '../../model/publishing-due.ts';
import { usePublishing } from '../../state/publishing-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { BatchPublicationsDialog } from './batch-publications-dialog.tsx';
import { PublicationDialog } from './publication-dialog.tsx';
import { PC } from './publishing-copy.ts';
import { closeBatchDialog, closePublicationDialog, usePublishingLaunch } from './publishing-launch.ts';

/** How long a "Time to post …" reminder stays (it has an Open button; `toast-timing.ts` keeps it while the pointer or focus is on it). */
const DUE_TOAST_MS = 15_000;

/**
 * The publication dialog and the batch dialog opened from screens other than the calendar (the editor's "Publish…", the library's "Prepare
 * publication", the shorts result page's "Prepare publications", the calendar's Unscheduled selection). Mounted once on the shell. Moving to another
 * page closes them (their drafts are saved or discarded first: a link inside them does not navigate while a draft has unsaved edits).
 */
export function PublishingDialogsHost() {
  const publicationId = usePublishingLaunch((s) => s.publicationId);
  const batch = usePublishingLaunch((s) => s.batch);
  const batchKey = usePublishingLaunch((s) => s.batchKey);
  const tab = useShell((s) => s.route.tab);
  const firstTab = useRef(tab);
  useEffect(() => {
    if (tab === firstTab.current) return;
    firstTab.current = tab;
    closePublicationDialog();
    closeBatchDialog();
  }, [tab]);
  return (
    <>
      <PublicationDialog
        publicationId={publicationId}
        onClose={closePublicationDialog}
        onOpenPublication={(id) => usePublishingLaunch.setState({ publicationId: id })}
      />
      <BatchPublicationsDialog key={batchKey} source={batch} onClose={closeBatchDialog} />
    </>
  );
}

/**
 * Reminders for by-hand posts (design §2.1 flow 6): each `due` event from the Runtime shows "Time to post "{label}" on {account}." once, with
 * "Open", which takes the calendar to that day with the publication open. Closing the toast takes the reminder off the queue; the calendar's
 * "Post by hand" list keeps showing what is still due.
 */
export function PublishingDueHost() {
  const due = usePublishing((s) => s.due);
  const rows = usePublishing((s) => s.publications);
  const accounts = usePublishing((s) => s.accounts);
  const timezone = usePublishing((s) => (s.settings && isValidTimezone(s.settings.timezone) ? s.settings.timezone : 'UTC'));
  const shown = useRef(new Set<string>());
  useEffect(() => {
    for (const toast of dueToasts(due, rows, accounts, shown.current, timezone)) {
      shown.current.add(toast.key);
      const dismiss = () => usePublishing.getState().dismissDue(toast.publicationId, toast.destinationId);
      ToastQueue.info(toast.text, {
        timeout: DUE_TOAST_MS,
        actionLabel: PC.calendar.open,
        shouldCloseOnAction: true,
        onAction: () => {
          dismiss();
          useShell.getState().go({ tab: 'calendar', ...(toast.day ? { day: toast.day } : {}), publicationId: toast.publicationId });
        },
        onClose: dismiss,
      });
    }
  }, [due, rows, accounts, timezone]);
  return null;
}
