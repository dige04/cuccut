#!/usr/bin/env node
/**
 * The CLI's offline catalog snapshot (agent surface design §2.3): `cuccut --help`, `help <command>` and `spec` must work
 * without a Runtime too, and are derived from this snapshot.
 *
 * Lists every tool set the Runtime assembles (with empty dependencies; only schemas and catalog entries are read) in the
 * terminal view (`surfaces` include `cli`), in exactly the shape of the gateway's `catalog.list` result, plus the
 * `edits_ops` operation catalog. Written to `apps/cli/src/generated/catalog.json` (generated, not in git).
 *
 *   node tools/catalog-snapshot.ts          write the snapshot
 *   node tools/catalog-snapshot.ts --check  exit code 1 when the snapshot differs from the current catalog (or is missing)
 *
 * The root `package.json`'s `build:catalog`, `pretest` and `prebuild` run it; vitest's globalSetup also writes it once
 * before tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_INTERFACE_VERSION, type CatalogSnapshot } from '@cuccut/protocol';
import { silentLogger } from '@cuccut/harness';
import { ToolCatalog } from '../packages/runtime-core/src/agent-tools/tool-catalog.ts';
import { defaultToolRisk } from '../packages/runtime-core/src/agent-tools/tool-scope.ts';
import { editOperationsCatalog } from '../packages/runtime-core/src/agent-tools/video-tools.ts';
import { allToolSets } from '../packages/runtime-core/src/agent-tools/all-tool-sets.ts';

export const SNAPSHOT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'cli',
  'src',
  'generated',
  'catalog.json',
);

/** The current catalog snapshot: same shape as `catalog.list` for the terminal, plus the operation catalog. */
export function buildCatalogSnapshot(): CatalogSnapshot {
  const catalog = new ToolCatalog(allToolSets(), silentLogger, { surface: 'cli' });
  return {
    interfaceVersion: MCP_INTERFACE_VERSION,
    tools: catalog.list().map((tool) => ({ ...tool, risk: defaultToolRisk(tool.name) })),
    editOps: editOperationsCatalog(),
  };
}

/** The snapshot's text (stable indentation, easy to compare). */
export function snapshotText(snapshot: CatalogSnapshot = buildCatalogSnapshot()): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** Writes the snapshot, leaving the file alone when nothing changed. Returns whether it wrote. */
export function writeCatalogSnapshot(file = SNAPSHOT_FILE): boolean {
  const text = snapshotText();
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(SNAPSHOT_FILE) ? fs.readFileSync(SNAPSHOT_FILE, 'utf8') : null;
    if (current !== snapshotText()) {
      process.stderr.write(`The catalog snapshot differs from the current tool catalog: run npm run build:catalog (${SNAPSHOT_FILE})\n`);
      process.exit(1);
    }
  } else {
    writeCatalogSnapshot();
  }
}
