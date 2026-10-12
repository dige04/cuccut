import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './local-music.zh-Hans.ts';
import { zhHant } from './local-music.zh-Hant.ts';
import { ja } from './local-music.ja.ts';
import { ko } from './local-music.ko.ts';
import { es } from './local-music.es.ts';
import { fr } from './local-music.fr.ts';
import { de } from './local-music.de.ts';
import { nl } from './local-music.nl.ts';
import { ptBR } from './local-music.pt-BR.ts';
import { it } from './local-music.it.ts';
import { ru } from './local-music.ru.ts';
import { pl } from './local-music.pl.ts';
import { tr } from './local-music.tr.ts';
import { vi } from './local-music.vi.ts';

/** `packages/models/src/local-music.ts` 给人看的文字：本地音乐生成模型的耗时提示。 */
const en = {
  slowLocal: 'Generates on this computer with the audio.cpp engine: a one-minute track takes a few minutes; longer tracks take proportionally longer',
};

export type ModelsLocalMusicMessages = typeof en;

export const ModelsLocalMusic = defineCatalog('modelsLocalMusic', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
