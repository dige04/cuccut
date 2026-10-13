import { describe, expect, it } from 'vitest';
import { ProjectTools } from './project-tools.ts';
import type { ToolPrincipal, ToolScope } from './tool-scope.ts';

/** When `projects_list` has no projects at all: each surface's `next` gives the path it can take (the terminal case does not need the Runtime started). */
describe('projects_list empty list', () => {
  const scope = {
    authorize: (principal: ToolPrincipal) => ({ principal, submitter: { kind: 'connection', id: 'c' } }),
    listProjects: async () => [],
  } as unknown as ToolScope;
  const tools = new ProjectTools({ harness: {} as never, videos: {} as never, scope });
  const list = (principal: Partial<ToolPrincipal>) =>
    tools.dispatch('projects_list', {}, principal as ToolPrincipal) as Promise<{ projects: unknown[]; next: string }>;

  it('terminal: videos_create without project falls to default CLI project, or projects_create first', async () => {
    const { projects, next } = await list({ kind: 'local', cwd: '/tmp', projectDir: null } as Partial<ToolPrincipal>);
    expect(projects).toEqual([]);
    expect(next).toContain('projects_create');
    expect(next).toContain('CLI project');
    expect(next).not.toContain('pass the project directory (path) as');
  });

  it('external service: cannot create projects; ask the user to register or run mcp install in terminal', async () => {
    const { next } = await list({ kind: 'service' } as Partial<ToolPrincipal>);
    expect(next).toContain('cuccut projects create');
    expect(next).toContain('cuccut mcp install');
  });

  it('session: when not in a project, new video is created in the session\'s working directory; projects_adopt_session used only when the user wants a project', async () => {
    const { next } = await list({ kind: 'agent' } as Partial<ToolPrincipal>);
    expect(next).toContain('does not belong to any project');
    expect(next).toContain('working directory');
    expect(next).toContain('projects_adopt_session');
  });
});
