import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './music-bundles.zh-Hans.ts';
import { zhHant } from './music-bundles.zh-Hant.ts';
import { ja } from './music-bundles.ja.ts';
import { ko } from './music-bundles.ko.ts';
import { es } from './music-bundles.es.ts';
import { fr } from './music-bundles.fr.ts';
import { de } from './music-bundles.de.ts';
import { nl } from './music-bundles.nl.ts';
import { ptBR } from './music-bundles.pt-BR.ts';
import { it } from './music-bundles.it.ts';
import { ru } from './music-bundles.ru.ts';
import { pl } from './music-bundles.pl.ts';
import { tr } from './music-bundles.tr.ts';
import { vi } from './music-bundles.vi.ts';

/** Human-facing text for `packages/models/src/music-bundles.ts`: license summaries for music generation model bundles (model names, license names and vendor names are not translated). */
const en = {
  yue2License: 'CC BY-NC 4.0: non-commercial use only, with attribution to the YuE authors; the GGUF conversion keeps the same license',
  audioCppLicense: 'Apache-2.0: free to use, including commercially; keep the copyright and license notices when redistributing',
};

export type ModelsMusicBundlesMessages = typeof en;

export const ModelsMusicBundles = defineCatalog('modelsMusicBundles', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
