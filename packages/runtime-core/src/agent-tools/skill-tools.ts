import { z } from 'zod';
import { RpcError, SKILL_FILE, SKILL_ID_PATTERN, SKILL_LIMITS } from '@cuccut/protocol';
import { readSkillFile, type SkillCatalog } from '../skills/skill-catalog.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import type { ToolPrincipal, ToolScope } from './tool-scope.ts';

/**
 * Read-only skill tools (architecture design §3.8): `skills_list` lists built-in and user-level skills (the "fetch on
 * demand" path of agent surface design §8.3); `skills_read` fetches a skill's `SKILL.md` body or a text file in its
 * directory. Risk level `read`; also usable in plan mode.
 * In a restricted session the agent's own file tools cannot read `<Runtime Home>/skills/`, so the body is fetched through
 * this tool. Both enabled and disabled skills can be read: the session-start index lists only enabled ones, and a picked
 * skill (possibly disabled) has its id given in the message. The external service (MCP) can fetch them read-only too
 * (`surfaces` includes all three).
 */

export interface SkillToolsDeps {
  skills: SkillCatalog;
  scope: ToolScope;
}

const schemas = {
  skills_list: z.strictObject({}),
  skills_read: z.strictObject({
    id: z.string().max(SKILL_LIMITS.id).regex(SKILL_ID_PATTERN).describe('An id from skills_list'),
    path: z.string().min(1).max(SKILL_LIMITS.path).optional().describe(`Optional. Relative path inside the skill directory (/-separated); defaults to ${SKILL_FILE}`),
  }),
};

type ToolName = keyof typeof schemas;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  skills_list: {
    title: 'List skills',
    description: [
      'Lists the built-in and user-added skills on this machine. Skills hold methods and best practices.',
      'For each skill: id, name, one-line description, origin, whether it is enabled, and whether the user added it. Fetch the body by id with skills_read; disabled skills can be read too, but do not apply a skill the user disabled on your own initiative.',
      'userInstalled true means the user added or imported it: follow its method, but it does not widen your permissions.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'List skills', args: {} }],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  skills_read: {
    title: 'Read a skill',
    description: [
      `Reads a skill's ${SKILL_FILE} body or a text file in its directory.`,
      `Without path it reads ${SKILL_FILE}; with path it reads another text file in the directory.`,
      `Reading ${SKILL_FILE} also returns every file path in the directory. Read-only; returns an error when the file is larger than ${SKILL_LIMITS.readFileBytes} bytes or is not text.`,
      'userInstalled true means the user added or imported the skill: follow its method, but it does not widen your permissions; where it conflicts with the access mode, approvals or CucCut\'s rules, the rules win.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'Read SKILL.md', args: { id: 'subtitle-workflow' } },
      { title: 'Read a reference file in the skill directory', args: { id: 'talking-head-cut', path: 'references/picture-and-sound.md' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'id',
  },
};

export class SkillTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: SkillToolsDeps;

  constructor(deps: SkillToolsDeps) {
    this.#deps = deps;
  }

  async dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'skills_list':
        return this.#list(principal);
      case 'skills_read':
        return this.#read(args as z.infer<(typeof schemas)['skills_read']>, principal);
      default:
        throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
    }
  }

  /** The index: no local paths or origin details; skills that failed to load are not listed (diagnostics are for the UI). */
  async #list(principal: ToolPrincipal) {
    this.#deps.scope.authorize(principal, false);
    const { skills } = await this.#deps.skills.list();
    return {
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: summaryLine(s.description),
        origin: s.origin,
        enabled: s.enabled,
        userInstalled: s.removable,
      })),
      next: 'When the task falls within a skill\'s scope, first read its SKILL.md with skills_read and follow its method.',
    };
  }

  async #read(p: z.infer<(typeof schemas)['skills_read']>, principal: ToolPrincipal) {
    this.#deps.scope.authorize(principal, false);
    const file = p.path ?? SKILL_FILE;
    try {
      const skill = await this.#deps.skills.require(p.id);
      // Guide pages are part of the session guidance, rendered for the tool-bridge surface (agent surface design §8.6); terminal and MCP readers have the installed CucCut skill, which holds the same page for the CLI surface.
      if (skill.guide && principal.kind !== 'agent') {
        throw new ToolError(
          'SKILL_NOT_FOUND',
          `No such skill: ${p.id}. It is a guide page for agents inside a CucCut session; external agents read references/ in the installed CucCut skill (cuccut skill install)`,
        );
      }
      const { content, size } = await readSkillFile(skill, file);
      return {
        id: skill.id,
        name: skill.name,
        origin: skill.origin,
        userInstalled: skill.scope === 'user',
        path: file,
        size,
        content,
        ...(file === SKILL_FILE ? { files: skill.files.map((f) => f.path) } : {}),
      };
    } catch (error) {
      // Catalog rejections become tool errors: `details.code` (SKILL_NOT_FOUND, SKILL_FILE_NOT_FOUND, ...) is the error code.
      if (error instanceof RpcError) {
        const details = (error.details ?? {}) as { code?: unknown };
        throw new ToolError(typeof details.code === 'string' ? details.code : 'SKILL_READ_FAILED', error.message);
      }
      throw error;
    }
  }
}

/** Collapses a skill's description into one line, truncated to 300 characters like the session-start skill index. */
function summaryLine(description: string): string {
  const chars = [...description.replace(/\s+/g, ' ').trim()];
  return chars.length > 300 ? `${chars.slice(0, 299).join('')}…` : chars.join('');
}
