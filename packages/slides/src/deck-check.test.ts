/**
 * Validation logic. Uses the compiler from the editor build (apps/slides-editor/dist/node/compiler.cjs); the parts that need it are skipped when it has not been built.
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
  title: 'Test',
  order: ['a', 'b'],
  sections: { s1: { description: 'Everything', start: 'a' } },
  cover: 'a',
  faces: { 'source-sans-3': FACE },
  designSystems: [],
  ...patch,
});
const SLIDE = (id: string, body = '<h1>Title</h1>') =>
  `<section id="${id}" style="background:#ffffff;font-family:'Source Sans 3', Arial, sans-serif;color:#292929;display:flex;flex-direction:column;padding:128px">\n  ${body}\n</section>\n`;

describe('deckReferenceProblems', () => {
  it('no problems when all references match', () => {
    expect(deckReferenceProblems(deck(), new Set(['a', 'b']))).toEqual([]);
  });

  it('reports missing files, duplicates, and wrong section and cover targets', () => {
    const problems = deckReferenceProblems(deck({ order: ['a', 'a', 'c'], sections: { s1: { description: 'x', start: 'zz' } }, cover: 'b' }), new Set(['a']));
    expect(problems).toEqual(['order: a is duplicated', 'order: c has no matching slides/c.html', 'section s1: start "zz" is not in order', 'cover "b" is not in order']);
  });
});

describe('fontHead', () => {
  it('turns faces into links in <head>, escaping &', () => {
    expect(fontHead(deck())).toBe(
      '<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;700&amp;display=swap"></head>\n',
    );
    expect(fontHead(deck({ faces: {} }))).toBe('<head></head>\n');
  });

  it('src fonts (imported or from a design system) become @font-face; unrecognized src is left out', () => {
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

  it('font links, existing font files and matching design systems have no problems', () => {
    const faces = { web: FACE, brand: { family: 'Brand Sans', src: `/_blob/${blob}` }, ds: { family: 'Acme', src: 'project/ds/acme/fonts/Acme.woff2' } };
    expect(deckFileProblems(deck({ faces, designSystems: [record('acme')] }), root)).toEqual([]);
    expect(deckFileProblems(deck({ faces, designSystems: { acme: record('acme') } as never }), root), 'the object form is accepted too').toEqual([]);
  });

  it('reports fonts the editor cannot recognize or find', () => {
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
      'deck.json: faces has 6 entries; the editor only reads the first 4',
      expect.stringMatching(/^deck\.json: faces\.missing\.src references \/_blob\/c{32}, which does not exist/),
      'deck.json: faces.gone.src points to ds/acme/fonts/Gone.woff2, which is not in the deck',
      expect.stringMatching(/^deck\.json: faces\.web\.src must be the \/_blob\/<id> returned by slides_import_asset/),
      'deck.json: faces.both: set only one of href or src',
      expect.stringMatching(/^deck\.json: faces\.cjk\.family "思源黑体" is not recognized by the editor/),
      expect.stringMatching(/^deck\.json: faces\.long\.href has \d+ characters; the editor only reads up to 1024/),
    ]);
  });

  it('directories under ds/ need a record; record shape, duplicates and count', async () => {
    await mkdir(path.join(root, 'ds/beta'), { recursive: true });
    try {
      expect(deckFileProblems(deck({ designSystems: [] }), root)).toEqual([
        expect.stringMatching(/^ds\/acme\/ has no record in designSystems/),
        expect.stringMatching(/^ds\/beta\/ has no record in designSystems/),
      ]);
      const records = [record('acme'), record('beta'), record('acme'), { namespace: 'Bad' }, record('d'), record('e')];
      expect(deckFileProblems(deck({ designSystems: records }), root)).toEqual([
        'deck.json: designSystems has 6 entries; a deck holds at most 4',
        'deck.json: designSystems[2]: namespace "acme" appears more than once',
        expect.stringMatching(/^deck\.json: designSystems\[3\] must be/),
      ]);
      expect(deckFileProblems(deck({ designSystems: [record('acme'), record('beta'), record('other')] }), root), 'a record without a directory yet is not a problem').toEqual([]);
    } finally {
      await rm(path.join(root, 'ds/beta'), { recursive: true, force: true });
    }
  });
});

describe.skipIf(!compilerAvailable())('validation with the runtime compiler', () => {
  let rt: SlidesRuntime;
  const head = fontHead(deck());
  beforeAll(() => {
    rt = loadSlidesCompiler();
  });

  it('a well-formed slide: no problems, no warnings, stable round trip', () => {
    const report = checkSlide(rt, 'a', SLIDE('a', '<h1 style="font-size:96px">Title</h1>\n  <p style="font-size:32px">Body text</p>'), { head, lists: 'css' });
    expect(report).toEqual({ id: 'a', problems: [], notes: [], roundTripDrift: false });
  });

  it('without font declarations the compiler warns the font is not declared (so check must prepend fontHead)', () => {
    const report = checkSlide(rt, 'a', SLIDE('a'), { head: '' });
    expect(report.problems).toHaveLength(0);
    expect(report.notes.join('\n')).toMatch(/Source Sans 3.*not declared/);
  });

  it('src fonts declared in head: not reported as undeclared, and not counted as a <style> in the slide', () => {
    const srcHead = fontHead(deck({ faces: { brand: { family: 'Source Sans 3', src: 'project/ds/acme/fonts/Brand.woff2' } } }));
    expect(checkSlide(rt, 'a', SLIDE('a'), { head: srcHead })).toEqual({ id: 'a', problems: [], notes: [], roundTripDrift: false });
  });

  it('tags outside the format are errors; dropped CSS is unsupported', () => {
    expect(checkSlide(rt, 'a', SLIDE('a', '<marquee>x</marquee>'), { head }).problems[0]).toMatch(/^error .*<marquee>/);
    expect(checkSlide(rt, 'a', SLIDE('a', '<p style="float:left">x</p>'), { head }).problems[0]).toMatch(/^unsupported .*float/);
  });

  it('an image inside a table cell is removed by the compiler and counted as a problem', () => {
    const report = checkSlide(rt, 'a', SLIDE('a', '<table><tr><td><img src="/_blob/' + 'f'.repeat(32) + '" alt="logo"></td></tr></table>'), {
      head,
      blobExists: () => true,
    });
    expect(report.problems.some(p => /1 table cell\(s\) removed/.test(p)), report.problems.join('\n')).toBe(true);
  });

  it('verbose adds layout hints: overlapping text, Latin words that do not fit; false "mid-word" hints on CJK sentences are filtered out', () => {
    const body = [
      `<p style="font-size:48px">${'这是一段很长的中文句子，'.repeat(8)}</p>`,
      '<p style="position:absolute;left:100px;top:100px;width:400px;font-size:40px">Overlapping</p>',
      '<p style="position:absolute;left:120px;top:110px;width:300px;font-size:40px">Supercalifragilisticexpialidocious</p>',
    ].join('\n  ');
    const notes = checkSlide(rt, 'a', SLIDE('a', body), { head, verbose: true }).notes;
    expect(notes.some(n => /^layout .*overlaps/.test(n)), notes.join('\n')).toBe(true);
    expect(notes.some(n => /^layout .*Supercalifragilisticexpialidocious.*mid-word/.test(n)), notes.join('\n')).toBe(true);
    expect(notes.some(n => /中文句子/.test(n)), notes.join('\n')).toBe(false);
    expect(isCjkWordBreakLint('<p> in <section id="a"> is 1632px wide but "这是一段" needs ~1874px — it will break mid-word')).toBe(true);
    expect(isCjkWordBreakLint('<p> is 300px wide but "Super" needs ~748px — it will break mid-word')).toBe(false);
  });

  it('matches the editor: relative and web image paths are errors with a hint to import; small data: images are fine', () => {
    const img = (src: string) => SLIDE('a', `<img src="${src}" alt="x" style="width:100px;height:100px">`);
    for (const src of ['images/a.png', 'https://example.com/a.png']) {
      const problems = checkSlide(rt, 'a', img(src), { head }).problems;
      expect(problems, src).toEqual([expect.stringMatching(/^error .*import the image with slides_import_asset first/)]);
      expect(problems[0]).not.toMatch(/make\.ts|beside the deck/);
    }
    expect(checkSlide(rt, 'a', img('data:image/png;base64,iVBORw0KGgo='), { head }).problems).toEqual([]);
  });

  it('<title>, <link> and <style> in slide files are errors (fonts are registered in deck.json); font links in head do not count', () => {
    const link = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&display=swap">\n';
    for (const extra of [link, '<title>t</title>\n']) {
      expect(checkSlide(rt, 'a', extra + SLIDE('a'), { head }).problems, extra).toEqual([expect.stringMatching(/<title>, <link> or <style>/)]);
    }
    expect(checkSlide(rt, 'a', '<style>p{color:red}</style>\n' + SLIDE('a'), { head }).problems).toContainEqual(expect.stringMatching(/<title>, <link> or <style>/));
    expect(checkSlide(rt, 'a', SLIDE('a'), { head }).problems).toEqual([]);
  });

  it('a file holds exactly one section', () => {
    const report = checkSlide(rt, 'a', SLIDE('a') + SLIDE('b'), { head });
    expect(report.problems).toEqual(['expected exactly one <section>, found 2']);
  });

  it('references a missing asset', () => {
    const id = '0'.repeat(32);
    const report = checkSlide(rt, 'a', SLIDE('a', `<img src="/_blob/${id}" alt="x" style="width:100px;height:100px">`), {
      head,
      blobExists: () => false,
    });
    expect(report.problems).toEqual([`referenced /_blob/${id} does not exist`]);
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

    it('collects deck.json problems, orphan slides and per-slide results', () => {
      const report = checkDeck(rt, root);
      expect(report.title).toBe('Test');
      expect(report.deckProblems).toEqual(['deck.json: order: missing has no matching slides/missing.html']);
      expect(report.orphans).toEqual(['orphan']);
      expect(report.slides.map(s => s.id)).toEqual(['a', 'b']);
      expect(report.slides[1]!.problems, 'the asset is in assets/').toEqual([]);
      expect(problemCount(report)).toBe(1);
    });
  });
});

describe('deck.json detection', () => {
  it('isDeckMetadata accepts only v4 with an order array', () => {
    expect(isDeckMetadata(deck())).toBe(true);
    expect(isDeckMetadata({ v: 3, order: [] })).toBe(false);
    expect(isDeckMetadata({ v: 4 })).toBe(false);
    expect(isDeckMetadata(null)).toBe(false);
  });

  it('readDeckSummary reads the title and slide count; null for a directory that is not a deck', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'deck-summary-'));
    try {
      expect(await readDeckSummary(dir)).toBe(null);
      await writeFile(path.join(dir, 'deck.json'), JSON.stringify(deck()));
      expect(await readDeckSummary(dir)).toEqual({ title: 'Test', slideCount: 2 });
      await writeFile(path.join(dir, 'deck.json'), '{"v":4');
      expect(await readDeckSummary(dir)).toBe(null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
