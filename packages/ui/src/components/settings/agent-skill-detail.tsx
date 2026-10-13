import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { SKILL_LIMITS, type SkillDetail, type SkillFileEntry, type SkillSummary } from '@cuccut/protocol';
import {
  ActionButton,
  Badge,
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  Form,
  Heading,
  ProgressCircle,
  Switch,
  Text,
  TextField,
} from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import ChevronLeft from '@react-spectrum/s2/icons/ChevronLeft';
import FileText from '@react-spectrum/s2/icons/FileText';
import FolderOpen from '@react-spectrum/s2/icons/FolderOpen';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { revealLabel } from '../../copy.ts';
import { fileSizeLabel, skillBody, skillErrorMessage, skillOriginLabel, skillSourceLine } from '../../model/agent-skills.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { getSkill, readSkillFile } from '../../runtime/skill-commands.ts';
import { remarkPlugins } from '../thread/remark-plugins.ts';
import { SKILL_DETAIL_COPY, SKILL_GITHUB_COPY, SKILLS_COPY } from './agent-copy.ts';
import '../thread/markdown.css';

const body = style({ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 });
const head = style({ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' });
const spacer = style({ flexGrow: 1 });
const stateLine = style({ margin: 0, font: 'ui-sm', color: 'gray-700' });
const desc = style({ margin: 0, font: 'body', color: 'gray-800', overflowWrap: 'anywhere', userSelect: 'text' });
const note = style({
  display: 'flex',
  alignItems: 'start',
  gap: 8,
  margin: 0,
  paddingY: 8,
  paddingX: 12,
  borderRadius: 'default',
  backgroundColor: 'gray-100',
  font: 'ui-sm',
  color: 'gray-800',
});
const noteIcon = style({ display: 'flex', flexShrink: 0, color: 'gray-700' });
const facts = style({ display: 'grid', gridTemplateColumns: ['auto', 'minmax(0, 1fr)'], columnGap: 16, rowGap: 8, margin: 0 });
const factLabel = style({ font: 'ui-sm', color: 'gray-600' });
const factValue = style({ display: 'flex', alignItems: 'center', gap: 8, margin: 0, minWidth: 0, font: 'ui-sm', color: 'gray-800' });
const mono = style({ font: 'code-sm', overflowWrap: 'anywhere', userSelect: 'text', minWidth: 0 });
const sectionTitle = style({ margin: 0, marginBottom: 8, font: 'ui-sm', fontWeight: 'bold', color: 'gray-700' });
const markdown = style({
  padding: 16,
  borderRadius: 'lg',
  backgroundColor: 'gray-50',
  overflowWrap: 'anywhere',
  userSelect: 'text',
  maxHeight: 360,
  overflowY: 'auto',
});
const quiet = style({ margin: 0, font: 'ui-sm', color: 'gray-600' });
const fileList = style({ display: 'flex', flexDirection: 'column', gap: 2, margin: 0, padding: 0, listStyleType: 'none' });
const fileRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: 'full',
  minHeight: 28,
  paddingX: 8,
  boxSizing: 'border-box',
  borderStyle: 'none',
  borderRadius: 'default',
  backgroundColor: { default: 'transparent', isButton: { ':hover': 'gray-100' } },
  font: 'ui-sm',
  color: { default: 'gray-800', isDim: 'gray-600' },
  textAlign: 'start',
  cursor: { default: 'default', isButton: 'pointer' },
  outlineStyle: { default: 'none', ':focus-visible': 'solid' },
  outlineWidth: 2,
  outlineOffset: -2,
  outlineColor: 'focus-ring',
});
const fileName = style({ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: 'code-sm' });
const fileMeta = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-600' });
const fileHead = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const filePath = style({
  font: 'code-sm',
  color: 'gray-700',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});
const pre = style({
  margin: 0,
  padding: 12,
  borderRadius: 'default',
  backgroundColor: 'gray-100',
  font: 'code-sm',
  color: 'gray-800',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  maxHeight: 420,
  overflowY: 'auto',
  userSelect: 'text',
});
const formNote = style({ marginTop: 16 });
const full = style({ width: 'full' });

type Load<T> =
  { key: string; state: 'loading' } | { key: string; state: 'ready'; value: T } | { key: string; state: 'failed'; message: string };

/**
 * Skill details (prototype settings-agent-skill-detail.jsx `AgentSkillDetail` and its file view, simplified to the data the backend has): name, source badge and version, toggle,
 * description, source and where it lives, the `SKILL.md` body (rendered as Markdown after the front matter is removed), the file list (text files open to show their content via `skills.readFile`), and remove.
 * The prototype’s category, author and “Try it” examples have no backend data, so they are not built. Removal deletes the directory and cannot be undone, so the prototype’s undo toast is not used; the caller shows a confirmation first.
 * State lives in the outer layer of the dialog, because S2’s Dialog renders its children again in several slots.
 */
export function SkillDetailDialog({
  skill,
  web,
  onToggle,
  onRemove,
  onClose,
}: {
  skill: SkillSummary | null;
  web: boolean;
  onToggle(enabled: boolean): void;
  onRemove(): void;
  onClose(): void;
}) {
  const runtime = useRuntime();
  // When the summary changes (toggle, re-import), the body and file list are fetched again. Switching the toggle alone does not refetch.
  const key = skill ? `${skill.id}@${skill.updatedAt}@${skill.fileCount}` : '';
  const [detail, setDetail] = useState<Load<SkillDetail>>({ key, state: 'loading' });
  const [file, setFile] = useState<(Load<string> & { path: string; skill: string }) | null>(null);
  const current: Load<SkillDetail> = detail.key === key ? detail : { key, state: 'loading' };
  const viewing = file && skill && file.skill === skill.id ? file : null;

  useEffect(() => {
    if (!skill) return undefined;
    let cancelled = false;
    getSkill(runtime, skill.id).then(
      (value) => !cancelled && setDetail({ key, state: 'ready', value }),
      (error) => !cancelled && setDetail({ key, state: 'failed', message: skillErrorMessage(error, 'read') }),
    );
    return () => {
      cancelled = true;
    };
    // The skill takes effect only through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, key]);

  const openFile = (entry: SkillFileEntry) => {
    if (!skill || !entry.text) return;
    const id = skill.id;
    setFile({ key: entry.path, path: entry.path, skill: id, state: 'loading' });
    readSkillFile(runtime, id, entry.path).then(
      (result) => setFile((f) => (f?.path === entry.path && f.skill === id ? { ...f, state: 'ready', value: result.content } : f)),
      (error) =>
        setFile((f) =>
          f?.path === entry.path && f.skill === id ? { ...f, state: 'failed', message: skillErrorMessage(error, 'read') } : f,
        ),
    );
  };

  const close = () => {
    setFile(null);
    onClose();
  };

  return (
    <DialogContainer onDismiss={close}>
      {skill ? (
        <Dialog size="L" isDismissible>
          <Heading slot="title">{skill.name}</Heading>
          <Content>
            {viewing ? (
              <div className={body}>
                <div className={fileHead}>
                  <ActionButton isQuiet size="S" onPress={() => setFile(null)}>
                    <ChevronLeft />
                    <Text>{SKILL_DETAIL_COPY.back}</Text>
                  </ActionButton>
                  <span className={filePath} title={viewing.path}>
                    {viewing.path}
                  </span>
                </div>
                {viewing.state === 'loading' ? (
                  <ProgressCircle isIndeterminate size="S" aria-label={SKILL_DETAIL_COPY.loading} />
                ) : viewing.state === 'failed' ? (
                  <p className={quiet}>{viewing.message}</p>
                ) : (
                  <pre className={pre}>{viewing.value}</pre>
                )}
              </div>
            ) : (
              <SkillInfo skill={skill} detail={current} web={web} onToggle={onToggle} onOpenFile={openFile} />
            )}
          </Content>
          {skill.removable && !web && !viewing ? (
            <ButtonGroup>
              <Button variant="negative" fillStyle="outline" onPress={onRemove}>
                {SKILL_DETAIL_COPY.remove}
              </Button>
            </ButtonGroup>
          ) : null}
        </Dialog>
      ) : null}
    </DialogContainer>
  );
}

function SkillInfo({
  skill,
  detail,
  web,
  onToggle,
  onOpenFile,
}: {
  skill: SkillSummary;
  detail: Load<SkillDetail>;
  web: boolean;
  onToggle(enabled: boolean): void;
  onOpenFile(entry: SkillFileEntry): void;
}) {
  const runtime = useRuntime();
  const source = skillSourceLine(skill.source);
  const text = detail.state === 'ready' ? skillBody(detail.value.content) : '';
  return (
    <div className={body}>
      <div className={head}>
        <Badge variant="neutral" size="S" fillStyle="subtle">
          {skillOriginLabel(skill)}
        </Badge>
        <span className={spacer} />
        <Switch aria-label={SKILLS_COPY.enable(skill.name)} isSelected={skill.enabled} onChange={onToggle} />
      </div>
      <p className={stateLine}>{skill.enabled ? SKILL_DETAIL_COPY.stateOn : SKILL_DETAIL_COPY.stateOff}</p>
      {skill.origin === 'third-party' ? (
        <p className={note} role="note">
          <span className={noteIcon} aria-hidden>
            <AlertTriangle />
          </span>
          <span>{SKILL_DETAIL_COPY.thirdPartyNote}</span>
        </p>
      ) : null}
      <p className={desc}>{skill.description}</p>
      <dl className={facts}>
        {source ? (
          <>
            <dt className={factLabel}>{SKILL_DETAIL_COPY.source}</dt>
            <dd className={factValue}>
              <span className={mono}>{source}</span>
            </dd>
          </>
        ) : null}
        <dt className={factLabel}>{SKILL_DETAIL_COPY.location}</dt>
        <dd className={factValue}>
          <span className={mono}>{skill.path}</span>
          {web ? null : (
            <ActionButton isQuiet size="S" aria-label={revealLabel()} onPress={() => void runtime.host.revealPath(skill.path)}>
              <FolderOpen />
            </ActionButton>
          )}
        </dd>
        <dt className={factLabel}>{SKILL_DETAIL_COPY.version}</dt>
        <dd className={factValue}>{skill.version ?? SKILL_DETAIL_COPY.noVersion}</dd>
      </dl>
      {skill.origin === 'builtin' && !web ? <p className={quiet}>{SKILL_DETAIL_COPY.removeBuiltin}</p> : null}

      <section aria-label={SKILL_DETAIL_COPY.body}>
        <h3 className={sectionTitle}>{SKILL_DETAIL_COPY.body}</h3>
        {detail.state === 'loading' ? (
          <ProgressCircle isIndeterminate size="S" aria-label={SKILL_DETAIL_COPY.loading} />
        ) : detail.state === 'failed' ? (
          <p className={quiet}>{SKILL_DETAIL_COPY.loadFailed(detail.message)}</p>
        ) : text.trim() ? (
          <div className={`${markdown} cc-md`}>
            <Markdown remarkPlugins={remarkPlugins}>{text}</Markdown>
          </div>
        ) : (
          <p className={quiet}>{SKILL_DETAIL_COPY.emptyBody}</p>
        )}
      </section>

      {detail.state === 'ready' ? (
        <section aria-label={SKILL_DETAIL_COPY.files(detail.value.files.length)}>
          <h3 className={sectionTitle}>{SKILL_DETAIL_COPY.files(detail.value.files.length)}</h3>
          <ul className={fileList}>
            {detail.value.files.map((entry) => (
              <li key={entry.path}>
                {entry.text ? (
                  <button type="button" className={fileRow({ isButton: true })} onClick={() => onOpenFile(entry)}>
                    <FileText />
                    <span className={fileName} title={entry.path}>
                      {entry.path}
                    </span>
                    <span className={fileMeta}>{fileSizeLabel(entry.size)}</span>
                  </button>
                ) : (
                  <span className={fileRow({ isDim: true })} title={entry.path}>
                    <FileText />
                    <span className={fileName}>{entry.path}</span>
                    <span className={fileMeta}>
                      {fileSizeLabel(entry.size)} ·{' '}
                      {entry.size > SKILL_LIMITS.readFileBytes ? SKILL_DETAIL_COPY.tooLarge : SKILL_DETAIL_COPY.notText}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Import from GitHub (prototype `AgentSkillAddGithub`): enter the address. It explains that only the files in that directory are downloaded and nothing is executed, and third-party is off by default.
 * While importing, the button spins and the input cannot be edited. On failure, the error code is turned into plain language (already exists, wrong address, over the limit, offline, rate limited), and the dialog stays open without discarding the input.
 */
export function GithubImportDialog({ open, onImport, onClose }: { open: boolean; onImport(url: string): Promise<void>; onClose(): void }) {
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setUrl('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!url.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await onImport(url.trim());
    } catch (e) {
      setError(skillErrorMessage(e, 'import'));
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogContainer onDismiss={onClose}>
      {open ? (
        <Dialog size="M">
          {({ close }) => (
            <>
              <Heading slot="title">{SKILL_GITHUB_COPY.title}</Heading>
              <Content>
                <Form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}>
                  <TextField
                    label={SKILL_GITHUB_COPY.label}
                    placeholder={SKILL_GITHUB_COPY.placeholder}
                    description={pending ? SKILL_GITHUB_COPY.pending : SKILL_GITHUB_COPY.description}
                    value={url}
                    onChange={(value) => {
                      setUrl(value);
                      setError(null);
                    }}
                    isReadOnly={pending}
                    isInvalid={!!error}
                    errorMessage={error ?? undefined}
                    styles={full}
                    autoFocus
                  />
                </Form>
                <div className={formNote}>
                  <p className={note} role="note">
                    <span className={noteIcon} aria-hidden>
                      <AlertTriangle />
                    </span>
                    <span>{SKILL_GITHUB_COPY.note}</span>
                  </p>
                </div>
              </Content>
              <ButtonGroup>
                <Button variant="secondary" onPress={close}>
                  {SKILL_GITHUB_COPY.cancel}
                </Button>
                <Button variant="accent" isDisabled={!url.trim()} isPending={pending} onPress={() => void submit()}>
                  {SKILL_GITHUB_COPY.submit}
                </Button>
              </ButtonGroup>
            </>
          )}
        </Dialog>
      ) : null}
    </DialogContainer>
  );
}
