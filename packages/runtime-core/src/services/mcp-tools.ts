import type { ServiceLevel } from '@cuccut/protocol';
import type { ToolInfo } from '../agent-tools/tool-catalog.ts';

/**
 * Tools the MCP service exposes (architecture design §4.8): the catalog entries whose `surfaces` include `mcp`; no separate
 * table is kept. Tool names and arguments are an external contract: renaming them or changing arguments is a breaking change
 * that must bump `MCP_INTERFACE_VERSION` and update the protocol constant `MCP_SERVICE_TOOL_NAMES` (a test asserts they
 * match). The implementation is shared with the tool bridge; only the principal and the scope differ (`ServiceScope`).
 *
 * - The `read` level exposes only tools with `annotations.readOnlyHint`; `ask` and `auto` expose every tool on the `mcp`
 *   surface. Hidden tools do not appear in the catalog, and calling one answers `UNKNOWN_TOOL`, as for a tool that does
 *   not exist.
 * - Not exposed: tools whose `surfaces` lack `mcp` (job contracts, outbound grant requests, handing files to the downloads
 *   directory, deleting videos, local model bundles, writing artifacts out as files), and everything outside the catalog
 *   (settings, credentials, service management, arbitrary files and commands).
 */
export function serviceToolExposed(info: ToolInfo, level: ServiceLevel): boolean {
  if (!info.surfaces.includes('mcp')) return false;
  return level !== 'read' || info.annotations?.readOnlyHint === true;
}

/**
 * Replaces a session-only passage of a catalog description. The anchor is the catalog's current wording: when it is
 * missing (the catalog text was reworded), this throws instead of silently leaving session wording in the MCP
 * description; `mcp-tools.test.ts` runs every rewrite against the real catalog.
 */
function rewrite(name: string, description: string, from: string | RegExp, to: string): string {
  const found = typeof from === 'string' ? description.includes(from) : from.test(description);
  if (!found) throw new Error(`MCP description rewrite for ${name} no longer matches the catalog text: ${String(from)}`);
  return description.replace(from, to);
}

/** The description shown to external clients: it does not mention sessions or the working directory, nor tools not offered here. */
export function describeServiceTool(name: string, info: ToolInfo): ToolInfo {
  switch (name) {
    case 'videos_list':
      return {
        ...info,
        description:
          'Lists the videos this service can access: the videos in projects registered in CucCut, each with videoId, name, project (projectId) and path. Use videoId to name a video afterwards.',
      };
    case 'videos_create':
      return {
        ...info,
        description: [
          'Creates an empty video (one visual track, one audio track) in a project registered in CucCut.',
          'project is required: the project id (projectId from videos_list). The new video is added to the videos this service can access; returns the same summary as videos_inspect.',
        ].join('\n'),
      };
    case 'jobs_inspect':
      return {
        ...info,
        description: rewrite(name, info.description, /You can see jobs you submitted in this session.*$/s, 'You can only see jobs you (this client) submitted.'),
      };
    case 'jobs_cancel':
      return {
        ...info,
        description:
          'Cancels a job you (this client) submitted. A queued job is cancelled at once; a running one once the provider stops. Returns the final state.',
      };
    case 'edits_apply':
      return {
        ...info,
        description: rewrite(
          name,
          info.description,
          'media file (relative to the working directory, or absolute)',
          "media file (relative to the video's project directory; only a file inside the project directory)",
        ),
      };
    case 'assets_import':
      return { ...info, description: `${info.description}\npath is relative to the video's project directory and must be a file inside it.` };
    case 'compositions_import':
      return { ...info, description: `${info.description}\npath is relative to the video's project directory and must be a directory inside it.` };
    case 'compositions_preview':
      return {
        ...info,
        description: `${rewrite(
          name,
          info.description,
          'in the output directory (the working directory for sessions and the terminal)',
          "in the exports/ of the video's project",
        )}\npath is relative to the video's project directory and must be a directory inside it.`,
      };
    case 'videos_frames':
      return {
        ...info,
        description: rewrite(
          name,
          info.description,
          "under the output directory (the working directory for sessions and the terminal, the project's exports for external services) in",
          "in the exports/ of the video's project, under",
        ),
      };
    case 'export':
      return {
        ...info,
        description: `${info.description}\nFiles are written into the exports/ of the video's project (dir can only be an existing subdirectory of it); the outputs of jobs_inspect give each file's path.`,
      };
    case 'speak':
    case 'image':
    case 'music':
      return {
        ...info,
        description: rewrite(name, info.description, '; when you need the file itself, copy it into the working directory with artifacts_save', ''),
      };
    case 'download':
      return {
        ...info,
        description: [
          'Downloads media from a video page link with yt-dlp and imports it into a video this service can access.',
          'video is required (a videoId from videos_list; for a new video, use videos_create first): the downloaded media is imported as an asset of that video, and with transcribe true a transcription is submitted too. Takes a single video only, never a playlist.',
          'The user must have installed yt-dlp in CucCut and agreed to its use; otherwise the call is refused with TOOL_UNAVAILABLE (remedy says what to ask the user to do). Asks the user to confirm according to the access level.',
          'Returns a jobId at once: wait for it with jobs_wait (for progress use jobs_inspect; progress.unit is bytes); when state is completed, outputs[0].assetId is the imported asset. On failure error.code is LINK_LOGIN_REQUIRED, LINK_UNSUPPORTED, LINK_NETWORK_ERROR, LINK_DISK_FULL and so on, and error.details.remedy says how to recover.',
        ].join('\n'),
      };
    default:
      return info;
  }
}
