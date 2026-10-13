#!/usr/bin/env node
/**
 * Syncs the agent guide (agent surface design §8.3, §8.6, §8.7):
 *
 * 1. Craft copies: each built-in skill `skills/cuccut/built-in-skills/<id>/` (SKILL.md + references/*.md) is composed into
 *    one page, `skills/cuccut/references/craft/<id>.md`.
 *    Front matter is dropped; the body's leading level-1 heading becomes the title (`name` when there is none), the
 *    `description` the lead, and references become level-2 appendices. Tool-bridge tool names are rewritten for the CLI face
 *    (`documents_read` → `cuccut documents read`; `edits_apply` operation names are unchanged), and `skills_read` phrasings
 *    become references to this page's appendices or to other craft pages. Markers and placeholders in the body are rendered
 *    for the CLI face (with the same renderer as the guide). Craft pages no longer in `built-in-skills/` are deleted.
 * 2. Generated blocks: the content between `<!-- generated: <name> -->` … `<!-- /generated -->` in the guide is rewritten
 *    from the catalogs: `common-ops` (the 8 most used `edits_apply` operations, from the descriptions and examples of
 *    `edits_ops`), `error-codes` (error code → exit code → next step, from the table in `apps/cli/src/envelope.ts`) and
 *    `tool-map` (MCP tool ↔ CLI command ↔ effect, from the catalog).
 * 3. After writing, both faces are rendered once (the CLI face against the terminal catalog, the tool-bridge face against
 *    the in-session agents' catalog); a bad placeholder or marker fails the sync.
 *
 *   node tools/sync-agent-skill.ts                 write
 *   node tools/sync-agent-skill.ts --check         exit code 1 when disk differs (or rendering fails)
 *   node tools/sync-agent-skill.ts --root <dir>    use another root (containing skills/cuccut/ and
 *                                                  skills/cuccut/built-in-skills/; used by the test fixtures)
 *
 * The root `package.json`'s `build:agent-skill` runs it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolCommandName, type CatalogEditOperations, type CatalogTool } from '@cuccut/protocol';
import { silentLogger } from '@cuccut/harness';
import { EXIT_BY_CODE } from '../apps/cli/src/envelope.ts';
import { ToolCatalog } from '../packages/runtime-core/src/agent-tools/tool-catalog.ts';
import { allToolSets } from '../packages/runtime-core/src/agent-tools/all-tool-sets.ts';
import {
  AGENT_SKILL_BUILTIN_DIR,
  AGENT_SKILL_CRAFT_DIR,
  AGENT_SKILL_ID,
  AgentSkillRenderError,
  craftIdsOf,
  readAgentSkillDir,
  renderAgentSkill,
  renderAgentSkillText,
  type AgentSkillFace,
  type AgentSkillGeneratedBlock,
} from '../packages/runtime-core/src/skills/agent-skill-renderer.ts';
import { parseSkillFrontmatter } from '../packages/runtime-core/src/skills/skill-frontmatter.ts';
import { buildCatalogSnapshot } from './catalog-snapshot.ts';

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Catalogs and tables used for generation. Taken from the current code by default; tests can substitute them. */
export interface SyncInputs {
  /** The terminal catalog (`surfaces` include `cli`). */
  cliTools: readonly CatalogTool[];
  /** Tool names the in-session agents (tool bridge) see. */
  agentToolNames: readonly string[];
  editOps: CatalogEditOperations;
  /** Error code → exit code (1 when not listed). */
  exitCodes: Readonly<Record<string, number>>;
}

export function defaultSyncInputs(): SyncInputs {
  const snapshot = buildCatalogSnapshot();
  const agent = new ToolCatalog(allToolSets(), silentLogger, { surface: 'agent' });
  return {
    cliTools: snapshot.tools,
    agentToolNames: agent.list().map((tool) => tool.name),
    editOps: snapshot.editOps,
    exitCodes: EXIT_BY_CODE,
  };
}

export interface SyncResult {
  /** Path relative to `root` → expected content (craft pages and pages with generated blocks). */
  files: Map<string, string>;
  /** Craft pages to delete (relative to `root`). */
  stale: string[];
  /** Problems that do not block the sync but need a human look (such as tool names in a craft that exist only on the tool bridge). */
  warnings: string[];
}

/** Computes the files the sync should produce, without writing to disk. */
export function buildAgentSkillSync(root: string, inputs: SyncInputs = defaultSyncInputs()): SyncResult {
  const agentRel = `skills/${AGENT_SKILL_ID}`;
  const agentDir = path.join(root, agentRel);
  const skillsDir = path.join(agentDir, AGENT_SKILL_BUILTIN_DIR);
  if (!isDirectory(agentDir)) throw new Error(`Agent guide directory not found: ${agentDir}`);
  const files = new Map<string, string>();
  const warnings: string[] = [];

  // 1. Craft copies.
  const craftIds = isDirectory(skillsDir)
    ? fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')),
        )
        .map((entry) => entry.name)
        .sort()
    : [];
  const ids = new Set(craftIds);
  for (const id of craftIds) {
    files.set(`${agentRel}/${AGENT_SKILL_CRAFT_DIR}/${id}.md`, composeCraft(id, path.join(skillsDir, id), ids, inputs, warnings));
  }
  const craftAbs = path.join(agentDir, AGENT_SKILL_CRAFT_DIR);
  const stale = isDirectory(craftAbs)
    ? fs
        .readdirSync(craftAbs)
        // Only `<id>.md`; notes such as README.md are not the sync script's business.
        .filter((name) => craftIdsOf([`${AGENT_SKILL_CRAFT_DIR}/${name}`]) !== null && !ids.has(name.slice(0, -'.md'.length)))
        .map((name) => `${agentRel}/${AGENT_SKILL_CRAFT_DIR}/${name}`)
    : [];

  // 2. Generated blocks.
  const source = readAgentSkillDir(agentDir);
  for (const [rel, text] of source) {
    if (!rel.endsWith('.md') || rel.startsWith(`${AGENT_SKILL_CRAFT_DIR}/`)) continue;
    const filled = fillGeneratedBlocks(text, rel, inputs);
    if (filled !== null) files.set(`${agentRel}/${rel}`, filled);
  }

  // 3. Render each face once: placeholders, markers and tool names must all pass.
  const merged = new Map(source);
  for (const id of craftIdsOf(merged) ?? []) merged.delete(`${AGENT_SKILL_CRAFT_DIR}/${id}.md`);
  for (const [rel, text] of files) merged.set(rel.slice(agentRel.length + 1), text);
  renderAgentSkill(merged, { face: 'cli', catalog: { tools: inputs.cliTools } });
  renderAgentSkill(merged, { face: 'agent', catalog: { tools: inputs.agentToolNames.map((name) => ({ name })) } });

  return { files, stale, warnings };
}

// ---- craft ----

/** Composes one craft into one page. */
export function composeCraft(id: string, dir: string, craftIds: ReadonlySet<string>, inputs: SyncInputs, warnings: string[]): string {
  const sourceRel = `skills/${AGENT_SKILL_ID}/${AGENT_SKILL_BUILTIN_DIR}/${id}`;
  const skillSource = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const parsed = parseSkillFrontmatter(skillSource);
  if (!parsed.ok) throw new Error(`${sourceRel}/SKILL.md: ${parsed.problem}`);
  // The title is the body's leading level-1 heading (`name` is the skill id; the human-readable name is on the body's first line), falling back to `name`.
  const title = firstHeading(parsed.body) ?? (parsed.fields.get('name') || id);
  const description = parsed.fields.get('description') ?? '';

  const refsDir = path.join(dir, 'references');
  const refFiles = isDirectory(refsDir) ? listMarkdown(refsDir).map((file) => `references/${file}`) : [];
  const appendices = refFiles.map((file) => {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    return { file, title: firstHeading(text) ?? path.posix.basename(file, '.md'), text };
  });
  const titles = new Map(appendices.map((a) => [a.file, a.title]));

  const page = `${AGENT_SKILL_CRAFT_DIR}/${id}.md`;
  // The body is the tail of the source file (without front matter and the leading heading): line numbers in errors and warnings refer to the source file.
  const rewrite = (text: string, file: string, source: string) => {
    const lineOffset = source.replace(/\r\n?/g, '\n').split('\n').length - text.split('\n').length;
    return rewriteCraftText(text, { id, file: `${sourceRel}/${file}`, lineOffset, page, titles, craftIds, inputs, warnings });
  };

  const out: string[] = [
    `<!-- Generated by tools/sync-agent-skill.ts from ${sourceRel}/. Do not edit by hand: change the source files, then run npm run build:agent-skill -->`,
    '',
    `# ${title}`,
    '',
  ];
  if (description) out.push(`> ${description.replace(/\s*\n\s*/g, ' ')}`, '');
  out.push(rewrite(dropLeadingHeading(parsed.body), 'SKILL.md', skillSource).trim(), '');
  for (const appendix of appendices) {
    out.push(`## Appendix: ${appendix.title}`, '');
    out.push(demoteHeadings(rewrite(dropLeadingHeading(appendix.text), appendix.file, appendix.text)).trim(), '');
  }
  return out.join('\n');
}

interface RewriteContext {
  id: string;
  /** Source file (for errors): `skills/cuccut/built-in-skills/<id>/SKILL.md`. */
  file: string;
  /** Line number of the body's first line in the source file, minus one. */
  lineOffset: number;
  /** Location of the copy in the guide: `references/craft/<id>.md`. */
  page: string;
  /** This skill's references files → appendix titles. */
  titles: ReadonlyMap<string, string>;
  craftIds: ReadonlySet<string>;
  inputs: SyncInputs;
  warnings: string[];
}

/**
 * Rewrites a craft body for the CLI face. Only the `skills_read` phrasings below are recognized; any other one is an error
 * (with file and line), and whoever writes the craft changes it to a phrasing that matches, rather than this guessing:
 *
 * - "use `skills_read` to read this skill's `references/x.md`" → "read this page's appendix "…"";
 * - "…; when you do these, fetch it with `skills_read`" → "…; when you do these, turn to that appendix";
 *   "(fetch with `skills_read`)" → "(see this page's appendices)";
 * - "use `skills_read` to read `<another craft id>`" → a link to that page;
 * - "use `skills_read` to read `cuccut-catalog-<page>`" → a link to the shared catalog page, without copying its text; the
 *   target is checked when the whole guide is rendered.
 */
export function rewriteCraftText(text: string, ctx: RewriteContext): string {
  const cliNames = ctx.inputs.cliTools.map((tool) => tool.name);
  const lineAt = (index: number) => ctx.lineOffset + index + 1;
  let out: string;
  try {
    out = renderAgentSkillText(text, { face: 'cli', file: ctx.page, catalog: { tools: ctx.inputs.cliTools }, craftIds: ctx.craftIds });
  } catch (error) {
    if (!(error instanceof AgentSkillRenderError)) throw error;
    throw new AgentSkillRenderError(ctx.file, error.line > 0 ? lineAt(error.line - 1) : 0, error.problem);
  }
  const read = (use: string) => (use === 'U' ? 'Read' : 'read');
  // None of the rewrites below adds or removes lines: line i is still line i of the body.
  const lines = out.split('\n').map((line, index) =>
    line
      .replace(/`(references\/[^`\s]+\.md)`/g, (whole, ref: string) => {
        const title = ctx.titles.get(ref);
        if (title) return `appendix "${title}"`;
        ctx.warnings.push(`${ctx.file}:${lineAt(index)}: ${ref} is not in this skill's references/; left as is`);
        return whole;
      })
      .replace(/([Uu])se\s+`skills_read`\s+to read this skill's\s+/g, (_whole, use: string) => `${read(use)} this page's `)
      .replace(/fetch it with\s+`skills_read`/g, 'turn to that appendix')
      .replace(/fetch with\s+`skills_read`/g, "see this page's appendices")
      .replace(/([Uu])se\s+`skills_read`\s+to read\s+`([a-z0-9-]+)`/g, (whole, use: string, other: string) => {
        const catalogPage = /^cuccut-catalog-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(other);
        if (catalogPage) {
          const target = `references/catalog/${catalogPage[1]}.md`;
          return `${read(use)} [${other}](${path.posix.relative(path.posix.dirname(ctx.page), target)})`;
        }
        if (!ctx.craftIds.has(other)) return whole;
        return `${read(use)} [\`${AGENT_SKILL_CRAFT_DIR}/${other}.md\`](${other}.md)`;
      }),
  );
  const left = lines.findIndex((line) => line.includes('skills_read'));
  if (left >= 0) {
    throw new AgentSkillRenderError(
      ctx.file,
      lineAt(left),
      "This `skills_read` phrasing cannot be rewritten for the CLI face: write \"use `skills_read` to read this skill's `references/…`\" or \"use `skills_read` to read `<craft id>`\"",
    );
  }
  out = renderCraftToolNames(lines.join('\n'), cliNames);
  const bridgeOnly = ctx.inputs.agentToolNames.filter((name) => !cliNames.includes(name));
  out.split('\n').forEach((line, index) => {
    for (const name of bridgeOnly) {
      if (craftToolNamePattern([name])!.test(line)) {
        ctx.warnings.push(`${ctx.file}:${lineAt(index)}: ${name} exists only in CucCut sessions and has no CLI command; left as is`);
      }
    }
  });
  return out;
}

/**
 * Replaces bare tool names in the body with CLI commands (same naming rule as `renderCliToolNames`); outside inline code
 * and code blocks they are wrapped in backticks, matching the placeholder output. One-word verbs (`speak`, `export`) are
 * rewritten too, so the boundaries are stricter than in `renderCliToolNames`: names joined with `-`, `/` or `.` do not count
 * (`translate-subtitles.md`, `export/`), though a full stop ending the sentence does ("… with edits_apply."); and a
 * one-word name followed by `:` is a field, not a tool (`transcribe: true` of `download`). Names with `_` are never fields,
 * so a colon after them ("with videos_inspect: name, …") still counts. One-word verbs are also ordinary English words (an image, PNG export) and code (CSS `translate(…)`); see
 * `isVerbReference`.
 */
const CRAFT_TOOL_NAME_BOUNDARY = { before: '(?<![A-Za-z0-9_\\-/.])', after: '(?![A-Za-z0-9_\\-/]|\\.[A-Za-z0-9_])' } as const;

function craftToolNamePattern(names: readonly string[], flags = ''): RegExp | null {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return null;
  return new RegExp(`${CRAFT_TOOL_NAME_BOUNDARY.before}(${sorted.join('|')})${CRAFT_TOOL_NAME_BOUNDARY.after}`, flags);
}

function renderCraftToolNames(text: string, names: readonly string[]): string {
  const pattern = craftToolNamePattern(names, 'g');
  if (!pattern) return text;
  let fence: string | null = null;
  return text
    .split('\n')
    .map((line) => {
      const mark = /^\s*(```|~~~)/.exec(line)?.[1];
      if (mark && (!fence || fence === mark)) {
        fence = fence ? null : mark;
        return line;
      }
      return line.replace(pattern, (name: string, _g: string, offset: number) => {
        const command = `cuccut ${toolCommandName(name).display}`;
        const ticks = [...line.slice(0, offset)].filter((c) => c === '`').length;
        const at = fence ? 'fence' : ticks % 2 === 1 ? 'span' : 'prose';
        if (!name.includes('_') && (/^\s*:/.test(line.slice(offset + name.length)) || !isVerbReference(line, offset, name.length, at))) {
          return name;
        }
        if (at !== 'prose') return command;
        return `\`${command}\``;
      });
    })
    .join('\n');
}

/**
 * Where a one-word verb counts as a tool name. In code blocks, only as the command at the start of a line
 * (`transcribe --url x`, not `translate(-50%)`); in inline code it is a value (element type `image`), so never. In prose it
 * counts right after "use", "with" or "call" ("use transcribe with …", "with music (mode instrumental)"), unless a noun it
 * qualifies follows ("image generation", "music track"); or when a field with a code value follows in parentheses
 * ("export (kind `transcript`)"); or next to CJK text. Anything else is an English word.
 */
const VERB_LEAD = /(?:^|[^A-Za-z])(?:use|with|call)\s+$/i;
const VERB_NOUN_AFTER = /^\s+(?:generation|generations|model|models|track|tracks|mood|cue|cues|volume|file|files|type|URLs?)\b/i;
const VERB_FIELD_AFTER = /^\s+\(\w+\s+`/;

function isVerbReference(line: string, offset: number, length: number, at: 'fence' | 'span' | 'prose'): boolean {
  const after = line.slice(offset + length);
  if (at === 'fence') return line.slice(0, offset).trim() === '' && /^(\s|$)/.test(after);
  if (at === 'span') return false;
  const head = line.slice(0, offset);
  const before = head.trimEnd().slice(-1);
  const next = after.trimStart().slice(0, 1);
  if (VERB_FIELD_AFTER.test(after)) return true;
  if (VERB_LEAD.test(head) && !VERB_NOUN_AFTER.test(after)) return true;
  if (/[A-Za-z0-9]/.test(before) || /[A-Za-z0-9]/.test(next)) return false;
  return /[^\x00-\x7f]/.test(before) || /[^\x00-\x7f]/.test(next);
}

function listMarkdown(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listMarkdown(dir, child));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(child);
  }
  return out;
}

function firstHeading(text: string): string | null {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? null;
}

/** Drops the leading level-1 heading (the page header already uses it as the title). */
function dropLeadingHeading(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first >= 0 && /^#\s/.test(lines[first]!)) lines.splice(0, first + 1);
  return lines.join('\n');
}

/** Demotes headings by one level (not inside code blocks): `##` in an appendix becomes `###`. */
function demoteHeadings(text: string): string {
  let fence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence) return line;
      return /^#{1,5}\s/.test(line) ? `#${line}` : line;
    })
    .join('\n');
}

// ---- Generated blocks ----

const SURFACE_OPEN = /^\s*<!--\s*surface:\s*(\S+?)\s*-->\s*$/;
const SURFACE_CLOSE = /^\s*<!--\s*\/surface\s*-->\s*$/;
const GENERATED_OPEN = /^\s*<!--\s*generated:\s*(\S+?)\s*-->\s*$/;
const GENERATED_CLOSE = /^\s*<!--\s*\/generated\s*-->\s*$/;

/** Rewrites the generated blocks of a page; null when it has none. The renderer checks the markers; this only finds the blocks and the face each sits in. */
export function fillGeneratedBlocks(text: string, file: string, inputs: SyncInputs): string | null {
  const lines = text.split('\n');
  const out: string[] = [];
  let surface: AgentSkillFace | null = null;
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const open = SURFACE_OPEN.exec(line);
    if (open) surface = open[1] as AgentSkillFace;
    else if (SURFACE_CLOSE.test(line)) surface = null;
    out.push(line);
    const generated = GENERATED_OPEN.exec(line);
    if (!generated) continue;
    found = true;
    const end = lines.findIndex((candidate, j) => j > i && GENERATED_CLOSE.test(candidate));
    if (end < 0) throw new AgentSkillRenderError(file, i + 1, 'Generated block is not closed');
    const name = generated[1] as AgentSkillGeneratedBlock;
    out.push(...generateBlock(name, surface, inputs, file, i + 1).split('\n'));
    out.push(lines[end]!);
    i = end;
  }
  return found ? out.join('\n') : null;
}

function generateBlock(
  name: AgentSkillGeneratedBlock,
  surface: AgentSkillFace | null,
  inputs: SyncInputs,
  file: string,
  line: number,
): string {
  switch (name) {
    case 'common-ops':
      return commonOps(inputs.editOps);
    case 'error-codes':
      if (surface) return errorCodes(surface, inputs.exitCodes);
      return wrapFaces(errorCodes('cli', inputs.exitCodes), errorCodes('agent', inputs.exitCodes));
    case 'tool-map':
      if (surface === 'agent') throw new AgentSkillRenderError(file, line, 'tool-map belongs to the CLI face only and cannot sit in an agent section');
      return surface === 'cli' ? toolMap(inputs.cliTools) : wrapFaces(toolMap(inputs.cliTools), null);
    default:
      throw new AgentSkillRenderError(file, line, `Unknown generated block "${name as string}"`);
  }
}

function wrapFaces(cli: string, agent: string | null): string {
  const parts = ['<!-- surface: cli -->', cli, '<!-- /surface -->'];
  if (agent !== null) parts.push('<!-- surface: agent -->', agent, '<!-- /surface -->');
  return parts.join('\n');
}

/** Operations picked for `common-ops` and their human-readable labels (§8.7: placing assets, trimming, moving, deleting, splitting, volume and text first). */
export const COMMON_OPS: readonly { op: string; label: string }[] = [
  { op: 'importAsset', label: 'Import an asset' },
  { op: 'addItem', label: 'Place an asset' },
  { op: 'trimItem', label: 'Trim' },
  { op: 'moveItem', label: 'Move' },
  { op: 'deleteItems', label: 'Delete' },
  { op: 'splitItem', label: 'Split' },
  { op: 'setAudioMix', label: 'Change volume' },
  { op: 'setText', label: 'Change text' },
];

function commonOps(editOps: CatalogEditOperations): string {
  const byType = new Map(editOps.families.flatMap((family) => family.operations.map((op) => [op.type, op] as const)));
  const out: string[] = [];
  for (const { op, label } of COMMON_OPS) {
    const entry = byType.get(op);
    if (!entry) throw new Error(`common-ops: edits_ops has no operation ${op}`);
    out.push(`**${label}** (\`${op}\`): ${firstSentence(entry.description)}`, '', '```json', JSON.stringify(entry.example), '```', '');
  }
  out.push(
    'Caption layers are created with {{tool:captions_create}}, not with an operation here; to cut a span and close the gap, ' +
      'use `removeRange`, and for cuts in a talking head use `addCuts`. Get the other operations and how to write each field ' +
      'from {{tool:edits_ops}}.',
  );
  return out.join('\n');
}

/** First sentence of an operation description: after the signature (after the first `}: `) up to the first full stop. */
function firstSentence(description: string): string {
  const colon = description.indexOf('}: ');
  const rest = colon >= 0 ? description.slice(colon + 3) : description;
  const end = /\.(?=\s|$)/.exec(rest);
  return (end ? rest.slice(0, end.index + 1) : rest).trim();
}

/** Next step per exit code (what each class means in the command and protocol spec §11.7). */
const CLI_NEXT: Readonly<Record<number, string>> = {
  2: 'The user has to do something first: configure a capability, grant access or budget, agree to or install an external tool, sign in, authorize a voice. Pass `remedy` on to the user as is, and retry as `next` says once they are done; do not work around it with scripts, other providers or hand-edited configuration',
  3: 'The Runtime is unavailable or a different version. Run `cuccut runtime ensure` first; when the interface version differs, ask the user to update CucCut or the CLI, and do not work around it',
  4: 'Wrong arguments: fix them against `cuccut help <command>` or `cuccut spec <name>`; when `--yes` is missing, ask the user first and add it only once they agree',
};
const RUNTIME_NOT_MINE = 'The Runtime is not this CLI\'s to stop, or someone is still using it: do not stop it, leave it running';
const AGENT_SKILL_BROKEN =
  'The agent guide cannot be installed: the CucCut installation is incomplete or the guide is broken. Pass `message` on to the user as is and ask them to reinstall or update CucCut; do not assemble the guide yourself';
/** Error codes registered under exit code 1 each have their own next step: given per code, with codes that share a sentence on one row; the rest fall under the "Other error codes" row. */
const CLI_NEXT_FAILED: Readonly<Record<string, string>> = {
  RUNTIME_NOT_OWNED: RUNTIME_NOT_MINE,
  RUNTIME_IN_USE: RUNTIME_NOT_MINE,
  AGENT_SKILL_NOT_FOUND: AGENT_SKILL_BROKEN,
  AGENT_SKILL_INVALID: AGENT_SKILL_BROKEN,
};
const CLI_OTHER =
  'Failed or cancelled. Look at `retryability`: `after-refresh` - read again before submitting (on a revision conflict, `PROJECT_REVISION_CONFLICT`, run {{tool:videos_inspect}} again); ' +
  '`after-user-action` - pass it on to the user; `never` - change approach. On a wait timeout (`WAIT_TIMEOUT`) the job is still running: keep waiting with {{tool:jobs_wait}}';
const AGENT_NEXT_ACTION =
  'The user has to do something first: configure a capability, grant access or budget, agree to or install an external tool, sign in, authorize a voice. Pass `remedy` on to the user as is, and retry as `next` says once they are done; do not work around it';
const AGENT_NEXT_ARGS = 'Wrong arguments or tool name: fix them against the tool\'s schema; get the operation fields of `edits_apply` from {{tool:edits_ops}}';
const AGENT_OTHER =
  'Failed or cancelled. Look at `retryability`: `after-refresh` - read again before submitting (on a revision conflict, `PROJECT_REVISION_CONFLICT`, run {{tool:videos_inspect}} again); ' +
  '`after-user-action` - pass it on to the user; `never` - change approach';

function errorCodes(face: AgentSkillFace, exitCodes: Readonly<Record<string, number>>): string {
  const byExit = new Map<number, string[]>();
  for (const [code, exit] of Object.entries(exitCodes)) {
    if (!byExit.has(exit)) byExit.set(exit, []);
    byExit.get(exit)!.push(code);
  }
  const codes = (list: readonly string[]) => list.map((code) => `\`${code}\``).join(' ');
  if (face === 'cli') {
    const rows = ['| Error code | Exit code | Next step |', '| --- | --- | --- |'];
    for (const exit of [2, 3, 4]) {
      const list = byExit.get(exit);
      if (list?.length) rows.push(`| ${codes(list)} | ${exit} | ${CLI_NEXT[exit] ?? ''} |`);
    }
    const failed = new Map<string, string[]>();
    for (const code of byExit.get(1) ?? []) {
      const next = CLI_NEXT_FAILED[code] ?? CLI_OTHER;
      if (!failed.has(next)) failed.set(next, []);
      failed.get(next)!.push(code);
    }
    for (const [next, list] of failed) rows.push(`| ${codes(list)} | 1 | ${next} |`);
    rows.push(`| Other error codes | 1 | ${CLI_OTHER} |`);
    return rows.join('\n');
  }
  // Tool-bridge face: only what in-session agents meet (user action needed, arguments), without exit codes.
  const rows = ['| Error code | Next step |', '| --- | --- |'];
  const action = byExit.get(2) ?? [];
  if (action.length) rows.push(`| ${codes(action)} | ${AGENT_NEXT_ACTION} |`);
  const args = Object.keys(exitCodes).filter((code) => code === 'INVALID_ARGUMENTS' || code === 'UNKNOWN_TOOL');
  if (args.length) rows.push(`| ${codes(args)} | ${AGENT_NEXT_ARGS} |`);
  rows.push(`| Other error codes | ${AGENT_OTHER} |`);
  return rows.join('\n');
}

function toolMap(tools: readonly CatalogTool[]): string {
  const rows = ['| MCP tool | CLI command | Effect |', '| --- | --- | --- |'];
  const cliOnly: string[] = [];
  for (const tool of [...tools].sort((a, b) => a.name.localeCompare(b.name))) {
    const command = `cuccut ${toolCommandName(tool.name).display}`;
    if (tool.surfaces.includes('mcp')) rows.push(`| \`${tool.name}\` | \`${command}\` | ${tool.effect} |`);
    else cliOnly.push(`\`${command}\``);
  }
  if (cliOnly.length) rows.push('', `Only in the CLI, not on MCP: ${cliOnly.join(', ')}.`);
  return rows.join('\n');
}

// ---- Writing and checking ----

/** Compares with disk: the files that differ (relative to `root`). */
export function diffAgentSkillSync(root: string, result: SyncResult): string[] {
  const changed = [...result.files].filter(([rel, text]) => readOrNull(path.join(root, rel)) !== text).map(([rel]) => rel);
  return [...changed, ...result.stale].sort();
}

export function writeAgentSkillSync(root: string, result: SyncResult): string[] {
  const changed = diffAgentSkillSync(root, result);
  for (const rel of changed) {
    const abs = path.join(root, rel);
    const text = result.files.get(rel);
    if (text === undefined) fs.rmSync(abs, { force: true });
    else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text);
    }
  }
  return changed;
}

function readOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root = rootIndex >= 0 && args[rootIndex + 1] ? path.resolve(args[rootIndex + 1]!) : REPO_ROOT;
  let result: SyncResult;
  try {
    result = buildAgentSkillSync(root);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
  for (const warning of result.warnings) process.stderr.write(`Note: ${warning}\n`);
  if (args.includes('--check')) {
    const changed = diffAgentSkillSync(root, result);
    if (changed.length) {
      process.stderr.write(`The agent guide is out of date with its sources: run npm run build:agent-skill\n${changed.map((rel) => `  ${rel}`).join('\n')}\n`);
      process.exit(1);
    }
  } else {
    for (const rel of writeAgentSkillSync(root, result)) process.stdout.write(`${result.files.has(rel) ? 'wrote' : 'deleted'} ${rel}\n`);
  }
}
