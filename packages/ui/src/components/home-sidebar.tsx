import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Conversation, Project } from '@cuccut/protocol';
import {
  ActionButton,
  Menu,
  MenuItem,
  MenuTrigger,
  SideNav,
  SideNavHeader,
  SideNavSection,
  SubmenuTrigger,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import Folder from '@react-spectrum/s2/icons/Folder';
import FolderOpen from '@react-spectrum/s2/icons/FolderOpen';
import More from '@react-spectrum/s2/icons/More';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { S } from './shell-copy.ts';
import { shortenPath } from '../model/format.ts';
import { buildSidebar, type ProjectRow } from '../model/sidebar.ts';
import { useRuntime } from '../runtime/context.tsx';
import { useConnection } from '../state/connection-store.ts';
import { useDirectory } from '../state/directory-store.ts';
import { hrefFor, useShell } from '../state/shell-store.ts';
import { conversationItem, ProjectItem } from './home-sidebar-rows.tsx';
import { NameDialog } from './name-dialog.tsx';
import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '../cc/ui/button.tsx';
import { SESSION_COPY } from './session/session-copy.ts';
import { useNow } from './use-now.ts';
import { useRowActions } from './use-row-actions.ts';

const head = style({ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, width: 'full', height: 24, marginY: -4 });
const headLabel = style({ display: 'flex', alignItems: 'center', gap: 4, font: 'ui-sm', fontWeight: 'normal', color: 'gray-600' });
const empty = style({ font: 'ui-sm', color: 'gray-600', paddingX: 8, marginTop: 8, marginBottom: 0 });
/**
 * The drawer card (agentcut ProjectList, as a solid surface beside the session): the rows' hover and current fills
 * are white at low alpha (read by the `[data-cc-row]` rules in app.css).
 */
const drawer =
  'flex w-72 shrink-0 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card p-3 [--cc-row-current:rgb(255_255_255/0.1)] [--cc-row-hover:rgb(255_255_255/0.05)]';
/** S2 的 SideNav 默认撑满父级高度；下面还有空列表提示，按内容高度排，滚动交给外层。 */
const nav = style({ height: 'auto' });

type DialogState = { kind: 'new-project' } | { kind: 'rename-project'; project: Project } | null;
type SectionKey = 'pinned' | 'projects' | 'recent';

/**
 * The sessions list in the session layout's drawer (session/sessions-drawer.tsx places it inline or over the content):
 * a heading and New session, then pinned, projects and recent, each section collapsible. The projects section's ⋯
 * organises the list (by project / one list) and sorts sessions; its + creates a project or opens a folder.
 */
export function HomeSidebar({ className }: { className?: string }) {
  const runtime = useRuntime();
  const route = useShell((s) => s.route);
  const go = useShell((s) => s.go);
  const expanded = useShell((s) => s.expandedProjects);
  const setExpanded = useShell((s) => s.setExpandedProjects);
  const grouping = useShell((s) => s.sidebarGrouping);
  const sort = useShell((s) => s.sidebarSort);
  const projectsDir = useConnection((s) => (s.state.status === 'connected' ? s.state.runtime.projectsDir : null));
  const projects = useDirectory((s) => s.projects);
  const conversations = useDirectory((s) => s.conversations);
  const ready = useDirectory((s) => s.ready);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<SectionKey>>(new Set());
  const now = useNow(60_000);

  const tree = useMemo(() => buildSidebar(projects, conversations, sort), [projects, conversations, sort]);
  // 打开着视频时侧栏仍指向那条会话：选中位置不带视频参数。
  const selectedRoute =
    route.tab === 'home' ? hrefFor({ tab: 'home', conversationId: route.conversationId, projectId: route.projectId }) : undefined;

  // 当前会话所在的项目展开着，新会话在侧栏里才看得见。
  const currentProject =
    route.tab === 'home' ? (route.projectId ?? conversations.find((c) => c.id === route.conversationId)?.projectId ?? null) : null;
  useEffect(() => {
    const key = currentProject ? `proj:${currentProject}` : null;
    if (key && !useShell.getState().expandedProjects.includes(key)) setExpanded([...useShell.getState().expandedProjects, key]);
  }, [currentProject, setExpanded]);
  const expandedKeys = new Set(expanded);

  const toggleSection = (key: SectionKey) =>
    setCollapsed((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const added = (project: Project) => {
    setCollapsed((old) => new Set([...old].filter((key) => key !== 'projects')));
    setExpanded([...new Set([...expanded, `proj:${project.id}`])]);
    go({ tab: 'home', conversationId: null, projectId: project.id });
  };

  const openProject = async () => {
    try {
      const project = await runtime.openProjectFromDialog();
      if (project) added(project);
    } catch (error) {
      ToastQueue.negative(S.sidebar.openFolderFailed((error as Error).message), { timeout: 5000 });
    }
  };

  const actions = useRowActions();
  const onProjectAction = (project: Project, key: string) => {
    if (key === 'new') go({ tab: 'home', conversationId: null, projectId: project.id });
    else if (key === 'pin') actions.toggleProjectPin(project);
    else if (key === 'rename') setDialog({ kind: 'rename-project', project });
    else if (key === 'space') go({ tab: 'space', category: 'all', projectId: project.id });
    else if (key === 'reveal') void runtime.host.revealPath(project.path);
  };

  const projectName = (c: Conversation) => projects.find((p) => p.id === c.projectId)?.name ?? null;
  const conversationRow = (conversation: Conversation, key: string, pinned = false) =>
    conversationItem(conversation, key, { now, projectName: projectName(conversation), pinned, actions });
  const projectItem = (row: ProjectRow, key: string) => (
    <ProjectItem
      key={key}
      id={key}
      row={row}
      open={expandedKeys.has(key)}
      onAction={(k) => onProjectAction(row.project, k)}
      conversationRow={conversationRow}
    />
  );

  const flat = grouping === 'flat';
  const listEmpty = flat ? !tree.flat.length : !tree.projects.length;

  return (
    <aside className={cn(drawer, className)} aria-label={S.sidebar.sessions}>
      <div data-cc className="flex shrink-0 flex-col gap-3 px-1 pt-1 pb-3">
        <div className="px-1">
          <h2 className="text-base font-semibold text-foreground">{S.sidebar.sessions}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{SESSION_COPY.sessionsBlurb}</p>
        </div>
        <Button data-drawer-focus variant="outline" size="sm" className="justify-start" onClick={() => go({ tab: 'home', conversationId: null, projectId: null })}>
          <Plus />
          {S.common.newSession}
        </Button>
      </div>

      <div className="cc-scroll -mx-1 min-h-0 flex-1 overflow-y-auto border-t border-border/60 px-1 pt-2">
        <SideNav
          styles={nav}
          aria-label={S.sidebar.projectsAndSessions}
          selectedRoute={selectedRoute}
          expandedKeys={expandedKeys}
          onExpandedChange={(keys) => setExpanded([...keys].map(String))}>
          {tree.pinned.length ? (
            <SideNavSection id="pinned">
              <SideNavHeader>
                <SectionHead label={S.sidebar.pinned} collapsed={collapsed.has('pinned')} onToggle={() => toggleSection('pinned')} />
              </SideNavHeader>
              {collapsed.has('pinned')
                ? []
                : tree.pinned.map((pin) =>
                    pin.kind === 'project'
                      ? projectItem(pin.row, `pin:${pin.row.project.id}`)
                      : conversationRow(pin.conversation, `pin:${pin.conversation.id}`, true),
                  )}
            </SideNavSection>
          ) : null}
          <SideNavSection id="projects">
            <SideNavHeader>
              <SectionHead label={flat ? S.sidebar.sessions : S.sidebar.projects} collapsed={collapsed.has('projects')} onToggle={() => toggleSection('projects')}>
                <OrganizeMenu />
                <MenuTrigger>
                  <ActionButton isQuiet size="S" aria-label={S.sidebar.newOrOpenProject} isDisabled={!projectsDir}>
                    <Add />
                  </ActionButton>
                  <Menu aria-label={S.sidebar.newOrOpenProject} onAction={(key) => (key === 'new' ? setDialog({ kind: 'new-project' }) : void openProject())}>
                    <MenuItem id="new" textValue={S.sidebar.newProjectEllipsis}>
                      <Folder />
                      <Text slot="label">{S.sidebar.newProjectEllipsis}</Text>
                    </MenuItem>
                    <MenuItem id="open" textValue={S.sidebar.openFolderEllipsis}>
                      <FolderOpen />
                      <Text slot="label">{S.sidebar.openFolderEllipsis}</Text>
                    </MenuItem>
                  </Menu>
                </MenuTrigger>
              </SectionHead>
            </SideNavHeader>
            {collapsed.has('projects')
              ? []
              : flat
                ? tree.flat.map((conversation) => conversationRow(conversation, `flat:${conversation.id}`))
                : tree.projects.map((row) => projectItem(row, `proj:${row.project.id}`))}
          </SideNavSection>
          {!flat && tree.loose.length ? (
            <SideNavSection id="recent">
              <SideNavHeader>
                <SectionHead label={S.sidebar.recent} collapsed={collapsed.has('recent')} onToggle={() => toggleSection('recent')} />
              </SideNavHeader>
              {collapsed.has('recent') ? [] : tree.loose.map((conversation) => conversationRow(conversation, `loose:${conversation.id}`))}
            </SideNavSection>
          ) : null}
        </SideNav>
        {listEmpty && !collapsed.has('projects') ? (
          <p className={empty}>
            {!ready ? S.common.loadingEllipsis : flat ? S.sidebar.noSessions : S.sidebar.noProjects}
          </p>
        ) : null}
      </div>

      {dialog?.kind === 'new-project' ? (
        <NameDialog
          title={S.sidebar.newProjectTitle}
          label={S.sidebar.projectName}
          placeholder={S.sidebar.untitledProject}
          allowEmpty
          description={projectsDir ? S.sidebar.newProjectHint(shortenPath(projectsDir)) : undefined}
          submitLabel={S.sidebar.create}
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const project = await runtime.createProject(name);
            setDialog(null);
            ToastQueue.positive(S.sidebar.projectCreated(project.name), { timeout: 4000 });
            added(project);
          }}
        />
      ) : dialog?.kind === 'rename-project' ? (
        <NameDialog
          title={S.sidebar.renameProjectTitle}
          label={S.common.name}
          initial={dialog.project.name}
          description={S.sidebar.renameProjectHint}
          submitLabel={S.common.save}
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            await actions.renameProject(dialog.project, name);
            setDialog(null);
          }}
        />
      ) : null}
    </aside>
  );
}

/**
 * 段头：段名 + 折叠钮（展开箭头只在悬停、聚焦或已折叠时出现），右边可以挂这一段的操作。
 * 段头里的控件自己处理焦点与按键，不让 SideNav 把它们转给某一行。
 */
function SectionHead({ label, collapsed, onToggle, children }: { label: string; collapsed: boolean; onToggle: () => void; children?: ReactNode }) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <span className={`${head} cc-section-head`} onFocus={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <ActionButton
        isQuiet
        size="S"
        aria-label={S.sidebar.toggleSection(collapsed, label)}
        aria-expanded={!collapsed}
        styles={style({ flexGrow: 1, minWidth: 0, marginStart: -8 })}
        UNSAFE_style={{ justifyContent: 'start' }}
        UNSAFE_className="cc-section-toggle"
        onPress={onToggle}>
        <Text>
          <span className={headLabel}>
            {label}
            <span className="cc-section-chevron">
              <Chevron />
            </span>
          </span>
        </Text>
      </ActionButton>
      {children ? <span className="cc-section-actions">{children}</span> : null}
    </span>
  );
}

/** 项目段头的「⋯」：整理侧栏（按项目分组 / 在一个列表中）与会话排序。 */
function OrganizeMenu() {
  const grouping = useShell((s) => s.sidebarGrouping);
  const sort = useShell((s) => s.sidebarSort);
  const { setSidebarGrouping, setSidebarSort } = useShell.getState();
  return (
    <MenuTrigger>
      <ActionButton isQuiet size="S" aria-label={S.sidebar.organizeLabel}>
        <More />
      </ActionButton>
      <Menu aria-label={S.sidebar.sidebarSettings}>
        <SubmenuTrigger>
          <MenuItem id="organize" textValue={S.sidebar.organize}>
            <Text slot="label">{S.sidebar.organize}</Text>
          </MenuItem>
          <Menu
            aria-label={S.sidebar.organize}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[grouping]}
            onSelectionChange={(keys) => keys !== 'all' && setSidebarGrouping([...keys][0] === 'flat' ? 'flat' : 'project')}>
            <MenuItem id="project" textValue={S.sidebar.byProject}>
              <Text slot="label">{S.sidebar.byProject}</Text>
            </MenuItem>
            <MenuItem id="flat" textValue={S.sidebar.flat}>
              <Text slot="label">{S.sidebar.flat}</Text>
            </MenuItem>
          </Menu>
        </SubmenuTrigger>
        <SubmenuTrigger>
          <MenuItem id="sort" textValue={S.sidebar.sortSessions}>
            <Text slot="label">{S.sidebar.sortSessions}</Text>
          </MenuItem>
          <Menu
            aria-label={S.sidebar.sortSessions}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[sort]}
            onSelectionChange={(keys) => keys !== 'all' && setSidebarSort([...keys][0] === 'name' ? 'name' : 'recent')}>
            <MenuItem id="recent" textValue={S.sidebar.byRecent}>
              <Text slot="label">{S.sidebar.byRecent}</Text>
            </MenuItem>
            <MenuItem id="name" textValue={S.sidebar.byName}>
              <Text slot="label">{S.sidebar.byName}</Text>
            </MenuItem>
          </Menu>
        </SubmenuTrigger>
      </Menu>
    </MenuTrigger>
  );
}
