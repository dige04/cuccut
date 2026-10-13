import { create } from 'zustand';
import { ToastQueue } from '@react-spectrum/s2';
import type { Id } from '@cuccut/protocol';
import type { BatchSource } from '../../model/publishing-batch.ts';
import { preparePublications, publishingError } from '../../runtime/publishing-commands.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useShell } from '../../state/shell-store.ts';
import { PC } from './publishing-copy.ts';

/**
 * Opening publishing from other screens (design §6.3): the editor's "Publish…", the library's "Prepare publication", the shorts result page's
 * "Prepare publications" and the calendar's Unscheduled selection. On the calendar the publication dialog is part of the route
 * (`?publication=`); everywhere else the app-level host (`PublishingDialogsHost`) shows it over the current page. The batch dialog is always the
 * host's.
 */
export interface PublishingLaunch {
  /** The publication open in the host's dialog (not on the calendar). */
  publicationId: Id | null;
  batch: BatchSource | null;
  /** Bumped per batch, so a new batch starts fresh even with the same source. */
  batchKey: number;
}

export const usePublishingLaunch = create<PublishingLaunch>()(() => ({ publicationId: null, batch: null, batchKey: 0 }));

/** Opens a publication: in the calendar's route when the calendar is showing, else in the host's dialog. */
export function openPublicationDialog(publicationId: Id): void {
  const shell = useShell.getState();
  if (shell.route.tab === 'calendar') shell.replace({ ...shell.route, publicationId });
  else usePublishingLaunch.setState({ publicationId });
}

export function closePublicationDialog(): void {
  usePublishingLaunch.setState({ publicationId: null });
}

export function openBatchDialog(batch: BatchSource): void {
  usePublishingLaunch.setState((s) => ({ batch, batchKey: s.batchKey + 1 }));
}

export function closeBatchDialog(): void {
  usePublishingLaunch.setState({ batch: null });
}

/**
 * "Publish…" / "Prepare publication": opens the video's latest publication that is not archived, or prepares one (seeded from the video name and
 * the default accounts). A failure says why in a toast. Returns whether the dialog opened.
 */
export async function publishVideo(session: Pick<RuntimeSession, 'client'>, videoId: Id): Promise<boolean> {
  try {
    const [publication] = await preparePublications(session, { videoIds: [videoId] });
    if (!publication) return false;
    openPublicationDialog(publication.id);
    return true;
  } catch (error) {
    ToastQueue.negative(PC.entry.failed(publishingError(error).message), { timeout: 6000 });
    return false;
  }
}

/** Test hook. */
export function resetPublishingLaunch(): void {
  usePublishingLaunch.setState({ publicationId: null, batch: null, batchKey: 0 });
}
