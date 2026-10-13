import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import { allToolSets } from '../agent-tools/all-tool-sets.ts';
import { ToolCatalog } from '../agent-tools/tool-catalog.ts';
import {
  AgentSkillRenderError,
  agentPageId,
  countHardRules,
  craftIdsOf,
  readAgentSkillDir,
  renderAgentGuidance,
  renderAgentSkill,
  renderAgentSkillText,
  renderSessionOnlyTools,
  resolveBuiltinAgentSkillsDir,
  SESSION_ONLY_TOOLS,
  type AgentSkillFiles,
} from './agent-skill-renderer.ts';
import { findRepoDir, resolveBuiltinSkillsDir } from './skill-catalog.ts';
import { parseSkillFrontmatter } from './skill-frontmatter.ts';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'testing', 'agent-skill-fixture', 'skills', 'cuccut');
const cliCatalog = new ToolCatalog(allToolSets(), silentLogger, { surface: 'cli' });
const agentCatalog = new ToolCatalog(allToolSets(), silentLogger, { surface: 'agent' });
const CLI = { tools: cliCatalog.list() };
const AGENT = { tools: agentCatalog.list() };
/** 复合工具名（`a_b`）：终端目录里的与只在会话里有的（`downloads_save` 这类），CLI 面渲染后都不该再出现。 */
const CLI_COMPOUND = [...new Set([...CLI.tools, ...AGENT.tools].map((tool) => tool.name))].filter((name) => name.includes('_'));

/**
 * 只属于工具桥面（会话内智能体）的说法：审批与停止的错误码、编辑器上下文、工具桥本身、访问模式。CLI 面里出现就是漏标了 surface。
 * `skills_read` 的「现取」在 CLI 面渲染成 `cuccut skills read`，所以 `skills_read` 本身也不该出现。不分大小写比较。
 */
const BRIDGE_ONLY_TERMS = ['APPROVAL_DENIED', 'APPROVAL_CANCELLED', 'TASK_STOPPED', '<cuccut-editor-context>', 'tool bridge', 'access mode'];

/**
 * §8.6 的第一条：CLI 面里不出现 `a_b` 形式的工具名，也不出现 `skills_read` 的「现取」说法以外的工具桥用语。mcp.md 整页与
 * tool-map 块豁免（那里本来就是 MCP 工具名的对照表）。
 */
function bridgeNamesInCliFace(files: AgentSkillFiles): string[] {
  const hits: string[] = [];
  for (const [file, text] of files) {
    if (file === 'references/mcp.md') continue;
    const body = text.replace(/<!-- generated: tool-map -->[\s\S]*?<!-- \/generated -->/g, '');
    for (const name of [...CLI_COMPOUND, 'skills_read']) {
      if (new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(body)) hits.push(`${file}: ${name}`);
    }
    for (const term of BRIDGE_ONLY_TERMS) if (body.toLowerCase().includes(term.toLowerCase())) hits.push(`${file}: ${term}`);
  }
  return hits;
}

/** §8.6 的第二条：工具桥面里不出现 `cuccut <命令>`、`--yes` 与别的旗标、退出码。 */
function cliTracesInAgentFace(files: AgentSkillFiles): string[] {
  const hits: string[] = [];
  for (const [file, text] of files) {
    text.split('\n').forEach((line, index) => {
      if (/(?<![.\w])cuccut [a-z]/.test(line) || /(?<![\w-])--[a-z]/.test(line) || /\bexit codes?\b/i.test(line)) {
        hits.push(`${file}:${index + 1}: ${line}`);
      }
    });
  }
  return hits;
}

describe('说明书的渲染器', () => {
  const source = readAgentSkillDir(FIXTURE);

  it('CLI 面：工具名换成命令、参数换成旗标、craft 换成相对链接，没有工具桥的写法', () => {
    const cli = renderAgentSkill(source, { face: 'cli', catalog: CLI });
    const skill = cli.get('SKILL.md')!;
    expect(skill).toContain('first `cuccut documents read`, then write the translation back with `cuccut documents put`');
    expect(skill).toContain('then submit with the new `--revision` (the field is written `--expected-revision`)');
    expect(skill).toContain('For how to polish, see [demo-polish](references/craft/demo-polish.md).');
    // 代码块里不套反引号。
    expect(skill).toContain('```text\ncuccut edits apply --expected-revision 12\n```');
    // 另一面的段落连同标记行删掉；页面链接原样。
    expect(skill).toContain('Details in [start](references/start.md); for MCP see [mcp](references/mcp.md).');
    expect(skill).not.toContain('The tools are already connected');
    expect(skill).not.toMatch(/<!-- \/?surface/);
    // 从 references/ 下的页面引用 craft 时按该页计算相对路径。
    expect(cli.get('references/catalog/editing.md')).toContain('For how to cut a talking head, see [demo-polish](../craft/demo-polish.md).');
    expect(cli.get('references/workflows.md')).toContain('Polish it following [demo-polish](craft/demo-polish.md)');
    expect(cli.get('references/workflows.md')).toContain('write the translation with `--source-document`');
    // 生成块的标记行保留，里面的占位符照样渲染。
    expect(cli.get('references/conventions.md')).toContain('<!-- generated: error-codes -->');
    expect(cli.get('references/conventions.md')).toContain('| Error code | Exit code | Next step |');
    expect(cli.get('references/conventions.md')).not.toContain('{{');
    expect(cli.has('references/craft/demo-polish.md')).toBe(true);
    expect(bridgeNamesInCliFace(cli)).toEqual([]);
  });

  it('读说明书目录时跳过同目录下的 built-in-skills/：内置 skill 本身不是说明书的页，也不随 CLI 面装进宿主', () => {
    expect(fs.existsSync(path.join(FIXTURE, 'built-in-skills', 'demo-polish', 'SKILL.md'))).toBe(true);
    expect([...source.keys()].filter((file) => file.startsWith('built-in-skills/'))).toEqual([]);
  });

  it('工具桥面：工具名与字段名原样，craft 与页面链接换成 skills_read，没有 CLI 的痕迹', () => {
    const agent = renderAgentSkill(source, { face: 'agent', catalog: AGENT });
    const skill = agent.get('SKILL.md')!;
    expect(skill).toContain('first `documents_read`, then write the translation back with `documents_put`');
    expect(skill).toContain('then submit with the new `revision` (the field is written `expectedRevision`)');
    expect(skill).toContain('For how to polish, see `demo-polish` (read it with `skills_read`).');
    expect(skill).toContain('```text\nedits_apply expectedRevision 12\n```');
    expect(skill).toContain('The tools are already connected: read one catalog page for the task.');
    expect(skill).toContain('| editing (read `cuccut-catalog-editing` with `skills_read`) | Changes on the timeline |');
    // 锚点去掉；工具桥面没有的页（start.md）退成纯文字。
    expect(skill).toContain(
      'End-to-end recipes are in workflows (read `cuccut-workflows` with `skills_read`), how to handle errors is in conventions ' +
        '(read `cuccut-conventions` with `skills_read`), and start-up details are in start.',
    );
    expect(agent.get('references/catalog/media.md')).toContain('to cut, go to editing (read `cuccut-catalog-editing` with `skills_read`)');
    expect(agent.get('references/conventions.md')).toContain('| Error code | Next step |');
    // craft 副本是给外部 Agent 的，工具桥面不输出。
    expect([...agent.keys()].some((file) => file.startsWith('references/craft/'))).toBe(false);
    expect(cliTracesInAgentFace(agent)).toEqual([]);
  });

  it('两个面的硬规则条数相同', () => {
    const cli = renderAgentSkill(source, { face: 'cli' }).get('SKILL.md')!;
    const agent = renderAgentSkill(source, { face: 'agent' }).get('SKILL.md')!;
    expect(countHardRules(cli)).toBe(5);
    expect(countHardRules(agent)).toBe(5);
    expect(countHardRules('# Unrelated\n- one')).toBe(0);
    expect(countHardRules('## 5. Hard rules\n\n1. A\n2. B\n   - sub-items do not count\n\n## 6. Delivery\n- not counted')).toBe(2);
  });

  it('craft 的 id 只认小写连字符名，README.md 不算', () => {
    expect([...craftIdsOf(source)!].sort()).toEqual(['demo-chapters', 'demo-polish']);
    expect(craftIdsOf(['references/craft/README.md'])).toBeNull();
    expect(agentPageId('references/catalog/media.md')).toBe('cuccut-catalog-media');
    expect(agentPageId('references/craft/demo-polish.md')).toBe('demo-polish');
    expect(agentPageId('references/craft/README.md')).toBeNull();
    expect(agentPageId('references/mcp.md')).toBeNull();
  });

  it('工具桥面的指导与内置页面', () => {
    const { guidance, pages } = renderAgentGuidance(source, AGENT);
    expect(guidance.startsWith('# CucCut')).toBe(true);
    expect(guidance).not.toContain('description:');
    expect(pages.map((page) => page.id)).toEqual([
      'cuccut-catalog-editing',
      'cuccut-catalog-media',
      'cuccut-workflows',
      'cuccut-conventions',
    ]);
    const editing = pages.find((page) => page.id === 'cuccut-catalog-editing')!;
    expect(editing.name).toBe('Editing');
    expect(editing.description).toBe('Operation families of edits apply, talking-head cuts, chapters, undo and reading receipts.');
    expect(editing.body).not.toContain('<!--');
    const media = pages.find((page) => page.id === 'cuccut-catalog-media')!;
    expect(media.name).toBe('Media');
    expect(media.description).toBe('Import one file with `assets_import`; grab frames with `videos_frames`.');
  });
});

describe('只给 CLI 面的目录页', () => {
  const source = readAgentSkillDir(FIXTURE);
  const cliOnly = [
    '---',
    'description: 只给终端里的 Agent 的一页。',
    '---',
    '',
    '<!-- surface: cli -->',
    '# 网页',
    '',
    '终端里的 Agent 用 {{tool:videos_list}} 找到视频，再开网页。',
    '<!-- /surface -->',
    '',
  ].join('\n');
  const withPage = (extra: Record<string, string>): AgentSkillFiles => new Map([...source, ...Object.entries(extra)]);

  it('工具桥面正文为空（只剩 front matter 与标题）的页不登记成说明书页；CLI 面照常有这一页', () => {
    const files = withPage({ 'references/catalog/web.md': cliOnly });
    const { pages } = renderAgentGuidance(files, AGENT);
    expect(pages.map((page) => page.id)).not.toContain('cuccut-catalog-web');
    expect(pages.map((page) => page.id)).toContain('cuccut-catalog-media');
    // 标题在 cli 块外面也一样：只有标题不算正文。
    const titled = cliOnly.replace('<!-- surface: cli -->\n# 网页', '# 网页\n\n<!-- surface: cli -->');
    expect(renderAgentGuidance(withPage({ 'references/catalog/web.md': titled }), AGENT).pages.map((p) => p.id)).not.toContain(
      'cuccut-catalog-web',
    );
    const cli = renderAgentSkill(files, { face: 'cli', catalog: CLI }).get('references/catalog/web.md')!;
    expect(cli).toContain('# 网页');
    expect(cli).toContain('`cuccut videos list`');
  });

  it('两面都有的正文链到这一页时报错：链接要放进 cli 面', () => {
    const linked = (where: string) =>
      withPage({
        'references/catalog/web.md': cliOnly,
        'references/catalog/media.md': `${source.get('references/catalog/media.md')!}\n${where}\n`,
      });
    expect(() => renderAgentGuidance(linked('要在编辑器里看就读 [web](web.md)。'), AGENT)).toThrow(/cuccut-catalog-web/);
    expect(
      renderAgentGuidance(linked('<!-- surface: cli -->\n要在编辑器里看就读 [web](web.md)。\n<!-- /surface -->'), AGENT).pages,
    ).toHaveLength(renderAgentGuidance(source, AGENT).pages.length);
  });
});

describe('工具桥面的 craft 引用读起来通顺', () => {
  const agent = (text: string) => renderAgentSkillText(text, { face: 'agent', file: 'references/workflows.md' });
  const cli = (text: string) => renderAgentSkillText(text, { face: 'cli', file: 'references/workflows.md' });

  it('跟在 see、follow、表格与列举后面：名字在前，怎么读放括号里', () => {
    expect(agent('For polishing, see {{skill:polish-transcript}}.')).toBe('For polishing, see `polish-transcript` (read it with `skills_read`).');
    expect(agent('The method is in {{skill:talking-head-cut}} here.')).toBe(
      'The method is in `talking-head-cut` (read it with `skills_read`) here.',
    );
    expect(agent('2. Polish following {{skill:polish-transcript}}, then write back.')).toBe(
      '2. Polish following `polish-transcript` (read it with `skills_read`), then write back.',
    );
    expect(agent('| Summarize | {{skill:video-summary}} |')).toBe('| Summarize | `video-summary` (read it with `skills_read`) |');
    expect(agent('Crafts: {{skill:video-blog}}, {{skill:video-summary}}.')).toBe(
      'Crafts: `video-blog` (read it with `skills_read`), `video-summary` (read it with `skills_read`).',
    );
  });

  it('前面紧挨着 read 时不说两遍 read；spread、thread 这类不算', () => {
    expect(agent('1. Read {{skill:talking-head-cut}}.')).toBe('1. Use `skills_read` to read `talking-head-cut`.');
    expect(agent('Before starting, read {{skill:shorts-segments}}.')).toBe('Before starting, use `skills_read` to read `shorts-segments`.');
    expect(agent('Thread {{skill:video-blog}} in.')).toBe('Thread `video-blog` (read it with `skills_read`) in.');
    // 别的占位符前面的 read 原样留下；CLI 面的 read 也留着。
    expect(agent('Read {{tool:documents_read}} results')).toBe('Read `documents_read` results');
    expect(cli('1. Read {{skill:talking-head-cut}}.')).toBe('1. Read [talking-head-cut](craft/talking-head-cut.md).');
    expect(cli('Read {{tool:documents_read}} results')).toBe('Read `cuccut documents read` results');
  });
});

describe('只在会话里有的工具在 CLI 面的兜底写法', () => {
  const cli = (text: string) => renderAgentSkillText(text, { face: 'cli', file: 'references/craft/x.md', catalog: CLI });
  const agent = (text: string) => renderAgentSkillText(text, { face: 'agent', file: 'references/craft/x.md', catalog: AGENT });
  const PATH_TOLD = SESSION_ONLY_TOOLS.downloads_save!.replacement;

  it('downloads_save 在终端里没有命令：常见的整句换成「把路径告诉用户」，其余地方换成兜底说法，都不提工具名', () => {
    // craft 里的原句（skills/translate-subtitles 等）。
    expect(
      cli('Write it as a new file in the working directory, then put it in the downloads directory with downloads_save and tell the user the path it returns.'),
    ).toBe(`Write it as a new file in the working directory, then ${PATH_TOLD}.`);
    expect(PATH_TOLD).toBe("tell the user the file's path (the terminal has no downloads directory step: the file is where you wrote it)");
    expect(cli('At delivery, put the notes in the downloads directory with `downloads_save`.')).toBe(`At delivery, ${PATH_TOLD}.`);
    // 说明书里写成占位符也一样（不按终端的目录核对、不报「目录里没有」）。
    expect(cli('Finally {{tool:downloads_save}}.')).toBe("Finally hand the file to the user (in the terminal, tell the user the file's path).");
    expect(renderSessionOnlyTools('see downloads_saved and my_downloads_save')).toBe('see downloads_saved and my_downloads_save');
    // 代码块里不动。
    expect(cli('```text\ndownloads_save\n```')).toBe('```text\ndownloads_save\n```');
    // 工具桥面原样。
    expect(agent('Then put it in the downloads directory with {{tool:downloads_save}}.')).toBe(
      'Then put it in the downloads directory with `downloads_save`.',
    );
  });

  it('slides_check 与 slides_import_asset：craft 里的那一步从 Call / import 起整行换掉，其余地方换成兜底说法', () => {
    const fallback = SESSION_ONLY_TOOLS.slides_import_asset!;
    // skills/slides 的第 6 步与第 4 步。
    expect(
      cli('6. **Validate**. Call `slides_check` on the whole deck (parameter `path` is the deck directory), fix each problem it lists.'),
    ).toBe(`6. **Validate**. ${SESSION_ONLY_TOOLS.slides_check!.replacement}`);
    expect(SESSION_ONLY_TOOLS.slides_check!.replacement).toMatch(/^There is no check command in the terminal: /);
    expect(
      cli('   - Images the user gave: import each one into the deck with `slides_import_asset` (parameter `deck` is the deck directory) and write the returned `src`.'),
    ).toBe(`   - Images the user gave: ${fallback.replacement}`);
    expect(cli('Finally run {{tool:slides_check}} once more.')).toBe('Finally run the slides check (only in CucCut sessions) once more.');
    expect(cli('- Import font files (woff2, woff) one by one with `slides_import_asset` and set `src` to the returned `/_blob/<id>`.')).toBe(
      `- ${fallback.morePhrases![0]!.replacement.replace('$1', '(woff2, woff)')}`,
    );
    expect(cli('Images come in through slides_import_asset.')).toBe(
      'Images come in through importing images and fonts (only in CucCut sessions).',
    );
    // 工具桥面原样。
    expect(agent('Call {{tool:slides_check}} to validate.')).toBe('Call `slides_check` to validate.');
  });

  it('design_check 与 design_import_asset：skills/design 的校验句与导入句整句换掉，其余地方换成兜底说法', () => {
    // skills/design「New」的第 6 步与第 3 步。
    expect(
      cli(
        '6. The rest. Then run design_check on the design, fix every problem it lists, and run it again until it lists none: only then does the design card appear in the thread. Then say one line.',
      ),
    ).toBe(`6. The rest. ${SESSION_ONLY_TOOLS.design_check!.replacement} Then say one line.`);
    expect(
      cli(
        '3. Each font **file**: import it with design_import_asset (see below; write `canvas.json` first) → write the `src` it returns **verbatim** into `<img src>` or `@font-face`. .css files as before.',
      ),
    ).toBe(`3. Each font **file**: ${SESSION_ONLY_TOOLS.design_import_asset!.replacement} .css files as before.`);
    expect(cli('4. Then design_check until it lists no problems.')).toBe(
      '4. Then the design check (only in CucCut sessions) until it lists no problems.',
    );
    expect(cli('Importing (design_import_asset) is only for fonts')).toBe('Importing (importing assets (only in CucCut sessions)) is only for fonts');
    // 工具桥面原样。
    expect(agent('Then {{tool:design_check}}.')).toBe('Then `design_check`.');
  });

  it('design_system_check 与 design_system_import_asset：skills/design-system 的校验句与两条调用说明整句换掉', () => {
    const check = SESSION_ONLY_TOOLS.design_system_check!.replacement;
    expect(
      cli(
        '3. Write the index **last**. Then run design_system_check on the design system, fix every problem it lists, and run it again until it lists none: only then does the design system card appear in the thread.',
      ),
    ).toBe(`3. Write the index **last**. ${check}`);
    expect(
      cli(
        "- design_system_check (`path` = the design system's directory) → problems listed by file, plus hints that need no change; when there are no problems: the design system card appears in the thread.",
      ),
    ).toBe(`- ${check}`);
    expect(
      cli(
        "- design_system_import_asset (`system` = the design system's directory, `path` = the file in the working directory, `group` = the asset group it belongs to) → `src` (`/_blob/<id>`), plus the `record` to write into the index at `indexPath`. Uploading works for a directory that has no index yet: the index is still written last.",
      ),
    ).toBe(`- ${SESSION_ONLY_TOOLS.design_system_import_asset!.replacement}`);
    expect(cli('Images are uploaded via design_system_import_asset.')).toBe(
      'Images are uploaded via uploading assets (only in CucCut sessions).',
    );
    expect(agent('Then {{tool:design_system_check}}.')).toBe('Then `design_system_check`.');
  });
});

describe('说明书的标记法报错', () => {
  const render = (text: string, face: 'cli' | 'agent' = 'cli') => renderAgentSkillText(text, { face, file: 'references/x.md' });
  const errorOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(AgentSkillRenderError);
      return (error as Error).message;
    }
    throw new Error('应当抛错');
  };

  it('未知占位符、未闭合的占位符带文件与行号', () => {
    expect(errorOf(() => render('一\n二 {{tool:Bad Name}}'))).toBe('references/x.md:2：工具名不合规：{{tool:Bad Name}}');
    expect(errorOf(() => render('{{thing:x}}'))).toContain('references/x.md:1：不认识的占位符 {{thing:x}}');
    expect(errorOf(() => render('甲\n乙\n{{tool:documents_read'))).toBe('references/x.md:3：占位符没有闭合（有 {{ 没有对应的 }}）');
    // 代码里不带 kind: 的是模板洞（skills/design 讲 Design Component 的写法），原样保留；正文里的、带了不认识 kind: 的照样报错。
    expect(render('洞写成 `{{ item.x }}`，属性 `x="{{hole}}"`；{{tool:documents_read}}')).toBe(
      '洞写成 `{{ item.x }}`，属性 `x="{{hole}}"`；`cuccut documents read`',
    );
    expect(render('```html\n<h1>{{title}}</h1>\n<p>{{ }}</p>\n```')).toBe('```html\n<h1>{{title}}</h1>\n<p>{{ }}</p>\n```');
    expect(errorOf(() => render('标题 {{title}}'))).toContain('references/x.md:1：不认识的占位符 {{title}}');
    expect(errorOf(() => render('`{{thing:x}}`'))).toContain('不认识的占位符 {{thing:x}}');
    expect(errorOf(() => render('`{{hole}}` 与 `{{hole`'))).toContain('占位符没有闭合');
    expect(errorOf(() => renderAgentSkillText('{{tool:nope_nope}}', { face: 'cli', file: 'a.md', catalog: CLI }))).toContain(
      'a.md:1：{{tool:nope_nope}}：CLI 面的目录里没有这个工具',
    );
    expect(errorOf(() => renderAgentSkillText('{{skill:none}}', { face: 'cli', file: 'a.md', craftIds: new Set(['x']) }))).toContain(
      'a.md:1',
    );
  });

  it('surface 与生成块：未闭合、嵌套、交叉、多余的闭合、不认识的名字', () => {
    expect(errorOf(() => render('a\n<!-- surface: cli -->\nb'))).toBe('references/x.md:2：surface 标记没有闭合');
    expect(errorOf(() => render('<!-- surface: cli -->\n<!-- surface: agent -->'))).toContain('references/x.md:2：surface 标记不能嵌套');
    expect(errorOf(() => render('<!-- surface: web -->'))).toContain('不认识的面「web」');
    expect(errorOf(() => render('<!-- /surface -->'))).toContain('references/x.md:1：多出来的');
    expect(errorOf(() => render('<!-- generated: common-ops -->\n'))).toBe('references/x.md:1：生成块没有闭合');
    expect(errorOf(() => render('<!-- generated: misc -->\n<!-- /generated -->'))).toContain('不认识的生成块「misc」');
    expect(errorOf(() => render('<!-- surface: cli -->\n<!-- generated: tool-map -->\n<!-- /surface -->\n<!-- /generated -->'))).toContain(
      'references/x.md:3',
    );
  });

  it('链接到说明书里没有的页时报错；行内代码里的链接与占位符不动', () => {
    const files = new Set(['SKILL.md', 'references/x.md']);
    expect(errorOf(() => renderAgentSkillText('见 [y](y.md)', { face: 'cli', file: 'references/x.md', files }))).toContain(
      'references/x.md:1：链接 [y](y.md) 指向的 references/y.md 不在说明书里',
    );
    expect(renderAgentSkillText('写 `[a](b.md)` 与 `{{tool:documents_read}}`', { face: 'agent', file: 'SKILL.md', files })).toBe(
      '写 `[a](b.md)` 与 `documents_read`',
    );
  });
});

describe('说明书的位置', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('环境变量优先，其次是打包资源，最后是仓库根', () => {
    expect(resolveBuiltinAgentSkillsDir({ CUCCUT_AGENT_SKILLS_DIR: '/x/skills' })).toBe('/x/skills');
    const resources = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-agent-skills-'));
    dirs.push(resources);
    fs.mkdirSync(path.join(resources, 'skills'));
    expect(resolveBuiltinAgentSkillsDir({}, [resources])).toBe(path.join(resources, 'skills'));
    expect(resolveBuiltinAgentSkillsDir({}, [path.join(resources, 'missing')])).toBe(findRepoDir('skills'));
  });
});

describe('仓库里的说明书', () => {
  const dir = path.join(findRepoDir('skills')!, 'cuccut');

  // §8.6 的三条测试，对仓库里真实的说明书与真实的工具目录（Runtime 的工具组，按面取视图）。
  const source = readAgentSkillDir(dir);
  const cli = renderAgentSkill(source, { face: 'cli', catalog: CLI });
  const agent = renderAgentSkill(source, { face: 'agent', catalog: AGENT });
  const guidance = renderAgentGuidance(source, AGENT);

  it('CLI 面的渲染里没有 a_b 工具名与工具桥用语', () => {
    expect(bridgeNamesInCliFace(cli)).toEqual([]);
  });

  it('内置 skill 的 front matter 与说明书的路由表不写 a_b 工具名（它们原样进索引与引言，不经工具名改写）', () => {
    const bare = (text: string) =>
      CLI_COMPOUND.filter((name) => new RegExp(`(?<![A-Za-z0-9_{:])${name}(?![A-Za-z0-9_])`).test(text.replace(/\{\{[^}]*\}\}/g, '')));
    const skillsDir = resolveBuiltinSkillsDir({})!;
    const hits: string[] = [];
    for (const id of fs.readdirSync(skillsDir)) {
      const file = path.join(skillsDir, id, 'SKILL.md');
      if (!fs.existsSync(file)) continue;
      const parsed = parseSkillFrontmatter(fs.readFileSync(file, 'utf8'));
      expect(parsed.ok, id).toBe(true);
      if (!parsed.ok) continue;
      for (const [key, value] of parsed.fields) for (const name of bare(value)) hits.push(`${id} ${key}: ${name}`);
    }
    const skill = source.get('SKILL.md')!;
    const table = skill.slice(skill.indexOf('| What the user says |'), skill.indexOf('### The three baselines'));
    expect(table.length).toBeGreaterThan(0);
    for (const name of bare(table)) hits.push(`SKILL.md 路由表: ${name}`);
    expect(hits).toEqual([]);
  });

  it('工具桥面的渲染里没有 cuccut 命令、--yes 与退出码（含会话指导与内置页面）', () => {
    expect(cliTracesInAgentFace(agent)).toEqual([]);
    const rendered: AgentSkillFiles = new Map([
      ['guidance', guidance.guidance],
      ...guidance.pages.map((page) => [page.id, page.body] as const),
    ]);
    expect(cliTracesInAgentFace(rendered)).toEqual([]);
  });

  it('两面渲染出的硬规则条数相同', () => {
    expect(countHardRules(cli.get('SKILL.md')!)).toBe(12);
    expect(countHardRules(agent.get('SKILL.md')!)).toBe(12);
    expect(countHardRules(guidance.guidance)).toBe(12);
  });

  it('工具桥面：目录页、做法总览与约定成为内置页面，名字与说明取 front matter 或标题', () => {
    expect(guidance.pages.map((page) => page.id)).toEqual([
      'cuccut-catalog-editing',
      'cuccut-catalog-export',
      'cuccut-catalog-media',
      'cuccut-catalog-models',
      'cuccut-catalog-music',
      'cuccut-catalog-subtitles',
      'cuccut-catalog-system',
      'cuccut-catalog-voice-gemini-tts',
      'cuccut-catalog-voice-language-rates',
      'cuccut-catalog-voice',
      'cuccut-workflows',
      'cuccut-conventions',
    ]);
    for (const page of guidance.pages) {
      expect(page.name, page.id).not.toBe(page.id);
      expect(page.description, page.id).toMatch(/^[^-#|<]/);
      expect([...page.description].length, page.id).toBeLessThanOrEqual(300);
      expect(page.body, page.id).not.toMatch(/<!--|\{\{|^---/);
    }
    // 指导里引用的页面 id 都在。
    const ids = new Set(guidance.pages.map((page) => page.id));
    for (const match of guidance.guidance.matchAll(/`(cuccut-[a-z-]+)`/g)) expect(ids.has(match[1]!), match[1]).toBe(true);
  });
});
