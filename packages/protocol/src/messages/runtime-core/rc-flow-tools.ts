import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-flow-tools.zh-Hans.ts';
import { zhHant } from './rc-flow-tools.zh-Hant.ts';
import { ja } from './rc-flow-tools.ja.ts';
import { ko } from './rc-flow-tools.ko.ts';
import { es } from './rc-flow-tools.es.ts';
import { fr } from './rc-flow-tools.fr.ts';
import { de } from './rc-flow-tools.de.ts';
import { nl } from './rc-flow-tools.nl.ts';
import { ptBR } from './rc-flow-tools.pt-BR.ts';
import { it } from './rc-flow-tools.it.ts';
import { ru } from './rc-flow-tools.ru.ts';
import { pl } from './rc-flow-tools.pl.ts';
import { tr } from './rc-flow-tools.tr.ts';
import { vi } from './rc-flow-tools.vi.ts';

/**
 * Human-facing text for the first-level verbs (agent-tools/flow-tools.ts: `transcribe`, `translate`, `dub`, `transcode`): summaries on approval cards.
 * Tool descriptions, errors and next steps for the model are for the model only and are not here. English is the source of keys and types; translations are in `rc-flow-tools.<language>.ts`.
 */

/** The provider and model in the summary: written in parentheses when a provider is given. */
function providerNote(p: { provider: string | null; model: string | null }): string {
  return p.provider ? ` (${p.provider}${p.model ? ` ${p.model}` : ''})` : '';
}

/** How the original audio is handled while dubbing (`duck`, `mute`, `keep`). */
function originalAction(original: string): string {
  switch (original) {
    case 'mute':
      return 'mute';
    case 'keep':
      return 'keep';
    default:
      return 'lower';
  }
}

/** Transcode action (`compress`, `merge`, `extract-audio`) together with the file count. */
function transcodeAction(action: string, count: number): string {
  const files = `${count} ${count === 1 ? 'file' : 'files'}`;
  switch (action) {
    case 'merge':
      return `Merge ${files} in order`;
    case 'extract-audio':
      return `Extract audio from ${files}`;
    default:
      return `Compress ${files}`;
  }
}

const en = {
  /** Separator between items in a list. */
  listSeparator: ', ',

  /** Transcribe an asset in an existing video; when `asset` is null, it is the asset on the main track. */
  transcribeVideoSummary: (p: { asset: string | null; provider: string | null; model: string | null; captions: boolean }) =>
    `Transcribe ${p.asset ? `asset ${p.asset}` : 'the asset on the main track'}${providerNote(p)}${p.captions ? ' and add a subtitle layer' : ''}`,
  /** Transcribe an asset in an existing video and swap in the transcript (`target: 'replace'`). */
  transcribeReplaceSummary: (p: { asset: string | null; provider: string | null; model: string | null }) =>
    `Re-transcribe ${p.asset ? `asset ${p.asset}` : 'the asset on the main track'}${providerNote(p)} and replace the video's current transcript, carrying over translations, subtitles and dubbing (one undoable transaction)`,
  /** Transcribe a local file, writing only TXT and SRT transcripts; when `outDir` is null, written to the downloads folder. */
  transcribeFileSummary: (p: { file: string; provider: string | null; model: string | null; outDir: string | null }) =>
    `Transcribe ${p.file}${providerNote(p)} and write TXT and SRT transcripts to ${p.outDir ?? 'the Downloads folder'}`,
  /** Create a video from a local file, import it, place it on the timeline, then transcribe it. */
  transcribeCreateSummary: (p: { name: string | null; file: string; provider: string | null; model: string | null; captions: boolean }) =>
    `Create video${p.name ? ` "${p.name}"` : ''}, import ${p.file} and add it to the timeline, then transcribe it${providerNote(p)}${p.captions ? ' and add a subtitle layer' : ''}`,

  /** Translate the transcript of a video with a text model. */
  translateVideoSummary: (p: { to: string; provider: string | null; model: string | null; captions: boolean; bilingual: boolean }) =>
    `Translate the transcript into ${p.to} with the text model${providerNote(p)}${p.captions ? ` and add a ${p.bilingual ? 'bilingual ' : ''}subtitle layer` : ''}`,
  /** Translate a local subtitle file with a text model; when `outDir` is null, written to the downloads folder. */
  translateFileSummary: (p: { input: string; to: string; provider: string | null; model: string | null; outDir: string | null }) =>
    `Translate subtitle file ${p.input} into ${p.to} with the text model${providerNote(p)} and write the new file to ${p.outDir ?? 'the Downloads folder'}`,

  /** Translate the dub; `original` is `duck`, `mute` or `keep`. */
  dubSummary: (p: {
    to: string | null;
    translation: string | null;
    provider: string | null;
    model: string | null;
    voice: string | null;
    original: string;
  }) =>
    `Translated voice-over${p.to ? ` (${p.to})` : ''}: ${p.translation ? `use translation ${p.translation}` : 'translate with the text model first'}, synthesize sentence by sentence${providerNote(p)}${p.voice ? ` with voice ${p.voice}` : ''}, add a new voice-over track, and ${originalAction(p.original)} the original audio`,

  /** Transcode; `action` is `compress`, `merge` or `extract-audio`; `files` are the first few files (joined with `listSeparator`); `truncated` means there are more. */
  transcodeSummary: (p: { action: string; count: number; files: string; truncated: boolean; outDir: string | null }) =>
    `${transcodeAction(p.action, p.count)} (${p.files}${p.truncated ? '…' : ''}) and save to ${p.outDir ?? 'the Downloads folder'}`,
};

export type RcFlowToolsMessages = typeof en;

export const RcFlowTools = defineCatalog('rcFlowTools', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
