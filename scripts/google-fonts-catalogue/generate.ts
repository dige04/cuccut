// Generates the Google Fonts catalogue that ships with the Runtime (`packages/runtime-core/src/fonts/google-fonts-catalogue.json`). For usage, see README.md in the same directory.
//
//   node scripts/google-fonts-catalogue/generate.ts [--metadata <文件>] [--licences <文件>] [--out <文件>]

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

/** Public font metadata (no API key). */
const METADATA_URL = 'https://fonts.google.com/metadata/fonts';
/** Directory tree of the google/fonts repo: licenses are grouped by top-level directory (`ofl/`, `apache/`, `ufl/`); subdirectory names are the family names lowercased with spaces and symbols removed. */
const TREE_API = 'https://api.github.com/repos/google/fonts/' + 'git/trees/';

const LICENCE_DIRS = { ofl: 'OFL-1.1', apache: 'Apache-2.0', ufl: 'UFL-1.0' } as const;
type Licence = (typeof LICENCE_DIRS)[keyof typeof LICENCE_DIRS];

const CATEGORIES: Record<string, string> = {
  'Sans Serif': 'sans-serif',
  Serif: 'serif',
  Display: 'display',
  Handwriting: 'handwriting',
  Monospace: 'monospace',
};

interface MetadataFamily {
  family: string;
  category: string;
  subsets: string[];
  fonts: Record<string, unknown>;
  axes: unknown[];
  popularity: number;
}

/** One entry in the directory (short keys, small files): f family name, c category, s character subset, w upright weights, i italic weights, v variable font, l license. */
interface CatalogueFamily {
  f: string;
  c: string;
  s: string[];
  w: number[];
  i?: number[];
  v?: 1;
  l: Licence;
}

const { values } = parseArgs({
  options: {
    metadata: { type: 'string' },
    licences: { type: 'string' },
    out: { type: 'string' },
  },
});

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const out = path.resolve(values.out ?? path.join(repoRoot, 'packages/runtime-core/src/fonts/google-fonts-catalogue.json'));

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { 'User-Agent': 'CucCut catalogue script' } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const text = await response.text();
  return JSON.parse(stripGuard(text));
}

/** The metadata endpoint's response starts with `)]}'` to guard against JSON hijacking; strip it before parsing. */
function stripGuard(text: string): string {
  return text.startsWith(")]}'") ? text.slice(4) : text;
}

async function loadMetadata(): Promise<MetadataFamily[]> {
  const raw = values.metadata ? JSON.parse(stripGuard(readFileSync(values.metadata, 'utf8'))) : await getJson(METADATA_URL);
  return (raw as { familyMetadataList: MetadataFamily[] }).familyMetadataList;
}

/** `{ ofl: [目录名…], apache: […], ufl: […] }`. */
async function loadLicenceDirs(): Promise<Record<string, string[]>> {
  if (values.licences) return JSON.parse(readFileSync(values.licences, 'utf8')) as Record<string, string[]>;
  const root = (await getJson(`${TREE_API}main`)) as { tree: { path: string; sha: string }[] };
  const dirs: Record<string, string[]> = {};
  for (const entry of root.tree) {
    if (!(entry.path in LICENCE_DIRS)) continue;
    const sub = (await getJson(`${TREE_API}${entry.sha}`)) as { tree: { path: string; type: string }[]; truncated: boolean };
    if (sub.truncated) throw new Error(`The directory tree of ${entry.path} was truncated`);
    dirs[entry.path] = sub.tree.filter((t) => t.type === 'tree').map((t) => t.path);
  }
  return dirs;
}

function dirKey(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const metadata = await loadMetadata();
const licenceDirs = await loadLicenceDirs();
const licenceOf = new Map<string, Licence>();
for (const [dir, licence] of Object.entries(LICENCE_DIRS)) for (const name of licenceDirs[dir] ?? []) licenceOf.set(name, licence);

const families: CatalogueFamily[] = [];
const skipped: string[] = [];
for (const meta of [...metadata].sort((a, b) => a.popularity - b.popularity || a.family.localeCompare(b.family))) {
  const licence = licenceOf.get(dirKey(meta.family));
  const category = CATEGORIES[meta.category];
  const keys = Object.keys(meta.fonts);
  const weights = keys.filter((k) => /^\d+$/.test(k)).map(Number);
  const italics = keys.filter((k) => /^\d+i$/.test(k)).map((k) => Number(k.slice(0, -1)));
  // Fonts whose license cannot be recognized are not included: the license must be shown when choosing a font.
  if (!licence || !category || weights.length + italics.length === 0) {
    skipped.push(meta.family);
    continue;
  }
  families.push({
    f: meta.family,
    c: category,
    s: meta.subsets.filter((s) => s !== 'menu').sort(),
    w: weights.sort((a, b) => a - b),
    ...(italics.length > 0 ? { i: italics.sort((a, b) => a - b) } : {}),
    ...(meta.axes.length > 0 ? { v: 1 as const } : {}),
    l: licence,
  });
}

const lines = families.map((family) => `  ${JSON.stringify(family)}`);
const text = `{"schema":"cuccut.google-fonts-catalogue/1","generatedAt":"${new Date().toISOString().slice(0, 10)}","families":[\n${lines.join(',\n')}\n]}\n`;
writeFileSync(out, text);
process.stdout.write(`Wrote ${families.length} families (${(text.length / 1024).toFixed(0)} KiB) to ${path.relative(repoRoot, out)}\n`);
if (skipped.length > 0) process.stdout.write(`Skipped (license or category not recognized): ${skipped.join(', ')}\n`);
