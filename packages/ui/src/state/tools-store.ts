import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Id } from '@cuccut/protocol';
import { BLANK_IMAGE, type ImageDraft } from '../model/tools-image.ts';
import { BLANK_MUSIC, type MusicDraft } from '../model/tools-music.ts';
import { hideJob } from '../model/tools-records.ts';
import { BLANK_TEXT, type TextDraft } from '../model/tools-text.ts';
import { BLANK_COMPRESS, BLANK_EXTRACT, BLANK_MERGE, type TranscodeDraft } from '../model/tools-transcode.ts';
import type { TranscribeMode } from '../model/tools-transcribe.ts';
import { BLANK_TTS, type TtsDraft } from '../model/tools-tts.ts';

/** Form of the transcription tool: the chosen file is kept only for this run (the path may expire); the method, model and language are remembered with the draft. */
export interface TranscribeDraft {
  path: string | null;
  mode: TranscribeMode | null;
  model: string | null;
  language: string;
  /** Value the user set by hand for "More options › Identify speakers"; kept when the model changes. null means never set by hand (decided by the model and whether "speaker diarization" is installed). */
  speakers: boolean | null;
}

export const BLANK_TRANSCRIBE: TranscribeDraft = { path: null, mode: null, model: null, language: '', speakers: null };

/**
 * Local state of the tools page (the `jobs.draft` of each tool in the design): form drafts, kept when switching away and back; tasks hidden by "Delete this record"; records that were resubmitted.
 * The records themselves are not here; they are tasks in the `jobs` topic (model/tools-records.ts).
 */
export interface ToolsStore {
  hidden: Id[];
  /** Failed records already resubmitted with the original parameters in this run: "Try again" is no longer offered, so repeated clicks do not charge again. Not saved to disk. */
  retried: Id[];
  tts: TtsDraft;
  image: ImageDraft;
  music: MusicDraft;
  text: TextDraft;
  transcribe: TranscribeDraft;
  /** Form for compressing video, merging video and extracting audio: the chosen files are kept only for this run (as with transcription); encoding settings and output directory are remembered with the draft. */
  compress: TranscodeDraft;
  merge: TranscodeDraft;
  extract: TranscodeDraft;
  hide(jobId: Id): void;
  markRetried(jobId: Id): void;
  patchTts(patch: Partial<TtsDraft>): void;
  patchImage(patch: Partial<ImageDraft>): void;
  patchMusic(patch: Partial<MusicDraft>): void;
  patchText(patch: Partial<TextDraft>): void;
  patchTranscribe(patch: Partial<TranscribeDraft>): void;
  patchCompress(patch: Partial<TranscodeDraft>): void;
  patchMerge(patch: Partial<TranscodeDraft>): void;
  patchExtract(patch: Partial<TranscodeDraft>): void;
}

export const useTools = create<ToolsStore>()(
  persist(
    (set) => ({
      hidden: [],
      retried: [],
      tts: BLANK_TTS,
      image: BLANK_IMAGE,
      music: BLANK_MUSIC,
      text: BLANK_TEXT,
      transcribe: BLANK_TRANSCRIBE,
      compress: BLANK_COMPRESS,
      merge: BLANK_MERGE,
      extract: BLANK_EXTRACT,
      hide: (jobId) => set((s) => ({ hidden: hideJob(s.hidden, jobId) })),
      markRetried: (jobId) => set((s) => (s.retried.includes(jobId) ? s : { retried: [...s.retried, jobId] })),
      patchTts: (patch) => set((s) => ({ tts: { ...s.tts, ...patch } })),
      patchImage: (patch) => set((s) => ({ image: { ...s.image, ...patch } })),
      patchMusic: (patch) => set((s) => ({ music: { ...s.music, ...patch } })),
      patchText: (patch) => set((s) => ({ text: { ...s.text, ...patch } })),
      patchTranscribe: (patch) => set((s) => ({ transcribe: { ...s.transcribe, ...patch } })),
      patchCompress: (patch) => set((s) => ({ compress: { ...s.compress, ...patch } })),
      patchMerge: (patch) => set((s) => ({ merge: { ...s.merge, ...patch } })),
      patchExtract: (patch) => set((s) => ({ extract: { ...s.extract, ...patch } })),
    }),
    {
      name: 'cuccut.tools',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // "Change…" for the save location only changes it this once: the output directory is not kept across runs.
      partialize: (s) => ({
        hidden: s.hidden,
        tts: s.tts,
        image: s.image,
        music: s.music,
        text: s.text,
        transcribe: { ...s.transcribe, path: null },
        compress: { ...s.compress, inputs: [], outDir: null },
        merge: { ...s.merge, inputs: [], outDir: null },
        extract: { ...s.extract, inputs: [], outDir: null },
      }),
      // When fields are added later, the entries missing from an old draft are filled in with an empty form.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<ToolsStore, 'hidden' | 'tts' | 'image' | 'music' | 'text' | 'transcribe' | 'compress' | 'merge' | 'extract'>>;
        return {
          ...current,
          hidden: Array.isArray(p.hidden) ? p.hidden : current.hidden,
          tts: { ...BLANK_TTS, ...p.tts },
          image: { ...BLANK_IMAGE, ...p.image },
          music: { ...BLANK_MUSIC, ...p.music },
          text: { ...BLANK_TEXT, ...p.text },
          transcribe: { ...BLANK_TRANSCRIBE, ...p.transcribe, path: null },
          compress: { ...BLANK_COMPRESS, ...p.compress, inputs: [], outDir: null },
          merge: { ...BLANK_MERGE, ...p.merge, inputs: [], outDir: null },
          extract: { ...BLANK_EXTRACT, ...p.extract, inputs: [], outDir: null },
        };
      },
    },
  ),
);
