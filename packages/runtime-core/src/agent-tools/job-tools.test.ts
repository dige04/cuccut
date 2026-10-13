import { describe, expect, it } from 'vitest';
import { LINK_IMPORT_PIPELINE } from '@cuccut/jobs';
import { pipelineNext } from './job-tools.ts';

/** The next step after a fixed pipeline completes (`jobs_inspect` / `jobs_wait`): it must match what this run actually did. */
describe('next after a download completes', () => {
  it('new video: the media is placed on the timeline', () => {
    const next = pipelineNext(LINK_IMPORT_PIPELINE, { createdVideo: true, videoId: 'vid_1', transcribeJobId: null }, 'vid_1')!;
    expect(next).toContain('a new video was created');
    expect(next).toContain('placed on the timeline');
    expect(next).not.toContain('existing video');
  });

  it('imported into an existing video (createdVideo false, or missing in old records): does not claim a new video, says it is placed only on an empty timeline', () => {
    for (const summary of [{ createdVideo: false, videoId: 'vid_1' }, { videoId: 'vid_1' }, null]) {
      const next = pipelineNext(LINK_IMPORT_PIPELINE, summary, 'vid_1')!;
      expect(next).toContain('imported into an existing video');
      expect(next).toContain('if the timeline was empty');
      expect(next).not.toContain('new video');
    }
  });

  it('transcribed into the video: points to documentId when present; no longer sends to captions_create once a caption layer was created', () => {
    const base = { createdVideo: true, videoId: 'vid_1', transcribeJobId: 'job_t' };
    const plain = pipelineNext(LINK_IMPORT_PIPELINE, base, 'vid_1')!;
    expect(plain).toContain('videos_inspect');
    expect(plain).toContain('captions_create');
    const withDocument = pipelineNext(LINK_IMPORT_PIPELINE, { ...base, documentId: 'doc_1', captions: { status: 'disabled' } }, 'vid_1')!;
    expect(withDocument).toContain('summary.documentId');
    expect(withDocument).toContain('captions_create');
    const captioned = pipelineNext(
      LINK_IMPORT_PIPELINE,
      { ...base, documentId: 'doc_1', captions: { status: 'created', documentId: 'doc_c' } },
      'vid_1',
    )!;
    expect(captioned).toContain('caption layer was created too');
    expect(captioned).not.toContain('captions_create');
  });

  it('download only: not imported into a video', () => {
    expect(pipelineNext(LINK_IMPORT_PIPELINE, { createdVideo: false, videoId: null }, null)).toContain('not imported into a video');
  });
});
