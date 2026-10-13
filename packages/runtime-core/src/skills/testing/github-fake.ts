/**
 * For tests: a fake GitHub for `fetchGithubTree` (`apiBase: 'https://api.test'`, `rawBase: 'https://raw.test'`). Repository `o/r`, default branch `main` at
 * `FAKE_GITHUB_SHA`, files given by path.
 */
export const FAKE_GITHUB_SHA = 'c'.repeat(40);
const SHA = FAKE_GITHUB_SHA;

/** The `github` options that point a fetch at the fake. */
export function fakeGithubOptions(github: { fetch: typeof fetch }) {
  return { fetch: github.fetch, apiBase: 'https://api.test', rawBase: 'https://raw.test' };
}

/** Fake GitHub: repo `o/r`, default branch main, files given by path. Records the requested URLs. */
export function fakeGithub(files: Record<string, string | Uint8Array>, options: { truncated?: boolean; symlink?: string; rateLimited?: boolean } = {}) {
  const requests: string[] = [];
  const trees = new Map<string, { path: string; mode: string; type: string; sha: string; size?: number }[]>();
  // Tree shas are keyed by directory path: the root is the commit sha.
  const dirs = new Set<string>(['']);
  for (const file of Object.keys(files)) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const treeSha = (dir: string) => (dir === '' ? SHA : `tree:${dir}`);
  const entriesUnder = (dir: string, recursive: boolean) => {
    const prefix = dir ? `${dir}/` : '';
    const out: { path: string; mode: string; type: string; sha: string; size?: number }[] = [];
    for (const d of dirs) {
      if (d === '' || !d.startsWith(prefix) || d === dir) continue;
      const rel = d.slice(prefix.length);
      if (!recursive && rel.includes('/')) continue;
      out.push({ path: rel, mode: '040000', type: 'tree', sha: treeSha(d) });
    }
    for (const [file, body] of Object.entries(files)) {
      if (!file.startsWith(prefix)) continue;
      const rel = file.slice(prefix.length);
      if (!recursive && rel.includes('/')) continue;
      const link = options.symlink === file;
      out.push({ path: rel, mode: link ? '120000' : '100644', type: 'blob', sha: `blob:${file}`, size: typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength });
    }
    return out;
  };
  for (const d of dirs) trees.set(treeSha(d), entriesUnder(d, false));

  const fakeFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    if (options.rateLimited) {
      return new Response('limit', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' } });
    }
    const api = /^https:\/\/api\.test(\/repos\/o\/r)(\/.*)?$/.exec(url);
    if (api) {
      const rest = api[2] ?? '';
      if (rest === '') return Response.json({ default_branch: 'main' });
      if (rest === '/commits/main' || rest === `/commits/${SHA}`) return new Response(SHA);
      const tree = /^\/git\/trees\/([^?]+)(\?recursive=1)?$/.exec(rest);
      if (tree) {
        const sha = decodeURIComponent(tree[1]!);
        if (!trees.has(sha)) return new Response('', { status: 404 });
        const dir = sha === SHA ? '' : sha.slice('tree:'.length);
        return Response.json({ sha, tree: tree[2] ? entriesUnder(dir, true) : trees.get(sha), truncated: !!options.truncated });
      }
      return new Response('', { status: 404 });
    }
    const raw = new RegExp(`^https://raw\\.test/o/r/${SHA}/(.+)$`).exec(url);
    if (raw) {
      const file = raw[1]!.split('/').map(decodeURIComponent).join('/');
      if (file in files) return new Response(files[file] as BodyInit);
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  return { fetch: fakeFetch, requests };
}
