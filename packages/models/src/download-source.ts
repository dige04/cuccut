/**
 * 模型下载的来源（架构设计 §6.3）。
 *
 * 基址的取法，先到先用：环境变量 `CUCCUT_MODELS_ENDPOINT` → 设置 `models.downloadEndpoint` → 公共模型仓库
 * `https://huggingface.co`。镜像只要按同样的路径规则提供文件即可。
 *
 * 文件 URL：`<基址>/<owner>/<repo>/resolve/<revision>/<文件路径>`，每一段按 URL 编码，文件路径里的 `/` 保留。
 * 基址可以带路径前缀（`https://mirror.example/hf`），结尾的 `/` 去掉。
 *
 * ModelScope（基址的主机是 `modelscope.cn` 或 `www.modelscope.cn`）按它自己的路径规则：
 * `<源>/models/<owner>/<repo>/resolve/master/<文件路径>`。它的提交与公共模型仓库不共用 SHA，所以取 `master`，
 * 文件照样按内置清单的 sha256 逐个核对；个别仓库在 ModelScope 上换了名字（`MODELSCOPE_ALIASES`），
 * ModelScope 上没有的仓库（`MODELSCOPE_UNAVAILABLE`）改从公共模型仓库下载。
 *
 * 不带凭据：基址里不允许用户名、密码、查询参数与片段；下载请求不发 `Authorization`。
 */

import { DEFAULT_MODELS_ENDPOINT, isModelScopeEndpoint, MODELSCOPE_ENDPOINT } from '@cuccut/protocol';
import { ModelsDownloadSource as M } from '@cuccut/protocol/messages/models/download-source.ts';

// 默认来源、ModelScope 的基址与识别放在协议包里，设置页也按它们认出选的是哪一个。
export { DEFAULT_MODELS_ENDPOINT, isModelScopeEndpoint, MODELSCOPE_ENDPOINT };
export const MODELS_ENDPOINT_ENV = 'CUCCUT_MODELS_ENDPOINT';

/** ModelScope 上换了名字的仓库；没列出的按同名找。 */
const MODELSCOPE_ALIASES: Readonly<Record<string, string>> = {
  'openai/whisper-large-v3': 'openai-mirror/whisper-large-v3',
  'OpenMOSS-Team/MOSS-Transcribe-Diarize': 'OpenMOSS/MOSS-Transcribe-Diarize',
};

/** ModelScope 上没有的仓库（或没有同样内容的）：选了 ModelScope 时这些改从公共模型仓库下载。 */
const MODELSCOPE_UNAVAILABLE: ReadonlySet<string> = new Set(['ggerganov/whisper.cpp', 'PJMixers-Dev/lj1995_GPT-SoVITS-safetensors']);

export type EndpointOrigin = 'env' | 'setting' | 'default';

export interface ResolvedEndpoint {
  endpoint: string;
  origin: EndpointOrigin;
}

/** 基址是否可用：`http(s)://`，没有凭据、查询参数与片段。 */
export function validEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password && !url.search && !url.hash;
}

/** 按优先级取基址。环境变量的值不合规时抛错（不悄悄退回公共仓库）。 */
export function resolveModelsEndpoint(env: NodeJS.ProcessEnv, setting: string | null | undefined): ResolvedEndpoint {
  const fromEnv = env[MODELS_ENDPOINT_ENV]?.trim();
  if (fromEnv) {
    if (!validEndpoint(fromEnv)) throw new Error(M.invalidEndpoint({ name: MODELS_ENDPOINT_ENV }).text);
    return { endpoint: trimSlash(fromEnv), origin: 'env' };
  }
  if (setting && validEndpoint(setting)) return { endpoint: trimSlash(setting), origin: 'setting' };
  return { endpoint: DEFAULT_MODELS_ENDPOINT, origin: 'default' };
}

/** 这个仓库实际从哪个基址下载：选了 ModelScope 而它上面没有这个仓库时是公共模型仓库，其余就是 `endpoint`。 */
export function repoEndpoint(endpoint: string, repo: string): string {
  return isModelScopeEndpoint(endpoint) && MODELSCOPE_UNAVAILABLE.has(repo) ? DEFAULT_MODELS_ENDPOINT : trimSlash(endpoint);
}

/** 一个文件的下载 URL。`revision` 是内置清单里固定的版本；ModelScope 取 `master`（见文件开头）。 */
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
