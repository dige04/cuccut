import { JobsEntryInput } from '@cuccut/protocol/messages/jobs/entry-input.ts';
import { invalid } from './params.ts';

/**
 * Space entries as file input to the pipeline (architecture design §7.9, “Space entries as input”): a parameter can be an absolute path or `{ entryId }`.
 * The Runtime swaps the entry for a path in the method layer of `pipelines.start`; the pipeline only freezes the path. An entry that was not swapped reaches this point and is rejected with `invalid-request`.
 */
export function fileInputSchema(pathDescription: string, entryDescription: string): Record<string, unknown> {
  return {
    oneOf: [
      { type: 'string', description: pathDescription },
      {
        type: 'object',
        properties: { entryId: { type: 'string', description: entryDescription } },
        required: ['entryId'],
        additionalProperties: false,
      },
    ],
  };
}

/** A `{ entryId }` left in the parameters: it means the call should be submitted through `pipelines.start`. If it is not an entry, nothing is done; the caller's check handles it. */
export function rejectUnresolvedEntry(key: string, value: unknown): void {
  if (typeof value === 'object' && value !== null && typeof (value as { entryId?: unknown }).entryId === 'string') {
    throw invalid(key, JobsEntryInput.unresolvedEntry());
  }
}
