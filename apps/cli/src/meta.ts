import { localizeToolStatus, MCP_INTERFACE_VERSION, RUNTIME_VERSION, type ExternalToolStatus } from '@cuccut/protocol';
import { M } from './cli-copy.ts';
import { CliError, type ExitCode, type Output } from './envelope.ts';
import { findRuntime, openClient, type Session } from './runtime/connection.ts';

/**
 * Meta commands `version` and `status` (Agent-facing design §4.5). `version` is bare JSON and does not start the Runtime. `status` uses the envelope; if the Runtime cannot be found it is started (per §5.6), and it reports what can be done right now, with remedy commands for anything unavailable.
 */

/** `cuccut version`: the CLI, the Runtime (when running) and the interface version. */
export async function version(output: Output, home: string): Promise<ExitCode> {
  const cli = { version: RUNTIME_VERSION, interfaceVersion: MCP_INTERFACE_VERSION };
  const discovery = findRuntime(home);
  if (!discovery) return output.raw({ cli, runtime: null });
  try {
    const { client, info } = await openClient(discovery);
    try {
      const catalog = await client.request('catalog.list', {});
      return output.raw({
        cli,
        runtime: {
          version: info.runtimeVersion,
          protocolVersion: info.protocolVersion,
          interfaceVersion: catalog.interfaceVersion,
          pid: info.pid,
        },
        compatible: catalog.interfaceVersion === MCP_INTERFACE_VERSION,
      });
    } finally {
      client.close();
    }
  } catch (error) {
    // Report the CLI's version even when the connection fails (or the protocol differs): the version command exists precisely for troubleshooting.
    return output.raw({ cli, runtime: { pid: discovery.pid, error: error instanceof CliError ? error.body() : String(error) } });
  }
}

/**
 * `cuccut status`: the Runtime, the default and availability of each capability, local model packs, and external tools. By default it gives only a summary (which provider each capability uses right now, which ones are usable; the status of model packs). With `--full`, the capabilities and model packs are the full results of `models_capabilities` and `models_list` (each provider's models, parameters and limits).
 */
export async function status(output: Output, session: Session, cwd: string, options: { full: boolean }): Promise<ExitCode> {
  const { client, info, catalog, started } = session;
  const call = async (name: string) => {
    const result = await client.request('catalog.call', { name, args: {}, cwd });
    return result.ok ? result.result : { error: result.error };
  };
  const [capabilities, localModels, tools] = await Promise.all([
    call('models_capabilities'),
    call('models_list'),
    client.request('externalTools.list', {}).then(
      (result) => result.tools.map(externalTool),
      (error: unknown) => ({ error: String(error) }),
    ),
  ]);
  return output.success(
    {
      runtime: {
        running: true,
        started,
        version: info.runtimeVersion,
        interfaceVersion: catalog.interfaceVersion,
        pid: info.pid,
        home: info.home,
        launchedBy: info.launchedBy,
      },
      capabilities: options.full ? capabilities : capabilitySummary(capabilities),
      localModels: options.full ? localModels : bundleSummary(localModels),
      externalTools: tools,
    },
    options.full ? null : M.statusFullNext,
  );
}

/** Summary of capabilities: which one is in use now, which services are usable, and the next step; it omits each service's model list and parameters. When it cannot be obtained, it is returned unchanged (`{ error }`). */
function capabilitySummary(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.capabilities)) return value;
  return {
    capabilities: value.capabilities.filter(isRecord).map((c) => ({
      capability: c.capability,
      default: c.default,
      effective: c.effective,
      usableProviders: c.usableProviders,
      providerCount: Array.isArray(c.providers) ? c.providers.length : 0,
      next: c.next,
    })),
  };
}

/** Summary of local model packs: each pack's capabilities and status (the reason when unavailable). */
function bundleSummary(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.bundles)) return value;
  return {
    bundles: value.bundles.filter(isRecord).map((b) => ({
      bundleId: b.bundleId,
      capability: b.capability,
      state: b.state,
      ...(b.reason !== undefined ? { reason: b.reason } : {}),
    })),
    next: value.next,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Summary of external tools and their remedy commands (the admin bucket's `external-tools`). */
function externalTool(probed: ExternalToolStatus) {
  const tool = localizeToolStatus(probed);
  const remedy: string[] = [];
  if (tool.state === 'missing' && tool.installable) remedy.push(`cuccut external-tools install ${tool.name}`);
  if (tool.state === 'outdated' && tool.installable) remedy.push(`cuccut external-tools update ${tool.name}`);
  if (tool.state !== 'installed' && !tool.installable) remedy.push(`cuccut external-tools path ${tool.name} <file>`);
  if (tool.consentRequired && tool.consent?.state !== 'granted') remedy.push(`cuccut external-tools consent ${tool.name}`);
  return {
    name: tool.name,
    purpose: tool.purpose,
    state: tool.state,
    available: tool.state === 'installed' && (!tool.consentRequired || tool.consent?.state === 'granted'),
    version: tool.version,
    ...(tool.reason ? { reason: tool.reason } : {}),
    consentRequired: tool.consentRequired,
    consent: tool.consent?.state ?? null,
    ...(remedy.length ? { remedy } : {}),
  };
}
