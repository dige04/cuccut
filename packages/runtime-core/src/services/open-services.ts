import path from 'node:path';
import { SERVICE_APPROVAL_TIMEOUT_MS } from '@cuccut/protocol';
import type { Harness, Logger } from '@cuccut/harness';
import type { NodeService } from '@cuccut/nodes';
import type { RuntimeHome } from '@cuccut/runtime-storage';
import type { ToolScope } from '../agent-tools/tool-scope.ts';
import type { ToolSet } from '../agent-tools/tool-catalog.ts';
import type { ModelJobs } from '../models/model-jobs.ts';
import type { VideoService } from '../videos/video-service.ts';
import { McpService } from './mcp-service.ts';
import { ModelApiService } from './model-api-service.ts';
import { NodeServiceAdapter } from './node-service-adapter.ts';
import { ServiceApprovals } from './service-approvals.ts';
import { ServiceConfigStore } from './service-config-store.ts';
import { ServiceManager } from './service-manager.ts';
import { WebService } from './web-service.ts';
import type { WebSessionsOptions } from './web-sessions.ts';

export interface RuntimeServices {
  manager: ServiceManager;
  mcp: McpService;
  modelApi: ModelApiService;
  web: WebService;
}

export interface ServicesOptions {
  /** The timeout for service approval (default `SERVICE_APPROVAL_TIMEOUT_MS`). Tests use a short one. */
  approvalTimeoutMs?: number;
  /** The upload and body size limits of the model API service (defaults in `MODEL_API_MAX_UPLOAD_BYTES` and `MODEL_API_MAX_JSON_BYTES`). Tests use small ones. */
  modelApi?: { maxUploadBytes?: number; maxJsonBytes?: number };
  /** Web service: the build output directory (null means none; if not given, it is looked up via `CUCCUT_WEB_DIST`, packaged resources, and the build output in the repo), plus the lifetime of codes and sessions. */
  web?: { dist?: string | null } & WebSessionsOptions;
}

/**
 * Reads the config for external services and registers all services (architecture design §4.8). It enables no service: those that start with the Runtime are enabled by `manager.restore`.
 * Throws when the config file is not a valid config (it is not overwritten, so issued clients are not lost).
 */
export async function openServices(deps: {
  home: RuntimeHome;
  harness: Harness;
  videos: VideoService;
  models: ModelJobs;
  nodes: NodeService;
  log: Logger;
  /** The tool group of the full tool catalog (built for the service's scope): the MCP service exposes a subset of it according to `surfaces`. */
  toolSets: (scope: ToolScope) => ToolSet[];
  options?: ServicesOptions;
}): Promise<RuntimeServices> {
  const store = new ServiceConfigStore(deps.home.servicesFile);
  await store.load();
  const manager = new ServiceManager({
    log: deps.log,
    approvals: (m) =>
      new ServiceApprovals({
        timeoutMs: deps.options?.approvalTimeoutMs ?? SERVICE_APPROVAL_TIMEOUT_MS,
        onRequested: (approval) => m.topic.publish({ type: 'approval.requested', approval }),
        onResolved: (approvalId, outcome) => m.topic.publish({ type: 'approval.resolved', approvalId, outcome }),
        // Shares the Harness's ApprovalService with session approvals: pending service approvals are also listed under the `tasks` topic (§3.12).
        approvals: deps.harness.approvals,
      }),
  });
  const mcp = new McpService({
    store,
    harness: deps.harness,
    videos: deps.videos,
    models: deps.models,
    approvals: manager.approvals,
    log: deps.log,
    onChange: () => manager.refresh('mcp'),
    toolSets: deps.toolSets,
  });
  manager.register(mcp);
  const modelApi = new ModelApiService({
    store,
    models: deps.models,
    approvals: manager.approvals,
    stagingDir: path.join(deps.home.stagingDir, 'model-api'),
    log: deps.log,
    onChange: () => manager.refresh('model-api'),
    ...(deps.options?.modelApi ? { limits: deps.options.modelApi } : {}),
  });
  manager.register(modelApi);
  const { dist, ...sessions } = deps.options?.web ?? {};
  const web = new WebService({
    store,
    harness: deps.harness,
    videos: deps.videos,
    log: deps.log,
    onChange: () => manager.refresh('web'),
    ...(dist !== undefined ? { dist } : {}),
    sessions,
  });
  manager.register(web);
  manager.register(new NodeServiceAdapter(deps.nodes));
  return { manager, mcp, modelApi, web };
}
