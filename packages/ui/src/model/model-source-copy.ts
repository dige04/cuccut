import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './model-source-copy.zh-Hans.ts';
import { zhHant } from './model-source-copy.zh-Hant.ts';
import { ja } from './model-source-copy.ja.ts';
import { ko } from './model-source-copy.ko.ts';
import { es } from './model-source-copy.es.ts';
import { fr } from './model-source-copy.fr.ts';
import { de } from './model-source-copy.de.ts';
import { nl } from './model-source-copy.nl.ts';
import { ptBR } from './model-source-copy.pt-BR.ts';
import { it } from './model-source-copy.it.ts';
import { ru } from './model-source-copy.ru.ts';
import { pl } from './model-source-copy.pl.ts';
import { tr } from './model-source-copy.tr.ts';
import { vi } from './model-source-copy.vi.ts';

/**
 * 本地模型下载来源的文案（英文是键与类型的来源，译文在 `model-source-copy.<语言>.ts`）。Hugging Face、ModelScope 与网址是名字，
 * 不在文案里、不翻译。
 */
const en = {
  /** 本地模型页的行名；通用页用自己的「模型下载来源」。 */
  label: 'Download source',
  /** 本地模型页底部的折叠区。 */
  fold: 'Download and storage',
  custom: 'Custom',
  isDefault: 'Default',
  msHint: 'Often faster in mainland China',
  customHint: 'Enter a mirror’s base URL',
  hfDesc: 'Download from Hugging Face (huggingface.co).',
  msDesc: 'Download from ModelScope (modelscope.cn), often faster in mainland China.',
  customDesc: 'Download from a mirror that serves files at the same paths as Hugging Face.',
  msNote:
    'The few files ModelScope doesn’t have (whisper.cpp, GPT-SoVITS) still come from Hugging Face. Every file is checked against its built-in checksum.',
  pending: (current: string) => `Save an address to switch to it. Downloads still come from ${current} for now.`,
  envNote: (name: string) => `If the ${name} environment variable is set, it’s used instead.`,
  webNote: 'A browser can’t change the download source. Set this in the CucCut desktop app.',
  fieldLabel: 'Mirror base URL',
  save: 'Save',
  changed: (source: string) => `Download source changed to ${source}`,
};
export type ModelSourceMessages = typeof en;
export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
