import { beforeEach, expect, it, vi } from 'vitest';
import { COPY_DEFAULTS } from '../model/transcript-copy-options.ts';
import { copyPrefsOf, useTranscriptCopyPrefs } from './transcript-copy-prefs-store.ts';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  } });
});

const KEY = 'cuccut.transcript-copy';

beforeEach(async () => {
  // setState also writes to storage: clear it and reload, returning to the never-saved state.
  useTranscriptCopyPrefs.setState({ ...COPY_DEFAULTS });
  localStorage.removeItem(KEY);
  await useTranscriptCopyPrefs.persist.rehydrate();
});

it('when nothing was saved, the format is Markdown with all five toggles on', () => {
  expect(copyPrefsOf(useTranscriptCopyPrefs.getState())).toEqual(COPY_DEFAULTS);
});

it('remembers the last chosen format and checkboxes; reopening shows the same set', async () => {
  useTranscriptCopyPrefs.getState().set({ format: 'txt' });
  useTranscriptCopyPrefs.getState().set({ frontmatter: false, speakers: false });
  const saved = localStorage.getItem(KEY)!;
  expect(saved).not.toMatch(/"set"/);
  useTranscriptCopyPrefs.setState({ ...COPY_DEFAULTS });
  localStorage.setItem(KEY, saved);
  await useTranscriptCopyPrefs.persist.rehydrate();
  expect(copyPrefsOf(useTranscriptCopyPrefs.getState())).toEqual({ ...COPY_DEFAULTS, format: 'txt', frontmatter: false, speakers: false });
});
