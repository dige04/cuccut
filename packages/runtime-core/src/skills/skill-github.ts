import fsp from 'node:fs/promises';
import path from 'node:path';
import { RpcError, SKILL_FILE, SKILL_LIMITS, type Localized } from '@cuccut/protocol';
import { RcSkills } from '@cuccut/protocol/messages/runtime-core';

/**
 * Fetches a folder from GitHub (architecture design §12.9): a skill (`fetchGithubSkill`) or a pack (`packs/pack-source.ts`), through `fetchGithubTree` with the caller's
 * limits, required root file and error codes. Uses only GitHub's public interfaces:
 *
 * 1. If the address has no `ref`, uses the repository's default branch. Resolves `ref` to a commit sha, so everything after is fetched at that commit and the imported content matches the recorded commit.
 * 2. From the root tree, walks subdirectories level by level to find the target directory's tree, then recursively lists the entries under it (only this directory, not the whole repository).
 * 3. Checks the entries first. The root must have the required file. There must be no symbolic links. The file count and total size must not exceed the limits. Dot-prefixed entries and submodules are not fetched. Files are downloaded only after all of this passes.
 * 4. Downloads files one by one from the raw address at that commit, sets a size limit per the manifest, and writes them into the staging directory the caller provided.
 *
 * Does not execute any downloaded content. No retries: failures are reported as they are, and the user simply imports again. Each request has a timeout, and the whole import has an overall time limit.
 */

export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const ALLOWED_HOSTS = new Set(['api.github.com', 'raw.githubusercontent.com', 'codeload.github.com']);
/** Upper limit for one JSON response (repository info, first-level tree, recursive tree). */
const JSON_MAX_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export interface GithubRef {
  owner: string;
  repo: string;
  /** Branch, tag or commit written in the address. null when not given (the default branch is used). */
  ref: string | null;
  /** Subdirectory in the repository, `/`-separated. Empty string for the repository root. */
  path: string;
  /** The normalized address. */
  url: string;
}

/** A skill's GitHub address (the same shape as any folder's). */
export type GithubSkillRef = GithubRef;

export interface GithubFetchOptions {
  fetch?: typeof fetch;
  /** For tests: replaces the base URLs of the API and raw. */
  apiBase?: string;
  rawBase?: string;
  signal?: AbortSignal;
}

/** What differs between a skill folder and a pack folder fetched from GitHub. */
export interface GithubTreeRules {
  limits: { files: number; totalBytes: number; path: number };
  /** The file the folder's root must have (`SKILL.md`, `pack.json`). */
  requiredFile: string;
  /** `details.code` of each kind of failure. */
  codes: { invalid: string; tooLarge: string; network: string; notFound: string; rateLimited: string };
  messages: {
    /** The folder's entries break a rule (first issue). */
    notImportable(issue: Localized): Localized;
    folderTooLarge(p: { files: number; bytes: number; maxFiles: number; maxBytes: number }): Localized;
    treeTruncated(p: { limit: number }): Localized;
    downloadTooLarge(p: { what: string | Localized; limit: number }): Localized;
  };
}

/** Skills: `SKILL.md` in the root, `SKILL_LIMITS`, `SKILL_*` codes. */
export const SKILL_GITHUB_RULES: GithubTreeRules = {
  limits: { files: SKILL_LIMITS.files, totalBytes: SKILL_LIMITS.totalBytes, path: SKILL_LIMITS.path },
  requiredFile: SKILL_FILE,
  codes: {
    invalid: 'SKILL_INVALID',
    tooLarge: 'SKILL_TOO_LARGE',
    network: 'SKILL_GITHUB_NETWORK',
    notFound: 'SKILL_SOURCE_NOT_FOUND',
    rateLimited: 'SKILL_GITHUB_RATE_LIMITED',
  },
  messages: {
    notImportable: (issue) => RcSkills.notImportable({ issue }),
    folderTooLarge: (p) => RcSkills.githubFolderTooLarge(p),
    treeTruncated: (p) => RcSkills.treeTruncated(p),
    downloadTooLarge: (p) => RcSkills.downloadTooLarge(p),
  },
};

function urlInvalid(message: Localized, input: string, code: string): RpcError {
  return new RpcError('invalid-request', message, { code, url: input });
}

/**
 * Recognizes `owner/repo`, `https://github.com/<owner>/<repo>` (may carry `.git`, a trailing slash, a query and a fragment), and
 * `https://github.com/<owner>/<repo>/tree/<ref>/<subdirectory>`. `ref` takes the segment after `tree/`. A branch whose name contains `/` must be replaced by a commit sha or tag before importing.
 */
export function parseGithubSkillUrl(input: string): GithubSkillRef {
  return parseGithubUrl(input, 'SKILL_GITHUB_URL_INVALID');
}

/** `parseGithubSkillUrl` for any folder: `code` is the `details.code` of a refused address. */
export function parseGithubUrl(input: string, code: string): GithubRef {
  const raw = input.trim();
  if (!raw) throw urlInvalid(RcSkills.urlEmpty(), input, code);
  let rest = raw;
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i.exec(raw);
  if (url) rest = url[1]!;
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^[^/\s]+\.[a-z]{2,}\//i.test(raw)) throw urlInvalid(RcSkills.urlNotGithub(), input, code);
  const parts = rest
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .split('/');
  if (parts.length < 2 || !parts[0] || !parts[1]) throw urlInvalid(RcSkills.urlNeedsOwnerRepo(), input, code);
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!NAME_RE.test(owner) || !NAME_RE.test(repo)) throw urlInvalid(RcSkills.urlBadChars(), input, code);
  let ref: string | null = null;
  let sub = '';
  if (parts.length > 2) {
    if (parts[2] !== 'tree' || !parts[3]) throw urlInvalid(RcSkills.urlUnsupportedForm(), input, code);
    let segments: string[];
    try {
      segments = parts.slice(3).map((seg) => decodeURIComponent(seg));
    } catch {
      throw urlInvalid(RcSkills.urlBadEncoding(), input, code);
    }
    if (segments.some((seg) => !seg || seg === '.' || seg === '..' || /[\\\u0000-\u001f]/.test(seg))) {
      throw urlInvalid(RcSkills.urlBadPath(), input, code);
    }
    ref = segments[0]!;
    sub = segments.slice(1).join('/');
  }
  const encoded = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  return {
    owner,
    repo,
    ref,
    path: sub,
    url: `https://github.com/${owner}/${repo}${ref ? `/tree/${encoded(ref)}${sub ? `/${encoded(sub)}` : ''}` : ''}`,
  };
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
}

/**
 * Downloads a skill directory: `fetchGithubTree` with `SKILL_GITHUB_RULES`.
 * If the content is noncompliant (missing `SKILL.md`, or has symbolic links), it fails with `SKILL_INVALID`. If it exceeds the limit, it fails with `SKILL_TOO_LARGE`. Both checks happen before any file is downloaded.
 */
export function fetchGithubSkill(
  target: GithubSkillRef,
  staging: string,
  options: GithubFetchOptions = {},
): Promise<{ ref: string; commit: string; files: number; bytes: number }> {
  return fetchGithubTree(target, staging, SKILL_GITHUB_RULES, options);
}

/**
 * Downloads the directory that `ref` points to into `staging` (which must already exist and be empty). Returns the actual `ref` used and the commit.
 * Entries that break `rules` (no required file, symbolic links, bad paths) fail with `rules.codes.invalid`; over the limits, `rules.codes.tooLarge`. Both checks happen
 * before any file is downloaded.
 */
export async function fetchGithubTree(
  target: GithubRef,
  staging: string,
  rules: GithubTreeRules,
  options: GithubFetchOptions = {},
): Promise<{ ref: string; commit: string; files: number; bytes: number }> {
  const http = new GithubHttp(options, rules);
  const { limits, codes, messages } = rules;
  const repoPath = `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`;
  const where = `${target.owner}/${target.repo}`;
  let ref = target.ref;
  if (!ref) {
    const info = (await http.json(`${repoPath}`, RcSkills.whatRepo({ where }))) as { default_branch?: unknown };
    if (typeof info.default_branch !== 'string' || !info.default_branch) throw http.network(RcSkills.noDefaultBranch({ where }));
    ref = info.default_branch;
  }
  const commit = (
    await http.text(`${repoPath}/commits/${encodeURIComponent(ref)}`, RcSkills.whatRef({ where, ref }), { Accept: 'application/vnd.github.sha' })
  ).trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw http.network(RcSkills.noRefCommit({ where, ref }));

  // Walks down the subdirectories level by level, listing only the layers that are needed.
  let treeSha = commit;
  const segments = target.path ? target.path.split('/') : [];
  for (let i = 0; i < segments.length; i++) {
    const level = (await http.json(`${repoPath}/git/trees/${treeSha}`, RcSkills.whatTree({ where }))) as { tree?: TreeEntry[] };
    const next = (level.tree ?? []).find((e) => e.path === segments[i] && e.type === 'tree');
    if (!next) {
      throw new RpcError('not-found', RcSkills.folderNotInRef({ where, ref, folder: segments.slice(0, i + 1).join('/') }), {
        code: codes.notFound,
        url: target.url,
      });
    }
    treeSha = next.sha;
  }
  const listing = (await http.json(`${repoPath}/git/trees/${treeSha}?recursive=1`, RcSkills.whatTree({ where }))) as {
    tree?: TreeEntry[];
    truncated?: boolean;
  };
  if (listing.truncated) {
    throw new RpcError('invalid-request', messages.treeTruncated({ limit: limits.files }), {
      code: codes.tooLarge,
      url: target.url,
      limit: { files: limits.files, bytes: limits.totalBytes },
    });
  }
  const blobs: { path: string; size: number }[] = [];
  const issues: Localized[] = [];
  for (const entry of listing.tree ?? []) {
    if (entry.path.split('/').some((seg) => seg.startsWith('.'))) continue;
    if (entry.type === 'blob' && entry.mode === '120000') issues.push(RcSkills.noSymlinks({ path: entry.path }));
    else if (entry.type === 'blob') {
      if (
        entry.path.length > limits.path ||
        entry.path.split('/').some((seg) => !seg || seg === '..' || /[\\\u0000-\u001f]/.test(seg))
      ) {
        issues.push(RcSkills.pathInvalid({ path: entry.path.slice(0, 80) }));
      } else {
        blobs.push({ path: entry.path, size: typeof entry.size === 'number' ? entry.size : 0 });
      }
    }
    // `tree` is the directory itself (already expanded in the recursive listing), and `commit` is a submodule. Neither is fetched.
  }
  if (!blobs.some((b) => b.path === rules.requiredFile)) issues.push(RcSkills.folderRootMissingFile({ file: rules.requiredFile }));
  if (issues.length) {
    throw new RpcError('invalid-request', messages.notImportable(issues[0]!), {
      code: codes.invalid,
      url: target.url,
      issues: issues.map((issue) => issue.text),
    });
  }
  const bytes = blobs.reduce((sum, b) => sum + b.size, 0);
  if (blobs.length > limits.files || bytes > limits.totalBytes) {
    throw new RpcError(
      'invalid-request',
      messages.folderTooLarge({ files: blobs.length, bytes, maxFiles: limits.files, maxBytes: limits.totalBytes }),
      {
        code: codes.tooLarge,
        url: target.url,
        files: blobs.length,
        bytes,
        limit: { files: limits.files, bytes: limits.totalBytes },
      },
    );
  }

  let received = 0;
  for (const blob of blobs) {
    const repoFile = target.path ? `${target.path}/${blob.path}` : blob.path;
    const rawPath = `/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/${commit}/${repoFile.split('/').map(encodeURIComponent).join('/')}`;
    const data = await http.bytes(http.rawUrl(rawPath), blob.path, Math.min(blob.size, limits.totalBytes - received));
    received += data.byteLength;
    const dest = path.join(staging, ...blob.path.split('/'));
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, data, { flag: 'wx' });
  }
  return { ref, commit, files: blobs.length, bytes: received };
}

/** Shared parts of several requests: timeout, limits, status codes mapped to error codes, and redirects accepted only to GitHub's hosts. */
class GithubHttp {
  readonly #fetch: typeof fetch;
  readonly #api: string;
  readonly #raw: string;
  readonly #signal: AbortSignal | undefined;
  readonly #rules: GithubTreeRules;

  constructor(options: GithubFetchOptions, rules: GithubTreeRules) {
    this.#rules = rules;
    this.#fetch = options.fetch ?? fetch;
    this.#api = (options.apiBase ?? GITHUB_API_BASE).replace(/\/+$/, '');
    this.#raw = (options.rawBase ?? GITHUB_RAW_BASE).replace(/\/+$/, '');
    this.#signal = options.signal;
  }

  rawUrl(p: string): string {
    return `${this.#raw}${p}`;
  }

  network(message: Localized, extra: Record<string, unknown> = {}): RpcError {
    return new RpcError('conflict', message, { code: this.#rules.codes.network, ...extra });
  }

  async json(apiPath: string, what: Localized): Promise<unknown> {
    const text = await this.text(apiPath, what, { Accept: 'application/vnd.github+json' });
    try {
      return JSON.parse(text);
    } catch {
      throw this.network(RcSkills.githubNotJson({ what }));
    }
  }

  async text(apiPath: string, what: Localized, headers: Record<string, string>): Promise<string> {
    return Buffer.from(await this.bytes(`${this.#api}${apiPath}`, what, JSON_MAX_BYTES, headers)).toString('utf8');
  }

  async bytes(url: string, what: string | Localized, maxBytes: number, headers: Record<string, string> = {}): Promise<Uint8Array> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = this.#signal ? AbortSignal.any([this.#signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        headers: { 'User-Agent': 'CucCut', 'X-GitHub-Api-Version': '2022-11-28', ...headers },
        signal,
        redirect: 'follow',
      });
    } catch {
      throw this.network(timeout.aborted ? RcSkills.githubConnectTimeout({ what }) : RcSkills.githubUnreachable({ what }));
    }
    // When a redirect was followed (for example, the repository was renamed), the final address must still be on GitHub's host.
    if (response.url && response.redirected) {
      let host = '';
      try {
        host = new URL(response.url).hostname;
      } catch {
        // Invalid address: handled as an unrecognized host.
      }
      if (!ALLOWED_HOSTS.has(host)) {
        await response.body?.cancel().catch(() => {});
        throw this.network(RcSkills.githubRedirectedAway({ what }));
      }
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if ((response.status === 403 || response.status === 429) && response.headers.get('x-ratelimit-remaining') === '0') {
        const reset = Number(response.headers.get('x-ratelimit-reset'));
        throw new RpcError('conflict', RcSkills.githubRateLimited(), {
          code: this.#rules.codes.rateLimited,
          ...(Number.isFinite(reset) && reset > 0 ? { retryAt: new Date(reset * 1000).toISOString() } : {}),
        });
      }
      if (response.status === 404 || response.status === 422) {
        throw new RpcError('not-found', RcSkills.githubNotFound({ what }), {
          code: this.#rules.codes.notFound,
          status: response.status,
        });
      }
      throw this.network(RcSkills.githubHttpStatus({ what, status: response.status }), { status: response.status });
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw this.tooLarge(what, maxBytes);
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      if (response.body) {
        for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
          received += chunk.byteLength;
          if (received > maxBytes) throw this.tooLarge(what, maxBytes);
          chunks.push(chunk);
        }
      }
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw this.network(timeout.aborted ? RcSkills.githubDownloadTimeout({ what }) : RcSkills.githubConnectionLost({ what }));
    }
    return Buffer.concat(chunks);
  }

  tooLarge(what: string | Localized, maxBytes: number): RpcError {
    const { limits, codes, messages } = this.#rules;
    return new RpcError('invalid-request', messages.downloadTooLarge({ what, limit: maxBytes }), {
      code: codes.tooLarge,
      limit: { files: limits.files, bytes: limits.totalBytes },
    });
  }
}
