import { describe, expect, it } from 'vitest';
import { ProviderFailure } from '@cuccut/models';
import { checkFacts, providerCheckCode } from './model-install-service.ts';

describe('check failed: the Worker\'s failures classified by cause', () => {
  it('failing to load because a file is missing or corrupt is a model file problem, insufficient resources is not enough memory, a response that violates the protocol is wrong output, the rest are Worker problems', () => {
    const load = (reason: string) => new ProviderFailure('load-failed', '模型包加载失败', { reason, workerCode: 'X' });
    expect(providerCheckCode(load('not-installed'))).toBe('MODEL_FILES_DAMAGED');
    expect(providerCheckCode(load('resource'))).toBe('MODEL_OUT_OF_MEMORY');
    expect(providerCheckCode(load('unsupported'))).toBe('MODEL_WORKER_FAILED');
    expect(providerCheckCode(load('worker-missing'))).toBe('MODEL_WORKER_FAILED');
    expect(providerCheckCode(new ProviderFailure('protocol', 'job.run 返回 completed 却没有输出'))).toBe('MODEL_OUTPUT_WRONG');
    expect(providerCheckCode(new ProviderFailure('crashed', 'Model Worker 在任务进行中退出'))).toBe('MODEL_WORKER_FAILED');
    expect(providerCheckCode(new ProviderFailure('unavailable', '模型包已停用'))).toBe('MODEL_WORKER_FAILED');
  });

  it('technical details: one key: value per line, common ones first; no stderr, staging or local absolute paths; objects written as JSON, long ones truncated', () => {
    const facts = checkFacts({
      stderrTail: 'panic at /Users/someone/model.rs',
      staging: '/private/tmp/staging',
      file: '/Users/someone/Library/CucCut/models/x/model.safetensors',
      workerDetails: { file: 'model.safetensors' },
      workerCode: 'MODEL_NOT_INSTALLED',
      kind: 'load-failed',
      text: 'x'.repeat(400),
      note: 'see /Users/someone/log.txt',
      winNote: 'see C:\\Users\\someone\\log.txt',
      empty: null,
    });
    expect(facts.slice(0, 3)).toEqual([
      'kind: load-failed',
      'workerCode: MODEL_NOT_INSTALLED',
      'workerDetails: {"file":"model.safetensors"}',
    ]);
    expect(facts.find((l) => l.startsWith('text: '))).toHaveLength('text: '.length + 301);
    expect(facts.join('\n')).not.toMatch(/Users|\/private\/|stderrTail|staging|empty/);
  });
});
