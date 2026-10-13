import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CucCutClient } from '@cuccut/client';
import type { VideoSnapshot } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { useVideo, type OpenVideo } from '../state/video-store.ts';
import { VideoController } from './video-controller.ts';

function open() {
  const request = vi.fn(async (method: string, _params: Record<string, unknown>) =>
    method === 'edits.apply' ? { receipt: { transactionId: 'tx1' }, replayed: false } : {},
  );
  const video = { id: 'vid', revision: '7' } as unknown as VideoSnapshot;
  useVideo.setState({ video: { videoId: 'vid', state: { video, eventSeq: 1 }, status: 'ready', inFlight: 0 } as unknown as OpenVideo });
  return { request, videos: new VideoController({ request } as unknown as CucCutClient) };
}

afterEach(() => useVideo.setState({ video: null }));

describe('VideoController.apply', () => {
  it('the rename is submitted together with the catalog reference, and readers regenerate it in their own language', async () => {
    const { request, videos } = open();
    await videos.apply([], EditLabel.relinkAsset({ name: 'a.mov' }));
    expect(request).toHaveBeenCalledWith(
      'edits.apply',
      expect.objectContaining({
        expectedRevision: '7',
        label: '重新关联「a.mov」',
        labelRef: { key: 'editLabel.relinkAsset', params: { name: 'a.mov' } },
      }),
    );
  });

  it('when no rename is given, neither field is sent, and the engine names it', async () => {
    const { request, videos } = open();
    await videos.apply([]);
    const params = request.mock.calls.find(([method]) => method === 'edits.apply')![1];
    expect(params).not.toHaveProperty('label');
    expect(params).not.toHaveProperty('labelRef');
  });
});
