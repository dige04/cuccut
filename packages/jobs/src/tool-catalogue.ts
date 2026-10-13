import type { ToolDefinition } from '@cuccut/protocol';
import { JobsToolCatalogue as T } from '@cuccut/protocol/messages/jobs/tool-catalogue.ts';
import { DUB_PIPELINE } from './pipelines/dub.ts';
import { LINK_IMPORT_PIPELINE } from './pipelines/link-import.ts';
import { TRANSCODE_PIPELINE } from './pipelines/transcode.ts';
import { TRANSCRIBE_PIPELINE } from './pipelines/transcribe.ts';
import { TRANSLATE_PIPELINE } from './pipelines/translate.ts';
import { TRANSLATE_SUBTITLES_PIPELINE } from './pipelines/translate-subtitles.ts';

/**
 * Static registry of the tool catalogue (architecture design §7.9; product design §2.7). Pure data, with no dependency on the Runtime: whether a tool is usable right now is decided by the Runtime from capability configuration, external tools, and strict-offline checks (`tools.list`). To add a tool, add an entry here. Once an ID is published it is not changed, because the source of an artifact records it.
 */

/** The name of the transcription workflow (the workflow has the same name as its transcription step, §7.9). */
export { TRANSCRIBE_PIPELINE };

/** The names of the download tool and ffmpeg in the managed external-tool registry (§12.9). */
const YT_DLP = 'yt-dlp';
const FFMPEG = 'ffmpeg';

/** Name and description are getters: they produce text in the current language when read (the catalogue is constructed at module load, when text cannot yet be fetched). */
export const TOOL_CATALOGUE: readonly ToolDefinition[] = [
  // Speech and subtitles
  {
    id: 'transcribe',
    get label() {
      return T.transcribeLabel().text;
    },
    get description() {
      return T.transcribeDescription().text;
    },
    category: 'speech',
    inputs: ['file', 'video'],
    // A file-only (`file`) result is TXT and SRT in the save location; given a video or a new video, it is written into the video.
    results: ['artifact', 'video'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSCRIBE_PIPELINE },
    capabilities: ['transcribe'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: 'videos',
  },
  {
    id: 'translate-subtitles',
    get label() {
      return T.translateSubtitlesLabel().text;
    },
    get description() {
      return T.translateSubtitlesDescription().text;
    },
    category: 'speech',
    inputs: ['video', 'document', 'file'],
    results: ['video', 'artifact'],
    // Video input: when started from the tool entry, a subtitle track in the target language is created (workflow parameters do not create one by default, §7.9).
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSLATE_PIPELINE, params: { captions: true } },
    // Subtitle file: file to file, with the entry count and timecodes unchanged; the video is not touched.
    executionByInput: { file: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSLATE_SUBTITLES_PIPELINE } },
    capabilities: ['generateText'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: 'videos-with-transcript',
  },
  {
    id: 'dub',
    get label() {
      return T.dubLabel().text;
    },
    get description() {
      return T.dubDescription().text;
    },
    category: 'speech',
    inputs: ['video', 'document'],
    results: ['video'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: DUB_PIPELINE },
    capabilities: ['synthesizeSpeech'],
    optionalCapabilities: ['generateText'],
    externalTools: [FFMPEG],
    optionalExternalTools: [],
    network: 'none',
    candidates: 'videos-with-transcript',
  },
  {
    id: 'synthesize-speech',
    get label() {
      return T.synthesizeSpeechLabel().text;
    },
    get description() {
      return T.synthesizeSpeechDescription().text;
    },
    category: 'speech',
    // `document`: Space documents and subtitle entries, submitted via `material` (§7.9 “Space entries as input”).
    inputs: ['text', 'document'],
    results: ['artifact'],
    execution: { kind: 'job', method: 'models.synthesizeSpeech', capability: 'synthesizeSpeech' },
    capabilities: ['synthesizeSpeech'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: null,
  },
  // Text and images
  {
    id: 'generate-text',
    get label() {
      return T.generateTextLabel().text;
    },
    get description() {
      return T.generateTextDescription().text;
    },
    category: 'text-image',
    // `document`: same as generated speech; the material's text is appended after the prompt.
    inputs: ['text', 'document'],
    results: ['artifact'],
    execution: { kind: 'job', method: 'models.generateText', capability: 'generateText' },
    capabilities: ['generateText'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: null,
  },
  {
    id: 'generate-image',
    get label() {
      return T.generateImageLabel().text;
    },
    get description() {
      return T.generateImageDescription().text;
    },
    category: 'text-image',
    inputs: ['text'],
    results: ['artifact'],
    execution: { kind: 'job', method: 'models.generateImage', capability: 'generateImage' },
    capabilities: ['generateImage'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: null,
  },
  {
    id: 'generate-music',
    get label() {
      return T.generateMusicLabel().text;
    },
    get description() {
      return T.generateMusicDescription().text;
    },
    category: 'music',
    inputs: ['text'],
    results: ['artifact'],
    execution: { kind: 'job', method: 'models.generateMusic', capability: 'generateMusic' },
    capabilities: ['generateMusic'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: null,
  },
  // Video files
  {
    id: 'link-import',
    get label() {
      return T.linkImportLabel().text;
    },
    get description() {
      return T.linkImportDescription().text;
    },
    category: 'video-file',
    inputs: ['link'],
    results: ['artifact'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: LINK_IMPORT_PIPELINE },
    capabilities: [],
    optionalCapabilities: ['transcribe'],
    externalTools: [YT_DLP],
    optionalExternalTools: [],
    network: 'required',
    candidates: null,
  },
  {
    id: 'compress-video',
    get label() {
      return T.compressVideoLabel().text;
    },
    get description() {
      return T.compressVideoDescription().text;
    },
    category: 'video-file',
    inputs: ['file'],
    results: ['artifact'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSCODE_PIPELINE, params: { action: 'compress' } },
    capabilities: [],
    optionalCapabilities: [],
    externalTools: [FFMPEG],
    optionalExternalTools: [],
    network: 'none',
    candidates: null,
  },
  {
    id: 'merge-video',
    get label() {
      return T.mergeVideoLabel().text;
    },
    get description() {
      return T.mergeVideoDescription().text;
    },
    category: 'video-file',
    inputs: ['file'],
    results: ['artifact'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSCODE_PIPELINE, params: { action: 'merge' } },
    capabilities: [],
    optionalCapabilities: [],
    externalTools: [FFMPEG],
    optionalExternalTools: [],
    network: 'none',
    candidates: null,
  },
  {
    id: 'extract-audio',
    get label() {
      return T.extractAudioLabel().text;
    },
    get description() {
      return T.extractAudioDescription().text;
    },
    category: 'video-file',
    inputs: ['file'],
    results: ['artifact'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSCODE_PIPELINE, params: { action: 'extract-audio' } },
    capabilities: [],
    optionalCapabilities: [],
    externalTools: [FFMPEG],
    optionalExternalTools: [],
    network: 'none',
    candidates: null,
  },
];

/** Finds a tool by ID; null if there is none. */
export function toolDefinition(id: string): ToolDefinition | null {
  return TOOL_CATALOGUE.find((tool) => tool.id === id) ?? null;
}
