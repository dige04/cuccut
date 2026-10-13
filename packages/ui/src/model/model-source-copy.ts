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
 * Copy for local-model download sources (the English is the source of the keys and types; translations are in `model-source-copy.<locale>.ts`). Hugging Face, ModelScope, and URLs are names:
 * they are not part of the copy and are not translated.
 */
const en = {
  /** Row name on the local models page; the general page uses its own “模型下载来源” (model download source). */
  label: 'Download source',
  /** Collapsible section at the bottom of the local models page. */
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
