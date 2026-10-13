import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from '@cuccut/protocol';
import type { MessageFile } from '@cuccut/ui';

const IMAGE_MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

/** macOS can mix files and directories. Windows / Linux must decide before opening the system picker whether to select files or directories. */
export function messageFileProperties(platform: string, folders: boolean): ('openFile' | 'openDirectory' | 'multiSelections')[] {
  return platform === 'darwin' ? ['openFile', 'openDirectory', 'multiSelections'] : [folders ? 'openDirectory' : 'openFile', 'multiSelections'];
}

/** Reads only the images just returned by the system picker. Other files and directories keep their paths, and directory contents are not read recursively. */
export async function messageFiles(paths: readonly string[], images: boolean): Promise<MessageFile[]> {
  let imageCount = 0;
  const result: MessageFile[] = [];
  for (const selected of paths) {
    const stat = await fs.stat(selected);
    const entry: MessageFile = { path: selected, kind: stat.isDirectory() ? 'directory' : 'file' };
    const mimeType = IMAGE_MIME[path.extname(selected).toLowerCase()];
    if (images && stat.isFile() && mimeType && stat.size > 0 && stat.size <= MAX_ATTACHMENT_BYTES && imageCount < MAX_ATTACHMENTS_PER_MESSAGE) {
      // Reads up to a fixed limit, so that even if a file grows after stat, no oversized payload is sent to the renderer process.
      const handle = await fs.open(selected, 'r');
      try {
        const bytes = Buffer.alloc(stat.size + 1);
        let length = 0;
        while (length < bytes.length) {
          const read = await handle.read(bytes, length, bytes.length - length, length);
          if (!read.bytesRead) break;
          length += read.bytesRead;
        }
        if (length > 0 && length <= stat.size) {
          entry.image = { mimeType, bytes: new Uint8Array(bytes.subarray(0, length)) };
          imageCount++;
        }
      } finally { await handle.close(); }
    }
    result.push(entry);
  }
  return result;
}
