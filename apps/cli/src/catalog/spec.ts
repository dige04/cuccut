import type { CatalogEditOperations, CatalogListResult, CatalogTool } from '@cuccut/protocol';
import { M } from '../cli-copy.ts';
import { CliError } from '../envelope.ts';
import { buildTree } from './command-tree.ts';

/**
 * `cuccut spec [<name>]` (agent-surface design §4.5): a machine-readable catalog, bare JSON (no envelope). The name can be a tool name (`videos_inspect`), a dotted form (`videos.inspect`) or a command (`videos inspect`); `edits.<op>` gives one operation of `edits apply` (same source as `edits_ops`).
 * Every item carries the interface version.
 */

export type SpecResult =
  | { interfaceVersion: string; tools: CatalogTool[] }
  | { interfaceVersion: string; tool: CatalogTool }
  | { interfaceVersion: string; operation: CatalogEditOperations['families'][number]['operations'][number]; conventions: string };

export function specOf(catalog: CatalogListResult, editOps: CatalogEditOperations | null, name: string | undefined): SpecResult {
  const { interfaceVersion } = catalog;
  if (!name) return { interfaceVersion, tools: catalog.tools };
  const tool = findTool(catalog.tools, name);
  if (tool) return { interfaceVersion, tool };
  const op = /^edits[._ ](.+)$/.exec(name)?.[1];
  if (op && editOps) {
    for (const family of editOps.families) {
      const operation = family.operations.find((candidate) => candidate.type === op);
      if (operation) return { interfaceVersion, operation, conventions: editOps.conventions };
    }
    throw new CliError('INVALID_ARGUMENTS', M.unknownEditOp(op), {
      operations: editOps.families.flatMap((family) => family.operations.map((operation) => operation.type)),
    });
  }
  throw new CliError('INVALID_ARGUMENTS', M.unknownSpec(name));
}

/** Name → tool: tool name, `noun.verb` or `noun verb` (multi-word verbs use `-`). */
export function findTool(tools: readonly CatalogTool[], name: string): CatalogTool | undefined {
  const direct = tools.find((tool) => tool.name === name);
  if (direct) return direct;
  const [noun, verb, extra] = name.split(/[. ]/);
  if (extra !== undefined || !noun) return undefined;
  const tree = buildTree(tools);
  return verb === undefined ? tree.verbs.get(noun)?.tool : tree.nouns.get(noun)?.get(verb)?.tool;
}
