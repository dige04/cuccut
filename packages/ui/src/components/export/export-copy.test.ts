import { setLocale } from '@cuccut/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BAKE_POLICIES, EXPORT_COPY, PLANNED_PROJECT_TARGETS } from './export-copy.ts';

describe('export dialog copy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('English UI reads the English catalog', () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(EXPORT_COPY.title).toBe('Export');
    expect(EXPORT_COPY.retry).toBe('Try again');
    expect(EXPORT_COPY.exportSubtitles).toBe('Export subtitles');
    expect(EXPORT_COPY.moreItems(3)).toBe('3 more');
    expect(EXPORT_COPY.moreFiles(1)).toBe('1 file');
    expect(EXPORT_COPY.subtitlesWhat(['English', 'Chinese'])).toBe('English + Chinese bilingual');
    expect(EXPORT_COPY.eachWhat(['A', 'B', 'C'])).toBe('One file each for A, B, and C');
    expect(EXPORT_COPY.copied).toBe('Copied');
    expect(PLANNED_PROJECT_TARGETS[0]!.name).toBe('Jianying draft');
    expect(BAKE_POLICIES[2]!.label).toBe('Don’t convert, just drop them');
  });

  it('Chinese UI still reads the original text', () => {
    setLocale('zh-Hans');
    expect(EXPORT_COPY.title).toBe('导出');
    expect(EXPORT_COPY.moreItems(3)).toBe('还有 3 项');
    expect(EXPORT_COPY.subtitlesWhat(['英文', '中文'])).toBe('英文 + 中文 双语');
    expect(EXPORT_COPY.eachWhat(['甲', '乙'])).toBe('甲、乙 各一份');
    expect(EXPORT_COPY.copied).toBe('已复制');
    expect(EXPORT_COPY.transcriptLength).toBe('篇幅');
    expect(PLANNED_PROJECT_TARGETS[0]!.name).toBe('剪映草稿');
  });
});
