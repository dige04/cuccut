import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkCanvas } from './canvas-check.ts';
import { inspectCanvas, readCanvasInfo, resolveDesignEditorDist } from './index.ts';

const roots: string[] = [];
async function tempDir(files: Record<string, string> = {}, name = 'poster') {
  const parent = await mkdtemp(path.join(tmpdir(), 'canvas-check-'));
  roots.push(parent);
  const root = path.join(parent, name);
  await mkdir(root);
  for (const [p, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, p)), { recursive: true });
    await writeFile(path.join(root, p), content);
  }
  return root;
}
afterAll(async () => {
  await Promise.all(roots.map(r => rm(r, { recursive: true, force: true })));
});

const BLOB = '0123456789abcdef0123456789abcdef';

function board(opts: { width?: number; height?: number; body?: string; head?: string; props?: string } = {}) {
  const props = opts.props ?? `'{"accent":{"editor":"color","default":"#666"},"$preview":{"width":${opts.width ?? 880},"height":${opts.height ?? 560}}}'`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Spring Menu</title>
${opts.head ?? '<script src="./support.js"></script>'}
</head>
<body>
<x-dc>
<helmet><style>body{margin:0}</style></helmet>
${opts.body ?? `<div style="width: 880px; height: 560px"><img src="/_blob/${BLOB}"></div>`}
</x-dc>
<script type="text/x-dc" data-dc-script data-props=${props}>
class Component extends DCLogic { renderVals() { return {}; } }
</script>
</body>
</html>`;
}

function canvas(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    v: 3,
    createdOnFiles: { v: 1, at: '2026-10-11T00:00:00Z' },
    title: '  Spring Menu Poster ',
    launch: { view: 'canvas' },
    pages: [],
    boards: { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 } },
    order: ['Main.dc.html'],
    notes: {},
    designSystems: [],
    ...extra,
  });
}

const GOOD = { 'canvas.json': canvas(), 'Main.dc.html': board(), [`assets/${BLOB}.png`]: 'png', 'assets/index.json': '{}' };

describe('readCanvasInfo / inspectCanvas（docs/design/canvas §2.1）', () => {
  it('v 为 3、boards 是对象才算设计稿；标题去掉空白，没有时用目录名', async () => {
    expect(await readCanvasInfo(await tempDir(GOOD))).toEqual({ title: 'Spring Menu Poster', boardCount: 1 });
    expect(await readCanvasInfo(await tempDir({ 'canvas.json': JSON.stringify({ v: 3, boards: {} }) }, 'my-poster'))).toEqual({
      title: 'my-poster',
      boardCount: 0,
    });
    for (const bad of [JSON.stringify({ v: 2, boards: {} }), JSON.stringify({ v: 3, boards: [] }), JSON.stringify({ v: 3 }), '{', '[]']) {
      expect(await readCanvasInfo(await tempDir({ 'canvas.json': bad })), bad).toBeNull();
    }
    expect(await readCanvasInfo(await tempDir({}))).toBeNull();
  });

  it('canvas.json 是符号链接时不算', async () => {
    const real = await tempDir(GOOD);
    const dir = await tempDir({});
    await symlink(path.join(real, 'canvas.json'), path.join(dir, 'canvas.json'));
    expect(await readCanvasInfo(dir)).toBeNull();
  });

  it('inspectCanvas 的大小取目录与第一层子目录里的普通文件', async () => {
    const dir = await tempDir({ ...GOOD, 'a/b/deep.css': 'x'.repeat(1000), '.hidden': 'x'.repeat(1000) });
    const stat = await inspectCanvas(dir);
    expect(stat).toMatchObject({ title: 'Spring Menu Poster', boardCount: 1 });
    const expected = Buffer.byteLength(GOOD['canvas.json']) + Buffer.byteLength(GOOD['Main.dc.html']) + 3 + 2;
    expect(stat!.size).toBe(expected);
  });
});

describe('checkCanvas（docs/design/canvas §7.2）', () => {
  const messages = async (files: Record<string, string>) => (await checkCanvas(await tempDir(files))).issues.map(i => `${i.file}: ${i.message}`);

  it('合格的设计稿没有问题；返回标题与画板数', async () => {
    expect(await checkCanvas(await tempDir(GOOD))).toEqual({ title: 'Spring Menu Poster', boardCount: 1, issues: [] });
  });

  it('子目录里的画板与 ds/ 里的 .dc.html；实体转义的 data-props', async () => {
    const result = await checkCanvas(
      await tempDir({
        ...GOOD,
        'canvas.json': canvas({
          boards: { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 }, 'screens/Cart.dc.html': { x: 960, y: 0, w: 390, h: 844, page: 'p1' } },
          order: ['Main.dc.html', 'screens/Cart.dc.html'],
          pages: [{ id: 'p1', name: 'Flow' }],
          launch: { view: 'focused', file: 'screens/Cart.dc.html' },
          notes: { n1: { x: 0, y: -300, text: 'Flows', kind: 'title1' }, n2: { x: 0, y: 900, text: 'todo', w: 240 }, n3: { x: 0, y: 0, text: '', kind: 'arrow' } },
          designSystems: [{ title: 'Brand', namespace: 'brand', artifact: '../brand-system', version: null, copiedAt: '2026-10-11T00:00:00Z' }],
        }),
        'screens/Cart.dc.html': board({
          width: 390,
          height: 844,
          head: '<script src="./support.js"></script>\n<link rel="stylesheet" href="../ds/brand/base.css">\n<script src="../ds/brand/bundle.js"></script>',
          props: `'{"label":{"editor":"text","default":"Tom&#39;s &amp; co"},"item":{"editor":null},"$preview":{"width":390,"height":844}}'`,
          body: `<div style="width: 390px"><sc-for list="{{ items }}" as="item" hint-placeholder-count="3"><dc-import name="Main" item="{{ item }}" hint-size="100%,120px"></dc-import><span>{{ $index }}</span></sc-for><a href="../Main.dc.html" onClick="{{ item.pick }}">Back {{ label }}</a><svg viewBox="0 0 10 10"><path d="M0 0L10 10"/><linearGradient id="g"></linearGradient></svg><br><input type="text" disabled></div>`,
        }),
        'ds/brand/Button.dc.html': '<p>not an artboard',
        'ds/brand/base.css': '@import "https://cdn.example.com/x.css"; body{background:url("../_blob/ffffffffffffffffffffffffffffffff")}',
        'ds/brand/bundle.js': 'document.body.innerHTML = "x"',
        'ds/brand/tokens.json': '{}',
        'styles/base.css': `@import url("https://fonts.googleapis.com/css2?family=Inter"); body{background:url(/_blob/${BLOB})}`,
      }),
    );
    expect(result.issues).toEqual([]);
    expect(result.boardCount).toBe(2);
  });

  it('canvas.json 缺失、不是 JSON、版本不对', async () => {
    expect(await messages({ 'Main.dc.html': board() })).toContainEqual(expect.stringMatching(/^canvas\.json: missing/));
    expect(await messages({ 'canvas.json': '{' })).toContainEqual(expect.stringMatching(/^canvas\.json: is not valid JSON/));
    expect(await messages({ 'canvas.json': JSON.stringify({ v: 4, boards: {} }) })).toContainEqual(expect.stringMatching(/"v": 3/));
  });

  it('canvas.json 的字段与上限', async () => {
    const issues = await messages({
      ...GOOD,
      'canvas.json': canvas({
        title: 5,
        boards: {
          'Main.dc.html': { x: '0', y: 0, w: 30, h: 9000, expand: 'grow', paper: 'a3', page: 'nope', guides: [...Array(6).fill({ kind: 'grid' }), { kind: 'dots' }] },
          'Missing.dc.html': { x: 0, y: 0, w: 100, h: 100 },
          'bad.html': { x: 0, y: 0, w: 100, h: 100 },
        },
        order: ['Main.dc.html', 'Main.dc.html', 'Ghost.dc.html'],
        pages: Array.from({ length: 41 }, (_, i) => ({ id: `p${i}`, name: 'x' })),
        notes: { 'bad id': { x: 0, y: 0 }, n2: { x: 0, y: 0, text: 'x', kind: 'title2', page: 'gone' } },
        launch: { view: 'focused', file: 'Nope.dc.html' },
        designSystems: [
          { title: 'Ember', namespace: 'ember', artifact: '../ember', version: null, copiedAt: 'now' },
          { title: 'Bad', namespace: 'bad' },
        ],
      }),
      'ds/Cool_Kit/tokens.json': '{}',
      'ds/loose.json': '{}',
    });
    const expectIssue = (pattern: RegExp) => expect(issues).toContainEqual(expect.stringMatching(pattern));
    expectIssue(/^canvas\.json: title must be a string/);
    expectIssue(/boards\["Main\.dc\.html"\]: x and y must be numbers/);
    expectIssue(/boards\["Main\.dc\.html"\]: w and h must be numbers from 40 to 8000/);
    expectIssue(/expand can only be "fill"/);
    expectIssue(/paper must be "letter" or "a4"/);
    expectIssue(/page must be the id of an entry in pages/);
    expectIssue(/guides has 7 entries; at most 6/);
    expectIssue(/guides\[6\]\.kind must be "columns", "rows" or "grid"/);
    expectIssue(/notes\["n2"\]\.kind must be "title1"/);
    expectIssue(/notes\["n2"\]\.page must be the id of an entry in pages/);
    expect(issues.some((issue) => issue.includes('designSystems[0]'))).toBe(false);
    expectIssue(/designSystems\[1\] must be \{"title"/);
    expectIssue(/ds\/Cool_Kit\/: a design system folder is lower case/);
    expectIssue(/ds\/Cool_Kit\/ has no record in designSystems/);
    expectIssue(/ds\/loose\.json: files under ds\/ belong in ds\/<folder>\//);
    expectIssue(/the file Missing\.dc\.html does not exist/);
    expectIssue(/boards\["bad\.html"\]: the key must be the artboard file's path/);
    expectIssue(/order lists Main\.dc\.html more than once/);
    expectIssue(/order\[2\] \("Ghost\.dc\.html"\) is not a key of boards/);
    expectIssue(/Missing\.dc\.html is in boards but not in order/);
    expectIssue(/pages has 41 entries; at most 40/);
    expectIssue(/notes: the id "bad id"/);
    expectIssue(/notes\["bad id"\] needs numbers x and y and a string text/);
    expectIssue(/launch\.file must be a key of boards/);
  });

  it('画板文件：support.js 头行、<x-dc>、data-dc-script 块、data-props 与 $preview', async () => {
    const issues = await messages({
      ...GOOD,
      'canvas.json': canvas({
        boards: {
          'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 },
          'A.dc.html': { x: 0, y: 0, w: 880, h: 560 },
          'B.dc.html': { x: 0, y: 0, w: 880, h: 560 },
          'C.dc.html': { x: 0, y: 0, w: 880, h: 560 },
          'D.dc.html': { x: 0, y: 0, w: 880, h: 560 },
        },
        order: ['Main.dc.html', 'A.dc.html', 'B.dc.html', 'C.dc.html', 'D.dc.html'],
      }),
      'Main.dc.html': board({ head: '<script src="support.js"></script>', width: 800 }),
      'A.dc.html': board({ body: '<div>no wrapper</div>' }).replace(/<\/?x-dc>/g, ''),
      'B.dc.html': board({ props: `"{&quot;$preview&quot;:{&quot;width&quot;:880,&quot;height&quot;:560}}"` }),
      'C.dc.html': board({ props: `'{"$preview":{"width":880,"height":560},}'` }),
      'D.dc.html': board().replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, ''),
    });
    const expectIssue = (pattern: RegExp) => expect(issues).toContainEqual(expect.stringMatching(pattern));
    expectIssue(/^Main\.dc\.html: the <head> must contain the exact line <script src="\.\/support\.js"><\/script>/);
    expectIssue(/^Main\.dc\.html: \$preview is 800×560 but canvas\.json boards gives 880×560/);
    expectIssue(/^A\.dc\.html: the markup must be wrapped in <x-dc>/);
    expectIssue(/^B\.dc\.html: data-props must be single-quoted/);
    expectIssue(/^C\.dc\.html: data-props is not valid JSON/);
    expectIssue(/^D\.dc\.html: missing the <script type="text\/x-dc" data-dc-script/);
  });

  it('没登记的画板、重名、素材、嵌入与网上的脚本样式', async () => {
    const issues = await messages({
      ...GOOD,
      'Main.dc.html': board({
        body: `<div><img src="/_blob/ffffffffffffffffffffffffffffffff"><img src="/_blob/nope"><iframe src="x"></iframe><embed src="y"></div>`,
        head: '<script src="./support.js"></script>\n<script src="https://cdn.example.com/lib.js"></script>\n<link rel="stylesheet" href="https://cdn.example.com/x.css">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">',
      }),
      'screens/Main.dc.html': board(),
      'extra/Orphan.dc.html': board(),
      'styles/x.css': '@import "https://evil.example/x.css";',
    });
    const expectIssue = (pattern: RegExp) => expect(issues).toContainEqual(expect.stringMatching(pattern));
    expectIssue(/^Main\.dc\.html: \/_blob\/ffffffffffffffffffffffffffffffff is not in assets\//);
    expectIssue(/^Main\.dc\.html: \/_blob\/nope is not a valid asset reference/);
    expectIssue(/^Main\.dc\.html: <iframe> is not allowed/);
    expectIssue(/^Main\.dc\.html: <embed> is not allowed/);
    expectIssue(/^Main\.dc\.html: <script src="https:\/\/cdn\.example\.com\/lib\.js"> loads a script from the network/);
    expectIssue(/^Main\.dc\.html: <link href="https:\/\/cdn\.example\.com\/x\.css"> loads from the network/);
    expect(issues.some(i => i.includes('fonts.googleapis.com/css2'))).toBe(false);
    expectIssue(/^screens\/Main\.dc\.html: has the same name as Main\.dc\.html/);
    expectIssue(/^extra\/Orphan\.dc\.html: is not in canvas\.json boards/);
    expectIssue(/^styles\/x\.css: @import https:\/\/evil\.example\/x\.css loads a stylesheet from the network/);
  });

  it('原格式的踩坑规则：标签闭合与引号、{{ }} 只是查找、逻辑块、脚本拼界面、按键与网络、素材地址、dc-import', async () => {
    const issues = await messages({
      ...GOOD,
      'canvas.json': canvas({
        boards: { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 }, 'B.dc.html': { x: 0, y: 0, w: 880, h: 560 } },
        order: ['Main.dc.html', 'B.dc.html'],
      }),
      'Main.dc.html': board({
        props: `'{"size":{"editor":"slider"},"$preview":{"width":880,"height":560}}'`,
        body: [
          '<div class=box style="width: 880px; background: url(/_blob/0123456789abcdef0123456789abcdef)">',
          '<p>{{ a + b }}<span title="{{ !x }}">x</span>',
          '<Card></Card><dc-import name="Card"></dc-import><dc-import name="B"/>',
          '<img src="data:image/png;base64,AAAA"><img src="hero.jpg"><img src="https://img.example.com/a.png">',
          '<a href="Gone.dc.html">go</a>',
          '</div>',
        ].join(''),
      }).replace(
        'class Component extends DCLogic { renderVals() { return {}; } }',
        `import x from "y";
class Comp extends Base {
  componentDidMount() {
    this.el.innerHTML = '<b>x</b>';
    document.body.appendChild(document.createElement('div'));
    window.Widget = {};
    window.addEventListener('keydown', () => {});
    fetch('https://api.example.com/x');
    new WebSocket('wss://x');
  }
}`,
      ),
      'B.dc.html': board({
        body: '<div style="width: 880px"><style>.a{background:url(hero.png)} .b{background:url(https://fonts.gstatic.com/x.woff2)}</style><ul><li>one</ul></div>',
        head: '<script src="./support.js"></script>\n<link rel="stylesheet" href="styles/missing.css">\n<script src="lib/missing.js"></script>',
      }),
    });
    const expectIssue = (pattern: RegExp) => expect(issues).toContainEqual(expect.stringMatching(pattern));
    expectIssue(/^Main\.dc\.html: the attribute class=box is not quoted/);
    expectIssue(/^Main\.dc\.html: url\(…\) in an inline style/);
    expectIssue(/^Main\.dc\.html: \{\{ a \+ b \}\} is an expression/);
    expectIssue(/^Main\.dc\.html: \{\{ !x \}\} is an expression/);
    expectIssue(/^Main\.dc\.html: <p> is not closed before <\/div>/);
    expectIssue(/^Main\.dc\.html: <Card>: tag names are lower case/);
    expectIssue(/^Main\.dc\.html: <dc-import name="Card"> has no Card\.dc\.html to mount/);
    expectIssue(/^Main\.dc\.html: <dc-import \/> is self-closed/);
    expectIssue(/^Main\.dc\.html: <img src> uses a data: URI/);
    expectIssue(/^Main\.dc\.html: <img src> names the file hero\.jpg/);
    expectIssue(/^Main\.dc\.html: <img src> loads https:\/\/img\.example\.com\/a\.png from the network/);
    expectIssue(/^Main\.dc\.html: <a href="Gone\.dc\.html"> links to an artboard that does not exist/);
    expectIssue(/^Main\.dc\.html: data-props "size": editor must be one of/);
    expectIssue(/^Main\.dc\.html: the data-dc-script block must define class Component extends DCLogic/);
    expectIssue(/^Main\.dc\.html: the data-dc-script block is classic JS: no import or export/);
    expectIssue(/^Main\.dc\.html: builds UI from script/);
    expectIssue(/^Main\.dc\.html: sets a window\.X global/);
    expectIssue(/^Main\.dc\.html: installs a global keyboard handler/);
    expectIssue(/^Main\.dc\.html: fetch\("https:\/\/api\.example\.com\/x"\) goes to the network/);
    expectIssue(/^Main\.dc\.html: opens a network connection/);
    expectIssue(/^B\.dc\.html: url\(…\) names the file hero\.png/);
    expect(issues.some(i => i.includes('fonts.gstatic.com'))).toBe(false);
    expectIssue(/^B\.dc\.html: <li> is not closed before <\/ul>/);
    expectIssue(/^B\.dc\.html: <link href> "styles\/missing\.css" is not a file in this design/);
    expectIssue(/^B\.dc\.html: <script src> "lib\/missing\.js" is not a file in this design/);
  });

  it('路径段不合规则、符号链接与文件数上限', async () => {
    const files: Record<string, string> = { ...GOOD, 'has space.dc.html': 'x', '-x/y.css': 'y' };
    for (let i = 0; i < 512; i++) files[`parts/p${i}.css`] = 'a{}';
    const dir = await tempDir(files);
    await symlink(path.join(dir, 'Main.dc.html'), path.join(dir, 'Link.css'));
    const issues = (await checkCanvas(dir)).issues.map(i => `${i.file}: ${i.message}`);
    const expectIssue = (pattern: RegExp) => expect(issues).toContainEqual(expect.stringMatching(pattern));
    expectIssue(/^has space\.dc\.html: "has space\.dc\.html" is not a valid path segment/);
    expectIssue(/^-x: "-x" is not a valid path segment/);
    expectIssue(/^Link\.css: is a symbolic link/);
    expectIssue(/^\.: has 514 files outside assets\/; a design holds at most 512/);
  });
});

describe('resolveDesignEditorDist（docs/design/canvas §3）', () => {
  it('环境变量指的目录要有 index.html', async () => {
    const dist = await tempDir({ 'index.html': '<!doctype html>' });
    expect(resolveDesignEditorDist({ CUCCUT_DESIGN_EDITOR_DIST: dist })).toBe(dist);
    expect(resolveDesignEditorDist({ CUCCUT_DESIGN_EDITOR_DIST: path.join(dist, 'nope') })).toBeNull();
  });
});
