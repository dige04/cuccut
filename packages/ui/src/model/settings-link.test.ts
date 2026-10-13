import { describe, expect, it, vi } from 'vitest';
import { capabilitySettingsHref, MODEL_SERVICE_CAPABILITIES, setLocale } from '@cuccut/protocol';
import { settingsLink } from './settings-link.ts';
import { useShell } from '../state/shell-store.ts';

describe('settings links in replies', () => {
  it('each capability link the tool provides leads to the matching model settings', () => {
    const categories = ['asr', 'tts', 'image', 'llm', 'sep', 'music'];
    MODEL_SERVICE_CAPABILITIES.forEach((capability, i) => {
      expect(settingsLink(capabilitySettingsHref(capability))?.route).toEqual({ tab: 'models', category: categories[i] });
    });
    expect(settingsLink('/settings/models/asr/cloud')?.route).toEqual({ tab: 'models', category: 'asr', page: 'cloud' });
    expect(settingsLink('/settings/models/tts/voices')?.route).toEqual({ tab: 'models', category: 'tts', page: 'voices' });
    expect(settingsLink('/settings/agent/')?.route).toEqual({ tab: 'settings', section: 'agent' });
  });

  it('packs pages: the list, import, export and a pack', () => {
    expect(settingsLink('/settings/packs')?.route).toEqual({ tab: 'settings', section: 'packs' });
    expect(settingsLink('/settings/packs/import')?.route).toEqual({ tab: 'settings', section: 'packs', sub: 'import' });
    expect(settingsLink('/settings/packs/export')?.route).toEqual({ tab: 'settings', section: 'packs', sub: 'export' });
    expect(settingsLink('/settings/packs/news-desk')?.route).toEqual({ tab: 'settings', section: 'packs', sub: 'news-desk' });
    expect(settingsLink('/settings/packs/news-desk')?.trail.endsWith(' › news-desk')).toBe(true);
    expect(settingsLink('/settings/packs/-bad')).toBeNull();
    expect(settingsLink('/settings/packs/news-desk/extra')).toBeNull();
    // A skill's details have a link of their own too (the pack page uses it).
    expect(settingsLink('/settings/skills/news-desk')?.route).toEqual({ tab: 'settings', section: 'skills', sub: 'news-desk' });
    expect(settingsLink('/settings/skills/Not_an_id')).toBeNull();
  });

  it.each(['/settings', '/settings/model', '/settings/models', '/settings/models/asr/voices',
    '/settings/models/sep/cloud', '/settings/models/llm/local', '/settings/agent/skills', '/settings/general/extra',
    '/settings/models/asr/cloud/extra', '/settings/models/asr?tab=cloud', 'https://example.com/settings/agent', '//example.com/settings/agent',
    '/settings/unknown', 'javascript:alert(1)'])('unknown address %s shows only text', (href) => {
    expect(settingsLink(href)).toBeNull();
  });

  it('the hint\'s position changes with the UI language', () => {
    expect(settingsLink('/settings/models/asr/cloud')?.trail).toBe('设置 › 模型 › 语音识别 › 云端模型');
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    try {
      expect(settingsLink('/settings/models/asr/cloud')?.trail).toBe('Settings › Models › Speech recognition › Cloud models');
    } finally {
      vi.unstubAllEnvs();
      setLocale('zh-Hans');
    }
  });

  it('after opening a specific setting, going back returns to the original session', () => {
    const session = { tab: 'home' as const, conversationId: 'conv_settings_link', projectId: null };
    useShell.getState().go(session);
    useShell.getState().go(settingsLink('/settings/models/asr/cloud')!.route);
    expect(useShell.getState().route).toEqual({ tab: 'models', category: 'asr', page: 'cloud' });
    useShell.getState().goBack();
    expect(useShell.getState().route).toEqual(session);
  });
});
