import { describe, expect, it } from 'vitest';
import { ModelInstallTools, type ModelInstallToolsDeps } from './model-install-tools.ts';
import { toolRisk, type ToolConfirmation, type ToolPrincipal } from './tool-scope.ts';

/**
 * `models_install` and the music engine (architecture §6.3, §6.5): the audio.cpp engine of the music model pack (backend `audio-cpp`) is its required component (`audiocpp-engine`) and is in the same install plan. There is one confirmation; the size and parts in the description already include the engine, with no separate engine confirmation and no `engine` result.
 * The model installation and scope are fakes.
 */

const MUSIC = 'yue2-3b@audio-cpp-q8';
const agent = { kind: 'agent', conversationId: 'conv_1' } as unknown as ToolPrincipal;

function harness(upToDate: boolean) {
  const confirmed: ToolConfirmation[] = [];
  const submitted: Array<{ bundleId: string; confirmBytes?: number }> = [];
  const plan = (bundleId: string) => ({
    bundleId,
    upToDate,
    components: upToDate
      ? []
      : [
          { component: 'music', repo: 'audio-cpp/Yue2-3B-GGUF', revision: 'r', action: 'download', files: ['m.gguf'], bytes: 1000 },
          {
            component: 'audiocpp-engine',
            repo: '0xShug0/audio.cpp',
            revision: 'v0.9.1',
            origin: 'github-release',
            action: 'download',
            files: ['audio-v0.9.1-bin-macos-arm64-metal.tar.gz'],
            bytes: 300,
          },
        ],
    downloadBytes: upToDate ? 0 : 1300,
    estimatedBytes: 1300,
    confirmBytes: upToDate ? 0 : 1300,
    resumedBytes: 0,
    availableBytes: null,
    source: 'https://hf.example + https://github.com/0xShug0/audio.cpp/releases',
  });
  const deps = {
    installs: {
      install: async (request: { bundleId: string; confirmBytes?: number }) => {
        if (request.confirmBytes !== undefined) submitted.push(request);
        return { plan: plan(request.bundleId), jobId: request.confirmBytes !== undefined ? 'job_model' : null };
      },
    },
    catalog: { list: async () => [] },
    scope: {
      authorize: (principal: ToolPrincipal) => ({ principal, submitter: { kind: 'agent', id: 'conv_1' } }),
      confirm: async (_access: unknown, request: ToolConfirmation) => {
        confirmed.push(request);
        return { mode: 'auto', risk: toolRisk(request), decidedBy: 'auto' };
      },
      commandId: (_access: unknown, id: string) => id,
    },
  } as unknown as ModelInstallToolsDeps;
  return { tools: new ModelInstallTools(deps), confirmed, submitted };
}

describe('models_install 与音乐引擎', () => {
  it('要下载：一次确认，大小与部件含引擎组件；结果只有模型包的任务', async () => {
    const { tools, confirmed, submitted } = harness(false);
    const result = (await tools.dispatch('models_install', { bundleId: MUSIC, commandId: 'cmd_1' }, agent)) as Record<string, any>;
    expect(confirmed.map((c) => c.summaryRef?.key)).toEqual(['rcAgentTools.installModelSummary']);
    expect(confirmed[0]!.summary).toContain('0xShug0/audio.cpp');
    expect(submitted).toEqual([{ bundleId: MUSIC, confirmBytes: 1300, commandId: 'cmd_1' }]);
    expect(result).toMatchObject({ jobId: 'job_model', downloadBytes: 1300 });
    expect(result.components.map((c: { component: string }) => c.component)).toEqual(['music', 'audiocpp-engine']);
    expect(result.engine).toBeUndefined();
  });

  it('已经装好（含引擎）：不确认，不提交', async () => {
    const { tools, confirmed, submitted } = harness(true);
    const result = (await tools.dispatch('models_install', { bundleId: MUSIC }, agent)) as Record<string, any>;
    expect(confirmed).toEqual([]);
    expect(submitted).toEqual([]);
    expect(result).toMatchObject({ jobId: null });
    expect(result.engine).toBeUndefined();
  });
});
