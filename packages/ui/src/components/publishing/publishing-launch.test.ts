import { afterEach, describe, expect, it, vi } from 'vitest';
import { RpcError } from '@cuccut/protocol';
import { detail } from '../../model/publishing-test-fixtures.ts';
import { resetPublishingCommands } from '../../runtime/publishing-commands.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { HOME, useShell } from '../../state/shell-store.ts';
import { PC } from './publishing-copy.ts';
import {
  closeBatchDialog,
  openBatchDialog,
  openPublicationDialog,
  publishVideo,
  resetPublishingLaunch,
  usePublishingLaunch,
} from './publishing-launch.ts';

const toasts = vi.hoisted(() => ({ negative: vi.fn() }));
vi.mock('@react-spectrum/s2', () => ({ ToastQueue: { negative: toasts.negative } }));

function session(answer: (method: string, params: Record<string, unknown>) => unknown) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  return {
    calls,
    session: {
      client: {
        request: async (method: string, params: Record<string, unknown>) => {
          calls.push({ method, params });
          return answer(method, params);
        },
      },
    } as unknown as Pick<RuntimeSession, 'client'>,
  };
}

afterEach(() => {
  resetPublishingLaunch();
  resetPublishingCommands();
  useShell.getState().replace(HOME);
  toasts.negative.mockReset();
});

describe('opening publishing from other screens', () => {
  it('opens the dialog over the current page, or in the calendar’s route on the calendar', () => {
    openPublicationDialog('pub_1');
    expect(usePublishingLaunch.getState().publicationId).toBe('pub_1');
    resetPublishingLaunch();
    useShell.getState().replace({ tab: 'calendar', view: 'week' });
    openPublicationDialog('pub_2');
    expect(useShell.getState().route).toEqual({ tab: 'calendar', view: 'week', publicationId: 'pub_2' });
    expect(usePublishingLaunch.getState().publicationId).toBeNull();
  });

  it('starts every batch fresh', () => {
    openBatchDialog({ kind: 'videos', videoIds: ['v1'], origin: 'shorts' });
    const first = usePublishingLaunch.getState().batchKey;
    openBatchDialog({ kind: 'videos', videoIds: ['v1'], origin: 'shorts' });
    expect(usePublishingLaunch.getState().batchKey).toBe(first + 1);
    closeBatchDialog();
    expect(usePublishingLaunch.getState().batch).toBeNull();
  });

  it('“Publish…” prepares (or reuses) the video’s publication and opens it', async () => {
    const fake = session(() => ({ publications: [detail({ id: 'pub_9' })] }));
    expect(await publishVideo(fake.session, 'video_1')).toBe(true);
    expect(fake.calls).toEqual([{ method: 'publishing.prepare', params: { videoIds: ['video_1'] } }]);
    expect(usePublishingLaunch.getState().publicationId).toBe('pub_9');
  });

  it('says why when the publication cannot be prepared', async () => {
    const fake = session(() => {
      throw new RpcError('conflict', 'Publishing is read-only.', { code: 'PUBLISHING_READ_ONLY' });
    });
    expect(await publishVideo(fake.session, 'video_1')).toBe(false);
    expect(toasts.negative).toHaveBeenCalledWith(PC.entry.failed('Publishing is read-only.'), { timeout: 6000 });
    expect(usePublishingLaunch.getState().publicationId).toBeNull();
  });
});
