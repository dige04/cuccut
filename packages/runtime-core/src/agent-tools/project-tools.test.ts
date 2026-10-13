import { describe, expect, it } from 'vitest';
import { ProjectTools } from './project-tools.ts';
import type { ToolPrincipal, ToolScope } from './tool-scope.ts';

/** When `projects_list` has no projects at all: each surface's `next` gives the path it can take (the terminal case does not need the Runtime started). */
describe('projects_list 的空列表', () => {
  const scope = {
    authorize: (principal: ToolPrincipal) => ({ principal, submitter: { kind: 'connection', id: 'c' } }),
    listProjects: async () => [],
  } as unknown as ToolScope;
  const tools = new ProjectTools({ harness: {} as never, videos: {} as never, scope });
  const list = (principal: Partial<ToolPrincipal>) =>
    tools.dispatch('projects_list', {}, principal as ToolPrincipal) as Promise<{ projects: unknown[]; next: string }>;

  it('终端：videos_create 不给 project 时落到默认的 CLI 项目，或先 projects_create', async () => {
    const { projects, next } = await list({ kind: 'local', cwd: '/tmp', projectDir: null } as Partial<ToolPrincipal>);
    expect(projects).toEqual([]);
    expect(next).toContain('projects_create');
    expect(next).toContain('CLI project');
    expect(next).not.toContain('pass the project directory (path) as');
  });

  it('对外服务：不能新建项目，请用户登记或在终端 mcp install', async () => {
    const { next } = await list({ kind: 'service' } as Partial<ToolPrincipal>);
    expect(next).toContain('cuccut projects create');
    expect(next).toContain('cuccut mcp install');
  });

  it('会话：不属于项目时新视频建在会话的工作目录里，用户要建项目时才用 projects_adopt_session', async () => {
    const { next } = await list({ kind: 'agent' } as Partial<ToolPrincipal>);
    expect(next).toContain('does not belong to any project');
    expect(next).toContain('working directory');
    expect(next).toContain('projects_adopt_session');
  });
});
