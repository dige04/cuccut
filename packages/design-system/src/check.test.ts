import { mkdir, mkdtemp, open, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkDesignSystem, DESIGN_SYSTEM_ISSUE_CODES, DESIGN_SYSTEM_NOT_CHECKED, decodeIndexKey, encodeIndexKey, type DesignSystemCheckResult } from './check.ts';
import { BLOBS_DIR, DESIGN_SYSTEM_LIMITS } from './layout.ts';

/** 一个文件的内容；`{ sparse }` 是只有大小的稀疏文件（查大小上限用，不真的写这么多字节）；null 是删掉基础系统里的这个文件。 */
type Content = string | Buffer | { sparse: number } | null;

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map(r => rm(r, { recursive: true, force: true })));
});

async function materialize(files: Record<string, Exclude<Content, null>>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'design-system-check-'));
  roots.push(root);
  for (const [p, content] of Object.entries(files)) {
    const file = path.join(root, p);
    await mkdir(path.dirname(file), { recursive: true });
    if (typeof content === 'object' && 'sparse' in content) {
      const handle = await open(file, 'w');
      await handle.truncate(content.sparse);
      await handle.close();
    } else await writeFile(file, content);
  }
  return root;
}

const BLOB = '0123456789abcdef0123456789abcdef';
const OTHER_BLOB = 'fedcba9876543210fedcba9876543210';
const WOFF2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(60)]);

const BASE_INDEX: Record<string, unknown> = {
  v: 3,
  layout: 'files',
  createdOnFiles: { v: 1, at: '2026-01-01T00:00:00.000Z' },
  title: 'Acme',
  namespace: 'Acme',
  libraries: [
    { name: 'react', version: '18.3.1', global: 'React', file: 'components/lib/react.production.min.js' },
    { name: 'react-dom', version: '18.3.1', global: 'ReactDOM', file: 'components/lib/react-dom.production.min.js' },
  ],
  groups: ['Logos'],
  assetGroups: { Logos: { name: 'Logos', order: ['mark.svg'], files: {}, tile: 'm' } },
  blobs: {},
  sections: {},
  docs: { sections: [] },
};
const TOKENS = {
  version: 1,
  color: { themes: [{ id: 'light', name: 'Light' }], tokens: [{ name: 'ink', value: '#111111', usage: 'Text' }] },
  type: { fonts: [{ family: 'Inter', file: 'fonts/Inter.woff2', weight: '400', style: 'normal' }], families: { sans: 'Inter, sans-serif' }, groups: [] },
  spacing: { tokens: [{ name: 'space-1', value: '4px', usage: 'Tight gaps' }] },
};
const PREVIEW = [
  '<!-- @dsCard group="Actions" height=72 -->',
  '<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"></head><body>',
  '<div id="root"></div><img src="../../assets/Logos/mark.svg">',
  "<script>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.Acme.Button));</script>",
  '</body></html>',
].join('\n');
const BUNDLE = '/* @ds-bundle: {"format":4,"namespace":"Acme","components":[{"name":"Button"}]} */\n(()=>{window.Acme={Button:function Button(){return null}};})();\n';
const BASE_FILES: Record<string, Exclude<Content, null>> = {
  'README.md': '# Acme\n\nThe brand.\n',
  'tokens.json': JSON.stringify(TOKENS),
  'fonts/Inter.woff2': WOFF2,
  'components/bundle.js': BUNDLE,
  'components/bundle.css': '.acme-button{color:var(--ink)}',
  'components/index.d.ts': 'export declare const Button: () => null;',
  'components/Button/preview.html': PREVIEW,
  'components/Button/README.md': '# Button',
  'components/src/Button.tsx': 'export const Button = () => null;',
  'components/lib/react.production.min.js': '(function(){window.React={};})();',
  'components/lib/react-dom.production.min.js': '(function(){window.ReactDOM={};})();',
  'assets/Logos/mark.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'guide/voice.md': '# Voice',
  'manifest.json': '{"anything": "generated, not checked"}',
  'tokens.css': ':root{}',
  'api/tokens.md': '# generated',
};

/** 在基础系统上改：`files` 里 null 是删掉；`index` 的字段与基础索引合并，值为 undefined 时去掉这个字段。 */
async function check(files: Record<string, Content> = {}, index: Record<string, unknown> = {}): Promise<DesignSystemCheckResult> {
  const merged: Record<string, unknown> = { ...BASE_INDEX, ...index };
  for (const [key, value] of Object.entries(index)) if (value === undefined) delete merged[key];
  const all: Record<string, Content> = { 'design-system.json': JSON.stringify(merged), ...BASE_FILES, ...files };
  const kept = Object.fromEntries(Object.entries(all).filter((entry): entry is [string, Exclude<Content, null>] => entry[1] !== null));
  return checkDesignSystem(await materialize(kept));
}

function expectIssue(result: DesignSystemCheckResult, file: string, message: string | RegExp): void {
  const matches = result.issues.filter(i => i.file === file && (typeof message === 'string' ? i.message.includes(message) : message.test(i.message)));
  expect(matches, `${file}: ${String(message)}\n${JSON.stringify(result.issues, null, 1)}`).not.toHaveLength(0);
}

describe('checkDesignSystem：通过的', () => {
  it('完整的基础系统零问题、零说明；生成物列进 notChecked', async () => {
    const result = await check();
    expect(result.issues).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(result).toMatchObject({ title: 'Acme', namespace: 'Acme', notChecked: [...DESIGN_SYSTEM_NOT_CHECKED] });
  });

  it('刚建好的空系统（只有标记、title 与 namespace）零问题', async () => {
    const dir = await materialize({
      'design-system.json': JSON.stringify({ v: 3, layout: 'files', createdOnFiles: { v: 1, at: '2026-01-01T00:00:00.000Z' }, title: 'Acme', namespace: 'Acme' }),
    });
    const result = await checkDesignSystem(dir);
    expect(result.issues).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('design-system skill 自带的 demo（references/demo.json 的文件）零问题', async () => {
    const demoFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../skills/cuccut/built-in-skills/design-system/references/demo.json');
    const demo = JSON.parse(await readFile(demoFile, 'utf8')) as { content: { files: Record<string, string> } };
    const dir = await materialize({
      ...demo.content.files,
      'design-system.json': JSON.stringify({
        v: 3,
        layout: 'files',
        createdOnFiles: { v: 1, at: '2026-01-01T00:00:00.000Z' },
        title: 'Ember',
        namespace: 'Ember',
        libraries: [
          { name: 'react', version: '18.3.1', global: 'React', file: 'components/lib/react.production.min.js' },
          { name: 'react-dom', version: '18.3.1', global: 'ReactDOM', file: 'components/lib/react-dom.production.min.js' },
        ],
      }),
    });
    const result = await checkDesignSystem(dir);
    expect(result.issues).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('导出的系统：素材按 assets/<组>/<名字> 是文件，索引里的记录原样保留、没有 _blobs/：零问题，一条汇总说明', async () => {
    const result = await check(
      { 'assets/Icons/cup.svg': '<svg/>', 'assets/Icons/bag.svg': '<svg/>' },
      {
        groups: ['Logos', 'Icons'],
        assetGroups: {
          ...(BASE_INDEX.assetGroups as object),
          Icons: {
            name: 'Icons',
            order: ['cup.svg', 'bag.svg'],
            files: {
              'cup.svg': { name: 'cup.svg', blob: BLOB, size: 6, type: 'image/svg+xml' },
              'bag.svg': { name: 'bag.svg', blob: OTHER_BLOB, size: 6, type: 'image/svg+xml' },
            },
          },
        },
      },
    );
    expect(result.issues).toEqual([]);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatchObject({ file: 'design-system.json', message: expect.stringContaining('2 asset records point at a path that is a file') });
  });

  it('上传在 _blobs/ 里的记录还原成文件：字体也算在系统里', async () => {
    const result = await check(
      { 'fonts/Inter.woff2': null, [`${BLOBS_DIR}/${BLOB}.woff2`]: WOFF2, [`${BLOBS_DIR}/index.json`]: '{}' },
      { blobs: { 'fonts/Inter.woff2': { name: 'fonts/Inter.woff2', blob: BLOB, size: WOFF2.length, type: 'font/woff2' } } },
    );
    expect(result.issues).toEqual([]);
  });

  it('索引缺 libraries / groups / assetGroups / blobs / sections / docs 时按空读；分组缺 name 时从键解出；groups 的键可以不在 assetGroups 里', async () => {
    const result = await check(
      { 'assets/My Icons/cup.svg': '<svg/>' },
      {
        libraries: undefined,
        groups: ['Logos', 'Photos'],
        assetGroups: { [encodeIndexKey('My Icons')]: { order: ['cup.svg'] } },
        blobs: undefined,
        sections: undefined,
        docs: undefined,
      },
    );
    expect(result.issues).toEqual([]);
    expect(decodeIndexKey(encodeIndexKey('My Icons'))).toBe('My Icons');
  });

  it('tokens.json 里不是 token 族的键记成说明，不算问题', async () => {
    const result = await check({ 'tokens.json': JSON.stringify({ ...TOKENS, meta: { source: 'sync' } }) });
    expect(result.issues).toEqual([]);
    expect(result.notes).toEqual([{ file: 'tokens.json', message: expect.stringContaining('"meta" is not a token family') }]);
  });
});

/** 每一类问题至少一个用例：[说明, 文件改动, 索引改动, 报在哪个文件, 问题里的话]。 */
const CASES: [string, Record<string, Content>, Record<string, unknown>, string, string | RegExp][] = [
  // 索引
  ['没有索引', { 'design-system.json': null }, {}, 'design-system.json', 'missing'],
  ['索引不是 JSON', { 'design-system.json': '{ nope' }, {}, 'design-system.json', 'is not valid JSON'],
  ['索引不是 v3 files', {}, { v: 2 }, 'design-system.json', 'must be an object with "v": 3'],
  ['索引太长', {}, { padding: 'x'.repeat(2_000_001) }, 'design-system.json', 'the editor reads at most 2000000'],
  ['旧的单文件信封', {}, { content: { v: 2, files: {} } }, 'design-system.json', '"content" object'],
  ['没有迁移标记', {}, { createdOnFiles: undefined }, 'design-system.json', 'no createdOnFiles or convertedFrom marker'],
  ['title 不是字符串', {}, { title: 42 }, 'design-system.json', '"title" must be a string'],
  ['namespace 不合规则', {}, { namespace: 'my-ns' }, 'design-system.json', '"namespace" must be'],
  ['libraries 不是列表', {}, { libraries: {} }, 'design-system.json', '"libraries" must be a list'],
  ['library 形状不对', {}, { libraries: [{ name: 'react' }] }, 'design-system.json', 'each library is'],
  ['library 的 file 不在 lib/ 下', {}, { libraries: [{ name: 'x', version: '1', global: 'X', file: 'vendor/x.js' }] }, 'design-system.json', 'must be a path under components/lib/'],
  ['library 的 file 不在', {}, { libraries: [{ name: 'x', version: '1', global: 'X', file: 'components/lib/x.js' }] }, 'design-system.json', 'components/lib/x.js is not in the system'],
  ['library 的 global 不合规则', {}, { libraries: [{ name: 'react', version: '1', global: 'no-way', file: 'components/lib/react.production.min.js' }] }, 'design-system.json', '"global" must be'],
  ['react 以外的 library 没有 file', {}, { libraries: [{ name: 'lodash', version: '4' }] }, 'design-system.json', 'lodash has no "file"'],
  ['sections 形状不对', {}, { sections: { a: 1 } }, 'design-system.json', '"sections" must be'],
  ['groups 不是列表', {}, { groups: 'Logos' }, 'design-system.json', '"groups" must be'],
  ['assetGroups 不是对象', {}, { assetGroups: [] }, 'design-system.json', '"assetGroups" must be'],
  ['分组不是对象', {}, { assetGroups: { Logos: 'x' } }, 'design-system.json', 'assetGroups.Logos: each group is'],
  ['分组名不合规则', {}, { assetGroups: { Logos: { name: 'a/b' } } }, 'design-system.json', '"name" must be the group folder'],
  ['分组的 order 不对', {}, { assetGroups: { Logos: { name: 'Logos', order: [1] } } }, 'design-system.json', '"order" must be'],
  ['分组的 tile 不对', {}, { assetGroups: { Logos: { name: 'Logos', tile: 'huge' } } }, 'design-system.json', '"tile" is one of'],
  ['分组的 files 不是对象', {}, { assetGroups: { Logos: { name: 'Logos', files: [] } } }, 'design-system.json', '"files" must be an object'],
  ['blobs 不是对象', {}, { blobs: [] }, 'design-system.json', '"blobs" must be'],
  ['记录不是对象', {}, { blobs: { a: 'x' } }, 'design-system.json', 'blobs.a: each record is'],
  ['记录没有 name', {}, { blobs: { a: { blob: BLOB, size: 1, type: 'image/png' } } }, 'design-system.json', '"name" must be'],
  ['记录还原到的路径不合规则', {}, { blobs: { a: { name: 'index.html', blob: BLOB, size: 1, type: 'text/html' } } }, 'design-system.json', 'the editor skips the record'],
  ['记录的 size 不对', {}, { blobs: { a: { name: 'a.png', blob: BLOB, size: -1, type: 'image/png' } } }, 'design-system.json', '"size" must be'],
  ['记录的 type 不对', {}, { blobs: { a: { name: 'a.png', blob: BLOB, size: 1, type: 'png' } } }, 'design-system.json', '"type" must be'],
  ['记录的 blob 不是上传 id', {}, { blobs: { a: { name: 'a.png', blob: '/_blob/x', size: 1, type: 'image/png' } } }, 'design-system.json', '"blob" must be the upload'],
  ['docs 形状不对', {}, { docs: { sections: 'x' } }, 'design-system.json', '"docs" must be'],
  ['没有 namespace，bundle.js 也没有头行', { 'components/bundle.js': '(()=>{window.Acme={};})();' }, { namespace: undefined }, 'design-system.json', 'has no "namespace"'],
  // 目录树与路径
  ['工具配置文件', { 'package.json': '{}' }, {}, 'package.json', "The editor can't see it"],
  ['保留名', { 'index.html': 'x' }, {}, 'index.html', 'is reserved'],
  ['单个文件超过 15 MiB', { 'assets/Logos/huge.png': { sparse: DESIGN_SYSTEM_LIMITS.fileBytes + 1 } }, {}, 'assets/Logos/huge.png', 'a file can be at most'],
  ['README 超过 200 KB', { 'README.md': 'x'.repeat(200 * 1024 + 1) }, {}, 'README.md', 'README.md can be at most'],
  ['素材超过 12 MB', { 'assets/Logos/big.png': { sparse: 12 * 1024 * 1024 + 1 } }, {}, 'assets/Logos/big.png', 'an asset can be at most'],
  ['bundle.js 超过 6 MB', { 'components/bundle.js': BUNDLE + ' '.repeat(6 * 1024 * 1024) }, {}, 'components/bundle.js', 'bundle.js can be at most'],
  ['preview.html 超过 256 KB', { 'components/Button/preview.html': PREVIEW + ' '.repeat(256 * 1024) }, {}, 'components/Button/preview.html', 'a preview.html can be at most'],
  ['组件 README 超过 64 KB', { 'components/Button/README.md': 'x'.repeat(64 * 1024 + 1) }, {}, 'components/Button/README.md', "a component's README.md can be at most"],
  ['格式没有位置的文件超过 512 KB', { 'notes.txt': 'x'.repeat(512 * 1024 + 1) }, {}, 'notes.txt', 'a file the format has no place for'],
  ['.d.ts 合计超过 1.5 MB', { 'components/a.d.ts': 'x'.repeat(800 * 1024), 'components/b.d.ts': 'x'.repeat(800 * 1024) }, {}, 'components', 'the .d.ts files add up'],
  ['章节文档超过 24 个', Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`guide/s${i}.md`, '# s'])), {}, '.', 'section documents'],
  ['组件目录名不合规则', { 'components/my-button/preview.html': PREVIEW }, {}, 'components/my-button/preview.html', 'is not a component name'],
  ['素材组名不合规则', { 'assets/ Spaced/a.svg': '<svg/>' }, {}, 'assets/ Spaced/a.svg', 'is not a valid group name'],
  // 内容
  ['/_blob/ 引用写错', { 'README.md': '![x](/_blob/NOT-AN-ID)' }, {}, 'README.md', 'is not a valid upload reference'],
  ['/_blob/ 引用不在 _blobs/', { 'README.md': `![x](/_blob/${BLOB})` }, {}, 'README.md', `/_blob/${BLOB} is not in _blobs/`],
  ['preview 没有头行', { 'components/Button/preview.html': '<div></div>' }, {}, 'components/Button/preview.html', 'line 1 must be the marker'],
  ['preview 用 iframe', { 'components/Button/preview.html': `${PREVIEW}<iframe src="x"></iframe>` }, {}, 'components/Button/preview.html', 'uses <iframe>'],
  ['preview 从网上加载脚本', { 'components/Button/preview.html': `${PREVIEW}<script src="https://cdn.example.com/react.js"></script>` }, {}, 'components/Button/preview.html', 'loads the script https://cdn.example.com/react.js'],
  ['preview 链接 bundle.js', { 'components/Button/preview.html': `${PREVIEW}<script src="../bundle.js"></script>` }, {}, 'components/Button/preview.html', 'links ../bundle.js'],
  ['preview 的内联脚本连网', { 'components/Button/preview.html': `${PREVIEW}<script>import('https://esm.sh/x')</script>` }, {}, 'components/Button/preview.html', 'its script loads https://esm.sh/x'],
  ['preview 链接网上的样式', { 'components/Button/preview.html': `${PREVIEW}<link rel="stylesheet" href="https://cdn.example.com/x.css">` }, {}, 'components/Button/preview.html', 'links https://cdn.example.com/x.css'],
  ['preview 加载网上的图片', { 'components/Button/preview.html': `${PREVIEW}<img src="https://example.com/a.png">` }, {}, 'components/Button/preview.html', 'loads https://example.com/a.png'],
  ['preview 的样式连网', { 'components/Button/preview.html': `${PREVIEW}<style>@import url(https://cdn.example.com/x.css);</style>` }, {}, 'components/Button/preview.html', 'its style loads https://cdn.example.com/x.css'],
  ['bundle.js 用 import / export', { 'components/bundle.js': `${BUNDLE}export default 1;` }, {}, 'components/bundle.js', 'is not a classic script'],
  ['bundle.js 含 </script', { 'components/bundle.js': `${BUNDLE}var s='</script>';` }, {}, 'components/bundle.js', 'contains a literal </script'],
  ['bundle.js 含 <!--', { 'components/bundle.js': `${BUNDLE}var s='<!--';` }, {}, 'components/bundle.js', 'contains a literal <!--'],
  ['bundle.js 连网', { 'components/bundle.js': `${BUNDLE}fetch('/x');` }, {}, 'components/bundle.js', 'makes network requests'],
  ['bundle.js 头行写坏', { 'components/bundle.js': `/* @ds-bundle: {nope} */\n(()=>{window.Acme={};})();` }, {}, 'components/bundle.js', 'has an @ds-bundle header that is not'],
  ['bundle.js 头行的 namespace 与索引不同', { 'components/bundle.js': BUNDLE.replace('"namespace":"Acme"', '"namespace":"Other"') }, {}, 'components/bundle.js', 'names the namespace Other'],
  ['bundle.js 没赋值 window.<namespace>', { 'components/bundle.js': '(()=>{window.Other={};})();' }, {}, 'components/bundle.js', 'never assigns window.Acme'],
  ['bundle.css 含 </style', { 'components/bundle.css': 'a{content:"</style>"}' }, {}, 'components/bundle.css', 'contains a literal </style'],
  ['bundle.css 连网', { 'components/bundle.css': '@import url("https://cdn.example.com/x.css");' }, {}, 'components/bundle.css', 'loads https://cdn.example.com/x.css'],
  ['lib/ 的脚本含 </script', { 'components/lib/react.production.min.js': "window.React={};var s='</script>';" }, {}, 'components/lib/react.production.min.js', 'contains a literal </script'],
  ['lib/ 的脚本连网', { 'components/lib/react.production.min.js': "window.React={};import('https://cdn.example.com/x.js');" }, {}, 'components/lib/react.production.min.js', 'Copy what it loads'],
  // 字体
  ['fonts/ 里不是字体', { 'fonts/README.txt': 'x' }, {}, 'fonts/README.txt', 'fonts/ holds font files only'],
  ['字体文件头不对', { 'fonts/Inter.woff2': 'not a font' }, {}, 'fonts/Inter.woff2', 'is not a WOFF2 font'],
  ['字体没列进 type.fonts', { 'fonts/Extra.woff2': WOFF2 }, {}, 'fonts/Extra.woff2', 'is not listed in tokens.json type.fonts'],
  ['type.fonts 列的字体不在', { 'fonts/Inter.woff2': null }, {}, 'tokens.json', 'type.fonts names fonts/Inter.woff2'],
  // tokens.json
  ['tokens.json 丢掉的值', { 'tokens.json': JSON.stringify({ ...TOKENS, color: { tokens: [{ name: 'ink', value: 'red; x' }] } }) }, {}, 'tokens.json', 'color ink: no valid value'],
  ['tokens.json 是名字到值的映射', { 'tokens.json': JSON.stringify({ ...TOKENS, color: { ink: '#111111' } }) }, {}, 'tokens.json', 'name-to-value map'],
];

describe('checkDesignSystem：每一类问题', () => {
  it.each(CASES)('%s', async (_name, files, index, file, message) => {
    expectIssue(await check(files, index), file, message);
  });

  it('符号链接', async () => {
    const dir = await materialize({ 'design-system.json': JSON.stringify(BASE_INDEX), ...BASE_FILES });
    await symlink(path.join(dir, 'README.md'), path.join(dir, 'Link.md'));
    expectIssue(await checkDesignSystem(dir), 'Link.md', 'is a symbolic link');
  });

  it('记录指向的上传不在 _blobs/、路径上也没有文件：带 ASSET_RECORD_MISSING_UPLOAD', async () => {
    const result = await check(
      {},
      { assetGroups: { Logos: { name: 'Logos', files: { 'gone.svg': { name: 'gone.svg', blob: BLOB, size: 6, type: 'image/svg+xml' } } } } },
    );
    const missing = result.issues.filter(i => i.code === 'ASSET_RECORD_MISSING_UPLOAD');
    expect(missing).toEqual([{ file: 'design-system.json', code: 'ASSET_RECORD_MISSING_UPLOAD', message: expect.stringContaining('assets/Logos/gone.svg') }]);
    expect(DESIGN_SYSTEM_ISSUE_CODES).toContain('ASSET_RECORD_MISSING_UPLOAD');
    // 其余问题不带代码
    const other = await check({ 'package.json': '{}' });
    expect(other.issues.every(i => i.code === undefined)).toBe(true);
  });

  it('自有文件超过 1,008 个', async () => {
    const files = Object.fromEntries(Array.from({ length: DESIGN_SYSTEM_LIMITS.ownFiles }, (_, i) => [`parts/p${String(i).padStart(4, '0')}.css`, 'a{}']));
    expectIssue(await check(files), '.', `a design system holds at most ${DESIGN_SYSTEM_LIMITS.ownFiles}`);
  });

  it('合计超过 256 MiB（_blobs/ 不算）', async () => {
    const files = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`assets/Big/p${i}.png`, { sparse: 15 * 1024 * 1024 }]));
    const result = await check({ ...files, [`${BLOBS_DIR}/${BLOB}.png`]: { sparse: 20 * 1024 * 1024 } });
    expectIssue(result, '.', 'add up to');
  });
});
