import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentModeLabel, AGENT_MODE_LABELS } from './access.ts';
import { grantDataKindLabel } from './grants.ts';
import { setLocale } from './i18n.ts';
import { compileJsonSchema, JsonSchemaError } from './json-schema.ts';
import { methodParamSchemas } from './schemas.ts';
import { SETTING_DESCRIPTIONS, settingDescription } from './settings.ts';
import { templatePathProblem } from './template.ts';

/** When the interface language is English, the text the protocol layer shows people (settings descriptions, mode names, validation errors) is generated in English; after switching back to Chinese, it is generated as before. */
describe('protocol English copy', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('settings descriptions follow the current language when read', () => {
    expect(settingDescription('updates.autoCheck')).toBe('Check for app updates automatically');
    expect(SETTING_DESCRIPTIONS['ui.language']).not.toMatch(/[一-龥]/);
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
    expect(settingDescription('updates.autoCheck')).toBe('自动检查应用更新');
  });

  it('mode names and data kinds include the message reference', () => {
    const label = agentModeLabel('fullAccess');
    expect(label.text).toBe('Full access');
    expect(label.key).toMatch(/^protocolLabels\./);
    expect(AGENT_MODE_LABELS.fullAccess).toBe('Full access');
    expect(grantDataKindLabel('transcript').text).not.toMatch(/[一-龥]/);
  });

  it('validation errors follow the current language', () => {
    expect(templatePathProblem('')).toBe('Path is empty');
    let caught: unknown;
    try {
      compileJsonSchema(1);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(JsonSchemaError);
    expect((caught as JsonSchemaError).message).toBe('schema must be an object');
    expect((caught as JsonSchemaError).messageRef?.key).toBe('protocolValidation.jsonSchemaNotObject');

    const parsed = methodParamSchemas['models.synthesizeSpeech'].safeParse({ text: '  ' });
    expect(parsed.success).toBe(false);
    const messages = parsed.error!.issues.map((i) => i.message).join('\n');
    expect(messages).toContain("Text can't be empty");
  });
});
