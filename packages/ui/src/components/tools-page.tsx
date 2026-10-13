import { toolById, type ToolId } from '../model/tool-catalog.ts';
import { plannedReason } from '../model/tools-gallery.ts';
import { DubTool } from './tools/dub-tool.tsx';
import { ImageTool } from './tools/image-tool.tsx';
import { MusicTool } from './tools/music-tool.tsx';
import { LinkTool } from './tools/link-tool.tsx';
import { PlannedTool } from './tools/planned-tool.tsx';
import { TextTool } from './tools/text-tool.tsx';
import { CompressTool, ExtractAudioTool, MergeTool } from './tools/transcode-tool.tsx';
import { ToolsGallery } from './tools/tools-gallery.tsx';
import { TranscribeTool } from './tools/transcribe-tool.tsx';
import { TranslateTool } from './tools/translate-tool.tsx';
import { TtsTool } from './tools/tts-tool.tsx';

/**
 * Tools (product design §2.1, §2.7; design file page-tools.jsx): without a tool specified, it shows the overview; each tool has its own workbench page (compress, merge and extract audio share one page,
 * switched from the top of the page). A tool that has no backend yet says “即将推出” (Coming soon) and the reason when deep-linked to.
 */
export function ToolsPage({ tool }: { tool?: ToolId }) {
  const info = toolById(tool);
  if (!info) return <ToolsGallery />;
  const reason = plannedReason(info.id);
  if (reason) return <PlannedTool tool={info} reason={reason} />;
  switch (info.id) {
    case 'transcribe':
      return <TranscribeTool />;
    case 'translate-subtitles':
      return <TranslateTool />;
    case 'dub':
      return <DubTool />;
    case 'link-import':
      return <LinkTool />;
    case 'synthesize-speech':
      return <TtsTool />;
    case 'generate-image':
      return <ImageTool />;
    case 'generate-music':
      return <MusicTool />;
    case 'generate-text':
      return <TextTool />;
    case 'compress-video':
      return <CompressTool />;
    case 'merge-video':
      return <MergeTool />;
    case 'extract-audio':
      return <ExtractAudioTool />;
    default:
      return <ToolsGallery />;
  }
}
