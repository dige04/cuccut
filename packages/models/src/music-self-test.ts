import type { GenerationParameters } from '@cuccut/protocol';
import { speechSelfTestVerdict, type WavFacts } from './speech-self-test.ts';
import type { MessageRef } from '@cuccut/protocol';

/**
 * 本地音乐生成模型包的自检（架构设计 §6.3，Model Worker 协议规范 §4.4）：固定的风格、seed，不编排、少步数、短上限生成一小段纯音乐，
 * 检查输出是能解码的 WAV、时长合理、不是静音、没有削波（与语音合成同一套判定）。不判断好不好听，只证明引擎与权重能出声。
 */

type MusicParameters = Extract<GenerationParameters, { capability: 'generateMusic' }>;

/** 自检的固定输入：几秒的纯音乐、不编排、少步数；seed 固定，同一台机器上每次是同一段。 */
export const MUSIC_SELF_TEST = {
  mode: 'instrumental',
  // i18n-ignore: 交给模型的英文风格描述，不是界面文字
  style: 'calm solo piano, slow tempo',
  maxDurationSec: 8,
  seed: 7,
  steps: 4,
} as const;

/** 自检的冻结参数（与正式提交同一形状；步数另由 `MUSIC_SELF_TEST.steps` 指定）。 */
export function musicSelfTestParameters(): MusicParameters {
  const { mode, style, maxDurationSec, seed } = MUSIC_SELF_TEST;
  return { capability: 'generateMusic', mode, style, lyrics: null, targetDurationSec: null, maxDurationSec, planning: 'off', format: 'wav', seed };
}

/** 判定：能解码、0.3–30 秒、不是静音、没有削波（`speechSelfTestVerdict` 的阈值）。 */
export function musicSelfTestVerdict(
  bytes: Buffer,
): { passed: true; wav: WavFacts } | { passed: false; problem: string; problemRef?: MessageRef; wav?: WavFacts } {
  return speechSelfTestVerdict(bytes);
}
