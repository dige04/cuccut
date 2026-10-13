import { describe, expect, it } from 'vitest';
import {
  MODEL_CATEGORIES,
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_INFO,
  isSettingsSection,
  legacyAgentSection,
  settingsSub,
} from './settings-nav.ts';

describe('settings groups', () => {
  it('Agent forms its own group, after preferences and before the app: providers, skills, then packs', () => {
    expect(SETTINGS_GROUPS.map((g) => g.id)).toEqual(['preferences', 'agents', 'app']);
    expect(SETTINGS_GROUPS.find((g) => g.id === 'agents')).toMatchObject({ label: 'Agent', keys: ['agent', 'skills', 'packs'] });
    expect(SETTINGS_GROUPS.find((g) => g.id === 'app')?.keys).toEqual(['publishing', 'glossary', 'review', 'privacy', 'diagnostics', 'about']);
  });

  it('the preferences group opens with the profile (You, Rules), then General, Shortcuts and Fonts', () => {
    expect(SETTINGS_GROUPS.find((g) => g.id === 'preferences')?.keys).toEqual(['you', 'rules', 'general', 'shortcuts', 'fonts']);
    expect(isSettingsSection('you')).toBe(true);
    expect(isSettingsSection('rules')).toBe(true);
    const label = (key: string) => SETTINGS_SECTION_INFO.find((s) => s.key === key)?.label;
    expect(label('you')).toBeTruthy();
    expect(label('rules')).toBeTruthy();
    expect(SETTINGS_GROUPS.find((g) => g.id === 'agents')).toMatchObject({ label: 'Agent', keys: ['agent', 'skills', 'packs'] });
    expect(SETTINGS_GROUPS.find((g) => g.id === 'app')?.keys).toEqual(['publishing', 'glossary', 'review', 'privacy', 'diagnostics', 'about']);
  });

  it('each section belongs to exactly one group, and all have labels', () => {
    expect(SETTINGS_GROUPS.flatMap((g) => g.keys).sort()).toEqual([...SETTINGS_SECTIONS].sort());
    expect(SETTINGS_SECTION_INFO.map((s) => s.key)).toEqual([...SETTINGS_SECTIONS]);
    const label = (key: string) => SETTINGS_SECTION_INFO.find((s) => s.key === key)?.label;
    expect(label('agent')).toBe('Agent 提供方');
    expect(label('skills')).toBe('Skills');
    expect(label('privacy')).toBe('隐私与权限');
  });

  it('group ids and item keys do not collide (S2 SideNav shares one id space, and a collision throws RangeError)', () => {
    const ids = [...SETTINGS_GROUPS.map((g) => g.id), 'models', ...SETTINGS_SECTIONS, ...MODEL_CATEGORIES];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skills is its own section', () => {
    expect(isSettingsSection('skills')).toBe(true);
  });

  it('review sits right after the glossary in the app group (m2-review-gate §2.3)', () => {
    expect(isSettingsSection('review')).toBe(true);
    const app = SETTINGS_GROUPS.find((g) => g.id === 'app')!.keys;
    expect(app.indexOf('review')).toBe(app.indexOf('glossary') + 1);
    expect(SETTINGS_SECTION_INFO.find((s) => s.key === 'review')?.label).toBeTruthy();
  });

  it('packs is a section of its own, with a label', () => {
    expect(isSettingsSection('packs')).toBe(true);
    expect(SETTINGS_SECTION_INFO.find((s) => s.key === 'packs')?.label).toBeTruthy();
  });

  it('publishing opens the app group, ahead of the glossary', () => {
    expect(isSettingsSection('publishing')).toBe(true);
    expect(SETTINGS_GROUPS.find((g) => g.id === 'app')?.keys[0]).toBe('publishing');
    expect(SETTINGS_SECTION_INFO.find((s) => s.key === 'publishing')?.label).toBeTruthy();
  });
});

describe('pages inside a section', () => {
  it('packs has pages (import, export or a pack id); skills opens a skill by id', () => {
    expect(settingsSub('packs', 'import')).toBe('import');
    expect(settingsSub('packs', 'export')).toBe('export');
    expect(settingsSub('packs', 'news-desk')).toBe('news-desk');
    expect(settingsSub('packs', 'News_Desk')).toBeUndefined();
    expect(settingsSub('packs', 'a'.repeat(65))).toBeUndefined();
    expect(settingsSub('packs', undefined)).toBeUndefined();
    expect(settingsSub('skills', 'news-desk')).toBe('news-desk');
    expect(settingsSub('skills', 'tiêu-đề')).toBe('tiêu-đề');
    expect(settingsSub('skills', 'Not an id')).toBeUndefined();
    expect(settingsSub('general', 'news-desk')).toBeUndefined();
  });
});

describe('where the old Agent tabs went', () => {
  it('skills and permissions each move to their new place; the rest stay under Agent providers', () => {
    expect(legacyAgentSection('skills')).toBe('skills');
    expect(legacyAgentSection('permissions')).toBe('privacy');
    expect(legacyAgentSection('advanced')).toBe('agent');
    expect(legacyAgentSection('connect')).toBe('agent');
    expect(legacyAgentSection(undefined)).toBe('agent');
  });
});
