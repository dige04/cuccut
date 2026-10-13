import {
  refOf,
  RpcError,
  type CapabilityNotConfiguredDetails,
  type ExternalToolStatus,
  type ModelServiceCapability,
  type ToolDefinition,
  type ToolProblem,
  type ToolStatus,
} from '@cuccut/protocol';
import { problemRemedy, toolUseProblem } from '../external-tools/external-tool-service.ts';
import { RcRuntime } from '@cuccut/protocol/messages/runtime-core';

/**
 * Whether a tool can be used right now (`tools.list`, architecture design §7.9): the static registry plus the Runtime's state. The reasons reuse the existing error codes:
 *
 * - capabilities: judged by the same selection as at submit time (which Provider is used when none is given explicitly); when none can be selected, `CAPABILITY_NOT_CONFIGURED` (with `reason`);
 * - external tools: the result of the last probe (`externalTools.list`, probed the first time); when unusable, `TOOL_NOT_INSTALLED`, `TOOL_UNAVAILABLE`,
 *   `TOOL_OUTDATED`, `TOOL_CONSENT_REQUIRED`; while being updated in its original install way, `TOOL_UPDATING`;
 * - downloads over the network: `OFFLINE_STRICT` when strict offline mode (`offline.strict`) is on.
 *
 * Required dependencies go into `problems` (unavailable); those needed only for certain inputs or parameters go into `limitations` (still available).
 */

export interface ToolAvailabilityDeps {
  /** The error (`CAPABILITY_NOT_CONFIGURED`) when this capability cannot select a Provider right now; null when one can be selected. */
  capability(capability: ModelServiceCapability): Promise<RpcError | null>;
  /** Status of a managed external tool (the result of the last probe). */
  externalTools(): Promise<ExternalToolStatus[]>;
  offlineStrict(): boolean;
}

export async function toolStatuses(catalogue: readonly ToolDefinition[], deps: ToolAvailabilityDeps): Promise<ToolStatus[]> {
  const capabilities = new Map<ModelServiceCapability, ToolProblem | null>();
  const capabilityProblem = async (capability: ModelServiceCapability): Promise<ToolProblem | null> => {
    if (!capabilities.has(capability)) capabilities.set(capability, problemOfCapability(capability, await deps.capability(capability)));
    return capabilities.get(capability)!;
  };
  const tools = new Map((await deps.externalTools()).map((status) => [status.name, status]));
  const toolProblem = (name: string): ToolProblem | null => {
    const status = tools.get(name);
    if (!status) {
      const message = RcRuntime.externalToolNotRegistered({ name });
      return { code: 'TOOL_UNAVAILABLE', message: message.text, messageRef: refOf(message), tool: name };
    }
    const problem = toolUseProblem(status);
    return problem
      ? {
          code: problem.code,
          message: problem.message.text,
          messageRef: refOf(problem.message),
          tool: name,
          ...(String(problem.remedy) ? problemRemedy(problem.remedy) : {}),
        }
      : null;
  };
  const offline = deps.offlineStrict();
  const offlineMessage = RcRuntime.offlineStrictNoDownload();
  const offlineProblem: ToolProblem = {
    code: 'OFFLINE_STRICT',
    message: offlineMessage.text,
    messageRef: refOf(offlineMessage),
    ...problemRemedy(RcRuntime.offlineStrictRemedy()),
  };

  const out: ToolStatus[] = [];
  for (const tool of catalogue) {
    const problems: ToolProblem[] = [];
    const limitations: ToolProblem[] = [];
    for (const capability of tool.capabilities) {
      const problem = await capabilityProblem(capability);
      if (problem) problems.push(problem);
    }
    for (const capability of tool.optionalCapabilities) {
      const problem = await capabilityProblem(capability);
      if (problem) limitations.push(problem);
    }
    for (const name of tool.externalTools) {
      const problem = toolProblem(name);
      if (problem) problems.push(problem);
    }
    for (const name of tool.optionalExternalTools) {
      const problem = toolProblem(name);
      if (problem) limitations.push(problem);
    }
    if (offline && tool.network === 'required') problems.push(offlineProblem);
    if (offline && tool.network === 'optional') limitations.push(offlineProblem);
    out.push({ ...structuredClone(tool), available: problems.length === 0, problems, limitations });
  }
  return out;
}

function problemOfCapability(capability: ModelServiceCapability, error: RpcError | null): ToolProblem | null {
  if (!error) return null;
  const details = error.details as Partial<CapabilityNotConfiguredDetails> | undefined;
  return {
    code: details?.code ?? 'CAPABILITY_NOT_CONFIGURED',
    message: error.message,
    ...(error.messageRef ? { messageRef: error.messageRef } : {}),
    capability,
    ...(details?.reason ? { reason: details.reason } : {}),
    ...(details?.remedy?.hint ? { remedy: details.remedy.hint, ...(details.remedy.hintRef ? { remedyRef: details.remedy.hintRef } : {}) } : {}),
  };
}

/** An exception while selecting a capability is turned into “unavailable”: only `RpcError` is caught; others are still thrown. */
export async function capabilityError(select: () => Promise<unknown>): Promise<RpcError | null> {
  try {
    await select();
    return null;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
}
