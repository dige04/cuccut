import type { Id, VideoRef } from '@cuccut/protocol';
import { REVIEW_COPY as C } from '../components/review/review-copy.ts';
import { currentConversation, type HandoffConversation } from './ai-tools-handoff.ts';

/**
 * The judged pass from the UI (docs/cuccut/m2-review-gate.md §6): "Ask the questions too" hands one message to the
 * agent in the video's conversation. The agent reads `review_criteria`, looks at the video and records its answers with
 * `review_answer`; nothing here answers for it, and nothing runs on its own after an export.
 */

export interface RubricHandoff {
  /** Continue the conversation the video already has, or start one. */
  session: 'new' | { id: Id };
  text: string;
  /** The prompt box's draft key, should the message not go (it then waits in that conversation's input box). */
  draftKey: string;
}

/**
 * Which conversation the questions go to, and what is said: the video's own conversation when it has one (the one in
 * front of the user, else the most recent in its project or working directory), else a new one.
 */
export function rubricHandoff(o: {
  videoId: Id;
  video: Pick<VideoRef, 'name' | 'source'> | null;
  /** The conversation in front of the user, if any. */
  current: Id | null;
  conversations: readonly HandoffConversation[];
}): RubricHandoff {
  const here = currentConversation({ source: o.video?.source ?? null, current: o.current, conversations: o.conversations });
  return {
    session: here ? { id: here.id } : 'new',
    text: C.rubricPrompt(o.video?.name ?? o.videoId),
    draftKey: `review:${o.videoId}`,
  };
}

/** The answers arrived: a result written with answers given at or after the moment the questions were asked. */
export function answeredSince(answers: { at: string } | undefined, since: string): boolean {
  return !!answers && answers.at >= since;
}
