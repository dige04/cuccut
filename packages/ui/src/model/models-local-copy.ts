import { defineMessages, type ModelBundleReason, type ModelBundleStatus } from '@cuccut/protocol';
import { zhHans } from './models-local-copy.zh-Hans.ts';
import { zhHant } from './models-local-copy.zh-Hant.ts';
import { ja } from './models-local-copy.ja.ts';
import { ko } from './models-local-copy.ko.ts';
import { es } from './models-local-copy.es.ts';
import { fr } from './models-local-copy.fr.ts';
import { de } from './models-local-copy.de.ts';
import { nl } from './models-local-copy.nl.ts';
import { ptBR } from './models-local-copy.pt-BR.ts';
import { it } from './models-local-copy.it.ts';
import { ru } from './models-local-copy.ru.ts';
import { pl } from './models-local-copy.pl.ts';
import { tr } from './models-local-copy.tr.ts';
import { vi } from './models-local-copy.vi.ts';

/** Models › Local models copy (the English is the source of the keys and types; translations are in `models-local-copy.<locale>.ts`). */
const en = {
  /** Reasons a model package is unavailable or its files are wrong (row labels). */
  reason: {
    unsupported: 'Not supported on this computer',
    resource: 'Turned off',
    'worker-missing': 'Model Worker missing',
    'missing-manifest': 'Manifest missing',
    'missing-file': 'Files missing',
    'size-mismatch': 'File size mismatch',
    'hash-mismatch': 'Checksum mismatch',
    incomplete: 'Components missing',
    'load-failed': "Couldn't load",
    relocating: 'Moving',
  } as Record<ModelBundleReason, string>,
  chipDefault: 'Default',
  chipLoading: 'Loading',
  chipReady: 'Loaded',
  chipBusy: 'Running',
  chipUnloading: 'Unloading',
  chipUnavailable: 'Unavailable',
  /** Optional components still missing from an installed package (row labels). */
  chipMissing: (names: string[]) => `Missing ${names.join(', ')}`,
  /** Purpose of a model package. */
  capability: {
    transcribe: 'Transcribe',
    align: 'Align',
    synthesize: 'Synthesize',
    image: 'Image',
    separate: 'Separate',
    music: 'Music',
    diarize: 'Speaker diarization',
  } as Record<ModelBundleStatus['capability'], string>,
  /** The item in the default menu “no default, use factory default”. */
  auto: 'Automatic',
  /** The stored default points to a model package that is not installed. */
  notInstalled: (name: string) => `${name} (not installed)`,
  /** Display names of components (license, missing-part labels, shared components); components not listed use their component name. */
  componentName: {
    'audiocpp-engine': 'audio.cpp engine',
    aligner: 'Forced aligner',
    speaker: 'Speaker embedding',
    vad: 'VAD (voice activity detection)',
    tokenizer: 'Tokenizer',
    segmentation: 'Speaker segmentation',
    codec: 'Speech codec',
    aux: 'Auxiliary models',
  } as Record<string, string>,
  /** The row for a shared component says what it does; components not listed have no description. */
  componentDesc: {
    'audiocpp-engine': 'Runs YuE2 · downloaded for your platform · Windows / Linux need a Vulkan GPU driver',
    vad: 'Finds the stretches where someone is speaking',
    aligner: 'Aligns the text to word-level timing',
    tokenizer: 'Converts between text and the model’s tokens',
    speaker: 'Tells speakers apart',
    segmentation: 'Finds where each speaker starts and stops talking',
    codec: 'Turns acoustic tokens back into a waveform',
    aux: 'Extra models the main model needs',
  } as Record<string, string>,
  /** Source of components downloaded from GitHub release pages (the component row in details): repository and release tag. */
  githubRelease: (repo: string, tag: string) => `GitHub release ${repo} ${tag}`,
  weights: 'Model weights',
};

export type ModelsLocalMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
