import type { Id } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { HOME_COPY } from '../../copy.ts';
import { RATIO_SIZE, type Ratio } from '../../model/new-flow.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useShell } from '../../state/shell-store.ts';

/** The shapes a blank video can start in: the flow ratios plus 4:5 (agentcut's "start from" shapes). */
export type BlankRatio = Ratio | '4:5';

const BLANK_SIZE: Record<BlankRatio, { width: number; height: number }> = { ...RATIO_SIZE, '4:5': { width: 1080, height: 1350 } };

/**
 * Create a new blank video (prototype page-new.jsx `createBlank`): not a prompt, and it does not go through the Agent. Creates an empty video at the chosen aspect ratio and opens it directly in the feature area.
 * The start page's “新建空白视频” and Space's “New blank video” share this. If no project is chosen, a project is created first and the video is put in it (same as the original fixed flow).
 */
export async function createBlankVideo(
  runtime: Pick<RuntimeSession, 'createProject' | 'createFlowVideo'>,
  projectId: Id | null,
  ratio: BlankRatio,
): Promise<boolean> {
  try {
    const into = projectId ?? (await runtime.createProject(HOME_COPY.blankVideoProject)).id;
    const { target } = await runtime.createFlowVideo({ projectId: into }, BLANK_SIZE[ratio]);
    useShell.getState().openVideo(target, { conversationId: null, projectId: into });
    ToastQueue.positive(HOME_COPY.blankVideoCreated, { timeout: 4000 });
    return true;
  } catch (error) {
    ToastQueue.negative(HOME_COPY.blankVideoFailed((error as Error).message), { timeout: 5000 });
    return false;
  }
}
