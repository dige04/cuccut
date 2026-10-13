import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import { textModel, textView } from './models-test-fixtures.ts';
import { cloudModelOptions } from './tools-models.ts';
import { textJob, textResult } from './tools-test-fixtures.ts';
import {
  BLANK_TEXT,
  emptyInput,
  MAX_TEXT_INPUT,
  tooLong,
  againTextDraft,
  retryTextRequest,
  textCounter,
  textEffortLine,
  textFacts,
  textFileName,
  textHeaderChip,
  textProblems,
  textPrompt,
  textRequest,
  textSpaceEntry,
  textStatus,
  textTruncated,
} from './tools-text.ts';

describe('validation and request', () => {
  it('missing requirements; over 16,000 characters (by code points)', () => {
    expect(textProblems({ input: '  ' })).toEqual([emptyInput()]);
    expect(textProblems({ input: '写一段旁白' })).toEqual([]);
    expect(textProblems({ input: '字'.repeat(MAX_TEXT_INPUT) })).toEqual([]);
    expect(textProblems({ input: '😀'.repeat(MAX_TEXT_INPUT + 1) })).toEqual([tooLong()]);
    expect(tooLong()).toBe('一次最多输入 16,000 字符');
  });

  it('character count line: n / 16,000 characters; flagged when exceeded', () => {
    expect(textCounter({ input: ' 你好 ' })).toEqual({ text: '2 / 16,000 字符', over: false });
    expect(textCounter({ input: 'a'.repeat(16_001) })).toEqual({ text: '16,001 / 16,000 字符', over: true });
  });

  it('request is one user message naming the provider and model; reasoning effort and output limit are not included', () => {
    expect(textRequest({ input: ' 写一段旁白 ' }, { providerId: 'openai', modelId: 'gpt-5-mini' })).toEqual({
      messages: [{ role: 'user', content: '写一段旁白' }],
      provider: 'openai',
      model: 'gpt-5-mini',
    });
    expect(textRequest({ input: '总结要点' }, { providerId: 'openai', modelId: 'gpt-5-mini' }, { entryId: 'ent_doc' })).toEqual({
      messages: [{ role: 'user', content: '总结要点' }],
      provider: 'openai',
      model: 'gpt-5-mini',
      material: { entryId: 'ent_doc' },
    });
  });

  it('status beside the primary button: gate, issue, which one is used this time', () => {
    const options = cloudModelOptions(textView(), 'generateText');
    expect(options.map((o) => [o.key, o.usable])).toEqual([
      ['openai/gpt-5-mini', true],
      ['openai/gpt-4.1', true],
      ['google/gemini-2.5-flash', false],
    ]);
    const draft = { ...BLANK_TEXT };
    expect(textStatus(draft, null, false)).toEqual({ text: '请先连接一个文本模型', bad: true });
    expect(textStatus(draft, options[2]!, false)).toEqual({ text: '先连接 Google Gemini', bad: true });
    expect(textStatus(draft, options[0]!, false)).toEqual({ text: 'OpenAI · gpt-5-mini', bad: false });
    expect(textStatus(draft, options[0]!, true)).toEqual({ text: emptyInput(), bad: true });
    expect(textHeaderChip(options[0]!)).toBe('联网 · OpenAI · 按 token 计费');
    expect(textHeaderChip(null)).toBeNull();
  });
});

describe('reasoning effort', () => {
  it('reasoning effort uses the model page default; when the model cannot adjust it, says so', () => {
    const tunable = textModel('gpt-5-mini', { efforts: ['low', 'high'] });
    expect(textEffortLine({ effort: null }, tunable)).toBe('推理强度 · 自动（模型页设的默认）');
    expect(textEffortLine({ effort: 'minimal' }, tunable)).toBe('推理强度 · 最低（模型页设的默认）');
    expect(textEffortLine({ effort: 'high' }, textModel('gpt-4.1'))).toBe('推理强度 · 这只模型不能调');
  });
});

describe('records', () => {
  const done = textJob({
    state: 'completed',
    endedAt: '2026-10-03T10:15:00.123Z',
    result: { documentId: null, artifactId: 'sha256:t1', text: textResult({ length: 1234, usage: { inputTokens: 10, outputTokens: 900 } }) },
  });

  it('requirements, facts and file name match the same-named one in Space', () => {
    expect(textPrompt(done)).toBe('写一段城市漫游旁白');
    expect(textFacts(done)).toBe('1,234 字 · 输出 900 token');
    expect(textFileName(done)).toBe('生成文本-20261003-101500.txt');
    const json = textJob({ ...done, result: { documentId: null, artifactId: 'sha256:t2', text: textResult({ mediaType: 'application/json', usage: null }) } });
    expect(textFileName(json)).toBe('生成文本-20261003-101500.json');
    expect(textFacts(json)).toBe('20 字 · JSON');
  });

  it('truncation: a warning or finish reason of length', () => {
    expect(textTruncated(done)).toBe(false);
    const cut = textJob({ ...done, warnings: [{ code: 'output-truncated' }] });
    expect(textTruncated(cut)).toBe(true);
    expect(textFacts(cut)).toContain('到了输出上限，后面被截断');
    const byReason = textJob({ ...done, result: { documentId: null, artifactId: 'sha256:t1', text: textResult({ finishReason: 'length' }) } });
    expect(textTruncated(byReason)).toBe(true);
  });

  it('documents in Space: found by artifact ID; ones in the trash do not count', () => {
    const entry = (artifactId: string, trashedAt: string | null = null): SpaceEntry => ({
      id: `e-${artifactId}`,
      kind: 'document',
      name: '生成文本-20261003-101500.txt',
      fileName: '生成文本-20261003-101500.txt',
      source: { projectId: null, conversationId: null },
      relPath: '生成文本-20261003-101500.txt',
      size: 60,
      lastActivityAt: '2026-10-03T10:15:00.000Z',
      status: null,
      user: { favorite: false, displayName: null, trashedAt },
      ref: { artifactId },
    });
    expect(textSpaceEntry([entry('sha256:other'), entry('sha256:t1')], done)?.id).toBe('e-sha256:t1');
    expect(textSpaceEntry([entry('sha256:t1', '2026-10-03T11:00:00.000Z')], done)).toBeNull();
    expect(textSpaceEntry([entry('sha256:t1')], textJob())).toBeNull();
  });

  it('carry back to the left: requirements and model', () => {
    expect(againTextDraft(done)).toEqual({ input: '写一段城市漫游旁白', model: 'openai/gpt-5-mini' });
    expect(againTextDraft(textJob({ generation: undefined }))).toBeNull();
  });

  it('retry: resubmits the frozen parameters as they were; reasoning effort returns to the level originally requested', () => {
    expect(retryTextRequest(done)).toEqual({
      messages: [{ role: 'user', content: '写一段城市漫游旁白' }],
      responseFormat: { type: 'text' },
      maxOutputTokens: 128_000,
      provider: 'openai',
      model: 'gpt-5-mini',
    });
    const tuned = textJob({
      generation: {
        capability: 'generateText',
        messages: [{ role: 'user', content: 'hi' }],
        responseFormat: { type: 'text' },
        maxOutputTokens: 100,
        temperature: 0.2,
        requestedEffort: 'minimal',
        effort: 'low',
        seed: 7,
      },
    });
    expect(retryTextRequest(tuned)).toMatchObject({ temperature: 0.2, effort: 'minimal', seed: 7, maxOutputTokens: 100 });
    expect(retryTextRequest(textJob({ generation: undefined }))).toBeNull();
  });
});
