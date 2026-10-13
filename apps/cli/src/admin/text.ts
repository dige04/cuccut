import fs from 'node:fs/promises';
import { TEXT_EFFORTS, newId, type GenerateTextRequest, type TextEffort, type TextMessage } from '@cuccut/protocol';
import { CliError } from '../envelope.ts';
import { defineNoun, readStdin } from './context.ts';
import { M } from './text-copy.ts';

/**
 * `cuccut text <prompt>`: calls the text model once (`models.generateText`), waits for it to finish, and gets the full text back via `artifacts.openHandle`.
 * For human reading, the full text is written to stdout (model, usage and notes go to stderr, so it can be piped); with `--json`, the full text is in the `text` field of the result.
 * With `--out`, the full text is written to a file, and the result is a summary of the task and artifact.
 */
export const text = defineNoun({
  name: 'text',
  get usage() {
    return M.help;
  },
  options: {
    system: { type: 'string' },
    'json-schema': { type: 'string' },
    provider: { type: 'string' },
    model: { type: 'string', multiple: true },
    'max-output-tokens': { type: 'string' },
    effort: { type: 'string' },
    temperature: { type: 'string' },
    seed: { type: 'string' },
    out: { type: 'string' },
  },
  async run(ctx) {
    const { client, values, output } = ctx;
    const joined = ctx.args.join(' ');
    const prompt = joined === '-' ? await readStdin(M.stdinPromptHint) : joined;
    if (!prompt.trim()) throw ctx.usageError(M.missingPrompt);
    const messages: TextMessage[] = [];
    if (values.system !== undefined) messages.push({ role: 'system', content: values.system });
    messages.push({ role: 'user', content: prompt });
    const request: GenerateTextRequest = { messages, commandId: newId('cmd') };
    if (values['json-schema']) {
      const file = ctx.resolve(values['json-schema']);
      let schema: unknown;
      try {
        schema = JSON.parse(await fs.readFile(file, 'utf8'));
      } catch (error) {
        throw ctx.usageError(M.jsonSchemaUnreadable(file, error instanceof Error ? error.message : String(error)));
      }
      if (typeof schema !== 'object' || schema === null || Array.isArray(schema))
        throw ctx.usageError(M.jsonSchemaNotObject);
      request.responseFormat = { type: 'json', schema: schema as Record<string, unknown> };
    }
    if (values.provider) request.provider = values.provider;
    if (values.model) {
      if (values.model.length > 1) throw ctx.usageError(M.singleModel);
      request.model = values.model[0]!;
    }
    if (values['max-output-tokens'] !== undefined) {
      const n = Number(values['max-output-tokens']);
      if (!Number.isSafeInteger(n) || n < 1) throw ctx.usageError(M.maxOutputTokensInvalid);
      request.maxOutputTokens = n;
    }
    if (values.effort !== undefined) {
      if (!(TEXT_EFFORTS as readonly string[]).includes(values.effort)) throw ctx.usageError(M.effortChoices(TEXT_EFFORTS));
      request.effort = values.effort as TextEffort;
    }
    if (values.temperature !== undefined) {
      const temperature = Number(values.temperature);
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw ctx.usageError(M.temperatureRange);
      request.temperature = temperature;
    }
    if (values.seed !== undefined) {
      const seed = Number(values.seed);
      if (!Number.isSafeInteger(seed)) throw ctx.usageError(M.seedInvalid);
      request.seed = seed;
    }

    return ctx.follow(() => client.request('models.generateText', request), {
      complete: async (job) => {
        const summary = job.result?.text;
        if (!job.result || !summary) throw new CliError('COMMAND_FAILED', M.noTextResult);
        const artifactId = job.result.artifactId;
        const handle = await client.request('artifacts.openHandle', { artifactId });
        const response = await fetch(handle.url);
        if (!response.ok) throw new CliError('COMMAND_FAILED', M.fetchOutputFailed(artifactId, response.status));
        const content = Buffer.from(await response.arrayBuffer());
        for (const note of summary.notes) ctx.log(`[note] ${note}`);
        const { preview: _preview, ...rest } = summary;
        const meta = { jobId: job.jobId, providerId: job.providerId, modelId: job.modelId, artifactId, ...rest };
        if (values.out) {
          const file = ctx.resolve(values.out);
          await fs.writeFile(file, content);
          return ctx.done({ ...meta, file }, [M.written(file)]);
        }
        if (output.json) return ctx.done({ ...meta, text: content.toString('utf8') }, []);
        const usage = summary.usage ? { input: summary.usage.inputTokens ?? '?', output: summary.usage.outputTokens ?? '?' } : null;
        ctx.log(M.modelLine(job.providerId, summary.modelVersion ?? job.modelId, usage));
        output.stdout.write(content);
        if (!content.toString('utf8').endsWith('\n')) output.stdout.write('\n');
        return ctx.done(meta, []);
      },
    });
  },
});
