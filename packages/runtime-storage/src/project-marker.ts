import fs from 'node:fs/promises';
import path from 'node:path';
import type { Id } from '@cuccut/protocol';
import { writeJsonAtomic } from './json-file.ts';
import { RuntimeStorageFiles as SF } from '@cuccut/protocol/messages/runtime-storage';

/**
 * Project marker `<project directory>/.ccut/project.json` (architecture design §5.1): the project's identity lives in the directory, and the registry is only an index.
 * The marker directory holds only CucCut's own project-level state, not user content.
 */

export const PROJECT_MARKER_DIR = '.ccut';
export const PROJECT_MARKER_FILE = 'project.json';
export const PROJECT_MARKER_FORMAT = 'cuccut.project';
export const PROJECT_MARKER_SCHEMA_VERSION = 1;

export interface ProjectMarker {
  format: typeof PROJECT_MARKER_FORMAT;
  schemaVersion: typeof PROJECT_MARKER_SCHEMA_VERSION;
  projectId: Id;
  createdAt: string;
}

export type ProjectMarkerRead =
  | { kind: 'none' }
  | { kind: 'ok'; marker: ProjectMarker }
  /** Readable but not recognized: not JSON, wrong `format`, or missing fields. */
  | { kind: 'corrupt'; reason: string }
  /** Newer than this version understands: cannot be understood, and cannot be rewritten. */
  | { kind: 'unsupported'; schemaVersion: number };

const PROJECT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function projectMarkerPath(dir: string): string {
  return path.join(dir, PROJECT_MARKER_DIR, PROJECT_MARKER_FILE);
}

/** Reads the project marker. No file returns `none`. Read errors (permissions and the like) are thrown as usual. */
export async function readProjectMarker(dir: string): Promise<ProjectMarkerRead> {
  let text: string;
  try {
    text = await fs.readFile(projectMarkerPath(dir), 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'none' };
    throw error;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'corrupt', reason: SF.markerNotJson().text };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { kind: 'corrupt', reason: SF.markerNotObject().text };
  const record = data as Record<string, unknown>;
  if (record.format !== PROJECT_MARKER_FORMAT) return { kind: 'corrupt', reason: SF.markerFormat({ format: PROJECT_MARKER_FORMAT }).text };
  const version = record.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { kind: 'corrupt', reason: SF.markerSchemaVersion().text };
  if (version > PROJECT_MARKER_SCHEMA_VERSION) return { kind: 'unsupported', schemaVersion: version };
  if (typeof record.projectId !== 'string' || !PROJECT_ID.test(record.projectId)) return { kind: 'corrupt', reason: SF.markerProjectId().text };
  const createdAt = typeof record.createdAt === 'string' && !Number.isNaN(Date.parse(record.createdAt)) ? record.createdAt : null;
  if (!createdAt) return { kind: 'corrupt', reason: SF.markerCreatedAt().text };
  return {
    kind: 'ok',
    marker: { format: PROJECT_MARKER_FORMAT, schemaVersion: PROJECT_MARKER_SCHEMA_VERSION, projectId: record.projectId, createdAt },
  };
}

/** Atomically writes the project marker. */
export async function writeProjectMarker(dir: string, projectId: Id, createdAt: string): Promise<ProjectMarker> {
  const marker: ProjectMarker = {
    format: PROJECT_MARKER_FORMAT,
    schemaVersion: PROJECT_MARKER_SCHEMA_VERSION,
    projectId,
    createdAt,
  };
  await writeJsonAtomic(projectMarkerPath(dir), marker);
  return marker;
}

/** An unrecognized marker is kept by renaming it (`project.json.corrupt-<time>`), not silently overwritten. Returns the renamed path. */
export async function quarantineProjectMarker(dir: string, now = new Date()): Promise<string> {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const from = projectMarkerPath(dir);
  let to = `${from}.corrupt-${stamp}`;
  for (let n = 2; await exists(to); n++) to = `${from}.corrupt-${stamp}-${n}`;
  await fs.rename(from, to);
  return to;
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}
