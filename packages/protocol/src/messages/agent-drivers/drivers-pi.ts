import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './drivers-pi.zh-Hans.ts';
import { zhHant } from './drivers-pi.zh-Hant.ts';
import { ja } from './drivers-pi.ja.ts';
import { ko } from './drivers-pi.ko.ts';
import { es } from './drivers-pi.es.ts';
import { fr } from './drivers-pi.fr.ts';
import { de } from './drivers-pi.de.ts';
import { nl } from './drivers-pi.nl.ts';
import { ptBR } from './drivers-pi.pt-BR.ts';
import { it } from './drivers-pi.it.ts';
import { ru } from './drivers-pi.ru.ts';
import { pl } from './drivers-pi.pl.ts';
import { tr } from './drivers-pi.tr.ts';
import { vi } from './drivers-pi.vi.ts';

/** Pi Driver: preset description, probe results, and hints and errors from the RPC process and sessions. */
const en = {
  plan: 'Model accounts in Pi',
  installHint: 'Install Pi with npm (npm install -g @earendil-works/pi-coding-agent, needs Node.js)',
  signedOut:
    "Pi isn't signed in. Run pi in a terminal and enter /login, or set an API key for a model provider (for example ANTHROPIC_API_KEY).",
  rpcFailed: (p: { error: string }) => `Pi's RPC mode failed to start: ${p.error}`,
  processStartFailed: (p: { error: string }) => `The Pi process failed to start: ${p.error}`,
  /** `tail` is the last few lines of stderr. It is left out when empty. */
  processExited: (p: { code: string; signal: string; tail: string }) =>
    `The Pi process exited (code ${p.code}, signal ${p.signal})${p.tail ? `: ${p.tail}` : ''}`,
  processClosed: 'The Pi process is closed',
  requestTimeout: (p: { command: string; ms: string }) => `Pi didn't answer ${p.command} within ${p.ms} ms`,
  stdinUnwritable: "Pi's stdin isn't writable",
  commandFailed: (p: { command: string }) => `Pi's ${p.command} failed`,
  toolFallback: 'Tool',
  sessionFileMissing: 'session file not found',
  /** Appends the last few lines of stderr after an error. */
  withStderr: (p: { error: string; tail: string }) => `${p.error} (${p.tail})`,
  mcpNameInvalid: (p: { name: string }) =>
    `The MCP server name ${p.name} has characters Pi doesn't accept (only letters, digits, _ and -), so it can't be used in this session.`,
  modelFormat: (p: { model: string }) => `Pi models must be written as provider/id: ${p.model}`,
  switchModelFailed: (p: { model: string; error: string }) => `Pi couldn't switch to the model ${p.model}: ${p.error}`,
  effortUnsupported: (p: { level: string }) =>
    `Pi doesn't have the "${p.level}" reasoning effort level, so this turn uses its current setting.`,
  effortFailed: (p: { error: string }) => `Pi couldn't set the reasoning effort (${p.error}), so this turn uses its current setting.`,
  mcpConnectFailed: (p: { error: string }) =>
    `Pi couldn't connect to CucCut's MCP server, so CucCut's tools (reading and writing projects, captions, and so on) aren't available in this session: ${p.error}`,
  extensionError: (p: { error: string }) => `A Pi extension failed: ${p.error}`,
  modelCallFailed: "Pi's model call failed",
  /** Raw notification text sent by a Pi extension, prefixed with Pi. */
  notice: (p: { message: string }) => `Pi: ${p.message}`,
  /** `title` is the title of the question the extension asks. It is left out when empty. */
  extensionAsked: (p: { title: string }) =>
    `A Pi extension wanted to ask you something${p.title ? ` ("${p.title}")` : ''}. CucCut can't pass on this kind of question yet, so it was canceled for you.`,
  /** `mode` is the name of the “Full access” mode. */
  fullAccessOnly: (p: { mode: string }) =>
    `Pi has no way to ask before each action, so CucCut can only run it in "${p.mode}" mode: it won't ask you before running commands or changing files.`,
};

export type DriversPiMessages = typeof en;

export const DriversPi = defineCatalog('driversPi', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
