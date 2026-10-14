import path from 'node:path';
import { ModelCatalog } from '@cuccut/models';
import { JobManager, type JobManagerOptions, type JobVideos, type TranscribeRouter } from '../job-manager.ts';

/** For tests: a JobManager in a temporary directory (no model Provider). The fixed pipeline uses it only for bookkeeping. */
export function testJobManager(
  dir: string,
  videos: Partial<JobVideos> = {},
  limits: Pick<JobManagerOptions, 'maxRetainedJobs' | 'maxRetainedRetryablePipelines' | 'library'> = {},
): JobManager {
  const router: TranscribeRouter = {
    selectTranscribe: async () => {
      throw new Error('Fixed-pipeline tests do not transcribe');
    },
    transcriber: () => null,
    executors: () => [],
  };
  return new JobManager({
    paths: {
      jobsFile: path.join(dir, 'store', 'jobs.jsonl'),
      stagingDir: path.join(dir, 'staging'),
      artifactsDir: path.join(dir, 'artifacts'),
      diagnosticsDir: path.join(dir, 'logs', 'diagnostics'),
    },
    catalog: new ModelCatalog({ root: path.join(dir, 'models'), bundles: [] }),
    router,
    videos: {
      retain: () => {},
      release: () => {},
      source: async () => {
        throw new Error('Fixed-pipeline tests have no media');
      },
      current: () => null,
      videoRevision: () => null,
      apply: async () => ({}),
      ...videos,
    },
    ...limits,
  });
}
