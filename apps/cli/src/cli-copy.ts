import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './cli-copy.zh-Hans.ts';
import { zhHant } from './cli-copy.zh-Hant.ts';
import { ja } from './cli-copy.ja.ts';
import { ko } from './cli-copy.ko.ts';
import { es } from './cli-copy.es.ts';
import { fr } from './cli-copy.fr.ts';
import { de } from './cli-copy.de.ts';
import { nl } from './cli-copy.nl.ts';
import { ptBR } from './cli-copy.pt-BR.ts';
import { it } from './cli-copy.it.ts';
import { ru } from './cli-copy.ru.ts';
import { pl } from './cli-copy.pl.ts';
import { tr } from './cli-copy.tr.ts';
import { vi } from './cli-copy.vi.ts';

/**
 * The CLI's own text (derived commands, meta commands and Runtime ownership; English is the source of the keys and types; translations are in `cli-copy.<lang>.ts`).
 * Tool titles and descriptions come from the catalog (the original text for the model) and are not here.
 */
const en = {
  // One-screen help (agent-surface design §5.7)
  helpTagline:
    'cuccut — transcribe, translate, edit, dub and export videos with CucCut. Run `cuccut status` first to see what this machine can do.',
  helpFlows: 'Flows (return a job; wait until it finishes by default)',
  helpObjects: 'Objects',
  helpAdmin: 'Local admin (for people; agents ask the user first)',
  helpMore: 'More',
  helpMoreHelp: 'parameters, effect and examples',
  helpMoreSpec: 'machine-readable catalog (JSON)',
  helpMoreStatus: 'what this machine can do right now',
  helpGlobalFlags: '--json --project <dir> --yes --max-bytes <n> --result-file <file> --no-start',
  helpJobFlags: 'jobs: --no-wait --timeout <s> --progress jsonl',
  helpAdminVerbs: 'Local admin',
  helpGroupMore: (noun: string) => `cuccut help ${noun} <command> for parameters and examples.`,
  helpFlagsPlaceholder: '[flags]',
  effectLabel: (effect: string) => `effect: ${effect}`,
  effectQuery: 'query (read-only)',
  effectMutation: 'mutation (changes state)',
  effectJob: 'job (returns a job; waits until it finishes by default)',
  effectDestructive: 'destructive (cannot be undone; needs --yes)',
  helpParameters: 'Parameters',
  helpNoParameters: '(none)',
  helpRequired: 'required',
  helpRepeatable: 'repeatable',
  helpPositionalNote: (positional: string, flag: string) =>
    `${positional} can be given as the positional argument or as ${flag}, not both.`,
  helpExamples: 'Examples',
  helpCommonFlags: 'Common flags',

  // Output
  nextLabel: 'next',
  errorLabel: 'error',
  runtimeStartedNote: '(started a CucCut Runtime in the background; it exits by itself when idle)',
  spilledNote: (maxBytes: number) =>
    `The result is larger than ${maxBytes} bytes: the complete result is in the file at path (JSON). coverage lists its top-level keys and array lengths, summary its short fields. Read the file, narrow the request with the flags in continueWith.paging, or rerun with --max-bytes continueWith.maxBytes.`,
  resultFileWritten:
    'The complete result is in the file at path (JSON) as --result-file asked. coverage lists its top-level keys and array lengths, summary its short fields.',

  // Arguments
  unknownCommand: (command: string) => `Unknown command: ${command}. Run cuccut --help to see the commands.`,
  unknownFlag: (flag: string, command: string) => `Unknown flag ${flag} for cuccut ${command}. See cuccut help ${command}.`,
  missingValue: (flag: string) => `${flag} needs a value.`,
  noValueExpected: (flag: string) => `${flag} is a switch and takes no value.`,
  duplicateFlag: (flag: string) => `${flag} was given more than once.`,
  badNumber: (flag: string, value: string) => `${flag} needs a number, got "${value}".`,
  badInteger: (flag: string, value: string) => `${flag} needs a whole number, got "${value}".`,
  badBoolean: (flag: string, value: string) => `${flag} needs true or false, got "${value}".`,
  badChoice: (flag: string, value: string, choices: readonly string[]) => `${flag} must be one of ${choices.join(', ')}; got "${value}".`,
  badValue: (flag: string, value: string) => `"${value}" is not a valid value for ${flag}.`,
  badJson: (flag: string, reason: string) => `${flag} needs JSON (a literal, @file or - for stdin): ${reason}`,
  expectedObject: (flag: string) => `${flag} needs a JSON object.`,
  readFileFailed: (flag: string, file: string, reason: string) => `Could not read ${file} for ${flag}: ${reason}`,
  stdinTwice: (flag: string) => `Standard input can only be read once (${flag} asked for it again).`,
  noPositional: (command: string, value: string) => `cuccut ${command} takes no positional argument (got "${value}"); use flags.`,
  tooManyPositionals: (command: string, extra: string) => `cuccut ${command} takes one positional argument; extra: ${extra}`,
  positionalAndFlag: (field: string, flag: string) => `${field} was given both as the positional argument and as ${flag}; give only one.`,
  missingRequired: (names: string, command: string) => `Missing ${names}. See cuccut help ${command}.`,
  dryRunUnsupported: (command: string) => `cuccut ${command} has no --dry-run.`,
  projectNotDirectory: (value: string) => `--project ${value} is not a directory.`,
  confirmationRequired: (command: string, summary: string) =>
    `cuccut ${command} cannot be undone and was not run. It would do this: ${summary} Run it again with --yes once the user has agreed.`,
  confirmationNext: (command: string) => `cuccut ${command} … --yes (after the user agrees)`,
  unknownSpec: (name: string) => `No tool named ${name}. cuccut spec lists the whole catalog.`,
  unknownEditOp: (op: string) => `edits apply has no operation named ${op}. cuccut edits ops lists them.`,
  catalogUnavailable: (command: string) =>
    `The offline catalog snapshot is missing and no Runtime is running. Generate it with \`${command}\` (in the repository), or start the Runtime with cuccut runtime ensure.`,
  runtimeUsage: 'Usage: cuccut runtime ensure | status | stop',
  installConfirmationRequired: (bundleId: string, size: string, source: string) =>
    `Installing the local model ${bundleId} downloads ${size} from ${source}; nothing was downloaded. Tell the user the size and run it again with --yes once they agree.`,
  sizeEstimated: ' (estimated)',

  // Help for meta commands (§4.5)
  metaHelp: {
    help: "cuccut help [<command>]\n\nWithout a command: the one-screen overview. With one (`help videos`, `help videos inspect`, `help runtime`): its parameters, effect and examples. Uses the running Runtime's catalog when there is one, the offline snapshot otherwise; never starts a Runtime.",
    spec: "cuccut spec [<name>]\n\nThe machine-readable catalog as bare JSON (no envelope), with its interface version. <name> is a tool name (videos_inspect), a dotted name (videos.inspect), a command (videos inspect) or edits.<operation> for one operation of edits apply. Uses the running Runtime's catalog when there is one, the offline snapshot otherwise; never starts a Runtime.",
    version:
      'cuccut version\n\nVersions of this CLI and, when one is running, of the Runtime, with both tool interface versions and whether they match. Bare JSON; never starts a Runtime.',
    status:
      'cuccut status [--full] [--no-start]\n\nWhat this machine can do right now: the Runtime, each capability with its default and availability, local model bundles and external tools, with remedy commands for what is missing. Capabilities and model bundles are a summary; --full adds every provider with its models, parameters and limits, and the bundle details. Starts the Runtime when none is running; with --no-start it answers running: false instead.',
    runtime: [
      'cuccut runtime ensure | status | stop',
      '',
      'The CucCut Runtime this CLI talks to (one per CUCCUT_HOME).',
      '  ensure   find the running Runtime, or start one in the background; a Runtime the CLI started exits by itself',
      '           after runtime.idleExitMinutes idle (no connections, jobs or open services)',
      '  status   whether it runs, who started it, connections, active jobs, open services and idle exit; never starts one',
      '  stop     stop the Runtime the CLI started. RUNTIME_NOT_OWNED when the desktop app or someone else started it,',
      '           RUNTIME_IN_USE while the desktop app, another CLI or an unfinished job is using it (exit code 1)',
      '',
      'Flags: --json  --no-start (ensure: fail with exit code 3 instead of starting one)',
    ].join('\n'),
  } as Record<'help' | 'spec' | 'version' | 'status' | 'runtime', string>,

  // Runtime ownership (§5.6)
  runtimeNotRunning: (home: string) => `No CucCut Runtime is running for ${home}, and --no-start was given.`,
  runtimeNoEntry:
    'No CucCut Runtime is running and none could be started: install the CucCut app, run from the repository, or set CUCCUT_RUNTIME_ENTRY to the Runtime entry.',
  runtimeStartFailed: (reason: string, log: string) => `Could not start the CucCut Runtime (${reason}). See ${log}.`,
  runtimeStartTimeout: (seconds: number, log: string) => `The CucCut Runtime did not become ready within ${seconds} s. See ${log}.`,
  exitedWith: (code: number | null) => `it exited with code ${code ?? 'unknown'}`,
  runtimeConnectFailed: (reason: string) => `Could not connect to the CucCut Runtime: ${reason}`,
  runtimeLost: (reason: string) => `Lost the connection to the CucCut Runtime: ${reason}`,
  protocolMismatch: (reason: string) =>
    `This CLI and the CucCut Runtime speak different protocol versions: ${reason}. Update the older one.`,
  interfaceMismatch: (cli: string, runtime: string, update: 'cli' | 'runtime') =>
    `This CLI uses tool interface version ${cli}, the Runtime uses ${runtime}. ${update === 'cli' ? 'Update the CLI.' : 'Update the CucCut app (or restart the Runtime from the same checkout as the CLI).'}`,

  // Tasks (§5.4)
  jobCancelling: (jobId: string) => `Cancelling ${jobId}… (press Ctrl-C again to stop waiting right away)`,
  jobCancelFailed: (reason: string) => `Could not cancel the job: ${reason}`,
  jobEnded: (state: string) => `The job ended: ${state}.`,
  statusFullNext:
    'cuccut status --full lists every provider and model for each capability; for one capability run cuccut models capabilities --capability <capability>, for bundle details cuccut models list.',
  waitTimeout: (seconds: number, jobId: string) => `Stopped waiting after ${seconds} s; job ${jobId} keeps running.`,

  // Admin bucket (admin/context.ts)
  noRuntimeClient: "This command doesn't connect to the Runtime",
};

export type CliMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
