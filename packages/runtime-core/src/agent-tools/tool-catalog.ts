import { z } from 'zod';
import {
  RpcError,
  capabilityRemedyCommands,
  capabilitySettingsHref,
  isEngineErrorBody,
  localizeText,
  type CapabilityNotConfiguredDetails,
  type CatalogCliSwitch,
  type ToolEffect,
  type ToolSurface,
} from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import type { ToolPrincipal } from './tool-scope.ts';
import { OperationShapeError } from './video-digest.ts';
import { GRANT_NEXT, isGrantErrorDetails } from '../grants/grant-errors.ts';

/**
 * Tool catalog (architecture design §3.5): every tool behind the MCP endpoint. Each tool group (videos, models) only
 * provides the argument schema, description and execution; parsing arguments, logging, and turning errors into a shape
 * the agent can act on all happen here, the same for every group.
 */

export interface ToolDefinition {
  name: string;
  title: string;
  /** The first sentence is a one-line summary (ending with a period; `--help` and the MCP list show only it), followed by the details. */
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  /** Effect: `query` <=> `readOnlyHint`; `destructive` => `destructiveHint`; tools returning a `jobId` are `job`. */
  effect: ToolEffect;
  /** One to three minimal call examples; each `args` must pass the tool's own schema. */
  examples: ReadonlyArray<ToolExample>;
  /** Which surfaces it appears on (tool bridge, MCP service, CLI), listed in full, no defaults. */
  surfaces: ReadonlyArray<ToolSurface>;
  /** Field name for the CLI's single positional argument (usually `video`, `url` or `file`). */
  positional?: string;
  /** CLI shortcut switches (`CatalogTool.cliSwitches`): `--<flag>` means giving `field` this value. */
  cliSwitches?: ReadonlyArray<CatalogCliSwitch>;
}

export interface ToolExample {
  title: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export type ToolInfo = Omit<ToolDefinition, 'name' | 'inputSchema'>;

/** A group of tools. Arguments reaching `dispatch` have already been parsed with `schemas[name]`. */
export interface ToolSet {
  readonly schemas: Readonly<Record<string, z.ZodType>>;
  readonly definitions: Readonly<Record<string, ToolInfo>>;
  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown>;
}

/**
 * A view of the catalog for one kind of principal (§3.5, §4.8): exposes only tools whose `surfaces` include `surface` and
 * that `expose` accepts; hidden tools answer `UNKNOWN_TOOL` just like missing ones; `describe` rewrites the description of
 * individual tools (external descriptions do not mention sessions or working directories).
 */
export interface ToolCatalogView {
  surface?: ToolSurface;
  expose?: (name: string, info: ToolInfo) => boolean;
  describe?: (name: string, info: ToolInfo) => ToolInfo;
}

/** A refusal from the tool layer itself: same shape as engine errors; the agent decides its next step by `code`. */
export class ToolError extends Error {
  readonly code: string;
  readonly extra: Record<string, unknown>;
  constructor(code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

/** The outcome of one call: the tool's result object, or an error for the caller (in the `errorBody` shape). */
export type ToolOutcome = { ok: true; result: unknown } | { ok: false; error: ToolErrorBody };

export type ToolErrorBody = { code: string; message: string } & Record<string, unknown>;

export class ToolCatalog {
  readonly #sets: ToolSet[];
  readonly #log: Logger;
  readonly #parentLog: Logger;
  readonly #view: ToolCatalogView;

  constructor(sets: ToolSet[], log: Logger, view: ToolCatalogView = {}) {
    this.#sets = sets;
    this.#parentLog = log;
    this.#log = log.child('agent-tools');
    this.#view = view;
  }

  /** Another view of the same tool groups (same implementation and scope): for another kind of principal, without building new groups. */
  withView(view: ToolCatalogView): ToolCatalog {
    return new ToolCatalog(this.#sets, this.#parentLog, view);
  }

  list(): ToolDefinition[] {
    return this.#sets.flatMap((set) =>
      Object.keys(set.schemas)
        .filter((name) => this.#exposed(set, name))
        .map((name) => {
          const { $schema: _, ...inputSchema } = z.toJSONSchema(set.schemas[name]!, { io: 'input' }) as Record<string, unknown>;
          const info = set.definitions[name]!;
          return { name, ...(this.#view.describe ? this.#view.describe(name, info) : info), inputSchema };
        }),
    );
  }

  /** The MCP tool result shape: the result or error written as one JSON text. */
  async call(name: string, args: unknown, principal: ToolPrincipal): Promise<ToolResult> {
    const outcome = await this.invoke(name, args, principal);
    return outcome.ok
      ? { content: [{ type: 'text', text: JSON.stringify(outcome.result) }] }
      : { content: [{ type: 'text', text: JSON.stringify({ error: outcome.error }) }], isError: true };
  }

  /** Calls by name: parses arguments, executes, logs; errors become the `errorBody` shape (`catalog.call` hands it to the CLI as is). */
  async invoke(name: string, args: unknown, principal: ToolPrincipal): Promise<ToolOutcome> {
    const started = Date.now();
    try {
      const found = this.#sets.find((s) => Object.hasOwn(s.schemas, name));
      const set = found && this.#exposed(found, name) ? found : undefined;
      if (!set) throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
      const parsed = set.schemas[name]!.safeParse(args ?? {});
      if (!parsed.success) {
        throw new ToolError('INVALID_ARGUMENTS', 'Invalid arguments', {
          issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
      }
      const result = await set.dispatch(name, parsed.data, principal);
      this.#log.info('Tool call', { tool: name, ...callerOf(principal), ms: Date.now() - started });
      return { ok: true, result };
    } catch (error) {
      const body = this.#withInstallHint(errorBody(error));
      if (body.code === 'INTERNAL') this.#log.error('Tool call failed', { tool: name, error: String(error) });
      else this.#log.info('Tool call refused', { tool: name, ...callerOf(principal), code: body.code });
      return { ok: false, error: body };
    }
  }

  /** When the local model is not installed and this catalog exposes `models_install` (the agent in a session): tell it it can download the model first (§6.3). */
  #withInstallHint<T extends { code: string } & Record<string, unknown>>(body: T): T {
    const remedy = body.remedy as { action?: string } | undefined;
    if (body.code !== 'CAPABILITY_NOT_CONFIGURED' || remedy?.action !== 'install-model') return body;
    if (!this.#sets.some((s) => Object.hasOwn(s.schemas, 'models_install') && this.#exposed(s, 'models_install'))) return body;
    return { ...body, next: INSTALL_MODEL_NEXT };
  }

  #exposed(set: ToolSet, name: string): boolean {
    const info = set.definitions[name];
    if (!info) return false;
    if (this.#view.surface && !info.surfaces.includes(this.#view.surface)) return false;
    return this.#view.expose ? this.#view.expose(name, info) : true;
  }
}

/** The caller as logged: session, external service and client, or terminal connection. No tokens. */
function callerOf(principal: ToolPrincipal): Record<string, string> {
  if (principal.kind === 'agent') return { conversationId: principal.conversationId };
  if (principal.kind === 'local') return { client: principal.client, connectionId: principal.connectionId };
  return { serviceId: principal.serviceId, clientId: principal.clientId };
}

/** Capability not configured: the agent relays this to the user and does not try to work around it (§6.2). */
const NOT_CONFIGURED_NEXT =
  'This is configuration the user has to complete in CucCut, not something you can fix: relay hint and commands to the user and ask them to enable and configure the service in the model settings, writing remedy.settingsHref as a Markdown settings link whose text names the capability in the user\'s language (or to run the commands in commands in a terminal), then try again. Do not work around it with shell commands, scripts, ffmpeg, other websites or other providers, and do not look for or fill in API keys yourself.';

/** Local model not installed: downloading the model can be submitted as a prerequisite step (the size is told to the user first, confirmed according to the access mode). */
const INSTALL_MODEL_NEXT =
  'The local model bundle is not installed: you can download it with models_install (the tool first tells the user the size and confirms according to the access mode; for speech synthesis give a synthesis bundle listed in models_capabilities), wait for it to finish with jobs_wait, then submit again (for synthesis, with provider: local and that bundle); or relay hint and commands to the user and ask them to switch to an online service, writing remedy.settingsHref as a Markdown settings link. Do not download models yourself with shell commands, scripts or other websites, and do not look for or fill in API keys yourself.';

/** The error shape for agents: `code` decides the next step; `retryability` / `recovery` / `next` say how to recover. */
export function errorBody(error: unknown): ToolErrorBody {
  if (error instanceof ToolError) return { code: error.code, message: error.message, ...error.extra };
  if (error instanceof OperationShapeError) return { code: 'INVALID_OPERATION', message: error.message, operationIndex: error.index };
  if (error instanceof RpcError) {
    const details = error.details;
    if (isEngineErrorBody(details)) {
      return {
        code: details.code,
        message: localizeText(details.message, details.messageRef),
        retryability: details.retryability,
        ...(details.recovery ? { recovery: localizeText(details.recovery, details.recoveryRef) } : {}),
        ...(details.entityIds.length ? { entityIds: details.entityIds } : {}),
        ...(details.details !== null && details.details !== undefined ? { details: details.details } : {}),
        ...(details.code === 'PROJECT_REVISION_CONFLICT'
          ? { next: 'Re-read with videos_inspect and decide from the new state whether and how to edit' }
          : {}),
        ...(details.code === 'TASK_PROTECTED'
          ? {
              next: 'This content is protected by the user in the task contract (protectedRefs in tasks_contract): the whole edit was not written. Edit again while avoiding it; if it really must change, ask the user to adjust the protection, and do not work around it another way.',
            }
          : {}),
      };
    }
    if (isCapabilityNotConfigured(details)) {
      return {
        code: details.code,
        message: error.message,
        capability: details.capability,
        reason: details.reason,
        ...(details.providerId ? { providerId: details.providerId } : {}),
        remedy: {
          action: details.remedy.action, hint: details.remedy.hint, commands: capabilityRemedyCommands(details),
          settingsHref: capabilitySettingsHref(details.capability),
        },
        next: NOT_CONFIGURED_NEXT,
      };
    }
    // Grants and budgets (§12.5, §7.8): error code, remedy and next step; no switching providers to work around it.
    if (isGrantErrorDetails(details)) {
      const { code, ...rest } = details;
      return { code, message: error.message, ...rest, next: GRANT_NEXT[code] };
    }
    // Submission-time checks against the model description (§6.2): `details` holds the model's limits, passed to the agent as is.
    const extra = isRecord(details) ? details : null;
    if (extra && typeof extra.limit === 'number' && typeof extra.length === 'number') {
      return {
        code: 'INPUT_TOO_LONG',
        message: error.message,
        details: extra,
        next: `The input has ${extra.length} characters and the model takes at most ${extra.limit} per call: split it yourself by sentence or paragraph into pieces of at most ${extra.limit} characters and submit them one by one (one job per piece). The Runtime will not truncate or split it for you.`,
      };
    }
    // No voice given and the model has no default voice, or the model lacks that voice: pick one from the list, or ask the user for a voice ID from their account; do not switch providers.
    const voiceNext =
      extra && Array.isArray(extra.voices)
        ? {
            next:
              (extra.voices as unknown[]).length > 0
                ? 'Pick a voice from details.voices, or ask the user for a voice ID from their provider account; do not switch providers to work around it.'
                : 'This model\'s voices belong to the user\'s provider account: ask the user for a voice ID (voice); do not switch providers to work around it.',
          }
        : {};
    return {
      code: error.code.toUpperCase().replace(/-/g, '_'),
      message: error.message,
      ...(extra ? { details: extra } : {}),
      ...voiceNext,
    };
  }
  return { code: 'INTERNAL', message: 'Internal tool error' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCapabilityNotConfigured(value: unknown): value is CapabilityNotConfiguredDetails {
  return isRecord(value) && value.code === 'CAPABILITY_NOT_CONFIGURED';
}
