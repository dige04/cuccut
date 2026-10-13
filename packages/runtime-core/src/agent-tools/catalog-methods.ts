import path from 'node:path';
import { MCP_INTERFACE_VERSION, RpcError, renderCliToolNames, toolCommandName, type CatalogAgentSkill } from '@cuccut/protocol';
import { RcGateway, RcSkills } from '@cuccut/protocol/messages/runtime-core';
import type { TrustedPrincipal } from '../gateway.ts';
import type { RpcHandlers } from '../handlers.ts';
import { AGENT_SKILL_ID, AgentSkillRenderError, renderAgentSkill, resolveBuiltinAgentSkillsDir } from '../skills/agent-skill-renderer.ts';
import { resolveLocalPrincipal } from './local-scope.ts';
import { errorBody, type ToolCatalog, type ToolOutcome } from './tool-catalog.ts';
import { defaultToolRisk } from './tool-scope.ts';

/**
 * Handlers for `catalog.*` (architecture design §3.5, §4.1; command and protocol spec §4.1): hands the agent surface's
 * tool catalog to the CLI through the gateway. The catalog is the Runtime's single `ToolCatalog` (tool groups are routed
 * by principal to `LocalScope` via `ScopeRouter`); this takes its terminal view.
 *
 * Only for `cli` and `desktop` connections: browser (`web`), external-service and `agent` connections are always
 * `forbidden`; the web service's allowlist does not include `catalog.*` either.
 * Tool-level results and rejections are both in the return value (`{ ok }`); a rejection is the same object as the
 * `error` of an MCP tool result (`errorBody`).
 *
 * `catalog.agentSkill` renders the agent guide (`skills/cuccut/`) for the CLI surface, for `cuccut skill install`: the
 * renderer lives in the Runtime, and the CLI still goes only through the Client and the protocol (architecture design
 * §13.1); `{{tool:…}}` is checked against this catalog's terminal view. The directory is re-read on every call.
 */
export function catalogMethods(
  tools: ToolCatalog,
  options: { agentSkillsDir?: () => string | null } = {},
): Pick<RpcHandlers['methods'], 'catalog.list' | 'catalog.call' | 'catalog.agentSkill'> {
  const agentSkillsDir = options.agentSkillsDir ?? (() => resolveBuiltinAgentSkillsDir());
  let names: readonly string[] | null = null;
  const toolNames = () => (names ??= tools.list().map((tool) => tool.name));
  const own = (principal: TrustedPrincipal) => {
    if (principal.kind !== 'cli' && principal.kind !== 'desktop') {
      throw new RpcError('forbidden', RcGateway.catalogLocalOnly());
    }
  };
  return {
    'catalog.list': (_p, principal) => {
      own(principal);
      return {
        interfaceVersion: MCP_INTERFACE_VERSION,
        tools: tools.list().map((tool) => ({ ...tool, risk: defaultToolRisk(tool.name) })),
      };
    },
    // `cwd` and `project` are both absolute paths (schema-checked); the CLI resolves a relative `--project` against cwd before sending.
    'catalog.call': async (p, principal) => {
      own(principal);
      let local;
      try {
        local = await resolveLocalPrincipal(principal, p);
      } catch (error) {
        return { ok: false, error: errorBody(error) };
      }
      const outcome = await tools.invoke(p.name, p.args, local);
      return local.client === 'cli' ? renderForCli(outcome, toolNames()) : outcome;
    },
    'catalog.agentSkill': (_p, principal) => {
      own(principal);
      return agentSkill(agentSkillsDir(), tools);
    },
  };
}

function agentSkill(root: string | null, tools: ToolCatalog): CatalogAgentSkill {
  const sourceDir = root && path.join(root, AGENT_SKILL_ID);
  let files;
  try {
    files = sourceDir ? renderAgentSkill(sourceDir, { face: 'cli', catalog: { tools: tools.list() } }) : null;
  } catch (error) {
    if (error instanceof AgentSkillRenderError) {
      throw new RpcError('conflict', RcSkills.agentSkillRenderFailed({ problem: error.localized }), {
        code: 'AGENT_SKILL_INVALID',
        file: error.file,
        line: error.line,
      });
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') files = null;
    else throw error;
  }
  if (!sourceDir || !files) {
    throw new RpcError('not-found', RcSkills.agentSkillDirNotFound({ dir: `skills/${AGENT_SKILL_ID}` }), {
      code: 'AGENT_SKILL_NOT_FOUND',
      ...(sourceDir ? { path: sourceDir } : {}),
    });
  }
  return {
    interfaceVersion: MCP_INTERFACE_VERSION,
    id: AGENT_SKILL_ID,
    sourceDir,
    files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, content]) => ({ path: file, content })),
  };
}

/**
 * `next` rendered per principal (agent surface design §5.1; command and protocol spec §11.7): tools write `next` with
 * tool names (the MCP spelling); for the CLI, each `<noun>_<verb>` in it becomes `cuccut <noun> <verb>` (multi-word verbs
 * `_` -> `-`). Only names in the catalog are replaced; top-level verbs (`export`, `transcribe`) have the same name on
 * both sides and are often ordinary words, so they are left alone. Only the top-level `next` of a result or error is
 * looked at.
 */
export function renderForCli(outcome: ToolOutcome, names: readonly string[]): ToolOutcome {
  if (outcome.ok) {
    const result = outcome.result;
    if (!isRecord(result) || typeof result.next !== 'string') return outcome;
    return { ok: true, result: { ...result, next: cliNext(result.next, names) } };
  }
  if (typeof outcome.error.next !== 'string') return outcome;
  return { ok: false, error: { ...outcome.error, next: cliNext(outcome.error.next, names) } };
}

/** Replaces tool names in a `next` text with CLI commands. */
export function cliNext(text: string, names: readonly string[]): string {
  return renderCliToolNames(text, names);
}

/** Tool name -> CLI command (without `cuccut`): `videos_import_package` -> `videos import-package`, `export` -> `export`. */
export function cliCommand(name: string): string {
  return toolCommandName(name).display;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
