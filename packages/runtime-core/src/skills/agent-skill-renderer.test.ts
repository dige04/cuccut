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
/** Compound tool names (`a_b`): those in the terminal directory, and those that exist only in the session (such as `downloads_save`), should no longer appear after CLI-side rendering. */
const CLI_COMPOUND = [...new Set([...CLI.tools, ...AGENT.tools].map((tool) => tool.name))].filter((name) => name.includes('_'));

/**
 * Wording that belongs only to the tool-bridge surface (the in-session agent): the approval and stop error codes, editor context, the tool bridge itself, and access modes. Its appearance on the CLI surface means `surface` was missed.
 * `skills_read`'s “on-demand fetch” is rendered as `cuccut skills read` on the CLI surface, so `skills_read` itself should not appear either. Comparison is case-insensitive.
 */
const BRIDGE_ONLY_TERMS = ['APPROVAL_DENIED', 'APPROVAL_CANCELLED', 'TASK_STOPPED', '<cuccut-editor-context>', 'tool bridge', 'access mode'];

/**
 * Point 1 of §8.6: the CLI surface does not show tool names in the `a_b` form, and does not show tool-bridge wording other than the “on-demand fetch” wording of `skills_read`. The whole mcp.md page and the tool-map block are exempt, since they are by nature a comparison table of MCP tool names.
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

/** Point 2 of §8.6: the tool-bridge surface does not show `cuccut <command>`, `--yes` or other flags, or exit codes. */
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

describe('manual renderer', () => {
  const source = readAgentSkillDir(FIXTURE);

  it('CLI surface: tool names become commands, parameters become flags, craft becomes relative links, with no tool-bridge wording', () => {
    const cli = renderAgentSkill(source, { face: 'cli', catalog: CLI });
    const skill = cli.get('SKILL.md')!;
    expect(skill).toContain('first `cuccut documents read`, then write the translation back with `cuccut documents put`');
    expect(skill).toContain('then submit with the new `--revision` (the field is written `--expected-revision`)');
    expect(skill).toContain('For how to polish, see [demo-polish](references/craft/demo-polish.md).');
    // No extra backticks are added inside code blocks.
    expect(skill).toContain('```text\ncuccut edits apply --expected-revision 12\n```');
    // The paragraph meant for the other surface, together with its marker line, is removed. Page links are kept as-is.
    expect(skill).toContain('Details in [start](references/start.md); for MCP see [mcp](references/mcp.md).');
    expect(skill).not.toContain('The tools are already connected');
    expect(skill).not.toMatch(/<!-- \/?surface/);
    // When citing craft from a page under references/, the relative path is computed from that page.
    expect(cli.get('references/catalog/editing.md')).toContain('For how to cut a talking head, see [demo-polish](../craft/demo-polish.md).');
    expect(cli.get('references/workflows.md')).toContain('Polish it following [demo-polish](craft/demo-polish.md)');
    expect(cli.get('references/workflows.md')).toContain('write the translation with `--source-document`');
    // Marker lines of generated blocks are kept. Placeholders inside them are still rendered.
    expect(cli.get('references/conventions.md')).toContain('<!-- generated: error-codes -->');
    expect(cli.get('references/conventions.md')).toContain('| Error code | Exit code | Next step |');
    expect(cli.get('references/conventions.md')).not.toContain('{{');
    expect(cli.has('references/craft/demo-polish.md')).toBe(true);
    expect(bridgeNamesInCliFace(cli)).toEqual([]);
  });

  it('reading the manual directory skips built-in-skills/ beside it: built-in skills are not manual pages and are not installed into the host with the CLI surface', () => {
    expect(fs.existsSync(path.join(FIXTURE, 'built-in-skills', 'demo-polish', 'SKILL.md'))).toBe(true);
    expect([...source.keys()].filter((file) => file.startsWith('built-in-skills/'))).toEqual([]);
  });

  it('tool-bridge surface: tool and field names kept as is, craft and page links become skills_read, with no CLI traces', () => {
    const agent = renderAgentSkill(source, { face: 'agent', catalog: AGENT });
    const skill = agent.get('SKILL.md')!;
    expect(skill).toContain('first `documents_read`, then write the translation back with `documents_put`');
    expect(skill).toContain('then submit with the new `revision` (the field is written `expectedRevision`)');
    expect(skill).toContain('For how to polish, see `demo-polish` (read it with `skills_read`).');
    expect(skill).toContain('```text\nedits_apply expectedRevision 12\n```');
    expect(skill).toContain('The tools are already connected: read one catalog page for the task.');
    expect(skill).toContain('| editing (read `cuccut-catalog-editing` with `skills_read`) | Changes on the timeline |');
    // Anchors are removed. Pages that the tool-bridge surface does not have (start.md) degrade to plain text.
    expect(skill).toContain(
      'End-to-end recipes are in workflows (read `cuccut-workflows` with `skills_read`), how to handle errors is in conventions ' +
        '(read `cuccut-conventions` with `skills_read`), and start-up details are in start.',
    );
    expect(agent.get('references/catalog/media.md')).toContain('to cut, go to editing (read `cuccut-catalog-editing` with `skills_read`)');
    expect(agent.get('references/conventions.md')).toContain('| Error code | Next step |');
    // The craft copy is for external agents, so the tool-bridge surface does not output it.
    expect([...agent.keys()].some((file) => file.startsWith('references/craft/'))).toBe(false);
    expect(cliTracesInAgentFace(agent)).toEqual([]);
  });

  it('both surfaces have the same number of hard rules', () => {
    const cli = renderAgentSkill(source, { face: 'cli' }).get('SKILL.md')!;
    const agent = renderAgentSkill(source, { face: 'agent' }).get('SKILL.md')!;
    expect(countHardRules(cli)).toBe(5);
    expect(countHardRules(agent)).toBe(5);
    expect(countHardRules('# Unrelated\n- one')).toBe(0);
    expect(countHardRules('## 5. Hard rules\n\n1. A\n2. B\n   - sub-items do not count\n\n## 6. Delivery\n- not counted')).toBe(2);
  });

  it('a craft id only accepts lowercase hyphenated names, README.md does not count', () => {
    expect([...craftIdsOf(source)!].sort()).toEqual(['demo-chapters', 'demo-polish']);
    expect(craftIdsOf(['references/craft/README.md'])).toBeNull();
    expect(agentPageId('references/catalog/media.md')).toBe('cuccut-catalog-media');
    expect(agentPageId('references/craft/demo-polish.md')).toBe('demo-polish');
    expect(agentPageId('references/craft/README.md')).toBeNull();
    expect(agentPageId('references/mcp.md')).toBeNull();
  });

  it('tool-bridge surface guidance and built-in pages', () => {
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

describe('CLI-only directory page', () => {
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

  it('a tool-bridge page with an empty body (only front matter and heading left) is not registered as a manual page; the CLI surface still has the page', () => {
    const files = withPage({ 'references/catalog/web.md': cliOnly });
    const { pages } = renderAgentGuidance(files, AGENT);
    expect(pages.map((page) => page.id)).not.toContain('cuccut-catalog-web');
    expect(pages.map((page) => page.id)).toContain('cuccut-catalog-media');
    // Headings outside cli blocks are handled the same way: only headings do not count as body text.
    const titled = cliOnly.replace('<!-- surface: cli -->\n# 网页', '# 网页\n\n<!-- surface: cli -->');
    expect(renderAgentGuidance(withPage({ 'references/catalog/web.md': titled }), AGENT).pages.map((p) => p.id)).not.toContain(
      'cuccut-catalog-web',
    );
    const cli = renderAgentSkill(files, { face: 'cli', catalog: CLI }).get('references/catalog/web.md')!;
    expect(cli).toContain('# 网页');
    expect(cli).toContain('`cuccut videos list`');
  });

  it('a body present on both surfaces that links to this page errors: the link must go in the cli surface', () => {
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

describe('craft references read smoothly on the tool-bridge surface', () => {
  const agent = (text: string) => renderAgentSkillText(text, { face: 'agent', file: 'references/workflows.md' });
  const cli = (text: string) => renderAgentSkillText(text, { face: 'cli', file: 'references/workflows.md' });

  it('after see, follow, tables and lists: name first, how to read in parentheses', () => {
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

  it('does not repeat read when read immediately precedes it; words like spread and thread do not count', () => {
    expect(agent('1. Read {{skill:talking-head-cut}}.')).toBe('1. Use `skills_read` to read `talking-head-cut`.');
    expect(agent('Before starting, read {{skill:shorts-segments}}.')).toBe('Before starting, use `skills_read` to read `shorts-segments`.');
    expect(agent('Thread {{skill:video-blog}} in.')).toBe('Thread `video-blog` (read it with `skills_read`) in.');
    // A `read` before other placeholders is kept as-is. The `read` on the CLI surface is kept too.
    expect(agent('Read {{tool:documents_read}} results')).toBe('Read `documents_read` results');
    expect(cli('1. Read {{skill:talking-head-cut}}.')).toBe('1. Read [talking-head-cut](craft/talking-head-cut.md).');
    expect(cli('Read {{tool:documents_read}} results')).toBe('Read `cuccut documents read` results');
  });
});

describe('fallback wording on the CLI surface for tools that exist only in the session', () => {
  const cli = (text: string) => renderAgentSkillText(text, { face: 'cli', file: 'references/craft/x.md', catalog: CLI });
  const agent = (text: string) => renderAgentSkillText(text, { face: 'agent', file: 'references/craft/x.md', catalog: AGENT });
  const PATH_TOLD = SESSION_ONLY_TOOLS.downloads_save!.replacement;

  it('downloads_save has no terminal command: common whole sentences become "tell the user the path", elsewhere fallback wording, never naming the tool', () => {
    // Original sentences from craft (skills/translate-subtitles, etc.).
    expect(
      cli('Write it as a new file in the working directory, then put it in the downloads directory with downloads_save and tell the user the path it returns.'),
    ).toBe(`Write it as a new file in the working directory, then ${PATH_TOLD}.`);
    expect(PATH_TOLD).toBe("tell the user the file's path (the terminal has no downloads directory step: the file is where you wrote it)");
    expect(cli('At delivery, put the notes in the downloads directory with `downloads_save`.')).toBe(`At delivery, ${PATH_TOLD}.`);
    // Placeholders written in the instructions behave the same way: they are not checked against the terminal's directory, and no “not in directory” error is reported.
    expect(cli('Finally {{tool:downloads_save}}.')).toBe("Finally hand the file to the user (in the terminal, tell the user the file's path).");
    expect(renderSessionOnlyTools('see downloads_saved and my_downloads_save')).toBe('see downloads_saved and my_downloads_save');
    // Code blocks are left untouched.
    expect(cli('```text\ndownloads_save\n```')).toBe('```text\ndownloads_save\n```');
    // Tool-bridge surface kept as-is.
    expect(agent('Then put it in the downloads directory with {{tool:downloads_save}}.')).toBe(
      'Then put it in the downloads directory with `downloads_save`.',
    );
  });

  it('slides_check and slides_import_asset: in craft, the step is replaced from the Call / import line onward, elsewhere replaced with fallback wording', () => {
    const fallback = SESSION_ONLY_TOOLS.slides_import_asset!;
    // Step 6 and step 4 of skills/slides.
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
    // Tool-bridge surface kept as-is.
    expect(agent('Call {{tool:slides_check}} to validate.')).toBe('Call `slides_check` to validate.');
  });

  it('design_check and design_import_asset: the validation and import sentences in skills/design are replaced whole, elsewhere with fallback wording', () => {
    // Step 6 and step 3 of skills/design “New”.
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
    // Tool-bridge surface kept as-is.
    expect(agent('Then {{tool:design_check}}.')).toBe('Then `design_check`.');
  });

  it('design_system_check and design_system_import_asset: the validation sentence and two call notes in skills/design-system are replaced whole', () => {
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

describe('manual markup syntax errors', () => {
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

  it('unknown placeholder and unclosed placeholder report file and line number', () => {
    expect(errorOf(() => render('一\n二 {{tool:Bad Name}}'))).toBe('references/x.md:2：工具名不合规：{{tool:Bad Name}}');
    expect(errorOf(() => render('{{thing:x}}'))).toContain('references/x.md:1：不认识的占位符 {{thing:x}}');
    expect(errorOf(() => render('甲\n乙\n{{tool:documents_read'))).toBe('references/x.md:3：占位符没有闭合（有 {{ 没有对应的 }}）');
    // In code, template holes are the ones without `kind:` (skills/design explains how to write Design Components). They are kept as-is. Those in the body with an unrecognized `kind:` still raise errors.
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

  it('surface and generated blocks: unclosed, nested, crossed, extra closing, unknown name', () => {
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

  it('linking to a page not in the manual errors; links and placeholders inside inline code are left alone', () => {
    const files = new Set(['SKILL.md', 'references/x.md']);
    expect(errorOf(() => renderAgentSkillText('见 [y](y.md)', { face: 'cli', file: 'references/x.md', files }))).toContain(
      'references/x.md:1：链接 [y](y.md) 指向的 references/y.md 不在说明书里',
    );
    expect(renderAgentSkillText('写 `[a](b.md)` 与 `{{tool:documents_read}}`', { face: 'agent', file: 'SKILL.md', files })).toBe(
      '写 `[a](b.md)` 与 `documents_read`',
    );
  });
});

describe('manual location', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('environment variable takes precedence, then bundled resources, finally the repo root', () => {
    expect(resolveBuiltinAgentSkillsDir({ CUCCUT_AGENT_SKILLS_DIR: '/x/skills' })).toBe('/x/skills');
    const resources = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-agent-skills-'));
    dirs.push(resources);
    fs.mkdirSync(path.join(resources, 'skills'));
    expect(resolveBuiltinAgentSkillsDir({}, [resources])).toBe(path.join(resources, 'skills'));
    expect(resolveBuiltinAgentSkillsDir({}, [path.join(resources, 'missing')])).toBe(findRepoDir('skills'));
  });
});

describe('manual in the repo', () => {
  const dir = path.join(findRepoDir('skills')!, 'cuccut');

  // The three §8.6 tests run against the real instructions in the repository and the real tool catalog (the Runtime's tool group, with the view chosen by surface).
  const source = readAgentSkillDir(dir);
  const cli = renderAgentSkill(source, { face: 'cli', catalog: CLI });
  const agent = renderAgentSkill(source, { face: 'agent', catalog: AGENT });
  const guidance = renderAgentGuidance(source, AGENT);

  it('CLI surface rendering has no a_b tool names or tool-bridge wording', () => {
    expect(bridgeNamesInCliFace(cli)).toEqual([]);
  });

  it('built-in skill front matter and the manual\'s routing table do not write a_b tool names (they go into the index and intro as is, without tool-name rewriting)', () => {
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

  it('tool-bridge surface rendering has no cuccut command, --yes or exit codes (including session guidance and built-in pages)', () => {
    expect(cliTracesInAgentFace(agent)).toEqual([]);
    const rendered: AgentSkillFiles = new Map([
      ['guidance', guidance.guidance],
      ...guidance.pages.map((page) => [page.id, page.body] as const),
    ]);
    expect(cliTracesInAgentFace(rendered)).toEqual([]);
  });

  it('both surfaces render the same number of hard rules', () => {
    expect(countHardRules(cli.get('SKILL.md')!)).toBe(12);
    expect(countHardRules(agent.get('SKILL.md')!)).toBe(12);
    expect(countHardRules(guidance.guidance)).toBe(12);
  });

  it('tool-bridge surface: directory page, how-to overview and conventions become built-in pages, with names and descriptions taken from front matter or the heading', () => {
    expect(guidance.pages.map((page) => page.id)).toEqual([
      'cuccut-catalog-editing',
      'cuccut-catalog-export',
      'cuccut-catalog-media',
      'cuccut-catalog-models',
      'cuccut-catalog-music',
      'cuccut-catalog-review',
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
    // The page IDs referenced by the guidance all exist.
    const ids = new Set(guidance.pages.map((page) => page.id));
    for (const match of guidance.guidance.matchAll(/`(cuccut-[a-z-]+)`/g)) expect(ids.has(match[1]!), match[1]).toBe(true);
  });
});
