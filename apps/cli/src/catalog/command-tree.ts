import { renderCliToolNames, toolCommandName, type CatalogTool } from '@cuccut/protocol';

/**
 * Catalog → command tree (agent-surface design §4.1): the tool name `<noun>_<verb>` is `cuccut <noun> <verb>`, with the `_` in multi-word verbs replaced by `-`
 * (`videos_import_package` → `videos import-package`); a name without `_` is a top-level verb, the same on both sides (`transcribe`). The rule exists in only one place, `toolCommandName` in
 * `@cuccut/protocol` (the Runtime's renderer for `next` and for the instructions also uses it).
 */

export interface CatalogCommand {
  tool: CatalogTool;
  /** Noun group; null for a top-level verb. */
  noun: string | null;
  verb: string;
  /** How it is written on the command line (without `cuccut`): `videos import-package`, `export`. */
  display: string;
}

export interface CommandTree {
  /** Top-level verbs, in catalog order. */
  verbs: Map<string, CatalogCommand>;
  /** Noun group → verbs → commands, in catalog order. */
  nouns: Map<string, Map<string, CatalogCommand>>;
  byTool: Map<string, CatalogCommand>;
}

export function commandOf(tool: CatalogTool): CatalogCommand {
  return { tool, ...toolCommandName(tool.name) };
}

export function buildTree(tools: readonly CatalogTool[]): CommandTree {
  const tree: CommandTree = { verbs: new Map(), nouns: new Map(), byTool: new Map() };
  for (const tool of tools) {
    const command = commandOf(tool);
    tree.byTool.set(tool.name, command);
    if (command.noun === null) tree.verbs.set(command.verb, command);
    else {
      let group = tree.nouns.get(command.noun);
      if (!group) tree.nouns.set(command.noun, (group = new Map()));
      group.set(command.verb, command);
    }
  }
  return tree;
}

export type Lookup =
  | { kind: 'command'; command: CatalogCommand; rest: string[] }
  /** Only a noun was given (or a noun followed by an unknown verb): hand off to the admin bucket, or list this group. */
  | { kind: 'group'; noun: string; verb: string | null; rest: string[] }
  | { kind: 'none' };

/** Finds a command by the first one or two words on the command line. */
export function lookup(tree: CommandTree, argv: readonly string[]): Lookup {
  const [first, second, ...rest] = argv;
  if (!first) return { kind: 'none' };
  const verb = tree.verbs.get(first);
  if (verb) return { kind: 'command', command: verb, rest: argv.slice(1) };
  const group = tree.nouns.get(first);
  if (!group) return { kind: 'none' };
  const command = second === undefined ? undefined : group.get(second);
  if (command) return { kind: 'command', command, rest };
  return { kind: 'group', noun: first, verb: second ?? null, rest };
}

/**
 * Commands that run only after the user confirms (irreversible ones, and `models install`, which reports the size first; agent-surface design §3.3, §4.3): without `--yes` they do not run,
 * and the exit code is 4. Examples in help and the common flags include `--yes` accordingly.
 */
export function needsConfirmation(tool: CatalogTool): boolean {
  return tool.effect === 'destructive' || tool.name === 'models_install';
}

/** The first sentence of the tool description (the `ToolDefinition.description` convention is that the first sentence is a one-line summary). A period directly followed by a letter (`video.db`) does not count as the end of a sentence. */
export function summaryOf(description: string): string {
  const match = /^[\s\S]*?(?:[。！？]|[.!?](?=\s|$))/.exec(description);
  return (match ? match[0] : description).trim();
}

/**
 * Tool names in the description are replaced by commands (`videos_list` → `cuccut videos list`), using the same function the Runtime uses to render `next` for the CLI
 * (`renderCliToolNames` in `@cuccut/protocol`): only names in the catalog that contain `_` are replaced; top-level verbs are the same on both sides and are often ordinary words, so they are left alone.
 */
export function renderToolNames(text: string, names: readonly string[]): string {
  return renderCliToolNames(text, names);
}
