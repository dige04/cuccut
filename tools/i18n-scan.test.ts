import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a pure-JS repo script with no type declarations
import { cjkLines, findings, isScannedFile, scan, SCAN_ROOTS } from './i18n-scan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('i18n scan', () => {
  it('finds CJK text in strings, templates and JSX but not in comments or regex literals', () => {
    const source = [
      "const a = '中文';", // 1
      '// 注释里的中文', // 2
      '/* 块注释', // 3
      '   中文 */', // 4
      'const re = /[，。]/;', // 5
      'const t = `x ${n ? `内层` : y} z`;', // 6
      'const j = <div>中文</div>;', // 7
      'const ok = 1 / 2; const s = "文";', // 8
    ].join('\n');
    expect(cjkLines(source)).toEqual([1, 6, 7, 8]);
  });

  it('honours the ignore markers', () => {
    const source = [
      "const a = '一'; // i18n-ignore: 理由", // 1
      '// i18n-ignore: 下一行', // 2
      "const b = '二';", // 3
      '// i18n-ignore-start', // 4
      "const c = '三';", // 5
      '// i18n-ignore-end', // 6
      "const d = '四';", // 7
    ].join('\n');
    expect(findings(source).map((f: { line: number }) => f.line)).toEqual([7]);
    expect(findings(`// i18n-ignore-file: 提示词\nconst x = '五';`)).toEqual([]);
  });

  it('skips tests and translation files', () => {
    expect(isScannedFile('packages/ui/src/foo-copy.zh-Hans.ts')).toBe(false);
    expect(isScannedFile('packages/ui/src/foo.test.ts')).toBe(false);
    expect(isScannedFile('packages/ui/src/foo-copy.ts')).toBe(true);
  });

  // Completion gate: the text shown to people by the UI, the Runtime and the CLI is all in the copy catalogs (repo convention §5).
  it('leaves no untranslated CJK text in packages/*/src and apps/*/src', () => {
    const found: { file: string; line: number; text: string }[] = scan(SCAN_ROOTS, root);
    expect(found.map((f) => `${f.file}:${f.line}: ${f.text}`)).toEqual([]);
  });
});
