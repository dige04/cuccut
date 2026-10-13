import { describe, expect, it } from 'vitest';
import { recommendedDriverModel } from '@cuccut/protocol';
import { FALLBACK_CLAUDE_MODELS, mapClaudeModels } from './claude/claude-models.ts';
import { toCatalog } from './codex/codex-models.ts';
import { FAKE_CLAUDE_MODELS } from './testing/fake-claude.ts';
import { fakeModel } from './testing/fake-codex.ts';

/** Recommended model (user decision of 2026-09-29): tested against the model tables that both Drivers actually produce. Do not fall to the expensive tier because of the CLI's stated default or the order in the table. */
describe('推荐模型 × Driver 的模型表', () => {
  it('Claude Code：CLI 的默认是 Opus、Fable 排在 Sonnet 前面，推荐的仍是 Sonnet；问不到模型表时的精简表也是', () => {
    const models = mapClaudeModels(FAKE_CLAUDE_MODELS);
    expect(models.find((m) => m.isDefault)?.id).toBe('opus');
    expect(recommendedDriverModel('claude', models)?.id).toBe('sonnet');
    expect(recommendedDriverModel('claude', FALLBACK_CLAUDE_MODELS)?.id).toBe('sonnet');
  });

  it('Codex：取第一个 -sol（隐藏的不算），不取标了默认的那一个', () => {
    const { models } = toCatalog([
      fakeModel('gpt-7-sol', { hidden: true }),
      fakeModel('gpt-6-astra', { isDefault: true }),
      fakeModel('gpt-6-sol'),
      fakeModel('gpt-5.6-sol'),
    ]);
    expect(recommendedDriverModel('codex', models)?.id).toBe('gpt-6-sol');
    // Default scenario of the fake codex.
    expect(
      recommendedDriverModel('codex', toCatalog([fakeModel('fake-luna'), fakeModel('fake-sol', { isDefault: true })]).models)?.id,
    ).toBe('fake-sol');
  });
});
