/**
 * Sources for model downloads (architecture design §6.3).
 *
 * The base URL is chosen in priority order: environment variable `CUCCUT_MODELS_ENDPOINT`, then setting `models.downloadEndpoint`, then the public model repository `https://huggingface.co`. A mirror only needs to serve files following the same path rules.
 *
 * File URL: `<base>/<owner>/<repo>/resolve/<revision>/<file path>`. Each segment is URL-encoded, and the `/` in the file path is kept. The base may carry a path prefix (`https://mirror.example/hf`); a trailing `/` is removed.
 *
 * ModelScope (base URL host is `modelscope.cn` or `www.modelscope.cn`) follows its own path rules: `<source>/models/<owner>/<repo>/resolve/master/<file path>`. Its commits do not share SHAs with the public model repository, so `master` is used. Files are still verified one by one against the sha256 in the built-in manifest. Some repositories were renamed on ModelScope (`MODELSCOPE_ALIASES`). Repositories not on ModelScope (`MODELSCOPE_UNAVAILABLE`) are downloaded from the public model repository instead.
 *
 * No credentials: the base URL may not contain a username, password, query parameters or fragment, and download requests send no `Authorization`.
 */

import { DEFAULT_MODELS_ENDPOINT, isModelScopeEndpoint, MODELSCOPE_ENDPOINT } from '@cuccut/protocol';
import { ModelsDownloadSource as M } from '@cuccut/protocol/messages/models/download-source.ts';

// The default source, the ModelScope base URL and the recognition logic live in the protocol package, so the settings page can also tell which one is selected.
export { DEFAULT_MODELS_ENDPOINT, isModelScopeEndpoint, MODELSCOPE_ENDPOINT };
export const MODELS_ENDPOINT_ENV = 'CUCCUT_MODELS_ENDPOINT';

/** Repositories renamed on ModelScope. Unlisted ones are found under the same name. */
const MODELSCOPE_ALIASES: Readonly<Record<string, string>> = {
  'openai/whisper-large-v3': 'openai-mirror/whisper-large-v3',
  'OpenMOSS-Team/MOSS-Transcribe-Diarize': 'OpenMOSS/MOSS-Transcribe-Diarize',
};

/** Repositories not on ModelScope (or without identical content). When ModelScope is selected, these are downloaded from the public model repository instead. */
const MODELSCOPE_UNAVAILABLE: ReadonlySet<string> = new Set(['ggerganov/whisper.cpp', 'PJMixers-Dev/lj1995_GPT-SoVITS-safetensors']);

export type EndpointOrigin = 'env' | 'setting' | 'default';

export interface ResolvedEndpoint {
  endpoint: string;
  origin: EndpointOrigin;
}

/** Whether a base URL is usable: `http(s)://`, with no credentials, query parameters or fragment. */
export function validEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password && !url.search && !url.hash;
}

/** Gets the base URL by priority. Throws when the environment variable's value is invalid (it does not silently fall back to the public repository). */
export function resolveModelsEndpoint(env: NodeJS.ProcessEnv, setting: string | null | undefined): ResolvedEndpoint {
  const fromEnv = env[MODELS_ENDPOINT_ENV]?.trim();
  if (fromEnv) {
    if (!validEndpoint(fromEnv)) throw new Error(M.invalidEndpoint({ name: MODELS_ENDPOINT_ENV }).text);
    return { endpoint: trimSlash(fromEnv), origin: 'env' };
  }
  if (setting && validEndpoint(setting)) return { endpoint: trimSlash(setting), origin: 'setting' };
  return { endpoint: DEFAULT_MODELS_ENDPOINT, origin: 'default' };
}

/** Which base URL this repository is actually downloaded from. When ModelScope is selected and the repository is not on it, this is the public model repository; otherwise it is `endpoint`. */
export function repoEndpoint(endpoint: string, repo: string): string {
  return isModelScopeEndpoint(endpoint) && MODELSCOPE_UNAVAILABLE.has(repo) ? DEFAULT_MODELS_ENDPOINT : trimSlash(endpoint);
}

/** The download URL for one file. `revision` is the version fixed in the built-in manifest. ModelScope uses `master` (see the top of the file). */
export function modelFileUrl(endpoint: string, repo: string, revision: string, file: string): string {
  const base = repoEndpoint(endpoint, repo);
  const filePath = file.split('/').map(encodeURIComponent).join('/');
  if (isModelScopeEndpoint(base)) {
    return `${new URL(base).origin}/models/${encodeRepo(MODELSCOPE_ALIASES[repo] ?? repo)}/resolve/master/${filePath}`;
  }
  return `${base}/${encodeRepo(repo)}/resolve/${encodeURIComponent(revision)}/${filePath}`;
}

function encodeRepo(repo: string): string {
  return repo.split('/').map(encodeURIComponent).join('/');
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
