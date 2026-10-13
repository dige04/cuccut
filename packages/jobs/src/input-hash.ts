import crypto from 'node:crypto';
import type { GenerationParameters } from '@cuccut/protocol';

/** Canonical JSON: object keys in lexicographic order, no whitespace; `undefined` fields are omitted. Equal values always give the same string. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Fields of a transcription task spec that determine the result (architecture design §6.6). */
export interface TranscribeInputSpec {
  contentHash: string;
  track: number;
  range: { start: number; end: number; timescale: number } | null;
  language: { mode: 'assert'; tag: string } | { mode: 'prefer'; tag: string | null };
  /** The Provider that runs it (`local`, `node:<nodeId>`, `openai`…) and the model (§6.2: a task freezes `providerId` and `modelId`). */
  providerId: string;
  modelId: string;
  /** Model package for local and node Providers; null for online Providers. */
  bundleId: string | null;
  diarize: boolean;
  hint: string | null;
  outputContract: string;
}

/** Input hash: `sha256:<hex>`, the digest of the canonical JSON of the fields above. Different Providers or models give different hashes. */
export function transcribeInputHash(spec: TranscribeInputSpec): string {
  const { contentHash, track, range, language, providerId, modelId, bundleId, diarize, hint, outputContract } = spec;
  return `sha256:${sha256Hex(canonicalJson({ contentHash, track, range, language, providerId, modelId, bundleId, diarize, hint, outputContract }))}`;
}

/** Fields of a generation task spec that determine the result (architecture design §6.6): capability, Provider, model and frozen parameters (including the original text or prompt). */
export interface GenerationInputSpec {
  capability: GenerationParameters['capability'];
  providerId: string;
  modelId: string;
  parameters: GenerationParameters;
  /** The video the result is imported into; null if there is none. Not part of the input hash. */
  videoId: string | null;
  /** Name of the imported asset (not part of the input hash). */
  name: string | null;
  /**
   * A copy at the save location (architecture design §7.9 “save location”; not part of the input hash). After publishing, a copy with a readable name is written into `dir`, named by `stem`.
   * Requests without `saveDir`, and tasks in the old ledger, do not have this field.
   */
  save?: { dir: string; stem: string } | null;
}

/**
 * Spec for a task that does not go through a model (export, architecture design §9.11). Everything needed to execute it is in the frozen snapshot artifact. The ledger records only its ID, and does not write the large plan into `jobs.jsonl`. The executor lives only in memory (after a Runtime restart such tasks are marked `interrupted` and are not resumed).
 * Installing, repairing and self-checking model packages (§6.3) are also tasks of this kind: the ledger records the model package and what is to be done.
 */
export type TaskInputSpec =
  | {
      task: 'export';
      /** Artifact of the frozen snapshot (`cuccut.export-snapshot/1`). */
      snapshotArtifactId: string;
    }
  | { task: 'modelInstall'; bundleId: string; repair: boolean; confirmBytes: number }
  | { task: 'modelTest'; bundleId: string }
  /** Moving a model directory (§6.3): from where to where, the repository to move, and the byte count. */
  | { task: 'modelsMove'; from: string; to: string; repos: string[]; bytes: number }
  /** Download of a managed external tool (architecture design §12.9): the tool, its version, and the digest of the files this machine has to download. */
  | { task: 'toolInstall'; tool: string; version: string; sha256: string }
  /** Update of an external tool by its original install method (§12.9): the tool, the method, and the command to run (argument array). */
  | { task: 'toolUpdate'; tool: string; method: string; argv: string[] }
  /** Voice cloning (§5.9): which voice in the library (frozen version and digest), and which Provider it is passed to. */
  | { task: 'voiceClone'; library: 'voices'; id: string; version: number; contentHash: string; providerId: string }
  /** Fonts downloaded on demand (§9.1): a family and the faces to download (weights and italics matched against the font catalog). The download address is not recorded. */
  | { task: 'fontDownload'; family: string; faces: { weight: number; italic: boolean }[] };

export function generationInputHash(spec: GenerationInputSpec): string {
  const { capability, providerId, modelId, parameters } = spec;
  return `sha256:${sha256Hex(canonicalJson({ capability, providerId, modelId, parameters }))}`;
}
