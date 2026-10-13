import { describe, expect, it } from 'vitest';
import { methodParamSchemas, settingValueSchemas, settingsPatchSchema } from './schemas.ts';
import { SETTING_DEFAULTS, SETTING_DESCRIPTIONS, SETTING_KEYS, defaultSettingsSnapshot, isSettingKey } from './settings.ts';

describe('preferences registry', () => {
  it('every key has a schema, a default and a description; the default matches its own schema', () => {
    expect(Object.keys(settingValueSchemas).sort()).toEqual([...SETTING_KEYS].sort());
    expect(Object.keys(SETTING_DEFAULTS).sort()).toEqual([...SETTING_KEYS].sort());
    expect(Object.keys(SETTING_DESCRIPTIONS).sort()).toEqual([...SETTING_KEYS].sort());
    for (const key of SETTING_KEYS) {
      expect(settingValueSchemas[key].safeParse(SETTING_DEFAULTS[key]).success, key).toBe(true);
      expect(SETTING_DESCRIPTIONS[key].length, key).toBeGreaterThan(0);
    }
  });

  it('keys are lowercase dot-separated names, with no credential-type keys', () => {
    for (const key of SETTING_KEYS) {
      expect(key).toMatch(/^[a-z]+(?:\.[a-z][A-Za-z]*)+$/);
      expect(key).not.toMatch(/key|token|secret|password|credential|apikey/i);
    }
    expect(isSettingKey('offline.strict')).toBe(true);
    expect(isSettingKey('models.apiKey')).toBe(false);
  });

  it('patch: unknown keys and values that fail the schema are rejected; null restores the default', () => {
    expect(settingsPatchSchema.safeParse({ 'offline.strict': true, 'agent.defaultDriver': null }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ 'openai.apiKey': 'sk-x' }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ 'agent.defaultAccessMode': 'everything' }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ 'captions.maxLineLength': { cjk: 18 } }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ 'captions.maxLineLength': { cjk: 18, other: 40, extra: 1 } }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ 'downloads.directory': 'relative/dir' }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ 'downloads.directory': '/Users/me/Downloads' }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ 'downloads.directory': 'D:\\Downloads' }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ 'updates.autoCheck': 'yes' }).success).toBe(false);
  });

  it('access modes: new values accepted as is, old values mapped to new ones', () => {
    const schema = settingValueSchemas['agent.defaultAccessMode'];
    for (const mode of ['ask', 'autoAcceptEdits', 'auto', 'fullAccess', 'plan']) expect(schema.parse(mode)).toBe(mode);
    expect(schema.parse('controlled')).toBe('ask');
    expect(schema.parse('authorized')).toBe('fullAccess');
    expect(settingsPatchSchema.parse({ 'agent.defaultAccessMode': 'authorized' })).toEqual({ 'agent.defaultAccessMode': 'fullAccess' });
    expect(SETTING_DEFAULTS['agent.defaultAccessMode']).toBe('auto');
  });

  it('method parameters: settings.get only accepts registered keys', () => {
    expect(methodParamSchemas['settings.get'].safeParse({}).success).toBe(true);
    expect(methodParamSchemas['settings.get'].safeParse({ keys: ['offline.strict'] }).success).toBe(true);
    expect(methodParamSchemas['settings.get'].safeParse({ keys: ['nope'] }).success).toBe(false);
    expect(methodParamSchemas['settings.set'].safeParse({ values: { nope: 1 } }).success).toBe(false);
    expect(methodParamSchemas.subscribe.safeParse({ topic: 'settings' }).success).toBe(true);
  });

  it('freezes to defaults when there is no settings store', () => {
    expect(defaultSettingsSnapshot(['agent.defaultAccessMode', 'agent.defaultDriver'])).toEqual({
      values: { 'agent.defaultAccessMode': 'auto', 'agent.defaultDriver': null },
      sources: { 'agent.defaultAccessMode': 'default', 'agent.defaultDriver': 'default' },
    });
  });
});
