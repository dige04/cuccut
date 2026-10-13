import { describe, expect, it } from 'vitest';
import { aiToolParamsSchema, methodParamSchemas } from './schemas.ts';
import { AI_TOOL_APPLY_KINDS, AI_TOOL_KINDS, AI_TOOL_PROMPT_MAX } from './pipelines.ts';
import { MAX_ATTACHMENTS_PER_MESSAGE } from './limits.ts';
import { SKILL_LIMITS } from './skill.ts';

describe('ai-tool flow parameters', () => {
  const base = { videoId: 'vid_1', tool: 'summary', prompt: 'Summarize this video' };
  const ok = (params: Record<string, unknown>) => aiToolParamsSchema.safeParse(params).success;

  it('accepts the minimal and the full set of parameters', () => {
    expect(ok(base)).toBe(true);
    expect(
      ok({
        ...base,
        tool: 'polish',
        range: { start: 12.5, end: 80 },
        documentId: 'doc_1',
        attachments: ['att_1'],
        skills: [{ id: 'polish-transcript' }, { id: 'video-summary' }],
        provider: 'openai',
        model: 'gpt-5',
        uiLanguage: 'zh-Hans',
      }),
    ).toBe(true);
    expect(ok({ ...base, prompt: '' })).toBe(true);
  });

  it('only accepts tools that call the model directly', () => {
    for (const tool of AI_TOOL_KINDS) expect(ok({ ...base, tool })).toBe(true);
    for (const tool of ['retranscribe', 'cleanup', 'stale', 'cover', 'speakers', 'translate']) expect(ok({ ...base, tool })).toBe(false);
    expect(AI_TOOL_APPLY_KINDS).toEqual(['polish', 'chapters']);
  });

  it('rejects extra fields, empty video, overlong prompts and reversed ranges', () => {
    expect(ok({ ...base, extra: 1 })).toBe(false);
    expect(ok({ ...base, uiLanguage: '' })).toBe(false);
    expect(ok({ ...base, uiLanguage: 'not a tag' })).toBe(false);
    expect(ok({ ...base, videoId: '' })).toBe(false);
    expect(ok({ ...base, prompt: 'x'.repeat(AI_TOOL_PROMPT_MAX + 1) })).toBe(false);
    expect(ok({ ...base, range: { start: 10, end: 10 } })).toBe(false);
    expect(ok({ ...base, range: { start: -1, end: 10 } })).toBe(false);
    expect(ok({ ...base, range: { start: 0, end: 10, label: 'x' } })).toBe(false);
  });

  it('chapters always cover the whole piece: rejects when a range is given', () => {
    expect(ok({ ...base, tool: 'chapters' })).toBe(true);
    expect(ok({ ...base, tool: 'chapters', range: { start: 0, end: 10 } })).toBe(false);
  });

  it('attachments and skills follow the limits and format at send time', () => {
    expect(ok({ ...base, attachments: Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => `att_${i}`) })).toBe(true);
    expect(ok({ ...base, attachments: Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, (_, i) => `att_${i}`) })).toBe(false);
    expect(ok({ ...base, skills: [{ id: 'Not An Id' }] })).toBe(false);
    expect(ok({ ...base, skills: Array.from({ length: SKILL_LIMITS.perMessage + 1 }, (_, i) => ({ id: `s${i}` })) })).toBe(false);
  });
});

describe('UI language of the editor context', () => {
  const send = methodParamSchemas['conversations.send'];
  const context = { videoId: 'vid_1', videoName: '样片', videoPath: 'videos/样片', revision: '3', selection: [], playheadSeconds: 0 };
  const ok = (extra: Record<string, unknown>) =>
    send.safeParse({ conversationId: 'c', text: 'hi', commandId: 'k', context: { ...context, ...extra } }).success;

  it('optional: older clients may omit it and it is still accepted; when given, must be a BCP 47 tag', () => {
    expect(ok({})).toBe(true);
    expect(ok({ uiLanguage: 'zh-Hans' })).toBe(true);
    expect(ok({ uiLanguage: 'pt-BR' })).toBe(true);
    expect(ok({ uiLanguage: '' })).toBe(false);
    expect(ok({ uiLanguage: 'not a tag' })).toBe(false);
  });
});
