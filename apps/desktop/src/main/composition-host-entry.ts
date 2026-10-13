import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

/**
 * The main process's second role: the Electron off-screen host for code packages (architecture design §8.3). The Runtime launches it as `<Electron> --composition-host <host.cjs>`
 * (`packages/code-runtime/src/composition-host.ts`).
 *
 * A packaged app does not recognise script arguments on the command line and always loads `out/main/index.js` from the asar. So the entry first checks whether `process.argv` has this switch.
 * If it does, it runs only the host script, without starting the Runtime or opening a window. In dev mode, Electron (default_app) skips unknown arguments starting with `-` and loads the script directly as an app file,
 * bypassing this code.
 */

export const COMPOSITION_HOST_SWITCH = '--composition-host';

/** The script path given to `--composition-host <script>`. null when the switch is absent; an empty string when the switch is present but no script is given. */
export function compositionHostScript(argv: readonly string[]): string | null {
  const index = argv.indexOf(COMPOSITION_HOST_SWITCH);
  if (index < 0) return null;
  const script = argv[index + 1];
  return script && !script.startsWith('-') ? script : '';
}

/** The host's own Electron data directory: `profile/` next to the script, not touching the app's data directory. */
export function compositionHostProfileDir(script: string): string {
  return path.join(path.dirname(script), 'profile');
}

/**
 * Runs the host script. Must `require` synchronously: the script calls `disableHardwareAcceleration` / `appendSwitch` before ready, and waiting until whenReady would be too late.
 * The script itself sends `ready` and exits when stdin closes.
 */
export function runCompositionHost(script: string): void {
  if (!script) {
    process.stderr.write(`[composition-host] ${COMPOSITION_HOST_SWITCH} needs the host script path\n`);
    process.exit(2);
  }
  const resolved = path.resolve(script);
  const profile = compositionHostProfileDir(resolved);
  fs.mkdirSync(profile, { recursive: true });
  // Electron's own data (cache, cookies, logs, crash dumps) goes into the host's directory.
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps'] as const) app.setPath(name, path.join(profile, name));
  require(resolved);
}
