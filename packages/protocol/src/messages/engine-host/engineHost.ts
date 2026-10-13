import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './engineHost.zh-Hans.ts';
import { zhHant } from './engineHost.zh-Hant.ts';
import { ja } from './engineHost.ja.ts';
import { ko } from './engineHost.ko.ts';
import { es } from './engineHost.es.ts';
import { fr } from './engineHost.fr.ts';
import { de } from './engineHost.de.ts';
import { nl } from './engineHost.nl.ts';
import { ptBR } from './engineHost.pt-BR.ts';
import { it } from './engineHost.it.ts';
import { ru } from './engineHost.ru.ts';
import { pl } from './engineHost.pl.ts';
import { tr } from './engineHost.tr.ts';
import { vi } from './engineHost.vi.ts';

/** The parameter is a scalar, or a nested reference (the text after expansion). */
type P<K extends string> = Record<K, string | number>;

/**
 * Errors emitted by `crates/engine-host` itself (parameters, paths, export plan, fonts).
 * The English entries match the Rust `msg!` templates word for word (checked by `tools/rust-messages.test.ts`). When the English changes, change both sides together. Keys are not renamed or reused after release.
 */
const en = {
  runGenerationNotInteger: 'runGeneration must be a decimal integer',
  secondsInvalid: (p: P<'field'>) => `${p.field} must be a finite number of seconds, at least 0`,
  secondsOverflow: (p: P<'field'>) => `${p.field} is out of range`,
  audioItemsKind: 'audioItems is only for audio and video plans',
  skipAssetsKind: 'skipAssets is only for video plans',
  outputKind: 'output is only for video plans',
  outputSize: 'The output width and height must be positive integers',
  tooManyRanges: (p: P<'max'>) => `At most ${p.max} ranges at a time`,
  textPlanNoDocument: 'A text plan needs at least one document',
  textPlanTooManyDocuments: 'A text plan takes at most two documents (the main one and the other one of a bilingual merge)',
  planKindUnknown: (p: P<'kind'>) => `Unknown plan kind ${p.kind}`,
  unknownMethod: (p: P<'method'>) => `Unknown method: ${p.method}`,
  paramsInvalid: (p: P<'error'>) => `Invalid parameters: ${p.error}`,
  fontFacesInvalid: (p: P<'max'>) => `Give 1 to ${p.max} faces: each family name non-empty and at most 200 characters, each weight between 1 and 1000`,
  cacheDirRelative: 'cacheDir must be absolute',
  fontPathRelative: 'path must be absolute',
  fontInvalid: (p: P<'error'>) => `Not a usable font file: ${p.error}`,
  videoPathRelative: 'The video path must be absolute',
  videoNotOpen: 'The video is not open',
  taskStopped: 'This run was stopped, and the change was not committed',
  afterNotInteger: 'after must be a decimal integer',
  enginePanic: 'The engine failed while handling the request, and the change was not committed',
  pathRelative: 'Paths must be absolute',
};

export type EngineHostMessages = typeof en;

export const engineHostMessages = defineCatalog('engineHost', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
