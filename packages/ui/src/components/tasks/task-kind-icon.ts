import { AudioLines, Bot, Download, FolderInput, FolderOpen, Image, Languages, Layers, Mic, Music, Search, Sparkles, Upload, UserRound, Wrench, type LucideIcon } from 'lucide-react';
import type { TaskKind } from '../../model/task-list.ts';

/** Icons (lucide, like the rest of the page chrome) for each kind of background task: the Tasks rail and task cards. */
export const TASK_KIND_RAIL_ICON: Record<TaskKind, LucideIcon> = {
  agent: Bot,
  transcribe: Mic,
  synthesizeSpeech: AudioLines,
  generateImage: Image,
  generateMusic: Music,
  generateText: Sparkles,
  export: Upload,
  pipeline: Layers,
  'pipeline-step': Layers,
  modelInstall: Download,
  modelTest: Search,
  modelsMove: FolderInput,
  toolInstall: Wrench,
  toolUpdate: Wrench,
  fontDownload: Download,
  voiceClone: UserRound,
  agentTranslate: Languages,
  legacyImport: FolderOpen,
};
