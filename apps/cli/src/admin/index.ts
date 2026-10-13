import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import type { AdminBucket } from '../cli.ts';
import { RpcError } from '@cuccut/protocol';
import { CliError, EXIT, type ExitCode } from '../envelope.ts';
import { ensureRuntime, openClient } from '../runtime/connection.ts';
import { approvals } from './approvals.ts';
import { chat } from './chat.ts';
import { AdminRun, COMMON_OPTIONS, type AdminNoun } from './context.ts';
import { externalTools } from './external-tools.ts';
import { fonts } from './fonts.ts';
import { grants } from './grants.ts';
import { jobs } from './jobs.ts';
import { library } from './library.ts';
import { mcp } from './mcp.ts';
import { models } from './models.ts';
import { nodes } from './nodes.ts';
import { profile } from './profile.ts';
import { services } from './services.ts';
import { settings } from './settings.ts';
import { share } from './share.ts';
import { skill } from './skill.ts';
import { skills } from './skills.ts';
import { space } from './space.ts';
import { tasks } from './tasks.ts';
import { templates } from './templates.ts';
import { text } from './text.ts';
import { web } from './web.ts';

/**
 * Admin bucket (Agent-surface design §7): hand-written commands for people only, matched exactly by noun and subcommand, and checked before derived commands. Nouns named the same as a directory (`models`,
 * `jobs`, `space`, `library`, `skills`) accept only the listed subcommands; the rest go to derived commands. The order is the order in the second half of `--help`.
 */
const NOUNS: readonly AdminNoun<ParseArgsOptionsConfig>[] = [
  models,
  jobs,
  space,
  library,
  skills,
  profile,
  externalTools,
  services,
  mcp,
  skill,
  share,
  nodes,
  settings,
  grants,
  approvals,
  fonts,
  templates,
  tasks,
  chat,
  text,
  web,
] as readonly unknown[] as readonly AdminNoun<ParseArgsOptionsConfig>[];

export const adminBucket: AdminBucket = {
  // Usage is read in the language in use at the time (a noun's usage is a getter).
  entries: NOUNS.map((noun) => ({
    name: noun.name,
    ...(noun.verbs ? { verbs: noun.verbs } : {}),
    get usage() {
      return noun.usage;
    },
  })),
  handles: (words) => {
    const noun = NOUNS.find((candidate) => candidate.name === words[0]);
    return Boolean(noun && (!noun.partial || noun.verbs?.includes(words[1] ?? '')));
  },
  run: async (argv, context): Promise<ExitCode> => {
    const { output, home, cwd, env } = context;
    let parsed;
    let noun: AdminNoun<ParseArgsOptionsConfig> | undefined;
    try {
      parsed = parseArgs({ args: [...argv], options: { ...allOptions(argv), ...COMMON_OPTIONS }, allowPositionals: true, strict: true });
      noun = NOUNS.find((candidate) => candidate.name === parsed!.positionals[0]);
    } catch (error) {
      throw new CliError('INVALID_ARGUMENTS', error instanceof Error ? error.message : String(error));
    }
    if (!noun) throw new CliError('UNKNOWN_COMMAND', String(parsed.positionals[0]));
    if (parsed.values.help) return output.text(noun.usage);

    const args = parsed.positionals.slice(1);
    const offline = noun.offline?.includes(args[0] ?? '') ?? false;
    let client = null;
    if (!offline) {
      const { discovery, started } = await ensureRuntime(home, { start: parsed.values['no-start'] !== true });
      ({ client } = await openClient(discovery));
      output.runtimeStarted = started;
    }
    try {
      const ctx = new AdminRun({ client, output, cwd, home, env, args, values: parsed.values, usage: noun.usage });
      return await noun.run(ctx as never);
    } catch (error) {
      // Plain errors thrown by nouns (a file cannot be read, an artifact cannot be fetched, etc.) mean this command did not get done. They are not a fault of the CLI itself.
      if (error instanceof Error && !(error instanceof CliError) && !(error instanceof RpcError)) {
        return output.failure({ code: 'COMMAND_FAILED', message: error.message }, EXIT.failed);
      }
      throw error;
    } finally {
      client?.close();
    }
  },
};

/** The noun's own flags (the noun is found by the first word on the command line; when none is found, only the common flags). */
function allOptions(argv: readonly string[]): ParseArgsOptionsConfig {
  const name = argv.find((token) => !token.startsWith('-'));
  return NOUNS.find((noun) => noun.name === name)?.options ?? {};
}
