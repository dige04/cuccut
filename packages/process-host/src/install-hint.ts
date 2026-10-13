/**
 * The one-line fix shown to the user when ffmpeg is not found, given for the platform the Runtime runs on (the machine missing the tool is the Runtime's machine, not the one showing the interface).
 *
 * The commands match `installCommand` / `manualInstall` in the design draft `model-video.js`: macOS uses Homebrew, Windows uses winget, and platforms with no command give the official download page. Each Linux distribution has its own package manager; the apt of Debian / Ubuntu is used as the example.
 *
 * On Windows, CucCut must be reopened after installation: PATH is fixed when the process starts, and winget's change is only seen by new processes.
 */

import type { Localized } from '@cuccut/protocol';
import { ProcessHostTools as T } from '@cuccut/protocol/messages/process-host';

export const FFMPEG_DOWNLOAD_URL = 'https://ffmpeg.org/download.html';

/** A hint for installing ffmpeg on this platform (excluding the words “安装 ffmpeg” (install ffmpeg) themselves), e.g. “例如 brew install ffmpeg” (for example: brew install ffmpeg). */
export function ffmpegInstallHint(platform: string = process.platform): string {
  return installHintMessage(platform).text;
}

function installHintMessage(platform: string): Localized {
  switch (platform) {
    case 'darwin':
      return T.hintMac();
    case 'win32':
      return T.hintWindows();
    case 'linux':
      return T.hintLinux();
    default:
      return T.hintDownload({ url: FFMPEG_DOWNLOAD_URL });
  }
}

/**
 * The full fix when ffmpeg is not found. When `ffprobe` is true, ffprobe is mentioned too (export and media checks use it; it is installed together with ffmpeg).
 */
export function ffmpegMissingRemedy(options: { ffprobe?: boolean; platform?: string } = {}): string {
  return ffmpegMissingRemedyMessage(options).text;
}

/** Same as `ffmpegMissingRemedy`, with a message reference: when it is embedded as an argument of another `Localized`, the reader's side can re-display it in their own language. */
export function ffmpegMissingRemedyMessage(options: { ffprobe?: boolean; platform?: string } = {}): Localized {
  const hint = installHintMessage(options.platform ?? process.platform);
  return options.ffprobe ? T.remedyWithProbe({ hint }) : T.remedy({ hint });
}
