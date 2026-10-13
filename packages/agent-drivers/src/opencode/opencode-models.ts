/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra). Modified:
 * modelsFromV2 / modelRef in packages/server/src/server/agent/providers/opencode/v2/mapping.ts (the `provider/model` format,
 * only enabled models kept, variants used as reasoning effort), waitForLocationReady in v2/readiness.ts (on cold start the directory first returns an empty plugin table; polling until it is non-empty counts as ready),
 * and fetchCatalog in v2/agent.ts.
 * Changed to CucCut's DriverModel. No error when there is no account (OpenCode Zen's free models need no login); accounts are reported by enabled provider.
 */
import type { DriverModel } from '@cuccut/protocol';
import { DriversOpencode } from '@cuccut/protocol/messages/agent-drivers';
import type { OpenCodeServer } from './opencode-server.ts';

/** One model from `/api/model` (only the fields used are listed). */
export interface OpenCodeModel {
  id: string;
  providerID: string;
  name?: string;
  enabled?: boolean;
  status?: string;
  capabilities?: { input?: string[] };
  variants?: Array<{ id: string }>;
}

export interface OpenCodeProvider {
  id: string;
  name?: string;
  activation?: string;
}

/** Providers that ship with OpenCode and need no login (OpenCode Zen's free models). */
export const BUILTIN_PROVIDER = 'opencode';

export interface OpenCodeCatalog {
  models: DriverModel[];
  /** Names of the enabled providers that require an account (comma-separated); null when only the bundled free provider is present. */
  account: string | null;
}

/**
 * Waits for the catalog to be ready. On cold start `/api/plugin` first returns an empty table; content appears only after the plugin registrations from the config finish (measured on 2.0.24: 0 the first time, then 86).
 * Before that, reading the model table or creating a session would return empty results.
 */
export async function waitForLocation(server: OpenCodeServer, directory: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await server.request<{ data?: unknown[] }>('GET', '/api/plugin', { location: directory, timeoutMs: 5_000 });
    if (Array.isArray(res?.data) && res.data.length > 0) return;
    if (Date.now() > deadline) throw new Error(String(DriversOpencode.directoryNotReady({ seconds: String(Math.round(timeoutMs / 1000)), directory })));
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Reads the model table, the default model, and the enabled providers. */
export async function readCatalog(server: OpenCodeServer, directory: string): Promise<OpenCodeCatalog> {
  await waitForLocation(server, directory);
  const [models, fallback, providers] = await Promise.all([
    server.request<{ data?: OpenCodeModel[] | null }>('GET', '/api/model', { location: directory }),
    server.request<{ data?: OpenCodeModel | null }>('GET', '/api/model/default', { location: directory }).catch(() => null),
    server.request<{ data?: OpenCodeProvider[] | null }>('GET', '/api/provider', { location: directory }).catch(() => null),
  ]);
  const defaultId = fallback?.data ? modelId(fallback.data) : null;
  return { models: driverModels(models?.data ?? [], defaultId), account: accountOf(providers?.data ?? []) };
}

/** CucCut's model id: `<providerID>/<id>`, for example `anthropic/claude-sonnet-5` or `opencode/big-pickle`. */
export function modelId(model: Pick<OpenCodeModel, 'id' | 'providerID'>): string {
  return `${model.providerID}/${model.id}`;
}

/** The reverse: split on the first `/` (the model id itself may contain slashes). Null if it cannot be split. */
export function modelRef(id: string, effort: string | null): { providerID: string; id: string; variant?: string } | null {
  const cut = id.indexOf('/');
  if (cut <= 0 || cut === id.length - 1) return null;
  return { providerID: id.slice(0, cut), id: id.slice(cut + 1), ...(effort ? { variant: effort } : {}) };
}

export function driverModels(models: OpenCodeModel[], defaultId: string | null): DriverModel[] {
  return models
    .filter((m) => m.enabled !== false && m.status !== 'deprecated')
    .map((m) => {
      const id = modelId(m);
      const efforts = (m.variants ?? []).filter((v) => v.id && v.id !== 'default').map((v) => ({ id: v.id, label: v.id }));
      return {
        id,
        label: m.name || id,
        description: null,
        tier: null,
        isDefault: id === defaultId,
        efforts,
        defaultEffort: null,
      };
    });
}

/** Accounts: the enabled providers other than the bundled free one. */
export function accountOf(providers: OpenCodeProvider[]): string | null {
  const names = providers
    .filter((p) => p.id !== BUILTIN_PROVIDER && (p.activation === undefined || p.activation === 'enabled'))
    .map((p) => p.name || p.id);
  return names.length > 0 ? names.join(', ') : null;
}
