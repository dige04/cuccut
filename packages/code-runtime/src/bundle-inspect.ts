import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import {
  CODE_BUNDLE_ALLOWED_EXTENSIONS,
  CODE_BUNDLE_CONTRACTS,
  CODE_BUNDLE_FORMAT,
  CODE_BUNDLE_HASH_PREFIX,
  CODE_BUNDLE_LIMITS,
  CODE_BUNDLE_SCHEMA_VERSION,
  CODE_BUNDLE_UNHASHED_FILES,
  type CodeBundleContract,
  type CodeBundleErrorCode,
  type CodeBundleFileEntry,
  type CodeBundleManifest,
  type Rate,
} from '@cuccut/protocol';

/**
 * Import checks for a code bundle (code bundle spec §2, §6.2): reads the directory, rejects symbolic links and files outside the allowlist, computes `contentHash`, validates or synthesizes the manifest, and statically scans for network references. It only reads the source directory. When a manifest has to be synthesized, the whole tree is first copied to a staging directory, and the manifest is written there.
 */

/** Errors from code bundle import, validation, frame fetching and baking. `code` is taken from `CODE_BUNDLE_ERROR_CODES`. */
export class CodeBundleError extends Error {
  readonly code: CodeBundleErrorCode;
  readonly details?: unknown;

  constructor(code: CodeBundleErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'CodeBundleError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** A network reference found by static scanning. `text` is the matched URL (a protocol-relative reference keeps its leading `//`). */
export interface NetworkReference {
  path: string;
  line: number;
  text: string;
}

export type BundleLimits = { [K in keyof typeof CODE_BUNDLE_LIMITS]: number };

export interface ListBundleFilesOptions {
  /** Overrides the default limits (for tests). */
  limits?: Partial<BundleLimits>;
}

/** Values that can be overridden when synthesizing the manifest. Those not given are read from the `data-*` attributes on the root element of the entry HTML. */
export interface SynthesizeOverrides {
  bundleId?: string;
  revision?: string;
  entry?: string;
  contract?: CodeBundleContract;
  width?: number;
  height?: number;
  /** The frame rate: an integer ratio, or a number (29.97-style values are converted to 30000/1001 per NTSC). */
  fps?: Rate | number;
  durationFrames?: number;
  /** Whether the output has transparency. Defaults to the root element's `data-alpha`, otherwise false. */
  alpha?: boolean;
}

export interface InspectBundleOptions {
  /** Override values used when synthesizing the manifest, for when there is no `bundle.manifest.json`. */
  manifest?: SynthesizeOverrides;
  compositionId?: string;
  /** Whether synthesis is allowed when there is no manifest (default true). */
  allowSynthesize?: boolean;
  /** The staging directory used when synthesizing the manifest (default: a new directory under the system temp directory). The directory must not exist or must be empty. */
  stagingDir?: string;
  /** When a network reference is found by static scanning, throws `BUNDLE_NETWORK_REFERENCE` (default true). With false, it is only recorded in the result. */
  strictNetwork?: boolean;
  limits?: Partial<BundleLimits>;
}

export interface InspectedBundle {
  /** The root directory of the bundle. When there is a manifest, it is the source directory. When the manifest is synthesized, it is the staging copy. */
  root: string;
  manifest: CodeBundleManifest;
  entries: CodeBundleFileEntry[];
  totalBytes: number;
  /** The manifest was synthesized here (it is not in the source directory). */
  synthesized: boolean;
  networkReferences: NetworkReference[];
  compositionId: string;
}

const MANIFEST_FILE = 'bundle.manifest.json';
const FILES_MANIFEST_FILE = 'files.manifest.json';
const DEPENDENCY_LOCK_FILE = 'dependency.lock';
const BUILD_RECIPE_FILE = 'build.recipe.json';

/** The files inside the bundle that are allowed by name (the fixed files of spec §2.5). */
const NAMED_FILES = new Set([
  MANIFEST_FILE,
  FILES_MANIFEST_FILE,
  'verification.json',
  DEPENDENCY_LOCK_FILE,
  BUILD_RECIPE_FILE,
  'parameters.schema.json',
]);
const ALLOWED_EXTENSIONS = new Set<string>(CODE_BUNDLE_ALLOWED_EXTENSIONS);
const UNHASHED = new Set<string>(CODE_BUNDLE_UNHASHED_FILES);
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.svg']);

const sha256Hex = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');
const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * Recursively lists the files in the bundle (`lstat`, does not follow links), sorted by `path`.
 * A symbolic link → `BUNDLE_SYMLINK`. Dot files, `node_modules`, and extensions outside the allowlist → `BUNDLE_FILE_NOT_ALLOWED`. Over the limit → `BUNDLE_TOO_LARGE`.
 */
export async function listBundleFiles(dir: string, options: ListBundleFilesOptions = {}): Promise<CodeBundleFileEntry[]> {
  const limits: BundleLimits = { ...CODE_BUNDLE_LIMITS, ...options.limits };
  const root = path.resolve(dir);
  const entries: CodeBundleFileEntry[] = [];
  let totalBytes = 0;

  const walk = async (absDir: string, relDir: string): Promise<void> => {
    const names = (await fs.readdir(absDir)).sort();
    for (const name of names) {
      const abs = path.join(absDir, name);
      const rel = relDir ? `${relDir}/${name}` : name;
      const stat = await fs.lstat(abs);
      if (stat.isSymbolicLink())
        throw new CodeBundleError('BUNDLE_SYMLINK', `Symbolic links are not allowed in a code bundle: ${rel}`, { path: rel });
      if (name.startsWith('.') || name === 'node_modules') {
        throw new CodeBundleError('BUNDLE_FILE_NOT_ALLOWED', `Hidden files and node_modules are not allowed in a code bundle: ${rel}`, {
          path: rel,
        });
      }
      if (rel.length > limits.maxPathLength) {
        throw new CodeBundleError('BUNDLE_TOO_LARGE', `Path is longer than ${limits.maxPathLength} characters: ${rel}`, {
          path: rel,
          limit: 'maxPathLength',
        });
      }
      if (stat.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      if (!stat.isFile()) throw new CodeBundleError('BUNDLE_FILE_NOT_ALLOWED', `Not a regular file: ${rel}`, { path: rel });
      if (!NAMED_FILES.has(rel) && !ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase())) {
        throw new CodeBundleError('BUNDLE_FILE_NOT_ALLOWED', `File type is not allowed in a code bundle: ${rel}`, { path: rel });
      }
      if (entries.length + 1 > limits.maxFiles) {
        throw new CodeBundleError('BUNDLE_TOO_LARGE', `A code bundle can hold at most ${limits.maxFiles} files`, { limit: 'maxFiles' });
      }
      if (stat.size > limits.maxFileBytes) {
        throw new CodeBundleError('BUNDLE_TOO_LARGE', `File is larger than ${limits.maxFileBytes} bytes: ${rel}`, {
          path: rel,
          size: stat.size,
          limit: 'maxFileBytes',
        });
      }
      totalBytes += stat.size;
      if (totalBytes > limits.maxTotalBytes) {
        throw new CodeBundleError('BUNDLE_TOO_LARGE', `A code bundle can hold at most ${limits.maxTotalBytes} bytes`, {
          limit: 'maxTotalBytes',
        });
      }
      const data = await fs.readFile(abs);
      entries.push({ path: rel, size: data.length, sha256: sha256Hex(data) });
    }
  };

  await walk(root, '');
  return entries.sort(byPath);
}

/**
 * `'sha256-' + sha256(JSON.stringify(entries))`: sorted by `path`, key order `path`/`size`/`sha256`, compact JSON, and excluding `bundle.manifest.json` and `verification.json` in the root directory (`CODE_BUNDLE_UNHASHED_FILES`).
 */
export function computeContentHash(entries: readonly CodeBundleFileEntry[]): string {
  const hashed = entries
    .filter((entry) => !UNHASHED.has(entry.path))
    .map(({ path: p, size, sha256 }) => ({ path: p, size, sha256 }))
    .sort(byPath);
  return CODE_BUNDLE_HASH_PREFIX + sha256Hex(JSON.stringify(hashed));
}

// ---- Static network scan ----

/** Replaces comments with whitespace of the same length (newlines are kept, so line numbers do not change). */
const blank = (text: string) => text.replace(/[^\n]/g, ' ');

function stripComments(text: string, ext: string): string {
  let out = text;
  if (ext === '.json') return out;
  if (ext === '.html' || ext === '.htm' || ext === '.svg') out = out.replace(/<!--[\s\S]*?-->/g, blank);
  if (ext === '.svg') return out;
  out = out.replace(/\/\*[\s\S]*?\*\//g, blank);
  // `//` line comment: the character before it is not `:`, a quote, `=`, `(` or an identifier character, so that `https://` and the protocol-relative `"//cdn"` are not falsely matched.
  out = out.replace(/(^|[^:"'`=(\w\\/])\/\/[^\n]*/gm, (match, lead: string) => lead + blank(match.slice(lead.length)));
  return out;
}

const ABSOLUTE_URL = /\b(?:https?|wss?):\/\/[^\s"'`)<>\\]+/gi;
/** Protocol-relative references are only recognized in positions that trigger loading: attributes, `url(`, `@import`, `import … from`, `import(`, `fetch(`, `new URL(`. */
const PROTOCOL_RELATIVE =
  /(?:\b(?:src|href|srcset|poster|data|action|xlink:href)\s*=\s*["']?|url\(\s*["']?|@import\s+["']|\bfrom\s+["']|\bimport\s*\(\s*["']|\bfetch\s*\(\s*["']|\bnew\s+URL\s*\(\s*["'])(\/\/[^\s"'`)<>\\]+)/gi;
/** XML namespaces: they are only identifiers and are never loaded. */
const XMLNS_ATTRIBUTE = /\bxmlns(?::[\w-]+)?\s*=\s*["'][^"']*["']/g;
const isNamespaceUri = (url: string) => /^https?:\/\/www\.w3\.org\//i.test(url);

/**
 * Statically scans text files for network references (absolute URLs, and protocol-relative URLs in positions that trigger loading).
 * Strips HTML, block and line comments before matching. `xmlns` attribute values and `http://www.w3.org/…` namespaces do not count.
 * This is a conservative approximation: URLs assembled inside strings are not visible (the runtime interception is the fallback), and fragments inside strings that look like comments may be stripped as comments.
 */
export async function scanNetworkReferences(dir: string, entries: readonly CodeBundleFileEntry[]): Promise<NetworkReference[]> {
  const root = path.resolve(dir);
  const found: NetworkReference[] = [];
  for (const entry of entries) {
    const ext = path.extname(entry.path).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const raw = await fs.readFile(path.join(root, entry.path), 'utf8');
    const text = stripComments(raw, ext).replace(XMLNS_ATTRIBUTE, blank);
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      const hits = new Set<string>();
      for (const match of line.matchAll(ABSOLUTE_URL)) if (!isNamespaceUri(match[0])) hits.add(match[0]);
      for (const match of line.matchAll(PROTOCOL_RELATIVE)) hits.add(match[1]!);
      for (const hit of hits) found.push({ path: entry.path, line: index + 1, text: hit });
    });
  }
  return found;
}

// ---- Manifest ----

export interface SynthesizeManifestInput {
  bundleId?: string;
  revision?: string;
  entry: string;
  compositionId?: string;
  width: number;
  height: number;
  fps: Rate;
  durationFrames: number;
  alpha: boolean;
  contract: CodeBundleContract;
  entries: CodeBundleFileEntry[];
}

/** Fills in the required fields per spec §2.1. `contentHash` is computed from `entries`. The browser manifest has no `compositionId` field, so none is written here. */
export function synthesizeManifest(input: SynthesizeManifestInput): CodeBundleManifest {
  const contentHash = computeContentHash(input.entries);
  return {
    format: CODE_BUNDLE_FORMAT,
    schemaVersion: CODE_BUNDLE_SCHEMA_VERSION,
    bundleId: input.bundleId ?? `bundle_${contentHash.slice(CODE_BUNDLE_HASH_PREFIX.length, CODE_BUNDLE_HASH_PREFIX.length + 16)}`,
    revision: input.revision ?? '1',
    contentHash,
    runtime: { engine: 'browser', contract: input.contract, entry: input.entry, frameworkHints: [] },
    source: { filesManifest: FILES_MANIFEST_FILE, dependencyLock: DEPENDENCY_LOCK_FILE, buildRecipe: BUILD_RECIPE_FILE },
    intrinsic: { width: input.width, height: input.height, fps: input.fps, durationFrames: input.durationFrames },
    output: { alpha: input.alpha, colorSpace: 'srgb', audio: 'none' },
    timing: { access: 'random' },
    timeDependencies: [{ kind: 'local-only' }],
    permissions: { network: 'deny', assetIds: [] },
  };
}

const positiveInt = z.number().int().positive();
const rateSchema = z.strictObject({ num: positiveInt, den: positiveInt });
const versionRefSchema = z.strictObject({ id: z.string().min(1), revision: z.string().min(1) });
const relativePath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..'), {
    message: 'must be a relative POSIX path inside the bundle',
  });

const manifestSchema = z.strictObject({
  format: z.literal(CODE_BUNDLE_FORMAT),
  schemaVersion: z.literal(CODE_BUNDLE_SCHEMA_VERSION),
  bundleId: z.string().min(1),
  revision: z.string().min(1),
  contentHash: z.string().regex(/^sha256-[0-9a-f]{64}$/),
  runtime: z.discriminatedUnion('engine', [
    z.strictObject({ engine: z.literal('browser'), contract: z.string().min(1), entry: relativePath, frameworkHints: z.array(z.string()) }),
    z.strictObject({ engine: z.literal('remotion'), entry: relativePath, compositionId: z.string().min(1) }),
  ]),
  source: z.strictObject({ filesManifest: z.string(), dependencyLock: z.string(), buildRecipe: z.string() }),
  intrinsic: z.strictObject({ width: positiveInt, height: positiveInt, fps: rateSchema, durationFrames: positiveInt }),
  output: z.strictObject({ alpha: z.boolean(), colorSpace: z.string().min(1), audio: z.enum(['none', 'stems', 'mixed']) }),
  timing: z.strictObject({ access: z.enum(['random', 'sequential', 'checkpointed']), fixedStep: rateSchema.optional() }),
  timeDependencies: z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('local-only') }),
        z.strictObject({ kind: z.literal('placement') }),
        z.strictObject({ kind: z.literal('cue-track'), ref: versionRefSchema }),
        z.strictObject({ kind: z.literal('sequence-clock') }),
      ]),
    )
    .optional(),
  parametersSchemaRef: z.string().optional(),
  exposedLayers: z.array(z.strictObject({ id: z.string().min(1), isolation: z.enum(['independent', 'requires-backdrop']) })).optional(),
  permissions: z.strictObject({ network: z.literal('deny'), assetIds: z.array(z.string()) }),
});

/** Validates the manifest's shape and the scope supported in the first phase (browser engine, known contract, network deny). */
function parseManifest(raw: string): CodeBundleManifest {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new CodeBundleError('BUNDLE_MANIFEST_INVALID', `bundle.manifest.json is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new CodeBundleError('BUNDLE_MANIFEST_INVALID', `bundle.manifest.json does not match the code bundle schema`, parsed.error.issues);
  }
  const manifest = parsed.data as CodeBundleManifest;
  if (manifest.runtime.engine !== 'browser') {
    throw new CodeBundleError('BUNDLE_CONTRACT_UNSUPPORTED', `Runtime engine "${manifest.runtime.engine}" is not supported yet`, {
      engine: manifest.runtime.engine,
    });
  }
  if (!(CODE_BUNDLE_CONTRACTS as readonly string[]).includes(manifest.runtime.contract)) {
    throw new CodeBundleError('BUNDLE_CONTRACT_UNSUPPORTED', `Browser contract "${manifest.runtime.contract}" is not supported`, {
      contract: manifest.runtime.contract,
      supported: CODE_BUNDLE_CONTRACTS,
    });
  }
  return manifest;
}

// ---- Root element of the entry HTML ----

interface RootAttributes {
  compositionId?: string;
  width?: number;
  height?: number;
  fps?: Rate;
  durationSeconds?: number;
  alpha?: boolean;
}

/** Reads the `data-*` attributes from the first element with `data-composition-id` in the entry HTML (a regex approximation; no script is run). */
export function readRootAttributes(html: string): RootAttributes {
  const tag = /<[a-zA-Z][\w-]*\b[^>]*?\sdata-composition-id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/.exec(html)?.[0];
  if (!tag) return {};
  const attr = (name: string): string | undefined => {
    const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(tag);
    return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
  };
  const num = (name: string) => {
    const value = attr(name);
    const n = value === undefined ? NaN : Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const out: RootAttributes = {};
  const id = attr('data-composition-id');
  if (id) out.compositionId = id;
  const width = num('data-width');
  const height = num('data-height');
  const duration = num('data-duration');
  if (width) out.width = Math.round(width);
  if (height) out.height = Math.round(height);
  if (duration) out.durationSeconds = duration;
  const fps = attr('data-fps');
  if (fps !== undefined) {
    const rate = parseRate(fps);
    if (rate) out.fps = rate;
  }
  const alpha = attr('data-alpha');
  if (alpha === 'true' || alpha === 'false') out.alpha = alpha === 'true';
  return out;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Converts a numeric frame rate to an integer ratio. Integers are kept as they are. NTSC values such as 23.976/29.97/59.94 become `n*1000/1001`. Others are reduced by a factor of one thousandth. */
export function toRate(fps: number): Rate | null {
  if (!Number.isFinite(fps) || fps <= 0) return null;
  if (Number.isInteger(fps)) return { num: fps, den: 1 };
  const ntsc = Math.round(fps * 1.001);
  if (Math.abs((ntsc * 1000) / 1001 - fps) < 0.005) return { num: ntsc * 1000, den: 1001 };
  const num = Math.round(fps * 1000);
  const g = gcd(num, 1000);
  return { num: num / g, den: 1000 / g };
}

/** `"30"`, `"29.97"`, `"30000/1001"` → integer ratio. */
export function parseRate(text: string): Rate | null {
  const ratio = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
  if (ratio) {
    const num = Number(ratio[1]);
    const den = Number(ratio[2]);
    if (num <= 0 || den <= 0) return null;
    const g = gcd(num, den);
    return { num: num / g, den: den / g };
  }
  return toRate(Number(text));
}

function pickEntry(entries: readonly CodeBundleFileEntry[], requested?: string): string {
  if (requested) {
    if (!entries.some((e) => e.path === requested)) {
      throw new CodeBundleError('BUNDLE_ENTRY_MISSING', `Entry file is not in the bundle: ${requested}`, { entry: requested });
    }
    return requested;
  }
  if (entries.some((e) => e.path === 'index.html')) return 'index.html';
  const html = entries.filter((e) => /\.html?$/i.test(e.path));
  if (html.length === 1) return html[0]!.path;
  throw new CodeBundleError(
    'BUNDLE_ENTRY_MISSING',
    html.length === 0
      ? 'The bundle has no HTML entry file'
      : 'The bundle has several HTML files and no index.html; name the entry explicitly',
    { candidates: html.map((e) => e.path) },
  );
}

/** Copies the whole tree to the staging directory (the source directory has already been checked and has no links or special files). */
async function stageCopy(
  root: string,
  entries: readonly CodeBundleFileEntry[],
  stagingDir: string | undefined,
): Promise<{ dir: string; created: boolean }> {
  let dir: string;
  let created = false;
  if (stagingDir) {
    dir = path.resolve(stagingDir);
    await fs.mkdir(dir, { recursive: true });
    if ((await fs.readdir(dir)).length > 0) {
      throw new CodeBundleError('BUNDLE_MANIFEST_INVALID', `Staging directory is not empty: ${dir}`, { stagingDir: dir });
    }
  } else {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-bundle-'));
    created = true;
  }
  for (const entry of entries) {
    const target = path.join(dir, ...entry.path.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(root, ...entry.path.split('/')), target);
  }
  return { dir, created };
}

/**
 * Checks a code bundle directory.
 *
 * - With `bundle.manifest.json`: validates the shape (`BUNDLE_MANIFEST_INVALID`), the contract (`BUNDLE_CONTRACT_UNSUPPORTED`), `contentHash` (`BUNDLE_HASH_MISMATCH`) and the entry (`BUNDLE_ENTRY_MISSING`).
 * - Without a manifest, and with synthesis allowed: size, frame rate and duration come from `options.manifest`, otherwise from the `data-*` attributes on the root element of the entry HTML. It writes `bundle.manifest.json` and `files.manifest.json` (and the missing `dependency.lock` and `build.recipe.json`) in the staging copy, without touching the source directory.
 * - When a network reference is found by static scanning, throws `BUNDLE_NETWORK_REFERENCE` (only recorded when `strictNetwork: false`).
 */
export async function inspectBundle(dir: string, options: InspectBundleOptions = {}): Promise<InspectedBundle> {
  const root = path.resolve(dir);
  const listOptions = options.limits ? { limits: options.limits } : {};
  const entries = await listBundleFiles(root, listOptions);
  const strictNetwork = options.strictNetwork ?? true;
  const checkNetwork = async (refs: NetworkReference[]) => {
    if (strictNetwork && refs.length > 0) {
      const first = refs[0]!;
      throw new CodeBundleError(
        'BUNDLE_NETWORK_REFERENCE',
        `The bundle references the network (${refs.length} reference(s), first: ${first.text} in ${first.path}:${first.line}); code bundles must be offline`,
        refs,
      );
    }
  };

  if (entries.some((e) => e.path === MANIFEST_FILE)) {
    const manifest = parseManifest(await fs.readFile(path.join(root, MANIFEST_FILE), 'utf8'));
    const actual = computeContentHash(entries);
    if (manifest.contentHash !== actual) {
      throw new CodeBundleError('BUNDLE_HASH_MISMATCH', `contentHash does not match the bundle files`, {
        expected: manifest.contentHash,
        actual,
      });
    }
    const entry = manifest.runtime.entry;
    if (!entries.some((e) => e.path === entry)) {
      throw new CodeBundleError('BUNDLE_ENTRY_MISSING', `Entry file is not in the bundle: ${entry}`, { entry });
    }
    const networkReferences = await scanNetworkReferences(root, entries);
    await checkNetwork(networkReferences);
    const rootAttrs = /\.html?$/i.test(entry) ? readRootAttributes(await fs.readFile(path.join(root, entry), 'utf8')) : {};
    return {
      root,
      manifest,
      entries,
      totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
      synthesized: false,
      networkReferences,
      compositionId: options.compositionId ?? rootAttrs.compositionId ?? 'main',
    };
  }

  if (options.allowSynthesize === false) {
    throw new CodeBundleError('BUNDLE_MANIFEST_INVALID', `The bundle has no bundle.manifest.json`);
  }

  const overrides = options.manifest ?? {};
  const entry = pickEntry(entries, overrides.entry);
  const html = await fs.readFile(path.join(root, entry), 'utf8');
  const attrs = readRootAttributes(html);
  const width = overrides.width ?? attrs.width;
  const height = overrides.height ?? attrs.height;
  const fps = typeof overrides.fps === 'number' ? toRate(overrides.fps) : (overrides.fps ?? attrs.fps ?? null);
  const durationFrames =
    overrides.durationFrames ?? (fps && attrs.durationSeconds ? Math.round((attrs.durationSeconds * fps.num) / fps.den) : undefined);
  const missing = [!width && 'width', !height && 'height', !fps && 'fps', !durationFrames && 'duration'].filter(Boolean);
  if (!width || !height || !fps || !durationFrames) {
    throw new CodeBundleError(
      'BUNDLE_MANIFEST_INVALID',
      `The bundle has no bundle.manifest.json and its intrinsic ${missing.join(', ')} are unknown; set data-width, data-height, data-fps and data-duration on the root element or pass them explicitly`,
      { missing },
    );
  }
  const networkReferences = await scanNetworkReferences(root, entries);
  await checkNetwork(networkReferences);

  const contract: CodeBundleContract = overrides.contract ?? (/__cuccutCompositions/.test(html) ? 'cuccut/1' : 'hyperframes/1');
  const sourceEntries = entries.filter((e) => e.path !== FILES_MANIFEST_FILE);
  const staging = await stageCopy(root, sourceEntries, options.stagingDir);
  try {
    if (!sourceEntries.some((e) => e.path === DEPENDENCY_LOCK_FILE)) await fs.writeFile(path.join(staging.dir, DEPENDENCY_LOCK_FILE), '');
    if (!sourceEntries.some((e) => e.path === BUILD_RECIPE_FILE)) {
      const recipe = { tool: '@cuccut/code-runtime', kind: 'synthesized-manifest', inputs: { entry, contract } };
      await fs.writeFile(path.join(staging.dir, BUILD_RECIPE_FILE), `${JSON.stringify(recipe, null, 2)}\n`);
    }
    const sourceFiles = (await listBundleFiles(staging.dir, listOptions)).filter((e) => !UNHASHED.has(e.path));
    await fs.writeFile(path.join(staging.dir, FILES_MANIFEST_FILE), `${JSON.stringify(sourceFiles, null, 2)}\n`);
    const staged = await listBundleFiles(staging.dir, listOptions);
    const manifest = synthesizeManifest({
      ...(overrides.bundleId ? { bundleId: overrides.bundleId } : {}),
      ...(overrides.revision ? { revision: overrides.revision } : {}),
      entry,
      width,
      height,
      fps,
      durationFrames,
      alpha: overrides.alpha ?? attrs.alpha ?? false,
      contract,
      entries: staged,
    });
    await fs.writeFile(path.join(staging.dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    const finalEntries = await listBundleFiles(staging.dir, listOptions);
    return {
      root: staging.dir,
      manifest,
      entries: finalEntries,
      totalBytes: finalEntries.reduce((sum, e) => sum + e.size, 0),
      synthesized: true,
      networkReferences,
      compositionId: options.compositionId ?? attrs.compositionId ?? 'main',
    };
  } catch (error) {
    if (staging.created) await fs.rm(staging.dir, { recursive: true, force: true });
    throw error;
  }
}
