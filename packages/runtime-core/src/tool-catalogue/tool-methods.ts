import { RpcError } from '@cuccut/protocol';
import { TOOL_CATALOGUE, toolDefinition } from '@cuccut/jobs';
import type { ModelServices } from '@cuccut/models';
import type { RpcHandlers } from '../handlers.ts';
import type { SpaceCatalog } from '../space-catalog.ts';
import type { ExternalToolService } from '../external-tools/external-tool-service.ts';
import { viewerOf } from '../space/space-methods.ts';
import { capabilityError, toolStatuses } from './tool-availability.ts';
import { toolCandidates } from './tool-candidates.ts';
import { RcRuntime } from '@cuccut/protocol/messages/runtime-core';

export interface ToolCatalogueDeps {
  space: SpaceCatalog;
  services: ModelServices;
  externalTools: () => ExternalToolService;
  offlineStrict: () => boolean;
  /** The resolved save location (§7.9); when not given, the result has no `saveDirectory`. */
  saveDirectory?: () => string;
}

/**
 * Handlers for `tools.*` (tool catalogue and candidate inputs, architecture design §7.9), merged into the method table by `handlers.ts`. All are read-only: the catalogue does not probe the network, and
 * external tools use the result of the last probe; candidate inputs do not open videos, and the scope is the same as `space.list` (external services do not go through the gateway and reach Space through MCP tools).
 * The Web service marks tools whose execution method is not on the allowlist as unavailable in `services/web-handlers.ts`.
 */
export function toolCatalogueMethods(deps: ToolCatalogueDeps): Pick<RpcHandlers['methods'], 'tools.list' | 'tools.candidates'> {
  const { services } = deps;
  return {
    'tools.list': async () => ({
      tools: await toolStatuses(TOOL_CATALOGUE, {
        capability: (capability) =>
          capabilityError(() => {
            if (capability === 'transcribe') return services.selectTranscribe({});
            if (capability === 'generateText') return services.selectText({});
            if (capability === 'separateAudio') return services.selectSeparate({});
            return services.selectGeneration(capability, {});
          }),
        externalTools: () => deps.externalTools().list(),
        offlineStrict: deps.offlineStrict,
      }),
      ...(deps.saveDirectory ? { saveDirectory: deps.saveDirectory() } : {}),
    }),
    'tools.candidates': (p, principal) => {
      const viewer = viewerOf(principal);
      const tool = toolDefinition(p.toolId);
      if (!tool) throw new RpcError('not-found', RcRuntime.noSuchTool({ toolId: p.toolId }));
      const { toolId: _toolId, ...params } = p;
      return toolCandidates(deps.space, viewer, tool, params);
    },
  };
}
