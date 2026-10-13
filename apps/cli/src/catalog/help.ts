import type { CatalogTool, ToolEffect } from '@cuccut/protocol';
import { M } from '../cli-copy.ts';
import { isRecord } from '../envelope.ts';
import { buildTree, needsConfirmation, renderToolNames, summaryOf, type CatalogCommand } from './command-tree.ts';
import { flagSpecs, kebab, soleTextField, type FlagSpec } from './flags.ts';

/**
 * Help (agent-surface design §4.5, §5.7): all derived from the catalog. `cuccut` / `--help` on one screen (no more than 40 lines): workflow, objects, local management, more;
 * `help <command>` gives arguments, effects and examples. Tool descriptions (`description` in the catalog) are the original text for the model and are not translated; titles and hints follow the current language.
 */

/** Order of workflow and noun groups in the one-screen help (new entries added to the catalog go after them). */
const FLOW_ORDER = ['transcribe', 'translate', 'dub', 'download', 'export', 'transcode', 'speak', 'image', 'music'];
const NOUN_ORDER = [
  'videos',
  'documents',
  'edits',
  'captions',
  'assets',
  'jobs',
  'models',
  'space',
  'projects',
  'artifacts',
  'skills',
  'packs',
  'library',
];

/** Line limit for the one-screen help (§5.7). */
export const HELP_MAX_LINES = 40;
const WIDTH = 100;

/** A noun in the admin bucket: the one-screen help lists only its name; `help <name>` lists the subcommands. */
export interface AdminEntry {
  name: string;
  /** Subcommands (`models configure|accounts|…`); if there are none, only the names are listed. */
  verbs?: readonly string[];
  /** Usage text for admin commands (handwritten in `admin/<noun>.ts`); `help <noun>` places it after the derived commands. */
  usage?: string;
}

export function renderMainHelp(tools: readonly CatalogTool[], admin: readonly AdminEntry[]): string {
  const tree = buildTree(tools);
  const out: string[] = [M.helpTagline, ''];

  out.push(M.helpFlows);
  const flows = ordered([...tree.verbs.keys()], FLOW_ORDER);
  const flowWidth = Math.max(...flows.map((name) => name.length)) + 3;
  for (const name of flows) {
    const summary = trimPeriod(summaryOf(tree.verbs.get(name)!.tool.description));
    out.push(`  ${name.padEnd(flowWidth)}${truncate(summary, WIDTH - flowWidth - 2)}`);
  }

  out.push(M.helpObjects);
  const nouns = ordered([...tree.nouns.keys()], NOUN_ORDER);
  const nounWidth = Math.max(...nouns.map((name) => name.length)) + 3;
  for (const noun of nouns) out.push(`  ${noun.padEnd(nounWidth)}${[...tree.nouns.get(noun)!.keys()].join(' · ')}`);

  out.push(M.helpAdmin);
  const adminWords = admin.map((entry) => (entry.verbs?.length ? `${entry.name} ${shortVerbs(entry.verbs)}` : entry.name));
  out.push(...wrap(adminWords, '  ', WIDTH));

  out.push(M.helpMore);
  out.push(`  ${'help <command>'.padEnd(18)}${M.helpMoreHelp}`);
  out.push(`  ${'spec [<name>]'.padEnd(18)}${M.helpMoreSpec}`);
  out.push(`  ${'status'.padEnd(18)}${M.helpMoreStatus}`);
  out.push(`  ${'runtime ensure|status|stop · version'}`);
  out.push(`  ${M.helpGlobalFlags}`, `  ${M.helpJobFlags}`);
  return out.join('\n');
}

/** `models configure|accounts|…`: lists at most four, the rest with an ellipsis. */
function shortVerbs(verbs: readonly string[]): string {
  return verbs.length > 4 ? `${verbs.slice(0, 3).join('|')}|…` : verbs.join('|');
}

function ordered(names: string[], preferred: readonly string[]): string[] {
  const known = preferred.filter((name) => names.includes(name));
  return [...known, ...names.filter((name) => !preferred.includes(name))];
}

function wrap(words: readonly string[], separator: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line}${separator}${word}` : word;
    if (line && displayWidth(next) + 2 > width) {
      lines.push(`  ${line}`);
      line = word;
    } else line = next;
  }
  if (line) lines.push(`  ${line}`);
  return lines;
}

/** Help for a noun group: the verbs and summaries from the catalog, then the subcommands of the same-named noun in the admin bucket. */
export function renderGroupHelp(tools: readonly CatalogTool[], noun: string, admin: AdminEntry | undefined): string | null {
  const group = buildTree(tools).nouns.get(noun);
  if (!group && !admin) return null;
  // Nouns that only have admin commands (`chat`, `settings`, etc.): show their usage directly.
  if (!group && admin?.usage) return admin.usage;
  const out: string[] = [`cuccut ${noun} <command>`, ''];
  if (group) {
    const width = Math.max(...[...group.keys()].map((verb) => verb.length)) + 3;
    for (const [verb, command] of group)
      out.push(`  ${verb.padEnd(width)}${truncate(trimPeriod(summaryOf(command.tool.description)), WIDTH - width - 2)}`);
  }
  if (admin?.usage) out.push('', `${M.helpAdminVerbs}:`, ...admin.usage.split('\n').filter((line) => line.startsWith('  ')));
  else if (admin?.verbs?.length) out.push('', M.helpAdminVerbs, ...wrap(admin.verbs, '   ', WIDTH));
  out.push('', M.helpGroupMore(noun));
  return out.join('\n');
}

/** `help <command>`: usage, effects, description, arguments and examples. `names` is the full list of tool names in the catalog (tool names in descriptions are replaced by commands). */
export function renderCommandHelp(command: CatalogCommand, names: readonly string[] = []): string {
  const { tool } = command;
  const render = (text: string) => renderToolNames(text, names);
  const specs = flagSpecs(tool.inputSchema);
  const positional = tool.positional ? specs.find((spec) => spec.field === tool.positional) : undefined;
  const usage = [`cuccut ${command.display}`];
  if (positional) usage.push(positional.required ? `<${positional.field}>` : `[<${positional.field}>]`);
  if (specs.some((spec) => spec !== positional)) usage.push(M.helpFlagsPlaceholder);
  const out = [usage.join(' '), '', `${tool.title} — ${M.effectLabel(effectText(tool.effect))}`, '', render(tool.description.trim()), ''];

  out.push(M.helpParameters);
  if (specs.length === 0) out.push(`  ${M.helpNoParameters}`);
  const left = specs.map((spec) => flagUsage(spec, spec === positional));
  const width = Math.min(Math.max(...left.map((text) => text.length), 0) + 2, 44);
  specs.forEach((spec, index) => {
    const notes = [spec.required ? M.helpRequired : '', spec.array ? M.helpRepeatable : ''].filter(Boolean).join(', ');
    const description = typeof spec.schema.description === 'string' ? render(spec.schema.description) : '';
    const text = [notes && `(${notes})`, description].filter(Boolean).join(' ');
    const head = `  ${left[index]!}`;
    out.push(head.length + 1 > width + 2 ? `${head}\n${' '.repeat(width + 2)}${text}` : `${head.padEnd(width + 2)}${text}`);
  });
  // Shortcut switches (`cliSwitches`): written as their equivalent flags.
  for (const entry of tool.cliSwitches ?? []) {
    const spec = specs.find((candidate) => candidate.field === entry.field);
    if (spec) out.push(`  ${`--${entry.flag}`.padEnd(width)}= --${spec.flag} ${String(entry.value)}`);
  }
  if (positional) out.push('', M.helpPositionalNote(`<${positional.field}>`, `--${positional.flag}`));

  if (tool.examples.length > 0) {
    out.push('', M.helpExamples);
    for (const example of tool.examples) out.push(`  # ${example.title}`, `  ${exampleCommand(command, example.args)}`);
  }
  out.push('', M.helpCommonFlags, `  ${commonFlags(tool)}`);
  return out.join('\n');
}

function effectText(effect: ToolEffect): string {
  return { query: M.effectQuery, mutation: M.effectMutation, job: M.effectJob, destructive: M.effectDestructive }[effect];
}

function commonFlags(tool: CatalogTool): string {
  const flags = ['--json', '--project <dir>', '--max-bytes <n>', '--result-file <file>', '--no-start'];
  if (tool.effect === 'job') flags.unshift('--no-wait', '--timeout <s>', '--progress jsonl');
  // `jobs wait` takes the same path as the default wait (run.ts), except that there is no “don't wait”.
  else if (tool.name === 'jobs_wait') flags.unshift('--timeout <s>', '--progress jsonl');
  if (needsConfirmation(tool)) flags.unshift('--yes');
  return flags.join('  ');
}

/** How a flag is written: `--document-id <string>`, `--bilingual`, `--kind <audio|video>`, `<video> | --video <string>`. */
function flagUsage(spec: FlagSpec, positional: boolean): string {
  const flag = spec.switch ? `--${spec.flag}${valueAlternative(spec.schema)}` : `--${spec.flag} ${placeholder(spec.schema)}`;
  return positional ? `<${spec.field}> | ${flag}` : flag;
}

/** Other values a switch can take (`--bilingual[=<json>]`). */
function valueAlternative(schema: Record<string, unknown>): string {
  if (!Array.isArray(schema.anyOf)) return '';
  const others = (schema.anyOf as Record<string, unknown>[]).filter((branch) => branch.type !== 'boolean');
  return others.length ? `[=${others.map(placeholder).join('|')}]` : '';
}

function placeholder(schema: Record<string, unknown>): string {
  if (Array.isArray(schema.anyOf)) return (schema.anyOf as Record<string, unknown>[]).map(placeholder).join('|');
  if (schema.const !== undefined) return String(schema.const);
  if (Array.isArray(schema.enum)) return `<${(schema.enum as unknown[]).join('|')}>`;
  switch (schema.type) {
    case 'array':
      return placeholder(isRecord(schema.items) ? schema.items : {});
    case 'object': {
      const properties = isRecord(schema.properties) ? schema.properties : {};
      if ('start' in properties && 'end' in properties) return '<a:b|json>';
      if ('num' in properties && 'den' in properties) return '<n/d|json>';
      const single = soleTextField(schema);
      if (single) return `<${single}|json>`;
      return '<json|@file|->';
    }
    case 'number':
    case 'integer':
      return '<n>';
    case 'boolean':
      return '<true|false>';
    default:
      return '<text>';
  }
}

/** Catalog examples (JSON arguments) written as command lines; commands that need confirmation carry `--yes` (the examples show the form after the user has already agreed). */
export function exampleCommand(command: CatalogCommand, args: Record<string, unknown>): string {
  const parts = ['cuccut', command.display];
  const positional = command.tool.positional;
  const value = positional === undefined ? undefined : args[positional];
  if (positional && value !== undefined) {
    if (Array.isArray(value)) parts.push(...value.map((item) => shellQuote(String(item))));
    else if (typeof value !== 'object') parts.push(shellQuote(String(value)));
  }
  for (const [field, item] of Object.entries(args)) {
    if (field === positional && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) continue;
    const flag = `--${kebab(field)}`;
    const shortcut = command.tool.cliSwitches?.find((entry) => entry.field === field && entry.value === item);
    if (shortcut) parts.push(`--${shortcut.flag}`);
    else if (item === true) parts.push(flag);
    else if (item === false) parts.push(field.startsWith('no') && /^no[A-Z]/.test(field) ? `${flag}=false` : `--no-${kebab(field)}`);
    else if (Array.isArray(item) && item.every((x) => typeof x !== 'object' || x === null))
      for (const x of item) parts.push(flag, shellQuote(String(x)));
    else if (isRange(item)) parts.push(flag, `${item.start}:${item.end}`);
    else if (typeof item === 'object' && item !== null) parts.push(flag, shellQuote(JSON.stringify(item)));
    else parts.push(flag, shellQuote(String(item)));
  }
  if (needsConfirmation(command.tool)) parts.push('--yes');
  return parts.join(' ');
}

function isRange(value: unknown): value is { start: number; end: number } {
  return isRecord(value) && Object.keys(value).length === 2 && typeof value.start === 'number' && typeof value.end === 'number';
}

function shellQuote(text: string): string {
  return /^[\w@%+=:,./-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

function trimPeriod(text: string): string {
  return text.replace(/[。.]$/, '');
}

/** Display width in the terminal: full-width characters count as 2. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += isWide(char.codePointAt(0)!) ? 2 : 1;
  return width;
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

function truncate(text: string, width: number): string {
  if (displayWidth(text) <= width) return text;
  let out = '';
  for (const char of text) {
    if (displayWidth(out + char) + 1 > width) break;
    out += char;
  }
  return `${out}…`;
}
