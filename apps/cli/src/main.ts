#!/usr/bin/env node
import { adminBucket } from './admin/index.ts';
import { runCli } from './cli.ts';

/**
 * Entry point of `cuccut`. Derived commands (tools from the catalog, Agent-facing design §5) and the admin bucket (`admin/`, §7) are both dispatched in `runCli`; this file only wires up the process. For the list of commands, see `cuccut --help`.
 */

// Exit quietly when output goes to a pipe that is closed early (`cuccut spec | head`).
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0);
  throw error;
});
process.exitCode = await runCli(process.argv.slice(2), adminBucket);
