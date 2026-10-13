import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@cuccut/protocol';
import { APPROVAL_CARD_COPY, CLIENTS_COPY, COMMON_COPY, MCP_COPY, MODEL_API_COPY, WEB_COPY } from './services-copy.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

describe('services page copy', () => {
  it('English UI reads English', () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(MCP_COPY.title).toBe('MCP service');
    expect(WEB_COPY.revoke).toBe('Sign out');
    expect(COMMON_COPY.section.requests).toBe('Recent requests');
    expect(MODEL_API_COPY.levels.read).toBe('Can only list models (GET /v1/models). Generation requests are rejected.');
    expect(COMMON_COPY.portSaved(8080)).toBe('Port changed to 8080');
    expect(CLIENTS_COPY.meta('2 days ago', null)).toBe('Created 2 days ago · Never used');
    expect(APPROVAL_CARD_COPY.video('Launch')).toBe('Video "Launch"');
    expect(COMMON_COPY.lightsLabel(['MCP service: on', 'Web service: off'])).toBe('MCP service: on, Web service: off');
  });

  it('Simplified Chinese translation unchanged', () => {
    expect(MCP_COPY.title).toBe('MCP 服务');
    expect(APPROVAL_CARD_COPY.video('发布会')).toBe('视频「发布会」');
    expect(COMMON_COPY.lightsLabel(['甲', '乙'])).toBe('甲，乙');
  });
});
