import type { CustomAgentProvider } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import { AcpDriver, type AcpDriverOptions } from './acp-driver.ts';
import { DriversAcp } from '@cuccut/protocol/messages/agent-drivers';
import { ACP_MODES, type AcpPreset } from './acp-presets.ts';

/**
 * Presets for ACP agents the user adds (`agents.addProvider`, architecture design §3.11): `command[0]` is the executable (a name on PATH or an absolute path), and the rest are arguments; `env` is added at startup. There is no minimum version (`--version` is not run), no install method, no login command and no known install locations; the access-mode mapping is the same as for the built-in presets.
 * `verified` takes the shared ACP implementation's value (`ACP_SHARED_VERIFIED`), and `tested` is false.
 */
export function customAcpPreset(provider: Pick<CustomAgentProvider, 'id' | 'name' | 'command' | 'env'>): AcpPreset {
  const [command, ...args] = provider.command;
  if (!command) throw new Error(String(DriversAcp.customNoCommand({ id: provider.id })));
  return {
    id: provider.id,
    name: provider.name,
    command,
    args,
    ...(provider.env && Object.keys(provider.env).length ? { env: { ...provider.env } } : {}),
    minVersion: null,
    loginCommand: null,
    install: [],
    get installHint() {
      return DriversAcp.customInstallHint({ command });
    },
    knownLocations: [],
    models: 'session',
    modes: ACP_MODES,
    tested: false,
  };
}

/** Builds an ACP Driver from a user-added config. */
export function createCustomAcpDriver(
  provider: Pick<CustomAgentProvider, 'id' | 'name' | 'command' | 'env'>,
  log: Logger,
  options: AcpDriverOptions = {},
): AcpDriver {
  return new AcpDriver(customAcpPreset(provider), log, options);
}
