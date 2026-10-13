/**
 * Model catalog for Codex: starts a temporary `codex app-server`, gets the model table via `model/list`, and converts it to `DriverModel`.
 *
 * The model field handling is based on paseo's packages/server/src/server/agent/providers/codex-app-server-agent.ts
 * (`CodexModelListResponseSchema`, `buildCodexModelDefinition`, `buildCodexThinkingOptionMap`),
 * Apache-2.0, Copyright (c) 2025-present Mohamed Boudra. Modified: changed to CucCut's `DriverModel` shape,
 * and added the hidden-model distinction, tier inference, and a pagination cap.
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import { RUNTIME_VERSION, type DriverModel, type ModelTier } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import type { CodexInstall } from './codex-binary.ts';
import type { CodexModel, InitializeParams, ModelListParams, ModelListResponse } from './codex-protocol.ts';
import { CodexRpcConnection } from './rpc-connection.ts';

/** Result of one `model/list` call. `all` includes hidden models, and is used to check whether this CLI version recognizes the models in the config. */
export interface CodexCatalog {
  models: DriverModel[];
  all: string[];
}

const MAX_PAGES = 5;

/**
 * Starts a temporary app-server to get the model table. Runs no model turns and spends no quota. The whole process is limited to `timeoutMs`; the process is always killed when it ends (including on failure or timeout).
 * Whether this works without a login is unverified (the local codex is logged in); when the table cannot be fetched, the caller gets an empty table.
 */
export async function listCodexModels(install: CodexInstall, log: Logger, timeoutMs = 15_000): Promise<CodexCatalog> {
  const child = spawn(install.command, ['app-server'], {
    cwd: os.tmpdir(),
    env: install.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const conn = new CodexRpcConnection(child, log);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`codex model/list timed out (${timeoutMs} ms)`)), timeoutMs);
  });
  try {
    return await Promise.race([fetchCatalog(conn, timeoutMs), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    await conn.close();
  }
}

async function fetchCatalog(conn: CodexRpcConnection, timeoutMs: number): Promise<CodexCatalog> {
  // The real app-server sends notifications such as configWarning; ignore all of them.
  conn.onNotification(() => {});
  const init: InitializeParams = {
    clientInfo: { name: 'cuccut', title: 'CucCut', version: RUNTIME_VERSION },
    capabilities: null,
  };
  await conn.request('initialize', init, timeoutMs);
  conn.notify('initialized');
  const raw: CodexModel[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params: ModelListParams = { includeHidden: true, ...(cursor ? { cursor } : {}) };
    const res = await conn.request<ModelListResponse>('model/list', params, timeoutMs);
    raw.push(...(Array.isArray(res?.data) ? res.data : []));
    cursor = typeof res?.nextCursor === 'string' && res.nextCursor ? res.nextCursor : null;
    if (!cursor) break;
  }
  return toCatalog(raw);
}

export function toCatalog(raw: CodexModel[]): CodexCatalog {
  const valid = raw.filter((m) => m && typeof m.id === 'string' && m.id);
  return {
    models: valid.filter((m) => !m.hidden).map(toDriverModel),
    all: valid.map((m) => m.id),
  };
}

export function toDriverModel(m: CodexModel): DriverModel {
  const efforts = (Array.isArray(m.supportedReasoningEfforts) ? m.supportedReasoningEfforts : [])
    .map((e) => (typeof e?.reasoningEffort === 'string' ? e.reasoningEffort : ''))
    .filter(Boolean)
    // Chinese labels are mapped by id in the UI; since the native side has no short labels, the id is used.
    .map((id) => ({ id, label: id }));
  const description = typeof m.description === 'string' && m.description.trim() ? m.description.trim() : null;
  return {
    id: m.id,
    label: typeof m.displayName === 'string' && m.displayName ? m.displayName : m.id,
    description,
    tier: inferTier(m.id, description),
    // Pass Codex's own default through as-is and do not change it for the user (design note: the model catalog is evidence for "discovery", not permission to rewrite the user's choice).
    isDefault: m.isDefault === true,
    efforts,
    defaultEffort: typeof m.defaultReasoningEffort === 'string' && m.defaultReasoningEffort ? m.defaultReasoningEffort : null,
  };
}

/**
 * Infers the tier from the name and description. The family suffix in the name takes priority (`-sol` main workhorse, `-astra` strongest, `-luna` fastest, per the 0.159.0 catalog),
 * then the wording in the description; if neither works, null. The UI marks only the recommended one as "Recommended", so it is fine for balanced to be matched broadly.
 */
export function inferTier(id: string, description: string | null): ModelTier | null {
  const name = id.toLowerCase();
  if (/-sol\b/.test(name)) return 'balanced';
  if (/-astra\b/.test(name)) return 'max';
  if (/-luna\b|-mini\b|-nano\b/.test(name)) return 'fast';
  const text = (description ?? '').toLowerCase();
  if (/\bfrontier\b|most demanding|most capable|strongest/.test(text)) return 'max';
  if (/\bfast(est)?\b/.test(text)) return 'fast';
  if (/\bworkhorse\b|\bbalanced\b|\beveryday\b/.test(text)) return 'balanced';
  return null;
}
