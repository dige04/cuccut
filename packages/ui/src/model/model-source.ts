import { DEFAULT_MODELS_ENDPOINT, isModelScopeEndpoint, MODELSCOPE_ENDPOINT } from '@cuccut/protocol';
import { M } from './model-source-copy.ts';

/**
 * 本地模型的下载来源（架构设计 §6.3「来源」、§5.10 `models.downloadEndpoint`；设计稿 model-local-models.js `SOURCES` /
 * `sourceOf`、settings-local.jsx `SourceRow`）。设置 › 本地模型 › 下载与存储，与 设置 › 通用 › 下载来源与离线 共用。
 *
 * 三个选项写同一个设置：Hugging Face 存 null（默认来源），ModelScope 存它的基址，自定义存填的镜像基址。存着的值按主机认回
 * 是哪一个，所以以前在文本框里填过的 `https://huggingface.co`、`https://www.modelscope.cn` 照样落在对应选项上。
 * 环境变量 `CUCCUT_MODELS_ENDPOINT` 优先于这个设置；Runtime 不告诉界面它设没设，这里只提一句。
 */

export const MODEL_SOURCE_COPY = M;

/** 环境变量的名字（与 `@cuccut/models` 的 `MODELS_ENDPOINT_ENV` 相同）。 */
export const MODELS_ENDPOINT_ENV = 'CUCCUT_MODELS_ENDPOINT';
/** 自定义基址框里的示例。 */
export const MIRROR_PLACEHOLDER = 'https://mirror.example.com';

export type ModelSourceId = 'hf' | 'ms' | 'custom';

export interface ModelSourceItem {
  id: ModelSourceId;
  /** 选项名：两个仓库是名字，不翻译。 */
  name: string;
  /** 选项下面的一行小字。 */
  hint: string;
}

const HF_HOST = new URL(DEFAULT_MODELS_ENDPOINT).hostname;
const MS_HOST = new URL(MODELSCOPE_ENDPOINT).hostname.replace(/^www\./, '');

/** 选择器里的三项，顺序照设计稿。 */
export function modelSources(): ModelSourceItem[] {
  return [
    { id: 'hf', name: 'Hugging Face', hint: `${HF_HOST} · ${M.isDefault}` },
    { id: 'ms', name: 'ModelScope', hint: `${MS_HOST} · ${M.msHint}` },
    { id: 'custom', name: M.custom, hint: M.customHint },
  ];
}

/** 存着的基址是哪一个选项：没设（null、空）或公共模型仓库的根是 Hugging Face，主机是 ModelScope 的是 ModelScope，其余是自定义。 */
export function sourceOf(endpoint: string | null | undefined): ModelSourceId {
  const value = endpoint?.trim();
  if (!value) return 'hf';
  if (isModelScopeEndpoint(value)) return 'ms';
  try {
    const url = new URL(value);
    if ((url.hostname === HF_HOST || url.hostname === `www.${HF_HOST}`) && url.pathname.replace(/\/+$/, '') === '') return 'hf';
  } catch {
    // 不是网址：合同不让存这样的值，万一有就当自定义显示出来。
  }
  return 'custom';
}

/** 选了 Hugging Face 或 ModelScope 时要存的值。 */
export function sourceEndpoint(id: 'hf' | 'ms'): string | null {
  return id === 'ms' ? MODELSCOPE_ENDPOINT : null;
}

/** 给人看的来源名：两个仓库写名字，自定义的写主机（看不出主机时原样写）。 */
export function sourceLabel(endpoint: string | null | undefined): string {
  const id = sourceOf(endpoint);
  if (id === 'hf') return 'Hugging Face';
  if (id === 'ms') return 'ModelScope';
  try {
    return new URL(endpoint!.trim()).host;
  } catch {
    return endpoint!.trim();
  }
}

/** 选项的一句说明（行名下面）。 */
export function sourceDesc(id: ModelSourceId): string {
  return id === 'hf' ? M.hfDesc : id === 'ms' ? M.msDesc : M.customDesc;
}

/** 基址框里的字 → 要存的值：去掉首尾空白与结尾的 `/`；空的是 null（还没填）。是否合规另由 `endpointProblem` 判断。 */
export function customEndpoint(text: string): string | null {
  const value = text.trim().replace(/\/+$/, '');
  return value === '' ? null : value;
}

/**
 * 选择器下面整行的补充说明，按顺序：ModelScope 的回退与核对；选了「自定义」还没保存时现在实际从哪里下载；环境变量优先。
 * `picked` 是选择器上的项（可能是还没保存的「自定义」），`saved` 是存着的基址。
 */
export function sourceNotes(picked: ModelSourceId, saved: string | null | undefined): string[] {
  const notes: string[] = [];
  if (picked === 'ms') notes.push(M.msNote);
  if (picked === 'custom' && sourceOf(saved) !== 'custom') notes.push(M.pending(sourceLabel(saved)));
  notes.push(M.envNote(MODELS_ENDPOINT_ENV));
  return notes;
}
