import {
  MODEL_SERVICE_CAPABILITIES,
  TEXT_EFFORTS,
  USAGE_PERIODS,
  type ConfigureProviderRequest,
  type DeclaredModel,
  type ImageModelInfo,
  type ModelCapabilitiesView,
  type ModelCost,
  type ModelInfoBase,
  type ModelServiceCapability,
  type ProviderAccountView,
  type ProviderConfigView,
  type ProviderUnavailableReason,
  type ProviderView,
  type SpeechModelInfo,
  type TextEffort,
  type TextModelInfo,
  type TranscribeModelInfo,
  type UsagePeriod,
} from '@cuccut/protocol';
import type { ExitCode } from '../envelope.ts';
import { defineNoun, readStdin, type AdminRun, type AdminValues } from './context.ts';
import { M } from './models-copy.ts';
import {
  accountOrderWithFirst,
  dirMode,
  dirProblem,
  findAccount,
  formatAccountLines,
  formatBundleLines,
  formatDirInspection,
  formatInstallPlan,
  formatModelsDir,
  formatRemoveResult,
  formatUsageReport,
  inspectDirChange,
  installFailureLines,
  installPrompt,
  removeTarget,
} from './models-output.ts';

const OPTIONS = {
  enable: { type: 'boolean' },
  disable: { type: 'boolean' },
  'key-stdin': { type: 'boolean' },
  endpoint: { type: 'string' },
  model: { type: 'string', multiple: true },
  'speech-model': { type: 'string', multiple: true },
  'image-model': { type: 'string', multiple: true },
  'text-model': { type: 'string', multiple: true },
  verify: { type: 'boolean' },
  effort: { type: 'string' },
  concurrency: { type: 'string' },
  yes: { type: 'boolean' },
  discard: { type: 'boolean' },
  set: { type: 'string' },
  reset: { type: 'boolean' },
  move: { type: 'boolean' },
  switch: { type: 'boolean' },
  label: { type: 'string' },
  region: { type: 'string' },
  period: { type: 'string' },
  provider: { type: 'string' },
} as const;

type Ctx = AdminRun<AdminValues<typeof OPTIONS>>;

/**
 * Admin bucket `cuccut models configure|accounts|usage|default|remove|refresh|parameters|dir|cancel|repair` (Architecture design §6):
 * credentials, defaults and the local model directory are changed only by the user. Capability queries, and listing, installing and checking model packages, are on the Agent surface (`models capabilities|list|install|test`).
 */
export const models = defineNoun({
  name: 'models',
  partial: true,
  verbs: ['configure', 'accounts', 'usage', 'default', 'remove', 'refresh', 'parameters', 'dir', 'cancel', 'repair'],
  get usage() {
    return M.help;
  },
  options: OPTIONS,
  async run(ctx) {
    const [sub, ...rest] = ctx.args;
    const { client, values } = ctx;
    switch (sub) {
      case 'repair': {
        const [bundleId] = rest;
        if (!bundleId) throw ctx.usageError(M.usageRepair);
        return repairBundle(ctx, bundleId);
      }
      case 'dir':
        return modelsDir(ctx);
      case 'cancel': {
        const [bundleId] = rest;
        if (!bundleId) throw ctx.usageError(M.usageCancel);
        const result = await client.request('models.cancelInstall', { bundleId, ...(values.discard ? { discard: true } : {}) });
        return ctx.done(result, [
          values.discard ? M.cancelledDiscarded : M.cancelledKept,
          ...formatBundleLines(result.bundle),
        ]);
      }
      case 'configure':
        return configure(ctx, rest[0]);
      case 'default': {
        const [capability, providerId, modelId] = rest;
        if (!capability || !providerId) throw ctx.usageError(M.usageDefault);
        if (!(MODEL_SERVICE_CAPABILITIES as readonly string[]).includes(capability)) {
          throw ctx.usageError(M.unknownCapability(capability, MODEL_SERVICE_CAPABILITIES));
        }
        const cleared = providerId === 'none';
        if (cleared && modelId) throw ctx.usageError(M.clearDefaultNoModel);
        const result = await client.request('models.setDefault', {
          capability: capability as ModelServiceCapability,
          providerId: cleared ? null : providerId,
          ...(modelId ? { modelId } : {}),
        });
        const label = M.capabilityLabels[capability as ModelServiceCapability];
        return ctx.done(result, [
          result.default ? M.defaultSet(label, result.default.providerId, result.default.modelId) : M.defaultCleared(label),
        ]);
      }
      case 'remove': {
        const [id] = rest;
        if (!id) throw ctx.usageError(M.usageRemove);
        const { capabilities } = await client.request('models.capabilities', {});
        const online = MODEL_SERVICE_CAPABILITIES.flatMap((c) =>
          capabilities[c].providers.filter((p) => p.kind === 'online').map((p) => p.providerId),
        );
        if (removeTarget(id, online) === 'provider') {
          const result = await client.request('models.removeProvider', { providerId: id });
          return ctx.done(result, [
            id.startsWith('custom:') ? M.customProviderDeleted(id) : M.providerRemoved(id),
          ]);
        }
        const result = await client.request('models.remove', { bundleId: id });
        return ctx.done(result, formatRemoveResult(result));
      }
      case 'refresh': {
        const [providerId] = rest;
        if (!providerId) throw ctx.usageError(M.usageRefresh);
        const result = await client.request('models.refreshProvider', { providerId });
        const { provider, refreshed } = result;
        const lines = [describeProvider(provider)];
        for (const capability of MODEL_SERVICE_CAPABILITIES) {
          for (const model of provider.capabilities[capability]?.models ?? [])
            lines.push(`  ${M.capabilityLabels[capability]}  ${describeModel(model)}`);
        }
        if (!refreshed.ok) {
          for (const line of lines) ctx.log(line);
          return ctx.fail({
            code: 'PROVIDER_REFRESH_FAILED',
            message: M.providerRefreshFailed(provider.providerId, refreshed.error),
            providerId: provider.providerId,
          });
        }
        return ctx.done(result, [
          M.providerRefreshed(provider.providerId, refreshed.models ?? 0, refreshed.voices, refreshed.at),
          ...lines,
        ]);
      }
      case 'accounts':
        return modelAccounts(ctx, rest);
      case 'usage': {
        const period = (values.period ?? '30d') as UsagePeriod;
        if (!(USAGE_PERIODS as readonly string[]).includes(period)) throw ctx.usageError(M.periodChoices(USAGE_PERIODS));
        const result = await client.request('models.usage', { period, ...(values.provider ? { providerId: values.provider } : {}) });
        return ctx.done(result, formatUsageReport(result, period, values.provider));
      }
      case 'parameters':
        return parameters(ctx, rest[0]);
      default:
        throw ctx.usageError();
    }
  },
});

async function configure(ctx: Ctx, providerId: string | undefined): Promise<ExitCode> {
  const { values } = ctx;
  if (!providerId) throw ctx.usageError(M.usageConfigure);
  if (values.enable && values.disable) throw ctx.usageError(M.enableDisableConflict);
  const request: ConfigureProviderRequest = { providerId };
  if (values.enable) request.enabled = true;
  if (values.disable) request.enabled = false;
  // Keys are read only from standard input: command-line arguments would stay in the shell history and the process list.
  if (values['key-stdin']) request.credential = await readKey(ctx);
  if (values.endpoint !== undefined) request.endpoint = values.endpoint;
  if (values.model || values['speech-model'] || values['image-model'] || values['text-model']) {
    const declared: DeclaredModel[] = [
      ...(values.model ?? []).map((modelId) => ({ modelId })),
      ...(values['speech-model'] ?? []).map((modelId) => ({ modelId, capability: 'synthesizeSpeech' as const })),
      ...(values['image-model'] ?? []).map((modelId) => ({ modelId, capability: 'generateImage' as const })),
      ...(values['text-model'] ?? []).map((modelId) => ({ modelId, capability: 'generateText' as const })),
    ];
    request.models = declared;
  }
  if (values.verify) request.verify = true;
  const result = await ctx.client.request('models.configure', request);
  return ctx.done(result, [M.saved(describeProvider(result.provider))]);
}

async function parameters(ctx: Ctx, capability: string | undefined): Promise<ExitCode> {
  const { values, client } = ctx;
  if (capability !== 'generateText') {
    throw ctx.usageError(M.usageParameters);
  }
  let result;
  if (values.effort === undefined && values.concurrency === undefined) {
    const { capabilities } = await client.request('models.capabilities', {});
    result = { parameters: capabilities.generateText.parameters };
  } else {
    const effort = values.effort === undefined ? undefined : values.effort === 'default' ? null : textEffort(ctx, values.effort);
    const concurrency =
      values.concurrency === undefined
        ? undefined
        : values.concurrency === 'default'
          ? null
          : positiveInteger(ctx, '--concurrency', values.concurrency);
    result = await client.request('models.setCapabilityParameters', {
      capability: 'generateText',
      ...(effort !== undefined ? { effort } : {}),
      ...(concurrency !== undefined ? { concurrency } : {}),
    });
  }
  return ctx.done(result, [describeTextParameters(result.parameters)]);
}

/**
 * Provider accounts (Architecture design §6.8): list, add (the key is read only from standard input), remove, and set as preferred. Calls always use the first account that is enabled and has a key,
 * and do not move on to the next on error. `use` moves an account to the front (`models.arrangeAccounts`). Output shows only masks.
 */
async function modelAccounts(ctx: Ctx, args: string[]): Promise<ExitCode> {
  const { client, values } = ctx;
  const [action, providerId, accountRef] = args;
  const usage = M.usageAccounts;
  const lines = (provider: ProviderView) => [describeProvider(provider), ...formatAccountLines(provider.config?.accounts ?? [])];
  if (action === 'add') {
    if (!providerId) throw ctx.usageError(usage);
    const credential = await readKey(ctx);
    const result = await client.request('models.addAccount', {
      providerId,
      credential,
      ...(values.label !== undefined ? { label: values.label } : {}),
      ...(values.region !== undefined ? { region: values.region } : {}),
      ...(values.endpoint !== undefined ? { endpoint: values.endpoint } : {}),
      ...(values.verify ? { verify: true } : {}),
    });
    const { provider } = result;
    const out = [values.verify ? M.verifiedAndSaved : M.savedPlain, ...lines(provider)];
    if (provider.config && !provider.config.enabled) out.push(`  ${M.providerNotEnabled(providerId)}`);
    return ctx.done(result, out);
  }
  if (action === 'remove' || action === 'use') {
    if (!providerId || !accountRef) throw ctx.usageError(usage);
    const accounts = await providerAccounts(ctx, providerId);
    const account = ctx.parse(() => findAccount(accounts, accountRef));
    if (action === 'remove') {
      const result = await client.request('models.removeAccount', { providerId, accountId: account.accountId });
      return ctx.done(result, [M.accountRemoved(account.label ?? account.masked), ...lines(result.provider)]);
    }
    const order = accountOrderWithFirst(accounts, account.accountId);
    const result = await client.request('models.arrangeAccounts', { providerId, order });
    return ctx.done(result, [M.accountPreferred(account.label ?? account.masked), ...lines(result.provider)]);
  }
  if (action && !providerId) {
    // `cuccut models accounts <providerId>`: list.
    const accounts = await providerAccounts(ctx, action);
    return ctx.done({ providerId: action, accounts }, formatAccountLines(accounts, ''));
  }
  throw ctx.usageError(usage);
}

/** A provider's accounts (its config is taken from the capability view). Errors when it is not an online provider. */
async function providerAccounts(ctx: Ctx, providerId: string): Promise<ProviderAccountView[]> {
  const { capabilities } = await ctx.client.request('models.capabilities', {});
  for (const capability of MODEL_SERVICE_CAPABILITIES) {
    const entry = capabilities[capability].providers.find((p) => p.providerId === providerId);
    if (!entry) continue;
    if (!entry.config || entry.config.credential === 'none') throw ctx.usageError(M.providerHasNoAccounts(providerId));
    return entry.config.accounts ?? [];
  }
  throw ctx.usageError(M.noSuchProvider(providerId));
}

/**
 * Repairs a model package. First prints the plan (size and source). After confirmation, submits it and follows the task's progress. Only `--yes` skips the confirmation. When not running in a terminal and `--yes` is not given, it refuses and does not default to consent.
 * (Installing is `models install` on the Agent surface.)
 */
async function repairBundle(ctx: Ctx, bundleId: string): Promise<ExitCode> {
  const { client } = ctx;
  const first = await client.request('models.repair', { bundleId });
  for (const line of formatInstallPlan(first.plan, 'repair')) ctx.log(line);
  let jobId = first.jobId;
  if (jobId) ctx.log(M.alreadyRepairing(jobId));
  if (!jobId && first.plan.upToDate) return ctx.done(first, [M.nothingToRepair]);
  if (!jobId) {
    const agreed = await ctx.confirm(installPrompt(first.plan, 'repair'), ctx.values.yes, M.notTtyConfirmDownload);
    if (!agreed) return ctx.done({ ...first, repaired: false }, [M.notDownloaded]);
  }
  return ctx.follow(
    async () => {
      if (jobId) return { jobId };
      const submitted = await client.request('models.repair', { bundleId, confirmBytes: first.plan.confirmBytes });
      if (!submitted.jobId) throw new Error(M.nothingToDownload);
      jobId = submitted.jobId;
      return { jobId };
    },
    {
      complete: async (job) => {
        const { bundles } = await client.request('models.list', {});
        const bundle = bundles.find((b) => b.bundleId === bundleId) ?? null;
        return ctx.done({ jobId: job.jobId, bundle }, [M.repairDone, ...(bundle ? formatBundleLines(bundle) : [])]);
      },
      stopped: (job) => {
        for (const line of installFailureLines(job.error)) ctx.log(line);
        if (job.state === 'cancelled') ctx.log(M.repairPartialKept(bundleId));
      },
    },
  );
}

/**
 * Shows or changes the model directory (Architecture design §6.3). Before changing it, explains the models already in the new location and the available space. When the current directory has models, the user chooses between
 * `--move` and `--switch`, and the choice is not made for them. Moving is a background task, shown with progress. Ctrl-C cancels it, and on failure or cancellation it rolls back.
 */
async function modelsDir(ctx: Ctx): Promise<ExitCode> {
  const { client, values } = ctx;
  const flags = { set: values.set, reset: values.reset, move: values.move, switch: values.switch };
  const usage = M.usageDir;
  if (flags.set !== undefined && flags.reset) throw ctx.usageError(M.setResetConflict(usage));
  if (flags.set === undefined && !flags.reset) {
    if (flags.move || flags.switch) throw ctx.usageError(usage);
    const info = await client.request('models.getDir', {});
    return ctx.done(info, formatModelsDir(info));
  }
  const target = flags.reset ? null : ctx.resolve(flags.set!);
  const inspection = await inspectDirChange(
    { getDir: () => client.request('models.getDir', {}), inspectDir: (dir) => client.request('models.inspectDir', { path: dir }) },
    target,
  );
  const problem = dirProblem(inspection);
  if (inspection.problem === 'same') return ctx.done(inspection, [problem ?? '']);
  if (problem) return ctx.fail({ code: 'MODELS_DIR_REJECTED', message: problem });
  for (const line of formatDirInspection(inspection)) ctx.log(line);
  const mode = dirMode(flags, inspection);
  if (!mode) throw ctx.usageError(M.dirHasModels);
  const first = await client.request('models.setDir', { path: target, mode });
  if (!first.jobId) {
    return ctx.done(first, [M.dirChanged(first.dir.path, mode === 'switch' && inspection.current.bytes > 0)]);
  }
  const jobId = first.jobId;
  return ctx.follow(async () => ({ jobId }), {
    complete: async () => {
      const info = await client.request('models.getDir', {});
      return ctx.done(info, [M.modelsMoved(info.path), ...formatModelsDir(info).slice(1)]);
    },
    stopped: () => ctx.log(M.dirRolledBack),
  });
}

/** Reads all of standard input as the key. When run directly in a terminal, shows how to end the input. The key is not echoed to the output. */
async function readKey(ctx: Ctx): Promise<string> {
  const key = (await readStdin(M.pasteKeyHint)).trim();
  if (!key) throw ctx.usageError(M.noKeyOnStdin);
  if (/\s/.test(key)) throw ctx.usageError(M.keyHasWhitespace);
  return key;
}

function positiveInteger(ctx: Ctx, option: string, value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw ctx.usageError(M.positiveInteger(option));
  return n;
}

function textEffort(ctx: Ctx, value: string): TextEffort {
  if (!(TEXT_EFFORTS as readonly string[]).includes(value)) throw ctx.usageError(M.effortChoices(TEXT_EFFORTS));
  return value as TextEffort;
}

function describeProvider(provider: ProviderView): string {
  const capabilities = MODEL_SERVICE_CAPABILITIES.flatMap((c) => {
    const cap = provider.capabilities[c];
    return cap ? [M.capabilityState(M.capabilityLabels[c], cap.available, unavailableLabel(cap.unavailableReason))] : [];
  });
  return `${provider.providerId}  ${provider.label}${describeConfig(provider.config)}  ${capabilities.join(M.capabilitySep)}`;
}

function describeConfig(config: ProviderConfigView | null): string {
  if (!config) return '';
  const parts = [config.enabled ? M.configEnabled : M.configDisabled];
  if (config.credential !== 'none') parts.push(M.keyState(config.credential === 'set'));
  if (config.endpoint) parts.push(M.configEndpoint(config.endpoint));
  if (config.refreshed) parts.push(config.refreshed.ok ? M.modelListRefreshed(config.refreshed.at) : M.lastRefreshFailed(config.refreshed.at));
  return `  [${parts.join(' · ')}]`;
}

function describeTextParameters(parameters: ModelCapabilitiesView['generateText']['parameters']): string {
  if (!parameters) return M.textParameters(null, 4);
  return M.textParameters(parameters.effort, parameters.concurrency);
}

function describeModel(model: ModelInfoBase): string {
  const marks: string[] = [];
  if (model.default) marks.push(M.markDefault);
  if (model.declared) marks.push(M.markDeclared);
  if (model.available === false) marks.push(unavailableLabel(model.unavailableReason));
  const transcribe = model as Partial<TranscribeModelInfo>;
  if (transcribe.wordTimestamps) marks.push(transcribe.wordTimestamps === 'native' ? M.wordTimestampsNative : M.wordTimestampsEstimated);
  if (typeof transcribe.maxInputBytes === 'number') marks.push(M.maxInputMegabytes((transcribe.maxInputBytes / 1_000_000).toFixed(0)));
  if (typeof transcribe.maxDurationSec === 'number') marks.push(M.maxDurationMinutes(Math.round(transcribe.maxDurationSec / 60)));
  const speech = model as Partial<SpeechModelInfo>;
  if (speech.voiceModes) {
    const voices = speech.voices ?? [];
    marks.push(voices.length > 0 ? M.voiceCount(voices.length, speech.defaultVoice) : M.noPresetVoices);
    if (speech.voiceModes.includes('custom') && voices.length > 0) marks.push(M.acceptsCustomVoices);
    if (typeof speech.maxInputChars === 'number') marks.push(M.maxInputChars(speech.maxInputChars));
    if (speech.formats) marks.push(speech.formats.join('/'));
    if (speech.acceptsInstructions) marks.push(M.acceptsInstructions);
  }
  const image = model as Partial<ImageModelInfo>;
  if (image.sizes) {
    marks.push(M.sizeCount(image.sizes.length, image.defaultSize));
    if (image.aspectRatios && image.aspectRatios.length > 0) marks.push(M.aspectRatios(image.aspectRatios.map((r) => r.ratio).join(' ')));
    if (typeof image.maxCount === 'number') marks.push(M.maxImageCount(image.maxCount));
    if (image.formats) marks.push(image.formats.join('/'));
    if (image.acceptsSeed === false && image.sizes.length === 0 && image.aspectRatios?.length === 0) marks.push(M.sizeAndSeedFixed);
  }
  const textModel = model as Partial<TextModelInfo>;
  if (typeof textModel.contextTokens === 'number') {
    marks.push(M.contextTokens(textModel.contextTokens), M.maxOutputTokens(textModel.maxOutputTokens));
    if (textModel.efforts && textModel.efforts.length > 0) {
      marks.push(M.efforts(textModel.efforts.join('/'), textModel.defaultEffort));
    }
    if (textModel.structuredOutput) marks.push(M.structuredOutput);
  }
  const cost = (model as { cost?: ModelCost }).cost;
  if (cost === 'subscription') marks.push(M.subscription);
  const name = model.label.includes(model.modelId) ? model.label : M.modelName(model.modelId, model.label);
  return `${name}${marks.length > 0 ? `  ${marks.join(' · ')}` : ''}${model.notes ? `\n      ${model.notes}` : ''}`;
}

function unavailableLabel(reason: ProviderUnavailableReason | undefined): string {
  return reason ? M.unavailableLabels[reason] : M.unavailable;
}
