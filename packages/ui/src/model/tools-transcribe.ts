import { defineMessages, localizeText, type ModelCapabilitiesView, type TranscribeModelInfo } from '@cuccut/protocol';
import { LOCAL_PROVIDER } from './models-local.ts';
import { kindOfFileName } from './space.ts';
import { cloudModelOptions, initialModelKey, modelKeyOf, type ToolModelOption } from './tools-models.ts';
import { zhHans } from './tools-transcribe.zh-Hans.ts';
import { zhHant } from './tools-transcribe.zh-Hant.ts';
import { ja } from './tools-transcribe.ja.ts';
import { ko } from './tools-transcribe.ko.ts';
import { es } from './tools-transcribe.es.ts';
import { fr } from './tools-transcribe.fr.ts';
import { de } from './tools-transcribe.de.ts';
import { nl } from './tools-transcribe.nl.ts';
import { ptBR } from './tools-transcribe.pt-BR.ts';
import { it } from './tools-transcribe.it.ts';
import { ru } from './tools-transcribe.ru.ts';
import { pl } from './tools-transcribe.pl.ts';
import { tr } from './tools-transcribe.tr.ts';
import { vi } from './tools-transcribe.vi.ts';

/** Copy for the transcription tool (translations are in `tools-transcribe.<language>.ts`). */
const en = {
  mediaFormats: 'MP4, MOV, MP3, WAV, M4A',
  notInstalled: 'Not installed',
  notConnected: 'Not connected',
  noCloud: 'No online speech recognition service yet',
  cloudLine: (connected: boolean, provider: string) => `${connected ? 'Connected' : 'Not connected'} · ${provider} · transcribes online`,
  noLocal: 'No speech recognition model on this computer yet',
  localReady: 'Installed · recognizes on this computer',
  localMissing: 'Model not installed yet',
};
export type ToolsTranscribeMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Tools › Transcribe (design mockup tool-transcribe.jsx): speech model and file checks: local or online, model, language, and whether this file is accepted.
 * Submission goes through the `transcribe` flow (model/tool-runs.ts `transcribeParams`): a local file creates a new video, or is written into a video in the Space.
 */

export type TranscribeOption = ToolModelOption<TranscribeModelInfo>;
export type TranscribeMode = 'local' | 'cloud';

/** The line of supported formats below the drop zone (wording as in the design mockup). */
export function mediaFormats(): string {
  return M.mediaFormats;
}

/** Whether this file is accepted: videos or audio in the Space category. */
export function isTranscribable(fileName: string): boolean {
  const kind = kindOfFileName(fileName);
  return kind === 'video-file' || kind === 'audio';
}

/** The last segment of the path. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** Local speech recognition models: model packs under the `local` provider. Unavailable ones (not installed properly, or disabled) are listed too, marked 「未安装」 (not installed). */
function localOptions(view: ModelCapabilitiesView): TranscribeOption[] {
  return view.transcribe.providers
    .filter((p) => p.kind === 'local' || p.providerId === LOCAL_PROVIDER)
    .flatMap((p) =>
      p.models.map((info) => {
        const why = !p.available
          ? (localizeText(p.detail, p.detailRef) ?? M.notInstalled)
          : info.available === false
            ? (localizeText(info.detail, info.detailRef) ?? M.notInstalled)
            : null;
        return {
          key: modelKeyOf(p.providerId, info.modelId),
          providerId: p.providerId,
          provider: p.label,
          modelId: info.modelId,
          label: info.label || info.modelId,
          connected: true,
          usable: why === null,
          why,
          info,
        };
      }),
    );
}

/** Models for this transcription method: for local, the model packs on this machine; for cloud, every model from the online provider (ones not connected are listed too, marked 「未连接」 (not connected)). */
export function transcribeOptions(view: ModelCapabilitiesView, mode: TranscribeMode): TranscribeOption[] {
  return mode === 'local' ? localOptions(view) : cloudModelOptions(view, 'transcribe', true);
}

/** An item in the picker: cloud items carry the provider name; unusable items carry 「未连接 / 未安装」 (not connected / not installed) (wording as in the design mockup). */
export function transcribeOptionLabel(option: TranscribeOption, mode: TranscribeMode): string {
  const name = mode === 'cloud' ? `${option.provider} · ${option.label}` : option.label;
  if (option.usable) return name;
  return `${name} · ${mode === 'cloud' ? M.notConnected : M.notInstalled}`;
}

/** The method and model on opening the page: the active default decides which side it lands on; when there is none, local takes priority. */
export function initialTranscribe(view: ModelCapabilitiesView, saved: { mode: TranscribeMode; model: string | null } | null): {
  mode: TranscribeMode;
  model: string | null;
} {
  if (saved && transcribeOptions(view, saved.mode).some((o) => o.key === saved.model)) return saved;
  const effective = view.transcribe.effective;
  const local = transcribeOptions(view, 'local');
  const mode: TranscribeMode = effective
    ? local.some((o) => o.providerId === effective.providerId)
      ? 'local'
      : 'cloud'
    : local.some((o) => o.usable) || !transcribeOptions(view, 'cloud').some((o) => o.usable)
      ? 'local'
      : 'cloud';
  return { mode, model: initialModelKey(transcribeOptions(view, mode), null, effective) };
}

/** Switching the transcription method lands on the first usable model on that side (or the first one, if none is usable), and the language returns to automatic (design mockup `switchMode`). */
export function switchMode(view: ModelCapabilitiesView, mode: TranscribeMode): { mode: TranscribeMode; model: string | null; language: string } {
  return { mode, model: initialModelKey(transcribeOptions(view, mode), null, view.transcribe.effective), language: '' };
}

/** The status sentence below the model (wording as in the design mockup). */
export function transcribeStatus(option: TranscribeOption | null, mode: TranscribeMode): string {
  if (mode === 'cloud') {
    if (!option) return M.noCloud;
    return M.cloudLine(option.usable, option.provider);
  }
  if (!option) return M.noLocal;
  return option.usable ? M.localReady : M.localMissing;
}
