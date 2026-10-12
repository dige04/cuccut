/**
 * 校验逻辑。用编辑器构建里的编译器（apps/slides-editor/dist/node/compiler.cjs）；没构建时跳过要编译器的部分。
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SlidesRuntime } from './compiler-contract.ts';
import { checkDeck, checkSlide, deckFileProblems, fontHead, isCjkWordBreakLint, problemCount } from './deck-check.ts';
import { deckReferenceProblems, isDeckMetadata, readDeckSummary, type DeckMetadata } from './deck-metadata.ts';
import { compilerAvailable, loadSlidesCompiler } from './slides-compiler.ts';

const FACE = { family: 'Source Sans 3', href: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;700&display=swap' };
const deck = (patch: Partial<DeckMetadata> = {}): DeckMetadata => ({
  v: 4,
  lists: 'css',
  title: '测试',
  order: ['a', 'b'],
  sections: { s1: { description: '全部', start: 'a' } },
  cover: 'a',
  faces: { 'source-sans-3': FACE },
  designSystems: [],
  ...patch,
});
const SLIDE = (id: string, body = '<h1>标题</h1>') =>
  `<section id="${id}" style="background:#ffffff;font-family:'Source Sans 3', Arial, sans-serif;color:#292929;display:flex;flex-direction:column;padding:128px">\n  ${body}\n</section>\n`;

describe('deckReferenceProblems', () => {
  it('引用都对得上时没有问题', () => {
    expect(deckReferenceProblems(deck(), new Set(['a', 'b']))).toEqual([]);
  });

  it('报告缺文件、重复、章节和封面指错', () => {
    const problems = deckReferenceProblems(deck({ order: ['a', 'a', 'c'], sections: { s1: { description: 'x', start: 'zz' } }, cover: 'b' }), new Set(['a']));
    expect(problems).toEqual(['order 里 a 重复', 'order 里的 c 没有对应的 slides/c.html', '章节 s1 的 start「zz」不在 order 里', 'cover「b」不在 order 里']);
  });
});

describe('fontHead', () => {
  it('把 faces 变成 <head> 里的链接，转义 &', () => {
    expect(fontHead(deck())).toBe(
      '<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;700&amp;display=swap"></head>\n',
    );
    expect(fontHead(deck({ faces: {} }))).toBe('<head></head>\n');
  });

  it('src 的字体（导入的或设计系统里的）变成 @font-face；认不得的 src 不拼', () => {
    const blob = `/_blob/${'a'.repeat(32)}`;
    const faces = {
      brand: { family: 'Brand Sans', src: blob },
      ds: { family: 'Acme Serif', src: 'project/ds/acme/fonts/Acme-Serif.woff2' },
      web: { family: 'Remote', src: 'https://example.com/a.woff2' },
    };
    expect(fontHead(deck({ faces }))).toBe(
      `<head><style>@font-face{font-family:'Brand Sans';src:url(${blob})}</style><style>@font-face{font-family:'Acme Serif';src:url(project/ds/acme/fonts/Acme-Serif.woff2)}</style></head>\n`,
    );
  });
});

describe('deckFileProblems', () => {
  let root: string;
  const blob = 'b'.repeat(32);
  const record = (namespace: string) => ({ title: namespace, namespace, artifact: `../${namespace}`, version: null, copiedAt: '2026-10-11T00:00:00Z' });
  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'deck-files-'));
    await mkdir(path.join(root, 'assets'), { recursive: true });
    await writeFile(path.join(root, `assets/${blob}.woff2`), 'woff2');
    await mkdir(path.join(root, 'ds/acme/fonts'), { recursive: true });
    await writeFile(path.join(root, 'ds/acme/tokens.json'), '{}');
    await writeFile(path.join(root, 'ds/acme/fonts/Acme.woff2'), 'woff2');
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('字体链接、存在的字体文件与对得上的设计系统没有问题', () => {
    const faces = { web: FACE, brand: { family: 'Brand Sans', src: `/_blob/${blob}` }, ds: { family: 'Acme', src: 'project/ds/acme/fonts/Acme.woff2' } };
    expect(deckFileProblems(deck({ faces, designSystems: [record('acme')] }), root)).toEqual([]);
    expect(deckFileProblems(deck({ faces, designSystems: { acme: record('acme') } as never }), root), '对象形式也认').toEqual([]);
  });

  it('报告编辑器认不得或找不到的字体', () => {
    const faces = {
      missing: { family: 'Missing', src: `/_blob/${'c'.repeat(32)}` },
      gone: { family: 'Gone', src: 'project/ds/acme/fonts/Gone.woff2' },
      web: { family: 'Remote', src: 'https://example.com/a.woff2' },
      both: { family: 'Both', href: FACE.href, src: `/_blob/${blob}` },
      cjk: { family: '思源黑体', href: FACE.href },
      long: { family: 'Long', href: `https://fonts.googleapis.com/css2?family=Long:wght@${'1;'.repeat(510)}400` },
    };
    const problems = deckFileProblems(deck({ faces, designSystems: [record('acme')] }), root);
    expect(problems).toEqual([
      'deck.json: faces 有 6 项，编辑器只认前 4 个',
      expect.stringMatching(/^deck\.json: faces\.missing\.src 引用的 \/_blob\/c{32} 不存在/),
      'deck.json: faces.gone.src 指向的 ds/acme/fonts/Gone.woff2 不在 deck 里',
      expect.stringMatching(/^deck\.json: faces\.web\.src 要是 slides_import_asset 返回的/),
      'deck.json: faces.both 只写 href 或 src 中的一个',
      expect.stringMatching(/^deck\.json: faces\.cjk\.family「思源黑体」编辑器认不得/),
      expect.stringMatching(/^deck\.json: faces\.long\.href 有 \d+ 个字符，编辑器只认 1024 个以内/),
    ]);
  });

  it('ds/ 下的目录要有记录；记录的形状、重复与个数', async () => {
    await mkdir(path.join(root, 'ds/beta'), { recursive: true });
    try {
      expect(deckFileProblems(deck({ designSystems: [] }), root)).toEqual([
        expect.stringMatching(/^ds\/acme\/ 在 designSystems 里没有记录/),
        expect.stringMatching(/^ds\/beta\/ 在 designSystems 里没有记录/),
      ]);
      const records = [record('acme'), record('beta'), record('acme'), { namespace: 'Bad' }, record('d'), record('e')];
      expect(deckFileProblems(deck({ designSystems: records }), root)).toEqual([
        'deck.json: designSystems 有 6 项，一份 deck 至多 4 个',
        'deck.json: designSystems[2]: namespace「acme」出现了不止一次',
        expect.stringMatching(/^deck\.json: designSystems\[3\] 要写成/),
      ]);
      expect(deckFileProblems(deck({ designSystems: [record('acme'), record('beta'), record('other')] }), root), '有记录、还没有目录不算问题').toEqual([]);
    } finally {
      await rm(path.join(root, 'ds/beta'), { recursive: true, force: true });
    }
  });
});

describe.skipIf(!compilerAvailable())('用运行时编译器校验', () => {
  let rt: SlidesRuntime;
  const head = fontHead(deck());
  beforeAll(() => {
    rt = loadSlidesCompiler();
  });

  it('规范的页面：没有问题、没有警告、往返稳定', () => {
    const report = checkSlide(rt, 'a', SLIDE('a', '<h1 style="font-size:96px">标题</h1>\n  <p style="font-size:32px">正文</p>'), { head, lists: 'css' });
    expect(report).toEqual({ id: 'a', problems: [], notes: [], roundTripDrift: false });
  });

  it('不带字体声明时，编译器警告字体未声明（所以 check 要拼上 fontHead）', () => {
    const report = checkSlide(rt, 'a', SLIDE('a'), { head: '' });
    expect(report.problems).toHaveLength(0);
    expect(report.notes.join('\n')).toMatch(/Source Sans 3.*not declared/);
  });

  it('src 的字体在 head 里声明过：不报未声明，也不算页面里的 <style>', () => {
    const srcHead = fontHead(deck({ faces: { brand: { family: 'Source Sans 3', src: 'project/ds/acme/fonts/Brand.woff2' } } }));
    expect(checkSlide(rt, 'a', SLIDE('a'), { head: srcHead })).toEqual({ id: 'a', problems: [], notes: [], roundTripDrift: false });
  });

  it('格式外的标签是错误，丢弃的 CSS 是 unsupported', () => {
    expect(checkSlide(rt, 'a', SLIDE('a', '<marquee>x</marquee>'), { head }).problems[0]).toMatch(/^错误 .*<marquee>/);
    expect(checkSlide(rt, 'a', SLIDE('a', '<p style="float:left">x</p>'), { head }).problems[0]).toMatch(/^不支持 .*float/);
  });

  it('单元格里放图片会被编译器移除，计入问题', () => {
    const report = checkSlide(rt, 'a', SLIDE('a', '<table><tr><td><img src="/_blob/' + 'f'.repeat(32) + '" alt="logo"></td></tr></table>'), {
      head,
      blobExists: () => true,
    });
    expect(report.problems.some(p => /1 个单元格被删/.test(p)), report.problems.join('\n')).toBe(true);
  });

  it('verbose 带上排版提示：文字重叠、拉丁长词放不下；中日韩整句的「断词」误报滤掉', () => {
    const body = [
      `<p style="font-size:48px">${'这是一段很长的中文句子，'.repeat(8)}</p>`,
      '<p style="position:absolute;left:100px;top:100px;width:400px;font-size:40px">Overlapping</p>',
      '<p style="position:absolute;left:120px;top:110px;width:300px;font-size:40px">Supercalifragilisticexpialidocious</p>',
    ].join('\n  ');
    const notes = checkSlide(rt, 'a', SLIDE('a', body), { head, verbose: true }).notes;
    expect(notes.some(n => /^排版 .*overlaps/.test(n)), notes.join('\n')).toBe(true);
    expect(notes.some(n => /^排版 .*Supercalifragilisticexpialidocious.*mid-word/.test(n)), notes.join('\n')).toBe(true);
    expect(notes.some(n => /中文句子/.test(n)), notes.join('\n')).toBe(false);
    expect(isCjkWordBreakLint('<p> in <section id="a"> is 1632px wide but "这是一段" needs ~1874px — it will break mid-word')).toBe(true);
    expect(isCjkWordBreakLint('<p> is 300px wide but "Super" needs ~748px — it will break mid-word')).toBe(false);
  });

  it('与编辑器一致：相对路径的图片、网上的图片是错误，提示改用导入；小的 data: 图片可以', () => {
    const img = (src: string) => SLIDE('a', `<img src="${src}" alt="x" style="width:100px;height:100px">`);
    for (const src of ['images/a.png', 'https://example.com/a.png']) {
      const problems = checkSlide(rt, 'a', img(src), { head }).problems;
      expect(problems, src).toEqual([expect.stringMatching(/^错误 .*图片先用 slides_import_asset 导入/)]);
      expect(problems[0]).not.toMatch(/make\.ts|beside the deck/);
    }
    expect(checkSlide(rt, 'a', img('data:image/png;base64,iVBORw0KGgo='), { head }).problems).toEqual([]);
  });

  it('页面文件里的 <title>、<link>、<style> 是错误（字体登记在 deck.json）；head 里的字体链接不算', () => {
    const link = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&display=swap">\n';
    for (const extra of [link, '<title>t</title>\n']) {
      expect(checkSlide(rt, 'a', extra + SLIDE('a'), { head }).problems, extra).toEqual([expect.stringMatching(/<title>、<link> 或 <style>/)]);
    }
    expect(checkSlide(rt, 'a', '<style>p{color:red}</style>\n' + SLIDE('a'), { head }).problems).toContainEqual(expect.stringMatching(/<title>、<link> 或 <style>/));
    expect(checkSlide(rt, 'a', SLIDE('a'), { head }).problems).toEqual([]);
  });

  it('一个文件里只能有一个 section', () => {
    const report = checkSlide(rt, 'a', SLIDE('a') + SLIDE('b'), { head });
    expect(report.problems).toEqual(['应该恰好一个 <section>，实际 2 个']);
  });

  it('引用不存在的素材', () => {
    const id = '0'.repeat(32);
    const report = checkSlide(rt, 'a', SLIDE('a', `<img src="/_blob/${id}" alt="x" style="width:100px;height:100px">`), {
      head,
      blobExists: () => false,
    });
    expect(report.problems).toEqual([`引用的 /_blob/${id} 不存在`]);
  });

  describe('checkDeck', () => {
    let root: string;
    beforeAll(async () => {
      root = await mkdtemp(path.join(tmpdir(), 'check-deck-'));
      await mkdir(path.join(root, 'slides'), { recursive: true });
      await mkdir(path.join(root, 'assets'), { recursive: true });
      await writeFile(path.join(root, 'deck.json'), JSON.stringify(deck({ order: ['a', 'missing', 'b'] })));
      await writeFile(path.join(root, 'slides/a.html'), SLIDE('a'));
      await writeFile(path.join(root, 'slides/b.html'), SLIDE('b', `<img src="/_blob/${'a'.repeat(32)}" alt="x" style="width:100px;height:100px">`));
      await writeFile(path.join(root, `assets/${'a'.repeat(32)}.png`), 'png');
      await writeFile(path.join(root, 'slides/orphan.html'), SLIDE('orphan'));
    });
    afterAll(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('汇总 deck.json 的问题、孤立页和每页结果', () => {
      const report = checkDeck(rt, root);
      expect(report.title).toBe('测试');
      expect(report.deckProblems).toEqual(['deck.json: order 里的 missing 没有对应的 slides/missing.html']);
      expect(report.orphans).toEqual(['orphan']);
      expect(report.slides.map(s => s.id)).toEqual(['a', 'b']);
      expect(report.slides[1]!.problems, '素材在 assets/ 里').toEqual([]);
      expect(problemCount(report)).toBe(1);
    });
  });
});

describe('deck.json 的识别', () => {
  it('isDeckMetadata 只认 v4 且有 order 数组', () => {
    expect(isDeckMetadata(deck())).toBe(true);
    expect(isDeckMetadata({ v: 3, order: [] })).toBe(false);
    expect(isDeckMetadata({ v: 4 })).toBe(false);
    expect(isDeckMetadata(null)).toBe(false);
  });

  it('readDeckSummary 读标题与页数；不是 deck 的目录给 null', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'deck-summary-'));
    try {
      expect(await readDeckSummary(dir)).toBe(null);
      await writeFile(path.join(dir, 'deck.json'), JSON.stringify(deck()));
      expect(await readDeckSummary(dir)).toEqual({ title: '测试', slideCount: 2 });
      await writeFile(path.join(dir, 'deck.json'), '{"v":4');
      expect(await readDeckSummary(dir)).toBe(null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
