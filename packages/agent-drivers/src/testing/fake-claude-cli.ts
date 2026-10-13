import fs from 'node:fs';
import path from 'node:path';
import type { FakeClaudeCliScenario } from './fake-claude.ts';

/**
 * The process entry point for the fake claude (see `createFakeClaudeCli` in `fake-claude.ts`). Run directly by node, using only Node's built-in modules.
 * It only answers the `--version` and `auth status` probes; sessions do not go through it (sessions use the injected fake Query).
 * Behavior comes from `$FAKE_CLAUDE_DIR/scenario.json`, and the arguments of each call are recorded in `$FAKE_CLAUDE_DIR/log.jsonl`.
 */

const dir = process.env.FAKE_CLAUDE_DIR;
if (!dir) {
  process.stderr.write('FAKE_CLAUDE_DIR 没有设置\n');
  process.exit(2);
}
const scenario = JSON.parse(fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8')) as FakeClaudeCliScenario;
const args = process.argv.slice(2);
fs.appendFileSync(path.join(dir, 'log.jsonl'), `${JSON.stringify({ t: Date.now(), args })}\n`);

if (args[0] === '--version') {
  if (scenario.version === null) {
    process.stderr.write('boom\n');
    process.exit(1);
  }
  process.stdout.write(`${scenario.version} (Claude Code)\n`);
  process.exit(0);
}
if (args[0] === 'auth' && args[1] === 'status') {
  if (scenario.auth === null) {
    // Old version: no such subcommand.
    process.stderr.write(`error: unknown command 'auth'\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(scenario.auth, null, 2)}\n`);
  // Consistent with 2.1.284: when not logged in, exit code 1, but stdout is still JSON.
  process.exit(scenario.auth.loggedIn ? 0 : 1);
}
process.stderr.write(`假 claude 不支持：${args.join(' ')}\n`);
process.exit(2);
