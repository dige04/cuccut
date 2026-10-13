import path from 'node:path';
import {
  AGENT_SKILL_ID,
  AgentSkillRenderError,
  renderAgentGuidance,
  type AgentSkillCatalog,
  type AgentSkillPage,
} from '../skills/agent-skill-renderer.ts';

/**
 * Guidance for agents inside a session (architecture design §3.8; agent surface design §8.6 "one source, two
 * renderings"): not hand-written here, but rendered from the agent guide `skills/cuccut/` for the tool-bridge surface.
 *
 * - `instructions`: the SKILL.md body, used as developer guidance for every native session (the "How to work" section),
 *   with the skill index appended after it.
 * - `pages`: `references/catalog/*.md`, `workflows.md` and `conventions.md`, registered as built-in skills
 *   (`cuccut-catalog-*`, `cuccut-workflows`, `cuccut-conventions`); they appear in the skill index and agents
 *   `skills_read` them as needed.
 *
 * `{{tool:…}}` is checked against the Runtime's actual tool-bridge catalog. When the guide is missing or cannot be
 * rendered, `AgentGuidanceError` is thrown: the Runtime fails at startup rather than opening sessions with empty or
 * stale guidance.
 */

export interface AgentGuidanceBundle {
  instructions: string;
  pages: AgentSkillPage[];
  /** The agent guide directory (`<root>/cuccut`). */
  sourceDir: string;
}

export class AgentGuidanceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AgentGuidanceError';
  }
}

/** `root` is the agent guide's root directory (containing `cuccut/`, see `resolveBuiltinAgentSkillsDir`); `catalog` is the tool-bridge surface's catalog. */
export function loadAgentGuidance(root: string | null, catalog: AgentSkillCatalog): AgentGuidanceBundle {
  if (!root) {
    throw new AgentGuidanceError(
      'Agent guide directory skills/ not found: guidance for agents inside a session is rendered from it. Check CUCCUT_AGENT_SKILLS_DIR, skills/ in the packaged resources, or the repository root',
    );
  }
  const sourceDir = path.join(root, AGENT_SKILL_ID);
  try {
    const { guidance, pages } = renderAgentGuidance(sourceDir, catalog);
    if (!guidance.trim()) throw new AgentGuidanceError(`The guidance rendered from the agent guide ${sourceDir}/SKILL.md is empty`);
    return { instructions: guidance, pages, sourceDir };
  } catch (error) {
    if (error instanceof AgentGuidanceError) throw error;
    if (error instanceof AgentSkillRenderError) {
      throw new AgentGuidanceError(`Failed to render session guidance (${sourceDir}): ${error.message}`, { cause: error });
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new AgentGuidanceError(`Agent guide directory does not exist: ${sourceDir}`, { cause: error });
    }
    throw error;
  }
}
