import { useId, useState } from 'react';
import type { Id, Project } from '@cuccut/protocol';
import {
  ActionButton,
  Button,
  CustomDialog,
  DialogContainer,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Text,
  TextField,
  ToastQueue,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Chat from '@react-spectrum/s2/icons/Chat';
import Close from '@react-spectrum/s2/icons/Close';
import DeviceLaptop from '@react-spectrum/s2/icons/DeviceLaptop';
import Folder from '@react-spectrum/s2/icons/Folder';
import FolderOpen from '@react-spectrum/s2/icons/FolderOpen';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { CREATE_PROJECT_COPY, HOME_COPY } from '../../copy.ts';
import { S } from '../shell-copy.ts';
import { shortenPath } from '../../model/format.ts';
import { projectNameError } from '../../model/home-brief.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';

// The row under the composer inside the start panel (agentcut keeps "what else" on its own row under the box):
// where the session runs, the project menu and the project path, aligned with the composer's own toolbar.
const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
  paddingX: 4,
  minWidth: 0,
});
const device = style({ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'ui-sm', color: 'gray-700', whiteSpace: 'nowrap' });
const path = style({ font: 'ui-sm', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 });
// When narrow, truncate the path first and keep the project name as complete as possible; even a very long name takes only half the width.
const picker = style({ flexShrink: 0, maxWidth: '[50%]' });

/** Key of the “不用项目” (No project) item in the menu (project keys are project IDs). */
const NONE = 'none';

/**
 * The project tray along the bottom edge of the start page's input box (product design §2.3, §3.2.1; prototype new-agent.jsx `HomeProjectPicker`): “这台电脑” (This computer), the project menu, and the project path.
 * A session does not have to belong to any project, so the first menu item is “不用项目” (No project), followed by the projects (sorted by recent activity) and “新建项目…” (New project…). When “不用项目” is selected, the path line explains where the video will be saved.
 * The start page remembers which item was chosen on this computer (state/home-memory-store.ts). `noneDisabled`: the editor has a video from some project open, so a new session can only be created in that project (the session must be able to edit this video).
 */
export function ProjectPicker({
  project,
  projects,
  noneDisabled = false,
  onSelect,
}: {
  /** The project a new session is created in; null = no project (the video is kept in the session's own folder). */
  project: Project | null;
  projects: readonly Project[];
  noneDisabled?: boolean;
  onSelect(projectId: Id | null): void;
}) {
  const [creating, setCreating] = useState(false);
  const current = <Text slot="description">{HOME_COPY.current}</Text>;
  return (
    <div className={row}>
      <span className={device}>
        <DeviceLaptop />
        {HOME_COPY.thisComputer}
      </span>
      <MenuTrigger>
        <ActionButton isQuiet size="S" styles={picker} aria-label={HOME_COPY.pickProjectLabel(project?.name ?? HOME_COPY.noProjectOption)}>
          {project ? <Folder /> : <Chat />}
          <Text>{project?.name ?? HOME_COPY.noProjectOption}</Text>
        </ActionButton>
        <Menu
          aria-label={HOME_COPY.pickProject}
          disabledKeys={noneDisabled ? [NONE] : []}
          onAction={(key) => (key === 'new' ? setCreating(true) : onSelect(key === NONE ? null : String(key)))}>
          <MenuSection>
            <MenuItem id={NONE} textValue={HOME_COPY.noProjectOption}>
              <Chat />
              <Text slot="label">{HOME_COPY.noProjectOption}</Text>
              {project ? null : current}
            </MenuItem>
          </MenuSection>
          {projects.length ? (
            <MenuSection>
              <Header>{S.sidebar.projects}</Header>
              {projects.map((p) => (
                <MenuItem key={p.id} id={p.id} textValue={p.name}>
                  <Folder />
                  <Text slot="label">{p.name}</Text>
                  {p.id === project?.id ? current : null}
                </MenuItem>
              ))}
            </MenuSection>
          ) : null}
          <MenuSection>
            <MenuItem id="new" textValue={HOME_COPY.newProject}>
              <Add />
              <Text slot="label">{HOME_COPY.newProject}</Text>
            </MenuItem>
          </MenuSection>
        </Menu>
      </MenuTrigger>
      <span className={path} title={project?.path ?? HOME_COPY.noProject}>
        {project ? shortenPath(project.path) : HOME_COPY.noProject}
      </span>
      {creating ? <CreateProjectDialog onClose={() => setCreating(false)} onCreated={(created) => onSelect(created.id)} /> : null}
    </div>
  );
}

const dialogBody = style({ position: 'relative', paddingTop: 32, paddingX: 24, paddingBottom: 24 });
const closeSlot = style({ position: 'absolute', top: 12, insetEnd: 12 });
const dialogHeading = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 });
const dialogTitle = style({ font: 'title-lg', margin: 0 });
const mark = style({
  display: 'grid',
  placeItems: 'center',
  size: 48,
  borderRadius: 'lg',
  backgroundColor: 'gray-100',
  color: 'gray-800',
});
const form = style({ display: 'flex', flexDirection: 'column', gap: 24 });
const field = style({ width: 'full' });
const location = style({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 });
const locationHead = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, font: 'ui', color: 'gray-800' });
const folder = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  paddingX: 12,
  borderRadius: 'default',
  backgroundColor: 'gray-100',
  font: 'ui',
  color: 'gray-800',
  boxSizing: 'border-box',
  minWidth: 0,
});
const folderText = style({ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 });
const pathNote = style({ margin: 0, font: 'ui-sm', color: 'gray-600', overflowWrap: 'anywhere' });
const actions = style({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 });

/**
 * Create project (prototype new-agent.jsx `CreateProjectDialog`). The Runtime's `projects.create` only takes a name.
 * The directory is created under the project root (`RuntimeInfo.projectsDir`), with a number appended automatically when the name is taken. So the save folder is shown read-only.
 * The parent-folder menu and custom path in the design draft must wait until the contract supports them (gap §2.10).
 */
function CreateProjectDialog({ onClose, onCreated }: { onClose(): void; onCreated(project: Project): void }) {
  const runtime = useRuntime();
  const projectsDir = useConnection((s) => (s.state.status === 'connected' ? s.state.runtime.projectsDir : null));
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const error = projectNameError(name);
  const parent = projectsDir ? shortenPath(projectsDir).replace(/[\\/]+$/, '') : null;
  // Windows directories use only `\`; the new directory in the preview is joined with it in the same way.
  const sep = parent?.includes('\\') && !parent.includes('/') ? '\\' : '/';

  const create = async (close: () => void) => {
    if (error) {
      setTouched(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const project = await runtime.createProject(name.trim());
      ToastQueue.positive(CREATE_PROJECT_COPY.created(project.name), { timeout: 4000 });
      close();
      onCreated(project);
    } catch (failure) {
      ToastQueue.negative(CREATE_PROJECT_COPY.failed((failure as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContainer onDismiss={onClose}>
      <CustomDialog size="S" padding="none" aria-labelledby={titleId}>
        {({ close }) => (
          <div className={dialogBody}>
            <div className={closeSlot}>
              <ActionButton isQuiet size="S" aria-label={CREATE_PROJECT_COPY.close} onPress={close}>
                <Close />
              </ActionButton>
            </div>
            <div className={dialogHeading}>
              <span className={mark} aria-hidden>
                <Folder />
              </span>
              <h2 id={titleId} className={dialogTitle}>
                {CREATE_PROJECT_COPY.title}
              </h2>
            </div>
            <form
              className={form}
              onSubmit={(event) => {
                event.preventDefault();
                void create(close);
              }}>
              <TextField
                label={CREATE_PROJECT_COPY.name}
                placeholder={CREATE_PROJECT_COPY.placeholder}
                value={name}
                onChange={setName}
                onBlur={() => setTouched(true)}
                isInvalid={touched && !!error}
                errorMessage={error ?? undefined}
                autoFocus
                maxLength={120}
                styles={field}
              />
              <section className={location} aria-label={CREATE_PROJECT_COPY.location}>
                <div className={locationHead}>
                  <span>{CREATE_PROJECT_COPY.location}</span>
                  <span className={device}>
                    <DeviceLaptop />
                    {HOME_COPY.thisComputer}
                  </span>
                </div>
                <div className={folder} title={projectsDir ?? undefined}>
                  <FolderOpen />
                  <span className={folderText}>{parent ?? '—'}</span>
                </div>
                {parent && !error ? <p className={pathNote}>{CREATE_PROJECT_COPY.preview(`${parent}${sep}${name.trim()}${sep}`)}</p> : null}
              </section>
              <div className={actions}>
                <Button variant="secondary" onPress={close} styles={field}>
                  {CREATE_PROJECT_COPY.cancel}
                </Button>
                <Button variant="accent" type="submit" isDisabled={!!error || !projectsDir} isPending={busy} styles={field}>
                  {CREATE_PROJECT_COPY.create}
                </Button>
              </div>
            </form>
          </div>
        )}
      </CustomDialog>
    </DialogContainer>
  );
}
