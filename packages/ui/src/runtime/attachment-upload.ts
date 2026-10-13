import { ATTACHMENT_COPY } from '../copy.ts';

/**
 * PUT the raw image bytes to the one-time address given by `attachments.prepare` (same port as the media channel).
 * Uses XHR instead of fetch because upload progress is needed. Content-Type must match the one declared at registration.
 */
export function putAttachment(
  url: string,
  body: Blob,
  mimeType: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else reject(new Error(ATTACHMENT_COPY.httpFailed(xhr.status)));
    };
    xhr.onerror = () => reject(new Error(ATTACHMENT_COPY.networkFailed));
    xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'));
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(body);
  });
}
