import fsp from 'node:fs/promises';
import path from 'node:path';
import { RpcError, SKILL_FILE, SKILL_LIMITS, type Localized } from '@cuccut/protocol';
import { RcSkills } from '@cuccut/protocol/messages/runtime-core';

/**
 * Fetches a skill directory from GitHub (architecture design §12.9). Uses only GitHub's public interfaces:
 *
 * 1. If the address has no `ref`, uses the repository's default branch. Resolves `ref` to a commit sha, so everything after is fetched at that commit and the imported content matches the recorded commit.
 * 2. From the root tree, walks subdirectories level by level to find the target directory's tree, then recursively lists the entries under it (only this directory, not the whole repository).
 * 3. Checks the entries first. The root must have `SKILL.md`. There must be no symbolic links. The file count and total size must not exceed the limits. Dot-prefixed entries and submodules are not fetched. Files are downloaded only after all of this passes.
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

export interface GithubSkillRef {
  owner: string;
  repo: string;
  /** Branch, tag or commit written in the address. null when not given (the default branch is used). */
  ref: string | null;
  /** Subdirectory in the repository, `/`-separated. Empty string for the repository root. */
  path: string;
  /** The normalized address. */
  url: string;
}

export interface GithubFetchOptions {
  fetch?: typeof fetch;
  /** For tests: replaces the base URLs of the API and raw. */
  apiBase?: string;
  rawBase?: string;
  signal?: AbortSignal;
}

function urlInvalid(message: Localized, input: string): RpcError {
  return new RpcError('invalid-request', message, { code: 'SKILL_GITHUB_URL_INVALID', url: input });
}

/**
 * Recognizes `owner/repo`, `https://github.com/<owner>/<repo>` (may carry `.git`, a trailing slash, a query and a fragment), and
 * `https://github.com/<owner>/<repo>/tree/<ref>/<subdirectory>`. `ref` takes the segment after `tree/`. A branch whose name contains `/` must be replaced by a commit sha or tag before importing.
 */
export function parseGithubSkillUrl(input: string): GithubSkillRef {
  const raw = input.trim();
  if (!raw) throw urlInvalid(RcSkills.urlEmpty(), input);
  let rest = raw;
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i.exec(raw);
  if (url) rest = url[1]!;
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^[^/\s]+\.[a-z]{2,}\//i.test(raw)) throw urlInvalid(RcSkills.urlNotGithub(), input);
  const parts = rest
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .split('/');
  if (parts.length < 2 || !parts[0] || !parts[1]) throw urlInvalid(RcSkills.urlNeedsOwnerRepo(), input);
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!NAME_RE.test(owner) || !NAME_RE.test(repo)) throw urlInvalid(RcSkills.urlBadChars(), input);
  let ref: string | null = null;
  let sub = '';
  if (parts.length > 2) {
    if (parts[2] !== 'tree' || !parts[3]) throw urlInvalid(RcSkills.urlUnsupportedForm(), input);
    let segments: string[];
    try {
      segments = parts.slice(3).map((seg) => decodeURIComponent(seg));
    } catch {
      throw urlInvalid(RcSkills.urlBadEncoding(), input);
    }
    if (segments.some((seg) => !seg || seg === '.' || seg === '..' || /[\\\u0000-\u001f]/.test(seg))) {
      throw urlInvalid(RcSkills.urlBadPath(), input);
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
 * Downloads the directory that `ref` points to into `staging` (which must already exist and be empty). Returns the actual `ref` used and the commit.
 * If the content is noncompliant (missing `SKILL.md`, or has symbolic links), it fails with `SKILL_INVALID`. If it exceeds the limit, it fails with `SKILL_TOO_LARGE`. Both checks happen before any file is downloaded.
 */
export async function fetchGithubSkill(
  target: GithubSkillRef,
  staging: string,
  options: GithubFetchOptions = {},
): Promise<{ ref: string; commit: string; files: number; bytes: number }> {
  const http = new GithubHttp(options);
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
        code: 'SKILL_SOURCE_NOT_FOUND',
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
    throw new RpcError('invalid-request', RcSkills.treeTruncated({ limit: SKILL_LIMITS.files }), {
      code: 'SKILL_TOO_LARGE',
      url: target.url,
      limit: { files: SKILL_LIMITS.files, bytes: SKILL_LIMITS.totalBytes },
    });
  }
  const blobs: { path: string; size: number }[] = [];
  const issues: Localized[] = [];
  for (const entry of listing.tree ?? []) {
    if (entry.path.split('/').some((seg) => seg.startsWith('.'))) continue;
    if (entry.type === 'blob' && entry.mode === '120000') issues.push(RcSkills.noSymlinks({ path: entry.path }));
    else if (entry.type === 'blob') {
      if (
        entry.path.length > SKILL_LIMITS.path ||
        entry.path.split('/').some((seg) => !seg || seg === '..' || /[\\\u0000-\u001f]/.test(seg))
      ) {
        issues.push(RcSkills.pathInvalid({ path: entry.path.slice(0, 80) }));
      } else {
        blobs.push({ path: entry.path, size: typeof entry.size === 'number' ? entry.size : 0 });
      }
    }
    // `tree` is the directory itself (already expanded in the recursive listing), and `commit` is a submodule. Neither is fetched.
  }
  if (!blobs.some((b) => b.path === SKILL_FILE)) issues.push(RcSkills.folderRootMissingFile({ file: SKILL_FILE }));
  if (issues.length) {
    throw new RpcError('invalid-request', RcSkills.notImportable({ issue: issues[0]! }), {
      code: 'SKILL_INVALID',
      url: target.url,
      issues: issues.map((issue) => issue.text),
    });
  }
  const bytes = blobs.reduce((sum, b) => sum + b.size, 0);
  if (blobs.length > SKILL_LIMITS.files || bytes > SKILL_LIMITS.totalBytes) {
    throw new RpcError(
      'invalid-request',
      RcSkills.githubFolderTooLarge({ files: blobs.length, bytes, maxFiles: SKILL_LIMITS.files, maxBytes: SKILL_LIMITS.totalBytes }),
      {
        code: 'SKILL_TOO_LARGE',
        url: target.url,
        files: blobs.length,
        bytes,
        limit: { files: SKILL_LIMITS.files, bytes: SKILL_LIMITS.totalBytes },
      },
    );
  }

  let received = 0;
  for (const blob of blobs) {
    const repoFile = target.path ? `${target.path}/${blob.path}` : blob.path;
    const rawPath = `/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/${commit}/${repoFile.split('/').map(encodeURIComponent).join('/')}`;
    const data = await http.bytes(http.rawUrl(rawPath), blob.path, Math.min(blob.size, SKILL_LIMITS.totalBytes - received));
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

  constructor(options: GithubFetchOptions) {
    this.#fetch = options.fetch ?? fetch;
    this.#api = (options.apiBase ?? GITHUB_API_BASE).replace(/\/+$/, '');
    this.#raw = (options.rawBase ?? GITHUB_RAW_BASE).replace(/\/+$/, '');
    this.#signal = options.signal;
  }

  rawUrl(p: string): string {
    return `${this.#raw}${p}`;
  }

  network(message: Localized, extra: Record<string, unknown> = {}): RpcError {
    return new RpcError('conflict', message, { code: 'SKILL_GITHUB_NETWORK', ...extra });
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
          code: 'SKILL_GITHUB_RATE_LIMITED',
          ...(Number.isFinite(reset) && reset > 0 ? { retryAt: new Date(reset * 1000).toISOString() } : {}),
        });
      }
      if (response.status === 404 || response.status === 422) {
        throw new RpcError('not-found', RcSkills.githubNotFound({ what }), {
          code: 'SKILL_SOURCE_NOT_FOUND',
          status: response.status,
        });
      }
      throw this.network(RcSkills.githubHttpStatus({ what, status: response.status }), { status: response.status });
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw tooLarge(what, maxBytes);
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      if (response.body) {
        for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
          received += chunk.byteLength;
          if (received > maxBytes) throw tooLarge(what, maxBytes);
          chunks.push(chunk);
        }
      }
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw this.network(timeout.aborted ? RcSkills.githubDownloadTimeout({ what }) : RcSkills.githubConnectionLost({ what }));
    }
    return Buffer.concat(chunks);
  }
}

function tooLarge(what: string | Localized, maxBytes: number): RpcError {
  return new RpcError('invalid-request', RcSkills.downloadTooLarge({ what, limit: maxBytes }), {
    code: 'SKILL_TOO_LARGE',
    limit: { files: SKILL_LIMITS.files, bytes: SKILL_LIMITS.totalBytes },
  });
}
