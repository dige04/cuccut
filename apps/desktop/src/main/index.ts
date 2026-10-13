import { startDesktopApp } from './app-main.ts';
import { compositionHostScript, runCompositionHost } from './composition-host-entry.ts';

/**
 * Main process entry. It first checks whether this launch is the off-screen host for a code package (`--composition-host <script>`, see `composition-host-entry.ts`). If so, it runs only the host script;
 * otherwise it goes on to the desktop app (`app-main.ts`). The modules on both sides have no side effects on import, so before the check, no Runtime is started, no IPC is registered and no window is opened.
 */
const hostScript = compositionHostScript(process.argv);
if (hostScript !== null) runCompositionHost(hostScript);
else startDesktopApp();
