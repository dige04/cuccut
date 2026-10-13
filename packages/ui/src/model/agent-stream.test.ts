import { describe, expect, it } from 'vitest';
import { advanceCut, closeStreamingTail, revealStep, safeCut, splitBlocks } from './agent-stream.ts';

describe('revealStep', () => {
  it('proportional to the backlog, floor 1, ceiling backlog', () => {
    expect(revealStep({ backlog: 300, elapsedMs: 16 })).toBe(32);
    expect(revealStep({ backlog: 30, elapsedMs: 16 })).toBe(4);
    expect(revealStep({ backlog: 3, elapsedMs: 1 })).toBe(1);
    expect(revealStep({ backlog: 0, elapsedMs: 16 })).toBe(0);
    expect(revealStep({ backlog: 5, elapsedMs: 0 })).toBe(1);
  });

  it('releases everything when elapsed is not shorter than horizon; clamps to 250ms first', () => {
    expect(revealStep({ backlog: 120, elapsedMs: 150 })).toBe(120);
    expect(revealStep({ backlog: 120, elapsedMs: 5000 })).toBe(120);
    expect(revealStep({ backlog: 1000, elapsedMs: 5000, horizonMs: 500 })).toBe(500);
    expect(revealStep({ backlog: 100, elapsedMs: 50, horizonMs: 100 })).toBe(50);
  });
});

describe('safeCut / advanceCut', () => {
  it('cut point snaps back to the start of the grapheme cluster', () => {
    const s = 'a👍🏽b';
    expect(safeCut(s, 2)).toBe(1);
    expect(safeCut(s, 3)).toBe(1);
    expect(safeCut(s, 5)).toBe(5);
    expect(safeCut('中文', 1)).toBe(1);
    expect(safeCut('abc', 0)).toBe(0);
    expect(safeCut('abc', 99)).toBe(3);
  });

  it('returns as-is without Intl.Segmenter', () => {
    const intl = Intl as { Segmenter?: unknown };
    const saved = intl.Segmenter;
    try {
      intl.Segmenter = undefined;
      expect(safeCut('a👍🏽b', 2)).toBe(2);
    } finally {
      intl.Segmenter = saved;
    }
    expect(safeCut('a👍🏽b', 2)).toBe(1);
  });

  it('even when landing mid-cluster, advances at least one whole cluster', () => {
    const s = 'a👍🏽b';
    expect(advanceCut(s, 1, 1)).toBe(5);
    expect(advanceCut(s, 0, 1)).toBe(1);
    expect(advanceCut(s, 5, 10)).toBe(6);
    expect(advanceCut(s, 6, 3)).toBe(6);
  });
});

describe('splitBlocks', () => {
  it('splits chunks on blank lines; trailing blank lines at the end of a chunk do not count', () => {
    expect(splitBlocks('第一段\n\n第二段\n\n')).toEqual(['第一段', '第二段']);
    expect(splitBlocks('# 标题\n正文')).toEqual(['# 标题\n正文']);
    expect(splitBlocks('')).toEqual([]);
  });

  it('blank lines inside fenced code blocks do not split', () => {
    const md = '说明\n\n```sh\necho a\n\necho b\n```\n\n结尾';
    expect(splitBlocks(md)).toEqual(['说明', '```sh\necho a\n\necho b\n```', '结尾']);
    // An unclosed fence: everything after it belongs to it.
    expect(splitBlocks('```\na\n\nb')).toEqual(['```\na\n\nb']);
  });

  it('blank lines inside lists do not split', () => {
    const md = '- 第一项\n\n- 第二项\n\n  续行\n\n之后的段落';
    expect(splitBlocks(md)).toEqual(['- 第一项\n\n- 第二项\n\n  续行', '之后的段落']);
    expect(splitBlocks('1. 一\n\n2. 二')).toEqual(['1. 一\n\n2. 二']);
  });
});

describe('closeStreamingTail', () => {
  it('closes unclosed bold, italic, strikethrough and inline code', () => {
    expect(closeStreamingTail('正在 **加')).toBe('正在 **加**');
    expect(closeStreamingTail('*斜')).toBe('*斜*');
    expect(closeStreamingTail('~~删')).toBe('~~删~~');
    expect(closeStreamingTail('运行 `ccut in')).toBe('运行 `ccut in`');
    expect(closeStreamingTail('**先跑 `ccut')).toBe('**先跑 `ccut`**');
    // A closing marker that was only half written is completed.
    expect(closeStreamingTail('**加粗*')).toBe('**加粗**');
  });

  it('removes a lone marker at the end', () => {
    expect(closeStreamingTail('接着 **')).toBe('接着 ');
    expect(closeStreamingTail('接着 *')).toBe('接着 ');
    expect(closeStreamingTail('接着 ~')).toBe('接着 ');
    expect(closeStreamingTail('接着 _')).toBe('接着 ');
    expect(closeStreamingTail('接着 `')).toBe('接着 ');
    expect(closeStreamingTail('snake_case')).toBe('snake_case');
  });

  it('already-paired markers are not closed again', () => {
    expect(closeStreamingTail('一段 **加粗** 和 `代码`')).toBe('一段 **加粗** 和 `代码`');
    expect(closeStreamingTail('**加粗**')).toBe('**加粗**');
    expect(closeStreamingTail('2 * 3 = 6')).toBe('2 * 3 = 6');
    expect(closeStreamingTail('* 列表项\n* 第二项')).toBe('* 列表项\n* 第二项');
    expect(closeStreamingTail('`a*b` 之后')).toBe('`a*b` 之后');
  });

  it('completed earlier paragraphs are left alone; only the last paragraph is fixed', () => {
    expect(closeStreamingTail('上一段 **没闭合\n\n这一段 **加')).toBe('上一段 **没闭合\n\n这一段 **加**');
    expect(closeStreamingTail('上一段 [链接\n\n这一段')).toBe('上一段 [链接\n\n这一段');
  });

  it('does nothing inside an unclosed fenced code block; ** inside the code block is left alone', () => {
    const open = '看这段：\n\n```js\nconst a = "**";\nconst b = `x';
    expect(closeStreamingTail(open)).toBe(open);
    const tilde = '~~~\n**x\n';
    expect(closeStreamingTail(tilde)).toBe(tilde);
    const closed = '```\n**x\n```\n';
    expect(closeStreamingTail(closed)).toBe(closed);
    // New paragraphs after a fence closes are completed as usual.
    expect(closeStreamingTail('```\n**x\n```\n然后 **加')).toBe('```\n**x\n```\n然后 **加**');
  });

  it('links show only their text; an incomplete image is hidden entirely', () => {
    expect(closeStreamingTail('见 [文档')).toBe('见 文档');
    expect(closeStreamingTail('见 [文档]')).toBe('见 文档');
    expect(closeStreamingTail('见 [文档](https://exa')).toBe('见 文档');
    expect(closeStreamingTail('见 [文档](https://example.test/a)')).toBe('见 [文档](https://example.test/a)');
    expect(closeStreamingTail('图 ![封面](cov')).toBe('图 ');
    expect(closeStreamingTail('图 ![封')).toBe('图 ');
    expect(closeStreamingTail('图 ![封面](cover.png)')).toBe('图 ![封面](cover.png)');
    expect(closeStreamingTail('`a[0` 后')).toBe('`a[0` 后');
  });
});
