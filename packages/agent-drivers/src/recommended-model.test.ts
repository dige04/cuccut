import { describe, expect, it } from 'vitest';
import { recommendedDriverModel } from '@cuccut/protocol';
import { FALLBACK_CLAUDE_MODELS, mapClaudeModels } from './claude/claude-models.ts';
import { toCatalog } from './codex/codex-models.ts';
import { FAKE_CLAUDE_MODELS } from './testing/fake-claude.ts';
import { fakeModel } from './testing/fake-codex.ts';

/** Recommended model (user decision of 2026-09-29): tested against the model tables that both Drivers actually produce. Do not fall to the expensive tier because of the CLI's stated default or the order in the table. */
describe('recommended model × driver model table', () => {
  it('Claude Code: the CLI default is Opus and Fable is ahead of Sonnet, but the recommendation is still Sonnet; the same holds for the reduced table used when the model table cannot be fetched', () => {
    const models = mapClaudeModels(FAKE_CLAUDE_MODELS);
    expect(models.find((m) => m.isDefault)?.id).toBe('opus');
    expect(recommendedDriverModel('claude', models)?.id).toBe('sonnet');
    expect(recommendedDriverModel('claude', FALLBACK_CLAUDE_MODELS)?.id).toBe('sonnet');
  });

  it('Codex: takes the first -sol (hidden ones do not count), not the one marked as default', () => {
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
