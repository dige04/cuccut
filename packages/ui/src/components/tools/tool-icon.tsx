import type { ComponentProps, ComponentType } from 'react';
import { AudioLines, Captions, Download as DownloadLine, Film, Image as ImageLine, Languages, Layers as LayersLine, Mic, Music, Type, type LucideIcon } from 'lucide-react';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import ImageIcon from '@react-spectrum/s2/icons/Image';
import Download from '@react-spectrum/s2/icons/Download';
import Layers from '@react-spectrum/s2/icons/Layers';
import Microphone from '@react-spectrum/s2/icons/Microphone';
import TextIcon from '@react-spectrum/s2/icons/Text';
import Transcript from '@react-spectrum/s2/icons/Transcript';
import Translate from '@react-spectrum/s2/icons/Translate';
import type { ToolIcon } from '../../model/tool-catalog.ts';
import { MusicIcon } from '../music-icon.tsx';

type IconComponent = ComponentType<ComponentProps<typeof AudioWave>>;

/** Icons for the tool catalog (the `icon` in design file model-tools.js `GROUPS`): shared by the overview cards and the sidebar. */
export const TOOL_ICON: Record<ToolIcon, IconComponent> = {
  transcript: Transcript,
  translate: Translate,
  microphone: Microphone,
  import: Download,
  wave: AudioWave,
  image: ImageIcon,
  music: MusicIcon,
  text: TextIcon,
  film: Filmstrip,
  layers: Layers,
};

/** The same catalog icons in lucide, for the page chrome (the Tools rail and gallery cards). */
export const TOOL_RAIL_ICON: Record<ToolIcon, LucideIcon> = {
  transcript: Captions,
  translate: Languages,
  microphone: Mic,
  import: DownloadLine,
  wave: AudioLines,
  image: ImageLine,
  music: Music,
  text: Type,
  film: Film,
  layers: LayersLine,
};
