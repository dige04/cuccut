import { describe, expect, it } from 'vitest';
import type { Id, JobRecord } from '@cuccut/protocol';
import { LinkImportTools, startLinkImport, type LinkImportToolsDeps } from './link-import-tools.ts';
import { ToolError } from './tool-catalog.ts';
import { toolRisk, type ToolConfirmation, type ToolPrincipal } from './tool-scope.ts';

/**
 * Destination checks and parameters for downloads from links (`download`, and `transcribe` given a `url`). `newVideo` for the external service requires `project`; a video the flow creates is registered into the service's scope as soon as it appears; transcription parameters are passed to the flow as given. yt-dlp, the flow and the job are all fakes.
 */

const LINK = 'https://video.example.com/watch?v=abc';

const service = { kind: 'service', serviceId: 'mcp', clientId: 'cli_1', clientName: '剪辑助手' } as unknown as ToolPrincipal;
const agent = { kind: 'agent', conversationId: 'conv_1' } as unknown as ToolPrincipal;

function harness() {
  const started: Record<string, unknown>[] = [];
  const confirmed: ToolConfirmation[] = [];
  const adopted: Id[] = [];
  const listeners = new Set<(record: JobRecord) => void>();
  let current = { jobId: 'job_1', videoId: null, state: 'running' } as unknown as JobRecord;
  const deps = {
    tools: {
      status: async () => ({ name: 'yt-dlp', label: 'yt-dlp', state: 'installed', version: '2026.09.01', consent: { state: 'granted' } }),
    },
    pipelines: {
      start: async (request: { params: Record<string, unknown> }) => {
        started.push(request.params);
        return { jobId: 'job_1' };
      },
    },
    jobs: {
      onChange: (listener: (record: JobRecord) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      inspect: () => current,
    },
    offlineStrict: () => false,
    scope: {
      authorize: (principal: ToolPrincipal) => ({
        principal,
        submitter: principal.kind === 'service' ? { kind: 'service', id: 'mcp', clientId: 'cli_1' } : { kind: 'agent', id: 'conv_1' },
      }),
      confirm: async (_access: unknown, request: ToolConfirmation) => {
        confirmed.push(request);
        return { mode: 'auto', risk: toolRisk(request), decidedBy: 'auto' };
      },
      createRoot: async (_access: unknown, project: string | undefined) => ({
        scope: project ? { projectId: project } : { conversationId: 'conv_1' },
      }),
      open: async (video: string) => ({ ref: { videoId: video } }),
      commandId: (_access: unknown, id: string) => id,
      adoptCreatedVideo: (_access: unknown, videoId: Id) => {
        adopted.push(videoId);
      },
    },
  } as unknown as LinkImportToolsDeps;
  const emit = (patch: Partial<JobRecord>) => {
    current = { ...current, ...patch } as JobRecord;
    for (const listener of [...listeners]) listener(current);
  };
  return { deps, started, confirmed, adopted, emit, listeners };
}

async function refused(promise: Promise<unknown>): Promise<ToolError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('应当拒绝');
}

describe('download: the destination for external service', () => {
  it('rejected when neither destination is given nor project given for newVideo; next points to projects_list\'s projectId; flow not started', async () => {
    const { deps, started, confirmed } = harness();
    const tools = new LinkImportTools(deps);
    for (const args of [{ url: LINK }, { url: LINK, newVideo: true }]) {
      const error = await refused(tools.dispatch('download', args, service));
      expect(error.code).toBe('INVALID_ARGUMENTS');
      expect(String(error.extra.next)).toContain('projects_list');
      expect(String(error.extra.next)).toContain('project');
    }
    expect(started).toEqual([]);
    expect(confirmed).toEqual([]);
  });

  it('newVideo with project: new video created in that project; when the parent task records videoId, registered in the service\'s scope, only once', async () => {
    const { deps, started, adopted, emit, listeners } = harness();
    const result = (await new LinkImportTools(deps).dispatch('download', { url: LINK, newVideo: true, project: 'prj_1' }, service)) as {
      jobId: Id;
    };
    expect(result.jobId).toBe('job_1');
    expect(started[0]).toMatchObject({ url: LINK, target: { create: { projectId: 'prj_1' } }, saveTo: 'project' });
    expect(adopted).toEqual([]);
    // Changes from other tasks do not count.
    for (const listener of [...listeners]) listener({ jobId: 'job_2', videoId: 'vid_other', state: 'running' } as unknown as JobRecord);
    emit({ phase: 'downloading' } as Partial<JobRecord>);
    expect(adopted).toEqual([]);
    emit({ videoId: 'vid_new' });
    await Promise.resolve();
    await Promise.resolve();
    expect(adopted).toEqual(['vid_new']);
    expect(listeners.size).toBe(0);
    emit({ state: 'completed' });
    await Promise.resolve();
    expect(adopted).toEqual(['vid_new']);
  });

  it('task ends without creating a video: not registered, no longer listening; agent\'s newVideo does not go through registration', async () => {
    const first = harness();
    await new LinkImportTools(first.deps).dispatch('download', { url: LINK, newVideo: true, project: 'prj_1' }, service);
    first.emit({ state: 'failed' });
    expect(first.listeners.size).toBe(0);
    expect(first.adopted).toEqual([]);

    const second = harness();
    await new LinkImportTools(second.deps).dispatch('download', { url: LINK, newVideo: true }, agent);
    expect(second.listeners.size).toBe(0);
    second.emit({ videoId: 'vid_new' });
    expect(second.adopted).toEqual([]);
  });
});

describe('download: where the file is stored', () => {
  it('video imported by the agent is downloaded to the download directory (no saveTo given); with only project given, goes into the project; when external service has a destination, goes there', async () => {
    const { deps, started } = harness();
    const tools = new LinkImportTools(deps);
    await tools.dispatch('download', { url: LINK, newVideo: true }, agent);
    await tools.dispatch('download', { url: LINK, newVideo: true, project: 'prj_1' }, agent);
    await tools.dispatch('download', { url: LINK, video: 'vid_1' }, agent);
    await tools.dispatch('download', { url: LINK }, agent);
    await tools.dispatch('download', { url: LINK, project: 'prj_1' }, agent);
    await tools.dispatch('download', { url: LINK, video: 'vid_1' }, service);
    await tools.dispatch('download', { url: LINK, project: 'prj_1' }, service);
    expect(started.map((p) => p.saveTo ?? null)).toEqual([null, null, null, null, 'project', 'project', 'project']);
  });

  it('result\'s next states truthfully where the file is', async () => {
    const { deps } = harness();
    const tools = new LinkImportTools(deps);
    const imported = (await tools.dispatch('download', { url: LINK, video: 'vid_1' }, agent)) as { next: string };
    expect(imported.next).toContain('in the downloads directory');
    const toProject = (await tools.dispatch('download', { url: LINK, project: 'prj_1' }, agent)) as { next: string };
    expect(toProject.next).toContain('downloads/');
  });
});

describe('transcribe with url: transcription parameters', () => {
  it('language, service and model, prompt, speaker and captions passed to the flow as-is; confirmation notes state the language', async () => {
    const { deps, started, confirmed } = harness();
    await startLinkImport(
      deps,
      {
        url: LINK,
        newVideo: true,
        project: 'prj_1',
        name: '访谈',
        transcribe: true,
        language: 'ja',
        provider: 'local',
        model: 'whisper',
        hint: '人名：佐藤',
        diarize: true,
        captions: true,
      },
      service,
    );
    expect(started[0]).toMatchObject({
      target: { create: { projectId: 'prj_1', name: '访谈' } },
      transcribe: true,
      language: 'ja',
      provider: 'local',
      model: 'whisper',
      hint: '人名：佐藤',
      diarize: true,
      captions: true,
    });
    expect(confirmed[0]!.summary).toContain('语言 ja');
    expect(confirmed[0]!.summary).toContain('建立字幕层');
  });

  it('download without transcription parameters: the flow parameters contain no such keys', async () => {
    const { deps, started } = harness();
    await new LinkImportTools(deps).dispatch('download', { url: LINK, newVideo: true, transcribe: true }, agent);
    for (const key of ['language', 'provider', 'model', 'hint', 'diarize', 'captions']) expect(started[0]).not.toHaveProperty(key);
  });
});
