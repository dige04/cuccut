import fs from 'node:fs';
import path from 'node:path';
import { fieldFlagName, toolCommandName, type Localized } from '@cuccut/protocol';
import { RcAgentTools, RcSkills } from '@cuccut/protocol/messages/runtime-core';
import { findRepoDir } from './skill-catalog.ts';
import { parseSkillFrontmatter } from './skill-frontmatter.ts';

/**
 * Renderer for the agent guide (agent surface design §8.6): one source, `skills/cuccut/` (SKILL.md + references/**), two
 * renderings. The `built-in-skills/` directory next to it holds the built-in skills themselves (loaded by `SkillCatalog` and
 * synced into craft copies); it is not a page of the guide and is skipped when reading the directory.
 *
 * - `cli` face: for external agents (Claude Code, Codex, Cursor, Gemini), installed into the host's skills directory by
 *   `cuccut skill install`.
 * - `agent` face: for CucCut's own in-session agents (tool bridge). The SKILL.md body becomes the "how to work" section of
 *   the guidance, and `references/catalog/*.md` and `workflows.md` become built-in skills (`renderAgentGuidance`).
 *
 * Markup (the contract between authors and the renderer; every marker that takes a line must be alone on that line):
 *
 * - Face selection: `<!-- surface: cli -->` … `<!-- /surface -->` (or `agent`), not nested. Rendering keeps this face's
 *   content and drops the other face's block together with its marker lines.
 * - `{{tool:a_b}}`: `cuccut a b` on the CLI face (multi-word verbs `_` → `-`), `a_b` on the tool-bridge face.
 * - `{{arg:camelCase}}`: `--kebab-case` on the CLI face, `camelCase` on the tool-bridge face.
 * - The output of these two is wrapped in backticks (`` `cuccut a b` ``), unless the placeholder already sits in backticks
 *   or a code block.
 * - `{{skill:id}}`: on the CLI face, a link to `references/craft/<id>.md` (path relative to the current file); on the
 *   tool-bridge face, "`` `id` `` (read it with `skills_read`)", which reads naturally after "see", "follow", "as in", in a
 *   table or in a list. When the word "read" comes right before it, the phrase becomes "use `skills_read` to read
 *   `` `id` ``", so "read" is not said twice.
 * - Tools that exist only in sessions and have no CLI command (`SESSION_ONLY_TOOLS`, such as `downloads_save`): on the CLI
 *   face they are replaced with a fallback wording that does not name the tool; bare names in the text (synced from crafts)
 *   are handled like `{{tool:…}}`. The tool-bridge face keeps them as they are.
 * - Relative links between pages: kept as they are on the CLI face (the linked file must exist). The tool-bridge face has no
 *   files to click, so they become references to built-in skills: `[text](references/catalog/x.md)` → "text (read
 *   `cuccut-catalog-x` with `skills_read`)"; likewise `workflows.md` and `conventions.md` (`cuccut-workflows`,
 *   `cuccut-conventions`), and craft copies → the craft's own id. Pages the tool-bridge face does not have (CLI-only pages
 *   such as `start.md` and `mcp.md`) fall back to plain text.
 * - The tool-bridge face does not output `references/craft/`: in-session agents read the local skills with `skills_read`,
 *   not the copies shipped with the guide.
 * - Generated blocks: `<!-- generated: <name> -->` … `<!-- /generated -->`. The sync script (`tools/sync-agent-skill.ts`)
 *   writes their content into the source files; the renderer does not recompute it, it only handles markers and
 *   placeholders inside like any other text, and keeps the marker lines.
 *
 * - Inside code (a code block, or inline code on the same line), `{{…}}` without a `kind:` is not a placeholder but a
 *   template the text is describing (such as `{{hole}}` or `{{ item.x }}` in a Design Component), and is kept as is; in
 *   plain text it still counts as an unknown placeholder.
 *
 * Unknown placeholders, unknown faces or generated blocks, and unclosed or nested markers all throw `AgentSkillRenderError`
 * (with file and line); nothing is silently let through. The name conversion rules exist only once (`toolCommandName` and
 * `fieldFlagName` in `@cuccut/protocol`), the same as the CLI's command tree and flags.
 */

export type AgentSkillFace = 'cli' | 'agent';

/** The guide's skill id, which is also its directory name in the host's skills directory. */
export const AGENT_SKILL_ID = 'cuccut';
export const AGENT_SKILL_ENTRY = 'SKILL.md';
/** Directory of the craft copies (synced from `built-in-skills/<id>/`, §8.3). */
export const AGENT_SKILL_CRAFT_DIR = 'references/craft';
/** Directory of the built-in skills (inside the guide directory): not guide pages; `readAgentSkillDir` skips it. */
export const AGENT_SKILL_BUILTIN_DIR = 'built-in-skills';
/** Names of the generated blocks. */
export const AGENT_SKILL_GENERATED_BLOCKS = ['common-ops', 'error-codes', 'tool-map'] as const;
export type AgentSkillGeneratedBlock = (typeof AGENT_SKILL_GENERATED_BLOCKS)[number];

/** Relative path (`/`-separated) → file content. */
export type AgentSkillFiles = Map<string, string>;

/** Catalog used to check `{{tool:…}}`: the tools this face can see. */
export interface AgentSkillCatalog {
  tools: ReadonlyArray<{ name: string }>;
}

export interface RenderAgentSkillOptions {
  face: AgentSkillFace;
  /** When given, names in `{{tool:…}}` must be in the catalog (the CLI face passes the catalog whose `surfaces` include `cli`, the tool-bridge face the `agent` one). */
  catalog?: AgentSkillCatalog | null;
}

export interface RenderAgentSkillTextOptions extends RenderAgentSkillOptions {
  /** Relative path of the file: errors, `{{skill:…}}` and relative page links are all based on it. */
  file: string;
  /** Known craft ids; when given, `{{skill:…}}` must be one of them. */
  craftIds?: ReadonlySet<string> | null;
  /** All files of the guide; when given, relative links between pages must point at one of them. */
  files?: ReadonlySet<string> | null;
}

export class AgentSkillRenderError extends Error {
  readonly file: string;
  readonly line: number;
  /** The full sentence with file and line (`message` is its text): it travels over the wire with `catalog.agentSkill` errors, and the CLI shows it in its own language. */
  readonly localized: Localized;
  /** The sentence without file and line: used when re-raising at another location (the sync script maps line numbers back to the source file). */
  readonly problem: Localized | string;

  /** `problem` is an entry of the copy catalog (rcSkills); repository tools such as the sync script may also pass plain text. */
  constructor(file: string, line: number, problem: Localized | string) {
    const localized =
      line > 0 ? RcSkills.renderErrorAt({ file, line, message: problem }) : RcSkills.renderErrorIn({ file, message: problem });
    super(localized.text);
    this.name = 'AgentSkillRenderError';
    this.file = file;
    this.line = line;
    this.localized = localized;
    this.problem = problem;
  }
}

const SURFACE_OPEN = /^\s*<!--\s*surface:\s*(\S+?)\s*-->\s*$/;
const SURFACE_CLOSE = /^\s*<!--\s*\/surface\s*-->\s*$/;
const GENERATED_OPEN = /^\s*<!--\s*generated:\s*(\S+?)\s*-->\s*$/;
const GENERATED_CLOSE = /^\s*<!--\s*\/generated\s*-->\s*$/;
/**
 * Placeholder; a "read" right before it is captured too (`{{skill:…}}` on the tool-bridge face absorbs it, other placeholders
 * put it back unchanged). Words that merely end in "read" ("spread", "thread") do not count.
 */
const PLACEHOLDER = /((?<![A-Za-z])[Rr]ead\s+)?\{\{([^{}\n]*)\}\}/g;
const TOOL_NAME = /^[a-z]+(?:_[a-z]+)*$/;
const ARG_NAME = /^[a-z][A-Za-z0-9]*$/;
const SKILL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FENCE = /^\s*(```|~~~)/;
/** Relative link to a `.md` file (an anchor is allowed): `[text](target)`. */
const MD_LINK = /\[([^\]\n]+)\]\(([^()\s]+?\.md)(#[^()\s]*)?\)/g;
const FACES: readonly string[] = ['cli', 'agent'];

/** How a tool that exists only in sessions, with no CLI command, is written on the CLI face. */
export interface SessionOnlyToolFallback {
  /** The usual whole-sentence wording (the tool name as a bare name, inline code or `{{tool:…}}`) → replaced with `replacement`. */
  phrase: RegExp;
  replacement: string;
  /** Other whole-sentence wordings for the same tool, each with its own replacement; applied before `phrase`. */
  morePhrases?: readonly { phrase: RegExp; replacement: string }[];
  /** The tool name anywhere else is replaced with this. */
  text: string;
}

/**
 * CLI-face fallbacks for tools that in-session agents have but the terminal does not (`surfaces` include `agent` but not
 * `cli`): external agents do not have the tool and should not read its name. Only wordings that really occur in crafts and
 * the guide are registered; anything else is still reported by the sync script.
 */
const FONT_FALLBACK =
  'there is no command in the terminal to import fonts into a deck: copy the fonts of the design system installed in the deck ' +
  'to `ds/<folder>/fonts/<file>` (paths contain only letters, digits and `._/-`) and set `src` to ' +
  '`project/ds/<folder>/fonts/<file>`; use Google Fonts or a system font for the others, and say so at delivery.';
export const SESSION_ONLY_TOOLS: Readonly<Record<string, SessionOnlyToolFallback>> = {
  // A session does not always belong to a project, so finished files go into the downloads directory for the user to see; in
  // the terminal the file is already in the user's own directory, so just give the path.
  downloads_save: {
    phrase: new RegExp(
      `put [^,.;\\n]*? in the downloads directory with\\s*${toolNamePattern('downloads_save')}(?: and tell the user the \`?path\`? it returns)?`,
      'g',
    ),
    replacement: "tell the user the file's path (the terminal has no downloads directory step: the file is where you wrote it)",
    text: "hand the file to the user (in the terminal, tell the user the file's path)",
  },
  // Checking slides (skills/slides) and importing images and fonts exist only in sessions; in crafts each is one step, and the
  // whole step is replaced from "call" or "import" to the end of the line.
  slides_check: {
    phrase: new RegExp(`[Cc]all\\s*${toolNamePattern('slides_check')}[^\\n]*`, 'g'),
    replacement:
      'There is no check command in the terminal: check each slide\'s tags, styles and image addresses yourself against ' +
      '`references/format.md`, confirm with the estimates in `references/design.md` that everything fits, then check that ' +
      '`order`, `sections` and `cover` in `deck.json` all point at existing slides and that `slides/` has no files outside `order`.',
    text: 'the slides check (only in CucCut sessions)',
  },
  slides_import_asset: {
    phrase: new RegExp(`import each (?:one|logo and image)[^\\n]*?with\\s*${toolNamePattern('slides_import_asset')}[^\\n]*`, 'g'),
    replacement:
      'there is no command in the terminal to import images into a deck: leave images out of the slides for now, and at ' +
      'delivery say which slides should get which images.',
    // Fonts (step 4, "Fonts" in format.md, design-system.md): the editor also accepts font files of the design system
    // installed in the deck, project/ds/….
    morePhrases: [
      {
        phrase: new RegExp(`Import font files ([^\\n]*?) one by one with\\s*${toolNamePattern('slides_import_asset')}[^\\n]*`, 'g'),
        replacement: `Font files $1: ${FONT_FALLBACK}`,
      },
      {
        phrase: new RegExp(`Import each font that has a file ([^\\n]*?) with\\s*${toolNamePattern('slides_import_asset')}[^\\n]*`, 'g'),
        replacement: `Fonts that have a file $1: ${FONT_FALLBACK}`,
      },
      {
        phrase: new RegExp(`import each with\\s*${toolNamePattern('slides_import_asset')},?\\s*and set \`src\`[^\\n]*`, 'g'),
        replacement: `but ${FONT_FALLBACK}`,
      },
    ],
    text: 'importing images and fonts (only in CucCut sessions)',
  },
  // Checking designs (skills/design) and importing assets also exist only in sessions: the check sentence of step 6 of "New"
  // and the import sentence of step 3 are replaced whole.
  design_check: {
    phrase: new RegExp(
      `Then run\\s*${toolNamePattern('design_check')}\\s*on the design,[^\\n]*?only then does the design card appear in the thread\\.`,
      'g',
    ),
    replacement:
      'There is no design check in the terminal, and no design card: check each file yourself against `references/format.md` ' +
      '(every tag closed, every attribute quoted, the `support.js` line at the head unchanged, `boards` and `order` pointing ' +
      'at existing files).',
    text: 'the design check (only in CucCut sessions)',
  },
  design_import_asset: {
    phrase: new RegExp(`import it with\\s*${toolNamePattern('design_import_asset')}\\s*\\([^)\\n]*\\)\\s*→[^\\n]*?or \`@font-face\`\\.`, 'g'),
    replacement:
      'there is no command in the terminal to import it into the design: leave it out for now (replace images with labeled ' +
      'placeholders), and say which files this design needs.',
    text: 'importing assets (only in CucCut sessions)',
  },
  // Design systems (skills/design-system): the check sentence of step 3 of "Creating" and the two tool notes under "Calls"
  // are replaced whole; in the terminal, uploading becomes copying as files (the other way of storing the original allows).
  design_system_check: {
    phrase: new RegExp(
      `(?:Then run\\s*${toolNamePattern('design_system_check')}\\s*on the design system,[^\\n]*?only then does the design system card appear in the thread\\.|` +
        `${toolNamePattern('design_system_check')}\\s*\\(\`path\` = the design system's directory\\)[^\\n]*?the design system card appears in the thread\\.)`,
      'g',
    ),
    replacement:
      'There is no design system check in the terminal, and no design system card: check each file yourself against ' +
      '`references/format.md` (the index\'s marker and fields, every family in `tokens.json` written as a list, every record ' +
      'and every `/_blob/<id>` pointing at an existing file).',
    text: 'the design system check (only in CucCut sessions)',
  },
  design_system_import_asset: {
    phrase: new RegExp(`${toolNamePattern('design_system_import_asset')}\\s*\\(\`system\`[^\\n]*?the index is still written last\\.`, 'g'),
    replacement:
      'Uploading is not possible in the terminal: copy each image, video and PDF as a file to `assets/<Group>/<file>` ' +
      '(`format.md`: stored "either as files or as uploads"), write no `files` record, and add it to its group\'s `order`; ' +
      'keep every record the design system already has, and write no record without a file behind it.',
    text: 'uploading assets (only in CucCut sessions)',
  },
};

/** The ways a tool name is written in the text: bare name, inline code, `{{tool:…}}`. */
function toolNamePattern(name: string): string {
  return `(?:\\{\\{\\s*tool:\\s*${name}\\s*\\}\\}|\`${name}\`|(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_]))`;
}

/** CLI face: session-only tools are replaced with their fallback wording (whole sentences first, then the remaining names). */
export function renderSessionOnlyTools(line: string): string {
  let out = line;
  for (const [name, fallback] of Object.entries(SESSION_ONLY_TOOLS)) {
    for (const more of fallback.morePhrases ?? []) out = out.replace(more.phrase, more.replacement);
    out = out.replace(fallback.phrase, fallback.replacement).replace(new RegExp(toolNamePattern(name), 'g'), fallback.text);
  }
  return out;
}

/**
 * Reads a guide directory: every file (except dot files and the top-level `built-in-skills/`), with `/`-separated relative
 * paths, sorted. Throws on symbolic links in the directory, so nothing outside it is read.
 */
export function readAgentSkillDir(dir: string): AgentSkillFiles {
  const files: AgentSkillFiles = new Map();
  const walk = (abs: string, rel: string) => {
    const entries = fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || (!rel && entry.name === AGENT_SKILL_BUILTIN_DIR)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(abs, entry.name);
      if (entry.isSymbolicLink()) throw new AgentSkillRenderError(childRel, 0, RcSkills.agentSkillNoSymlinks());
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile()) files.set(childRel, fs.readFileSync(childAbs, 'utf8'));
    }
  };
  walk(dir, '');
  return files;
}

/** Renders the whole guide into a file set of the same shape. `.md` files go through the markup; other files are kept as they are. */
export function renderAgentSkill(source: string | AgentSkillFiles, options: RenderAgentSkillOptions): AgentSkillFiles {
  const files = typeof source === 'string' ? readAgentSkillDir(source) : source;
  if (!files.has(AGENT_SKILL_ENTRY)) {
    throw new AgentSkillRenderError(AGENT_SKILL_ENTRY, 0, RcSkills.agentSkillNoEntry({ file: AGENT_SKILL_ENTRY }));
  }
  const craftIds = craftIdsOf(files);
  const known = new Set(files.keys());
  const out: AgentSkillFiles = new Map();
  for (const [file, text] of files) {
    if (options.face === 'agent' && file.startsWith(`${AGENT_SKILL_CRAFT_DIR}/`)) continue;
    out.set(file, file.endsWith('.md') ? renderAgentSkillText(text, { ...options, file, craftIds, files: known }) : text);
  }
  return out;
}

/**
 * The craft copies already in the guide (`references/craft/<id>.md`, where the id is a lowercase hyphenated name; notes such
 * as `README.md` do not count); null when there are none (then `{{skill:…}}` is not checked).
 */
export function craftIdsOf(files: AgentSkillFiles | Iterable<string>): Set<string> | null {
  const prefix = `${AGENT_SKILL_CRAFT_DIR}/`;
  const names = files instanceof Map ? [...files.keys()] : [...(files as Iterable<string>)];
  const ids = names
    .filter((file) => file.startsWith(prefix) && file.endsWith('.md') && !file.slice(prefix.length).includes('/'))
    .map((file) => file.slice(prefix.length, -'.md'.length))
    .filter((id) => SKILL_ID.test(id));
  return ids.length ? new Set(ids) : null;
}

/** Renders one Markdown file. The craft sync script also uses it on the craft pages it composes. */
export function renderAgentSkillText(text: string, options: RenderAgentSkillTextOptions): string {
  const { face, file } = options;
  const known = options.catalog ? new Set(options.catalog.tools.map((tool) => tool.name)) : null;
  const lines = text.split('\n');
  const out: string[] = [];
  let surface: { face: string; line: number } | null = null;
  let generated: { name: string; line: number; insideSurface: boolean } | null = null;
  let fence: string | null = null;

  lines.forEach((line, index) => {
    const n = index + 1;
    const fail = (message: Localized): never => {
      throw new AgentSkillRenderError(file, n, message);
    };
    const visible = !surface || surface.face === face;

    const surfaceOpen = SURFACE_OPEN.exec(line);
    if (surfaceOpen) {
      if (surface) fail(RcSkills.surfaceNested({ line: surface.line }));
      if (!FACES.includes(surfaceOpen[1]!)) fail(RcSkills.unknownSurface({ face: surfaceOpen[1]! }));
      surface = { face: surfaceOpen[1]!, line: n };
      return;
    }
    if (SURFACE_CLOSE.test(line)) {
      if (!surface) fail(RcSkills.extraSurfaceClose());
      if (generated?.insideSurface) fail(RcSkills.generatedCrossesSurfaceClose({ line: generated.line }));
      surface = null;
      return;
    }
    const generatedOpen = GENERATED_OPEN.exec(line);
    if (generatedOpen) {
      if (generated) fail(RcSkills.generatedNested({ line: generated.line }));
      if (!(AGENT_SKILL_GENERATED_BLOCKS as readonly string[]).includes(generatedOpen[1]!)) {
        fail(
          RcSkills.unknownGenerated({
            name: generatedOpen[1]!,
            names: AGENT_SKILL_GENERATED_BLOCKS.join(RcAgentTools.listSeparator().text),
          }),
        );
      }
      generated = { name: generatedOpen[1]!, line: n, insideSurface: surface !== null };
      if (visible) out.push(line);
      return;
    }
    if (GENERATED_CLOSE.test(line)) {
      if (!generated) fail(RcSkills.extraGeneratedClose());
      if (generated!.insideSurface !== (surface !== null)) fail(RcSkills.generatedCrossesSurface({ line: generated!.line }));
      generated = null;
      if (visible) out.push(line);
      return;
    }
    if (!visible) return;
    const fenceMark = FENCE.exec(line)?.[1];
    if (fenceMark && (!fence || fence === fenceMark)) {
      fence = fence ? null : fenceMark;
      out.push(line);
      return;
    }
    out.push(renderPlaceholders(line, n, options, known, fence !== null));
  });

  if (surface) throw new AgentSkillRenderError(file, (surface as { line: number }).line, RcSkills.surfaceUnclosed());
  if (generated) throw new AgentSkillRenderError(file, (generated as { line: number }).line, RcSkills.generatedUnclosed());
  return out.join('\n');
}

function renderPlaceholders(
  line: string,
  n: number,
  options: RenderAgentSkillTextOptions,
  known: ReadonlySet<string> | null,
  inFence: boolean,
): string {
  const { face, file } = options;
  const fail = (message: Localized): never => {
    throw new AgentSkillRenderError(file, n, message);
  };
  if (face === 'cli' && !inFence) {
    const fallback = renderSessionOnlyTools(line);
    if (fallback !== line) return renderPlaceholders(fallback, n, options, known, inFence);
  }
  const code = (text: string, offset: number) => (inFence || insideInlineCode(line, offset) ? text : `\`${text}\``);
  const linked = inFence ? line : renderLinks(line, n, options);
  if (linked !== line) return renderPlaceholders(linked, n, { ...options, files: null }, known, inFence);
  const rendered = line.replace(PLACEHOLDER, (match, lead: string | undefined, inner: string, offset: number) => {
    const whole = lead ? match.slice(lead.length) : match;
    const at = offset + (lead?.length ?? 0);
    const colon = inner.indexOf(':');
    const kind = colon < 0 ? inner : inner.slice(0, colon);
    const value = colon < 0 ? '' : inner.slice(colon + 1).trim();
    switch (kind.trim()) {
      case 'tool': {
        if (!TOOL_NAME.test(value)) fail(RcSkills.badToolName({ placeholder: whole }));
        if (known && !known.has(value)) fail(RcSkills.toolNotInCatalog({ placeholder: whole, face }));
        return (lead ?? '') + code(face === 'cli' ? `cuccut ${toolCommandName(value).display}` : value, at);
      }
      case 'arg': {
        if (!ARG_NAME.test(value)) fail(RcSkills.badArgName({ placeholder: whole }));
        return (lead ?? '') + code(face === 'cli' ? `--${fieldFlagName(value)}` : value, at);
      }
      case 'skill': {
        if (!SKILL_ID.test(value)) fail(RcSkills.badCraftId({ placeholder: whole }));
        if (options.craftIds && !options.craftIds.has(value)) fail(RcSkills.craftNotFound({ placeholder: whole, dir: AGENT_SKILL_CRAFT_DIR }));
        if (face === 'agent') {
          if (!lead) return `\`${value}\` (read it with \`skills_read\`)`;
          return `${lead.startsWith('R') ? 'Use' : 'use'} \`skills_read\` to read \`${value}\``;
        }
        const target = `${AGENT_SKILL_CRAFT_DIR}/${value}.md`;
        return `${lead ?? ''}[${value}](${path.posix.relative(path.posix.dirname(file), target)})`;
      }
      default:
        // Template holes in code (`{{hole}}`) are kept as they are, and a preceding "read" is put back unchanged.
        if (colon < 0 && (inFence || insideInlineCode(line, at))) return match;
        return fail(RcSkills.unknownPlaceholder({ placeholder: whole }));
    }
  });
  if (line.replace(PLACEHOLDER, '').includes('{{')) fail(RcSkills.placeholderUnclosed());
  return rendered;
}

/** Whether `offset` is inside inline code (an odd number of backticks before it). */
function insideInlineCode(line: string, offset: number): boolean {
  let ticks = 0;
  for (let i = 0; i < offset; i++) if (line[i] === '`') ticks++;
  return ticks % 2 === 1;
}

/**
 * Relative links between pages. The CLI face keeps them and only checks that the target exists; the tool-bridge face rewrites
 * them into built-in skill references, and pages that face does not have fall back to plain text. Links in inline code are
 * left alone.
 */
function renderLinks(line: string, n: number, options: RenderAgentSkillTextOptions): string {
  const { face, file, files } = options;
  return line.replace(MD_LINK, (whole, text: string, target: string, _anchor: string | undefined, offset: number) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/') || insideInlineCode(line, offset)) return whole;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
    if (files && !files.has(resolved)) throw new AgentSkillRenderError(file, n, RcSkills.linkTargetMissing({ link: whole, target: resolved }));
    if (face === 'cli') return whole;
    const id = agentPageId(resolved);
    return id ? `${text} (read \`${id}\` with \`skills_read\`)` : text;
  });
}

/** The built-in skill id of a guide file on the tool-bridge face; null when that face does not have the page. */
export function agentPageId(file: string): string | null {
  const catalog = /^references\/catalog\/([^/]+)\.md$/.exec(file);
  if (catalog) return `cuccut-catalog-${catalog[1]}`;
  if (file === 'references/workflows.md') return 'cuccut-workflows';
  if (file === 'references/conventions.md') return 'cuccut-conventions';
  const craft = new RegExp(`^${AGENT_SKILL_CRAFT_DIR}/([^/]+)\\.md$`).exec(file);
  if (craft && SKILL_ID.test(craft[1]!)) return craft[1]!;
  return null;
}

/**
 * Number of list items under the "Hard rules" heading (§8.6: both faces render the same number of hard rules). The heading
 * is the one at any level that contains "Hard rules"; only top-level `-`, `*` and `1.` items count, up to the next heading
 * of the same or a higher level. 0 when there is no such heading.
 */
export function countHardRules(rendered: string): number {
  const lines = rendered.split('\n');
  const start = lines.findIndex((line) => /^#{1,6}\s+.*\bHard rules\b/i.test(line));
  if (start < 0) return 0;
  const level = /^(#+)/.exec(lines[start]!)![1]!.length;
  let count = 0;
  for (const line of lines.slice(start + 1)) {
    const heading = /^(#{1,6})\s/.exec(line);
    if (heading && heading[1]!.length <= level) break;
    if (/^(?:[-*+]|\d+[.)])\s+\S/.test(line)) count++;
  }
  return count;
}

/** One page in built-in skill form (tool-bridge face): one each for `references/catalog/*.md`, `workflows.md` and `conventions.md`. */
export interface AgentSkillPage {
  /** `cuccut-catalog-media`, `cuccut-workflows`, `cuccut-conventions`. */
  id: string;
  /** Relative path of the source file in the guide (`references/catalog/media.md`). */
  file: string;
  name: string;
  description: string;
  /** The body without front matter and generated-block markers. */
  body: string;
}

export interface AgentGuidance {
  /** The SKILL.md body (without front matter), used as the "how to work" section of the session guidance. */
  guidance: string;
  pages: AgentSkillPage[];
}

/**
 * Tool-bridge face: the SKILL.md body is rendered into the "how to work" section of the session guidance, and
 * `references/catalog/*.md`, `references/workflows.md` and `references/conventions.md` into built-in skill form (ids from
 * `agentPageId`, matching the rewritten links on that face). A page's `name` / `description` come from its front matter, or
 * without front matter from the first `#` heading and the first paragraph after it. Pages whose body is empty on the
 * tool-bridge face (the whole page is CLI-only, such as `catalog/web.md`) are not registered; throws
 * `AgentSkillRenderError` when the guidance or another page references one.
 */
export function renderAgentGuidance(source: string | AgentSkillFiles, catalog?: AgentSkillCatalog | null): AgentGuidance {
  const rendered = renderAgentSkill(source, { face: 'agent', catalog: catalog ?? null });
  const guidance = cleanBody(splitFrontmatter(rendered.get(AGENT_SKILL_ENTRY)!, AGENT_SKILL_ENTRY).body);
  const pages: AgentSkillPage[] = [];
  /** Pages whose body is empty on the tool-bridge face (the whole page is CLI-only): not registered as guide pages. */
  const skipped: string[] = [];
  const catalogPages = [...rendered.keys()].filter((file) => /^references\/catalog\/[^/]+\.md$/.test(file)).sort();
  const others = ['references/workflows.md', 'references/conventions.md'].filter((file) => rendered.has(file));
  for (const file of [...catalogPages, ...others]) {
    const id = agentPageId(file)!;
    const { fields, body } = splitFrontmatter(rendered.get(file)!, file);
    const text = cleanBody(body);
    if (!hasBody(text)) {
      skipped.push(id);
      continue;
    }
    const name = fields.get('name') || firstHeading(text) || id;
    const description = fields.get('description') || firstParagraph(text);
    pages.push({ id, file, name, description, body: text });
  }
  // Skipped pages cannot be read on the tool-bridge face: the guidance and other pages must not reference them (links to them belong in the cli face).
  for (const [file, text] of [[AGENT_SKILL_ENTRY, guidance] as const, ...pages.map((page) => [page.file, page.body] as const)]) {
    const dangling = skipped.find((id) => text.includes(`\`${id}\``));
    if (dangling)
      throw new AgentSkillRenderError(file, 0, RcSkills.cliOnlyPageLink({ page: dangling }));
  }
  return { guidance, pages };
}

/** Whether there is body text besides headings and blank lines. A page wrapped whole in `<!-- surface: cli -->` keeps only its front matter (and headings) on the tool-bridge face. */
function hasBody(text: string): boolean {
  return text.split('\n').some((line) => line.trim() !== '' && !/^#{1,6}\s/.test(line));
}

function splitFrontmatter(text: string, file: string): { fields: Map<string, string>; body: string } {
  if (!/^﻿?---\s*\n/.test(text)) return { fields: new Map(), body: text };
  const parsed = parseSkillFrontmatter(text);
  if (!parsed.ok) throw new AgentSkillRenderError(file, 0, parsed.problem);
  return { fields: parsed.fields, body: parsed.body };
}

/** Drops generated-block marker lines (not needed in prompts) and trims leading and trailing blank lines. */
function cleanBody(body: string): string {
  return body
    .split('\n')
    .filter((line) => !GENERATED_OPEN.test(line) && !GENERATED_CLOSE.test(line))
    .join('\n')
    .trim();
}

function firstHeading(text: string): string {
  return /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? '';
}

function firstParagraph(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).map((block) => block.trim());
  const paragraph = paragraphs.find((block) => block && !block.startsWith('#') && !block.startsWith('<!--') && !block.startsWith('|'));
  return paragraph ? paragraph.replace(/\s*\n\s*/g, ' ') : '';
}

/**
 * Finds the guide's root directory (the one containing `cuccut/`): `CUCCUT_AGENT_SKILLS_DIR` → the packaged
 * `<resources>/skills` (Electron's `process.resourcesPath`, then each of `resourceDirs`: the CLI passes the resource
 * directories of the installed CucCut app) → `skills/` at the repository root, searched upward from this module. Same order
 * as `resolveBuiltinSkillsDir`; null when none exists.
 */
export function resolveBuiltinAgentSkillsDir(env: NodeJS.ProcessEnv = process.env, resourceDirs: readonly string[] = []): string | null {
  if (env.CUCCUT_AGENT_SKILLS_DIR) return env.CUCCUT_AGENT_SKILLS_DIR;
  const electron = (process as { resourcesPath?: string }).resourcesPath;
  for (const resources of [...(electron ? [electron] : []), ...resourceDirs]) {
    const bundled = path.join(resources, 'skills');
    if (isDirectory(bundled)) return bundled;
  }
  return findRepoDir('skills');
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
