import { ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, type AttachmentMimeType } from '@cuccut/protocol';
import { ATTACHMENT_COPY } from '../copy.ts';

/**
 * Validation of images attached in the composer (product design §3.2.4; prototype `composerImageFiles` / `addImages` in agent-thread.jsx).
 * The client checks first, then the Runtime validates; the limits and formats both come from limits.ts, not written out again here.
 */

export type AttachmentRejection = 'type' | 'size' | 'count';

export interface ImageCandidate {
  type: string;
  size: number;
}

export function isAttachmentMimeType(type: string): type is AttachmentMimeType {
  return (ATTACHMENT_MIME_TYPES as readonly string[]).includes(type);
}

/** Whether a single image is accepted: its format is on the allow-list and its size is between 0 (exclusive) and the limit (inclusive). */
export function checkImage(file: ImageCandidate): AttachmentRejection | null {
  if (!isAttachmentMimeType(file.type)) return 'type';
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) return 'size';
  return null;
}

/**
 * Which images to accept from a new batch (picked files, pasted, or dropped). Each is checked in turn: eligible ones are accepted in order until the message's image count limit is reached;
 * ineligible ones and ones that do not fit are returned, and `rejected` gives the first reason; the UI shows just one line.
 */
export function admitImages<T extends ImageCandidate>(
  existing: number,
  incoming: readonly T[],
): { accepted: T[]; rejected: AttachmentRejection | null } {
  const accepted: T[] = [];
  let rejected: AttachmentRejection | null = null;
  for (const file of incoming) {
    const problem = checkImage(file) ?? (existing + accepted.length >= MAX_ATTACHMENTS_PER_MESSAGE ? 'count' : null);
    if (problem) rejected ??= problem;
    else accepted.push(file);
  }
  return { accepted, rejected };
}

export function rejectionMessage(reason: AttachmentRejection): string {
  return reason === 'count' ? ATTACHMENT_COPY.tooMany : reason === 'size' ? ATTACHMENT_COPY.tooLarge : ATTACHMENT_COPY.badType;
}

/** Ordinary uploads share the attachment count/size bounds; MIME is normalized by uploadAttachment. */
export function admitFiles<T extends ImageCandidate>(existing:number,incoming:readonly T[]):{accepted:T[];rejected:AttachmentRejection|null}{
  const accepted:T[]=[];let rejected:AttachmentRejection|null=null;
  for(const file of incoming){const problem=file.size<=0||file.size>MAX_ATTACHMENT_BYTES?'size':existing+accepted.length>=MAX_ATTACHMENTS_PER_MESSAGE?'count':null;
    if(problem)rejected??=problem;else accepted.push(file);}
  return {accepted,rejected};
}
