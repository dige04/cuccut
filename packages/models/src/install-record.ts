import fs from 'node:fs/promises';
import path from 'node:path';
import type { ModelSelfTestResult } from '@cuccut/protocol';

/**
 * Install record (architecture design §6.3): `<models-root>/.ccut-installs.json`, recording which model packs the user has installed and the result of each one's most recent self-test.
 *
 * Shared component references are computed from it: a component's holders are the model packs that use it and are either on record or have complete files. When a model pack is deleted, only components with no other holders are removed. The record lives alongside the model files: when the model directory is moved (`models.setDir`), it is merged into the new directory and the references move with it. If the file is corrupt, it is treated as an empty record (references fall back to "model packs with complete files").
 */

export const INSTALL_RECORD_FILE = '.ccut-installs.json';

export interface InstallRecordEntry {
  installedAt: string;
  selfTest?: ModelSelfTestResult;
}

export interface InstallRecord {
  format_version: 1;
  bundles: Record<string, InstallRecordEntry>;
}

const queues = new Map<string, Promise<unknown>>();

export async function readInstallRecord(root: string): Promise<InstallRecord> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(root, INSTALL_RECORD_FILE), 'utf8')) as Partial<InstallRecord>;
    if (raw.format_version === 1 && typeof raw.bundles === 'object' && raw.bundles !== null && !Array.isArray(raw.bundles)) {
      return { format_version: 1, bundles: raw.bundles };
    }
  } catch {
    // Missing or corrupt: empty record.
  }
  return { format_version: 1, bundles: {} };
}

/** Read-modify-write, executed serially per root; write a temp file, then rename. */
export function updateInstallRecord(root: string, change: (record: InstallRecord) => void): Promise<InstallRecord> {
  const previous = queues.get(root) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const record = await readInstallRecord(root);
      change(record);
      await fs.mkdir(root, { recursive: true });
      const file = path.join(root, INSTALL_RECORD_FILE);
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`);
      await fs.rename(tmp, file);
      return record;
    });
  queues.set(root, next);
  const done = () => {
    if (queues.get(root) === next) queues.delete(root);
  };
  next.then(done, done);
  return next;
}
