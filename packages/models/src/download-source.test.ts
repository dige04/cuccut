import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODELS_ENDPOINT,
  MODELSCOPE_ENDPOINT,
  MODELS_ENDPOINT_ENV,
  isModelScopeEndpoint,
  modelFileUrl,
  repoEndpoint,
  resolveModelsEndpoint,
  validEndpoint,
} from './download-source.ts';
import { REPO_MANIFESTS } from './repo-manifests.ts';

describe('下载来源', () => {
  it('基址的优先级：环境变量 → 设置 → 公共仓库', () => {
    expect(resolveModelsEndpoint({}, null)).toEqual({ endpoint: DEFAULT_MODELS_ENDPOINT, origin: 'default' });
    expect(resolveModelsEndpoint({}, 'https://mirror.example/hf/')).toEqual({ endpoint: 'https://mirror.example/hf', origin: 'setting' });
    expect(resolveModelsEndpoint({ [MODELS_ENDPOINT_ENV]: 'http://127.0.0.1:9/' }, 'https://mirror.example')).toEqual({
      endpoint: 'http://127.0.0.1:9',
      origin: 'env',
    });
  });

  it('不合规的基址：环境变量报错，设置退回公共仓库', () => {
    expect(() => resolveModelsEndpoint({ [MODELS_ENDPOINT_ENV]: 'ftp://x' }, null)).toThrow(MODELS_ENDPOINT_ENV);
    expect(resolveModelsEndpoint({}, 'https://user:pw@mirror.example').origin).toBe('default');
    for (const bad of ['mirror.example', 'https://a.example/?token=x', 'https://a.example/#x', 'https://u@a.example', 'file:///tmp']) {
      expect(validEndpoint(bad)).toBe(false);
    }
    expect(validEndpoint('https://a.example/prefix')).toBe(true);
  });

  it('文件 URL：<基址>/<owner>/<repo>/resolve/<revision>/<路径>，逐段编码，保留 /', () => {
    expect(modelFileUrl('https://huggingface.co', 'aufklarer/Silero-VAD', 'abc123', 'model.safetensors')).toBe(
      'https://huggingface.co/aufklarer/Silero-VAD/resolve/abc123/model.safetensors',
    );
    expect(modelFileUrl('https://m.example/hf/', 'o/r', 'rev', 'sub dir/a#b.json')).toBe(
      'https://m.example/hf/o/r/resolve/rev/sub%20dir/a%23b.json',
    );
  });

  it('ModelScope：按主机认，路径是 /models/<owner>/<repo>/resolve/master/<路径>', () => {
    for (const base of [MODELSCOPE_ENDPOINT, 'https://modelscope.cn/', 'https://www.modelscope.cn/models']) {
      expect(isModelScopeEndpoint(base)).toBe(true);
      expect(modelFileUrl(base, 'aufklarer/Silero-VAD', 'abc123', 'sub dir/model.safetensors')).toBe(
        `${new URL(base).origin}/models/aufklarer/Silero-VAD/resolve/master/sub%20dir/model.safetensors`,
      );
    }
    for (const other of [DEFAULT_MODELS_ENDPOINT, 'https://modelscope.cn.example', 'https://mirror.example/www.modelscope.cn', 'nope']) {
      expect(isModelScopeEndpoint(other)).toBe(false);
    }
  });

  it('ModelScope：换了名字的仓库用它那边的名字，没有的仓库改从公共模型仓库下载', () => {
    expect(modelFileUrl(MODELSCOPE_ENDPOINT, 'openai/whisper-large-v3', 'abc', 'tokenizer.json')).toBe(
      'https://www.modelscope.cn/models/openai-mirror/whisper-large-v3/resolve/master/tokenizer.json',
    );
    expect(modelFileUrl(MODELSCOPE_ENDPOINT, 'OpenMOSS-Team/MOSS-Transcribe-Diarize', 'abc', 'config.json')).toBe(
      'https://www.modelscope.cn/models/OpenMOSS/MOSS-Transcribe-Diarize/resolve/master/config.json',
    );
    expect(repoEndpoint(MODELSCOPE_ENDPOINT, 'ggerganov/whisper.cpp')).toBe(DEFAULT_MODELS_ENDPOINT);
    expect(modelFileUrl(MODELSCOPE_ENDPOINT, 'ggerganov/whisper.cpp', 'abc', 'ggml.bin')).toBe(
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/abc/ggml.bin',
    );
    // Other mirrors are not affected.
    expect(repoEndpoint('https://mirror.example/', 'ggerganov/whisper.cpp')).toBe('https://mirror.example');
  });

  it('改名表与缺失表只列内置清单里真有的下载仓库', () => {
    const repos = new Set(REPO_MANIFESTS.map((m) => m.sourceRepo ?? m.repo));
    for (const repo of ['openai/whisper-large-v3', 'OpenMOSS-Team/MOSS-Transcribe-Diarize', 'ggerganov/whisper.cpp', 'PJMixers-Dev/lj1995_GPT-SoVITS-safetensors']) {
      expect(repos.has(repo), repo).toBe(true);
    }
  });
});
