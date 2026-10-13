import type { EditOperation, GenerationParameters, JobRecord } from '@cuccut/protocol';
import { JobsGeneratedImport as J } from '@cuccut/protocol/messages/jobs/generated-import.ts';

/**
 * The single operation that imports a generated output into a video (architecture design §5.7, §7.3). When a generation task is given a video, the JobManager imports with it. For a task given no video, a later “add the artifact to the video” also uses it (the agent, via `importAsset` + `artifactId` in `edits_apply`). Both routes record exactly the same source.
 *
 * - Bytes always go into the video directory (`managed`). Files in the artifact store are not the user's original files and cannot be linked (video format spec §4.2).
 * - The source records only the task, Provider, model, parameters and digest, not the original text or prompt (those live only in the task record).
 */
export function generatedImportOperation(
  record: JobRecord,
  output: { artifactId: string; file: string; index: number; total: number },
  options: { name?: string | null; ref?: string } = {},
): EditOperation {
  const generation = record.generation!;
  const base = options.name ?? defaultAssetName(generation);
  const { text: _text, prompt: _prompt, ...parameters } = generation as GenerationParameters & { text?: string; prompt?: string };
  return {
    type: 'importAsset',
    path: output.file,
    name: output.total > 1 ? `${base} ${output.index + 1}` : base,
    ...(options.ref !== undefined ? { ref: options.ref } : {}),
    storage: 'managed',
    provenance: {
      origin: 'generated',
      source: {
        jobId: record.jobId,
        capability: generation.capability,
        providerId: record.providerId,
        modelId: record.modelId,
        inputHash: record.inputHash,
        contentHash: record.contentHash,
        artifactId: output.artifactId,
        parameters,
      },
    },
  };
}

/** Asset name used when no name is given: the kind, plus the start of the original text or prompt. (Text generation does not import into a video; this is here only so the type is complete.) */
function defaultAssetName(parameters: GenerationParameters): string {
  const source =
    parameters.capability === 'synthesizeSpeech'
      ? parameters.text
      : parameters.capability === 'generateImage'
        ? parameters.prompt
        : parameters.capability === 'generateMusic'
          ? parameters.style
          : (parameters.messages.findLast((m) => m.role === 'user')?.content ?? '');
  const head = [...source.replace(/\s+/g, ' ').trim()].slice(0, 24).join('');
  const more = [...source.trim()].length > 24 ? '…' : '';
  const name =
    parameters.capability === 'synthesizeSpeech' ? J.voiceOverName : parameters.capability === 'generateMusic' ? J.musicName : J.imageName;
  return name({ head: `${head}${more}` }).text;
}
