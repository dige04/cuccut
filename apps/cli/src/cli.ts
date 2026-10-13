import fs from 'node:fs';
import {
  RpcError,
  processLanguageTags,
  resolveLanguage,
  setLocale,
  type CatalogEditOperations,
  type CatalogListResult,
} from '@cuccut/protocol';
import { M } from './cli-copy.ts';
import { CliError, EXIT, Output, type ExitCode } from './envelope.ts';
import { buildTree, lookup } from './catalog/command-tree.ts';
import { extractGlobals, processInput, parseToolArgs, type GlobalFlags, type InputSource } from './catalog/flags.ts';
import { renderCommandHelp, renderGroupHelp, renderMainHelp, type AdminEntry } from './catalog/help.ts';
import { runTool } from './catalog/run.ts';
import { SNAPSHOT_COMMAND, loadSnapshot } from './catalog/snapshot.ts';
import { specOf } from './catalog/spec.ts';
import { status, version } from './meta.ts';
import { connectRuntime, findRuntime, openClient, runtimeHome, type Session } from './runtime/connection.ts';
import { runtimeCommand } from './runtime/runtime-command.ts';

/**
 * Dispatch for `cuccut` (agent-surface design §4, §5): meta commands → admin bucket → commands derived from the catalog.
 *
 * - Meta commands: `help`, `spec`, `version`, `status`, `runtime`, and the case with no command or with `--help`.
 * - Admin bucket (§7): handwritten commands for humans only, matched exactly by noun and subcommand (`models configure`); checked before derived commands.
 * - The rest follow the catalog: connect to the Runtime (starting it if necessary), find the command according to `catalog.list`, parse the arguments, and execute.
 */

/** Admin bucket: the name is for help; `handles` decides whether a command belongs to it; `run` executes it (receives all arguments from the command line). */
export interface AdminBucket {
  entries: readonly AdminEntry[];
  /** `words` are the words on the command line with flags removed (`['models', 'configure', …]`). */
  handles(words: readonly string[]): boolean;
  run(argv: readonly string[], context: AdminContext): Promise<ExitCode>;
}

export interface AdminContext {
  output: Output;
  globals: GlobalFlags;
  home: string;
  cwd: string;
  /** Environment variables for this call (in tests replaced with a temporary HOME and host config directory). */
  env: NodeJS.ProcessEnv;
}

export interface CliIo {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: NodeJS.WritableStream & { isTTY?: boolean };
  stderr?: NodeJS.WritableStream & { isTTY?: boolean };
  input?: InputSource;
}

const META = new Set(['help', 'spec', 'version', 'status', 'runtime']);

function isMeta(word: string): word is 'help' | 'spec' | 'version' | 'status' | 'runtime' {
  return META.has(word);
}

/** Arguments of `status`: only `--full` (includes all providers and models for each capability, and details of local model packages). */
function statusArgs(tail: readonly string[]): boolean {
  for (const token of tail) {
    if (token === '--full') continue;
    const flag = token.startsWith('-');
    throw new CliError(
      'INVALID_ARGUMENTS',
      flag ? M.unknownFlag(token, 'status') : M.unknownCommand(`status ${token}`),
      flag ? { flag: token } : {},
    );
  }
  return tail.length > 0;
}

export async function runCli(argv: readonly string[], admin: AdminBucket, io: CliIo = {}): Promise<ExitCode> {
  setLocale(resolveLanguage(null, processLanguageTags()));
  const env = io.env ?? process.env;
  const home = runtimeHome(env);
  const cwd = fs.realpathSync(io.cwd ?? process.cwd());
  let output = new Output({ stdout: io.stdout, stderr: io.stderr });
  let session: Session | null = null;
  try {
    let parsed: ReturnType<typeof extractGlobals> | null = null;
    let parseError: unknown = null;
    try {
      parsed = extractGlobals(argv);
    } catch (error) {
      parseError = error;
    }
    // The admin bucket parses flags itself (it has same-named flags such as `--yes` and `--out`, with their own meanings).
    const words = (parsed?.rest ?? argv).filter((token) => !token.startsWith('-'));
    if (words.length > 0 && !META.has(words[0]!) && admin.handles(words)) {
      const globals = extractGlobals(argv.filter((token) => token === '--json' || token === '--no-json')).globals;
      output = new Output({ json: globals.json, stdout: io.stdout, stderr: io.stderr });
      return await admin.run(argv, { output, globals, home, cwd, env });
    }
    if (!parsed) throw parseError;

    const { globals, rest } = parsed;
    output = new Output({ json: globals.json, stdout: io.stdout, stderr: io.stderr });
    const [first, ...tail] = rest;

    if (first === undefined || first === 'help') {
      const target = first === 'help' ? tail : [];
      return await help(output, home, cwd, admin, target);
    }
    // `--help` is help on any command; meta commands (`runtime --help`, `spec --help`) too (§4.5).
    if (globals.help) return await help(output, home, cwd, admin, rest);
    if (first === 'spec') {
      if (tail.length > 1) throw new CliError('INVALID_ARGUMENTS', M.unknownSpec(tail.join(' ')));
      return await spec(output, home, cwd, tail[0]);
    }
    if (first === 'version') return await version(output, home);
    if (first === 'runtime') return await runtimeCommand(output, home, tail, globals.noStart);

    // When no Runtime is running, commands are looked up from the snapshot first: a mistyped command (including an unknown verb after a known noun) does not need a Runtime started for this, and neither does listing the group when only a noun is given.
    // If one is running, ask it (when the snapshot is stale, it takes precedence), without starting one.
    const snapshot = first === 'status' ? null : loadSnapshot();
    if (snapshot && !findRuntime(home)) {
      const known = lookup(buildTree(snapshot.tools), rest);
      if (known.kind === 'none' || (known.kind === 'group' && known.verb !== null)) {
        throw new CliError('UNKNOWN_COMMAND', M.unknownCommand(rest.slice(0, 2).join(' ')));
      }
      if (known.kind === 'group') return await help(output, home, cwd, admin, [known.noun]);
    }
    // `status` only accepts `--full`; unknown options are rejected before the Runtime is started.
    const statusFull = first === 'status' && statusArgs(tail);
    // `status --no-start`: only looks at the status; not running is also an answer.
    if (first === 'status' && globals.noStart && !findRuntime(home)) {
      return output.success({ runtime: { running: false, home } }, 'cuccut runtime ensure');
    }

    session = await connectRuntime({ home, start: !globals.noStart });
    output.runtimeStarted = session.started;
    if (first === 'status') return await status(output, session, cwd, { full: statusFull });

    const found = lookup(buildTree(session.catalog.tools), rest);
    if (found.kind !== 'command') {
      if (found.kind === 'group' && found.verb === null)
        return output.text(renderGroupHelp(session.catalog.tools, found.noun, adminEntry(admin, found.noun)) ?? '');
      throw new CliError('UNKNOWN_COMMAND', M.unknownCommand(rest.slice(0, 2).join(' ')));
    }
    const input = io.input ?? processInput(cwd);
    const args = await parseToolArgs(found.command, found.rest, globals, input);
    return await runTool({ session, command: found.command, args, globals, cwd, output });
  } catch (error) {
    return fail(output, error);
  } finally {
    session?.client.close();
  }
}

/** Error → failure envelope. */
function fail(output: Output, error: unknown): ExitCode {
  if (error instanceof CliError) return output.failure(error.body());
  if (error instanceof RpcError) {
    const details = (typeof error.details === 'object' && error.details !== null ? error.details : {}) as Record<string, unknown>;
    const code = typeof details.code === 'string' ? details.code : error.code.toUpperCase().replace(/-/g, '_');
    return output.failure({ ...details, code, message: error.message });
  }
  return output.failure({ code: 'INTERNAL', message: error instanceof Error ? error.message : String(error) }, EXIT.failed);
}

function adminEntry(admin: AdminBucket, name: string): AdminEntry | undefined {
  return admin.entries.find((entry) => entry.name === name);
}

/**
 * The catalog used by `help` and `spec` (architecture design §3.6): when a Runtime is running, its `catalog.list` takes precedence (its version matches the one used at execution time); when there is none or it cannot be asked,
 * the build-time snapshot is used; when neither exists, `CATALOG_UNAVAILABLE`. It does not start the Runtime just to show help.
 */
async function readCatalog(
  home: string,
  cwd: string,
  withOps: boolean,
): Promise<{ catalog: CatalogListResult; editOps: CatalogEditOperations | null }> {
  const discovery = findRuntime(home);
  if (discovery) {
    try {
      const { client } = await openClient(discovery);
      try {
        const catalog = await client.request('catalog.list', {});
        let editOps: CatalogEditOperations | null = null;
        if (withOps) {
          const ops = await client.request('catalog.call', { name: 'edits_ops', args: {}, cwd });
          if (ops.ok) editOps = ops.result as CatalogEditOperations;
        }
        return { catalog, editOps };
      } finally {
        client.close();
      }
    } catch {
      // Cannot be asked (exiting, protocol differs): fall back to the snapshot.
    }
  }
  const snapshot = loadSnapshot();
  if (snapshot) return { catalog: snapshot, editOps: snapshot.editOps };
  throw new CliError('CATALOG_UNAVAILABLE', M.catalogUnavailable(SNAPSHOT_COMMAND), { next: SNAPSHOT_COMMAND });
}

async function help(output: Output, home: string, cwd: string, admin: AdminBucket, target: readonly string[]): Promise<ExitCode> {
  const topic = target[0];
  if (topic !== undefined && isMeta(topic)) return output.text(M.metaHelp[topic]);
  const { catalog } = await readCatalog(home, cwd, false);
  if (target.length === 0) return output.text(renderMainHelp(catalog.tools, admin.entries));
  const found = lookup(buildTree(catalog.tools), target);
  if (found.kind === 'command')
    return output.text(
      renderCommandHelp(
        found.command,
        catalog.tools.map((tool) => tool.name),
      ),
    );
  const noun = target[0]!;
  const entry = adminEntry(admin, noun);
  if (found.kind === 'group' || entry) {
    const text = renderGroupHelp(catalog.tools, noun, entry);
    if (text) return output.text(text);
  }
  throw new CliError('UNKNOWN_COMMAND', M.unknownCommand(target.slice(0, 2).join(' ')));
}

async function spec(output: Output, home: string, cwd: string, name: string | undefined): Promise<ExitCode> {
  const { catalog, editOps } = await readCatalog(home, cwd, Boolean(name?.startsWith('edits')));
  return output.raw(specOf(catalog, editOps, name));
}
