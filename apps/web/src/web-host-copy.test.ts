import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@cuccut/protocol';
import { M } from './web-host-copy.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

describe('web host copy', () => {
  it('reads the notices in English', () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(M.pickDirectory).toMatch(/^You can’t choose a folder .* Use the CucCut desktop app, or open a registered project\.$/);
    expect(M.reveal).toBe('Show in Folder isn’t available in the browser. Use the CucCut desktop app.');
  });

  it('keeps the Chinese text', () => {
    expect(M.pickMedia).toBe('浏览器里不能导入本机文件（第一版不支持上传）：请在 CucCut 桌面应用里操作。');
  });
});
