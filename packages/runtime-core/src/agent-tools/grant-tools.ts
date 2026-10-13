import { z } from 'zod';
import { MODEL_SERVICE_CAPABILITIES, type GrantRequestItem, type Id, type ModelServiceCapability } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { ModelJobs } from '../models/model-jobs.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { videoArg } from './video-tools.ts';

/**
 * One up-front request for the outbound data a task needs (architecture design §12.5): before starting a series of model
 * calls, the agent bundles which providers get which data, and roughly how many times, into one approval (risk `high`);
 * the user approves once instead of confirming each call.
 *
 * - Only for agents in a session (`surfaces` is only `agent`: external-service clients have no task, and the MCP
 *   service's catalog does not list it);
 * - once approved, each item issues a grant that belongs to this task only, capped at the requested number of calls
 *   (the user may also choose to issue a standing grant);
 * - items already covered by a grant, and local and node items, skip the approval; if the quota is insufficient the
 *   whole request is rejected with `BUDGET_EXCEEDED` without an approval;
 * - it does not relax the budget: every later call is still reserved and settled at submission, and once the calls run
 *   out the result is `BUDGET_EXCEEDED`.
 */

export interface GrantToolsDeps {
  models: ModelJobs;
  scope: ToolScope;
}

const capabilityArg = z.enum(MODEL_SERVICE_CAPABILITIES as [ModelServiceCapability, ...ModelServiceCapability[]]);

const schemas = {
  grants_request: z.strictObject({
    items: z
      .array(
        z.strictObject({
          capability: capabilityArg.describe('Capability: transcribe, synthesizeSpeech, generateImage, generateMusic'),
          provider: z.string().min(1).max(200).optional().describe('Optional. Provider; defaults to the default for this capability'),
          model: z.string().min(1).max(200).optional().describe('Optional. Model ID'),
          video: videoArg.optional().describe('Optional. The video the data comes from (or the result is imported into); when given, the grant covers only this video'),
          calls: z.number().int().min(1).max(500).describe('Expected number of calls in this task (the grant\'s call cap)'),
          purpose: z.string().min(1).max(200).describe('Purpose, shown to the user (e.g. "Synthesize speech for narration segment 3")'),
        }),
      )
      .min(1)
      .max(10)
      .describe('Outbound uses to request, one capability per item (the same kind of data for the same provider goes in one item), at most 10 items'),
  }),
};

type Args = z.infer<(typeof schemas)['grants_request']>;

const DEFINITIONS: Record<keyof typeof schemas, ToolInfo> = {
  grants_request: {
    title: 'Request outbound data grants',
    description: [
      'Bundles the data a task will send out into one grant request.',
      'When a task will call online or agent providers several times (transcription, speech synthesis, image generation), use this first to bundle the data to be sent into one request; the user approves once.',
      'Each item gives the capability, optional provider / model / video, the expected number of calls, and the purpose. Once approved you get a grant that belongs to this task only, capped at calls; later calls no longer ask for a grant each time, and once the calls run out they are rejected with BUDGET_EXCEEDED.',
      'Local models, paired nodes and items already covered by a grant need no request (status not-needed / covered in the result). If the user declines, do not work around it by switching providers or any other means.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Request a grant for a series of speech syntheses',
        args: { items: [{ capability: 'synthesizeSpeech', provider: 'openai', calls: 12, purpose: 'Synthesize the narration segment by segment' }] },
      },
    ],
    // Grants belong to the session's task: external-service clients have no task, and the CLI is the user themself (enabling a Provider is a standing grant).
    surfaces: ['agent'],
  },
};

export class GrantTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #models: ModelJobs;
  readonly #scope: ToolScope;

  constructor(deps: GrantToolsDeps) {
    this.#models = deps.models;
    this.#scope = deps.scope;
  }

  dispatch(_name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    return this.#request(args as Args, principal);
  }

  async #request(args: Args, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    if (access.submitter.kind !== 'agent') throw new ToolError('UNKNOWN_TOOL', 'This tool is only for agents in a session');
    const taskId: Id = access.submitter.taskId;
    await this.#models.services.capabilities();
    const results: Record<string, unknown>[] = [];
    const pending: GrantRequestItem[] = [];
    const slots: number[] = [];
    for (const item of args.items) {
      const videoId = item.video !== undefined ? (await this.#scope.open(item.video, access)).ref.videoId : null;
      const plan = this.#models.grants.plan({
        capability: item.capability,
        providerId: item.provider,
        modelId: item.model,
        videoId,
        taskId,
        purpose: item.purpose,
      });
      if (plan.status === 'none') {
        results.push({ capability: item.capability, status: 'not-needed', note: 'Local, a node, or the provider is not enabled (submission will be rejected)' });
      } else if (plan.status === 'covered') {
        results.push({ capability: item.capability, status: 'covered', grantId: plan.grant.grantId, recipient: plan.grant.recipient });
      } else {
        slots.push(results.length);
        results.push({ capability: item.capability, status: 'requested' });
        pending.push({ ...plan.item, maxCalls: item.calls });
      }
    }
    if (pending.length === 0) return { items: results, next: 'No new grant needed; submit directly.' };
    const approval = await this.#scope.confirm(access, {
      tool: 'grants_request',
      ...confirmSummary(
        RcAgentTools.grantSummary({
          recipients: [...new Set(pending.map((p) => p.recipient))].join(RcAgentTools.listSeparator().text),
          items: pending
            .map((p) => RcAgentTools.grantSummaryItem({ purpose: p.purpose, maxCalls: p.maxCalls }).text)
            .join(RcAgentTools.clauseSeparator().text),
        }),
      ),
      risk: 'high',
      grants: pending,
    });
    const issued = approval?.grant ? this.#models.grants.issueForTask(pending, approval.grant, { approvalId: null, taskId }) : [];
    issued.forEach((grant, i) => {
      results[slots[i]!] = {
        capability: pending[i]!.capability,
        status: 'granted',
        grantId: grant.grantId,
        recipient: grant.recipient,
        dataKinds: grant.dataKinds,
        videoId: grant.scope.videoId,
        maxCalls: grant.maxCalls,
        taskId: grant.taskId,
      };
    });
    return {
      items: results,
      ...approvalField(approval),
      next: 'Grant issued: submit within the requested number of calls; once they run out, calls are rejected with BUDGET_EXCEEDED. Then tell the user what happened; do not work around it by switching providers.',
    };
  }
}
