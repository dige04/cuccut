import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n.ts';
import { formatRef, refOf } from '../../message-ref.ts';
import { EditLabel } from './edit-label.ts';

beforeEach(() => {
  vi.stubEnv('CUCCUT_LOCALE', undefined);
  setLocale('en');
});
afterEach(() => vi.unstubAllEnvs());

describe('editLabel', () => {
  it('language parameter stores the tag, language names shown in the reader\'s language', () => {
    const label = EditLabel.undoDub({ language: 'fr' });
    expect(label.text).toBe('Undo voice-over (French)');
    expect(refOf(label)).toEqual({ key: 'editLabel.undoDub', params: { language: 'fr' } });
    setLocale('zh-Hans');
    expect(formatRef(label, label.text)).toBe('撤销配音（法语）');
    expect(EditLabel.removeDubGroup({ language: '' }).text).toBe('移除配音（）');
  });

  it('nested references follow the language change, content names kept as is', () => {
    const ratio = EditLabel.aspectRatio({ ratio: EditLabel.originalRatio() });
    const added = EditLabel.addNamed({ name: 'Logo' });
    expect([ratio.text, added.text]).toEqual(['Aspect ratio Original', 'Add Logo']);
    setLocale('ja');
    expect(formatRef(ratio, ratio.text)).toBe('アスペクト比 オリジナル');
    expect(formatRef(added, added.text)).toBe('Logo を追加');
  });
});
