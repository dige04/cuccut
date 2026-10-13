/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra). Modified:
 * the version format from packages/server/src/server/agent/providers/opencode/runtime-client.ts (`opencode v2.0.24` or `1.18.34`)
 * and the minimum v2 version (2.0.10), and the `serve` launch arguments and password environment variable from v2/runtime.ts.
 * Changed to CucCut's preset constants: the name and subscription note follow MORE_HARNESSES in the prototype designs/cuccut/app/data.js; only 2.x is accepted.
 */
import type { DriverInstallOption } from '@cuccut/protocol';
import { DriversOpencode } from '@cuccut/protocol/messages/agent-drivers';

/**
 * OpenCode's preset (same format as `acp/acp-presets.ts`). Only 2.x is accepted: 2.x's `opencode serve` provides the v2 HTTP API (`/api/...`) and
 * the event stream. 1.x is a different interface; it is not supported for compatibility, and the probe reports the version as too old.
 */
export const OPENCODE_PRESET = {
  name: 'OpenCode',
  /** The name typed in the terminal. The 2.x npm package (`@opencode/cli`) installs both the `opencode` and `opencode2` names; both are searched. */
  command: 'opencode',
  commandAliases: ['opencode2'],
  /** Minimum version of the v2 API: the version recorded as the source of the port, where the session v2 interfaces are complete. */
  minVersion: '2.0.10',
  /** Subscription note (varies by language; read when needed). */
  get plan() {
    return DriversOpencode.plan();
  },
  /** Sign in to a model account: `opencode auth login` (OpenCode Zen's free models work without signing in). */
  loginCommand: 'opencode auth login',
  /**
   * Install method. The prototype lists the official script and `npm install -g opencode-ai`, but both (checked 2026-10) install 1.x (the script fetches the latest GitHub release, v1.18.34, and the npm package `opencode-ai` is also 1.18.34); 2.x is only in the npm package `@opencode/cli`. Only the entry that installs 2.x is given here.
   */
  install: [
    {
      kind: 'npm',
      label: 'npm',
      needs: 'Node.js',
      command: 'npm install -g @opencode/cli',
      upgrade: 'npm install -g @opencode/cli@latest',
    },
  ] satisfies DriverInstallOption[],
  get installHint() {
    return DriversOpencode.installHint();
  },
  /** Known install locations outside PATH (paths starting with `~` are relative to the user's home directory). */
  knownLocations: ['~/.opencode/bin/opencode', '~/.local/bin/opencode', '/opt/homebrew/bin/opencode', '/usr/local/bin/opencode'],
} as const;

/** Environment variable that overrides the executable location. */
export const OPENCODE_PATH_VARIABLE = 'CUCCUT_OPENCODE_PATH';

/**
 * Environment for `opencode serve`: no automatic upgrade (an upgrade would replace the executable in use). The password is generated randomly for each launch by `OpenCodeServer`, separately.
 */
export const OPENCODE_ENV: Record<string, string> = {
  OPENCODE_DISABLE_AUTOUPDATE: '1',
};
