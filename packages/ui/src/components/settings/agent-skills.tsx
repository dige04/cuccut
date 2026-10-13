import { useEffect, useState } from 'react';
import type { SkillSummary } from '@cuccut/protocol';
import {
  ActionButton,
  AlertDialog,
  Button,
  DialogContainer,
  Disclosure,
  DisclosurePanel,
  DisclosureTitle,
  Menu,
  MenuItem,
  MenuTrigger,
  ProgressCircle,
  SearchField,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Download from '@react-spectrum/s2/icons/Download';
import FolderOpen from '@react-spectrum/s2/icons/FolderOpen';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  countSkills,
  filterSkills,
  SKILL_ORIGIN_LABEL,
  SKILL_TABS,
  skillErrorMessage,
  skillMetaLine,
  type SkillTab,
} from '../../model/agent-skills.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { addSkillFromFolder, importSkillFromGithub, removeSkill, setSkillEnabled } from '../../runtime/skill-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSkillsLoader } from '../use-skills.ts';
import { SKILLS_COPY, SKILL_DETAIL_COPY } from './agent-copy.ts';
import { GithubImportDialog, SkillDetailDialog } from './agent-skill-detail.tsx';
import { PANEL, PANEL_HOVER } from './settings-ui.tsx';

const bar = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 });
const search = style({ flexGrow: 1, flexBasis: 160, minWidth: 0, maxWidth: 280 });
const spacer = style({ flexGrow: 1 });
const webNote = style({ marginTop: -4, marginBottom: 16, font: 'ui-sm', color: 'gray-600' });
// Two-column cards. When the body column is narrow, it becomes one column. The scroll area is an inline-size container, so measure it rather than the viewport.
const grid = style({
  display: 'grid',
  gridTemplateColumns: { default: ['minmax(0, 1fr)', 'minmax(0, 1fr)'], '@container (max-width: 640px)': ['minmax(0, 1fr)'] },
  gap: 12,
});
// Card: the whole block is a “View details” button, with the toggle overlaid in the top-right corner, not nested inside the button (prototype `.skl-card`).
const card = style({
  position: 'relative',
  minWidth: 0,
});
const cardMain = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '[6px]',
  width: 'full',
  height: 'full',
  minHeight: 124,
  padding: 16,
  boxSizing: 'border-box',
  borderStyle: 'none',
  borderRadius: '[24px]',
  backgroundColor: 'transparent',
  color: 'gray-800',
  textAlign: 'start',
  cursor: 'pointer',
  outlineStyle: { default: 'none', ':focus-visible': 'solid' },
  outlineWidth: 2,
  outlineOffset: 2,
  outlineColor: 'focus-ring',
});
const cardName = style({
  display: 'block',
  paddingEnd: 56,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  font: 'ui',
  fontWeight: 'bold',
  color: { default: 'gray-900', isOff: 'gray-700' },
});
const cardDesc = style({ flexGrow: 1, font: 'ui-sm', color: 'gray-700', lineClamp: 3, overflowWrap: 'anywhere' });
const cardMeta = style({ font: 'ui-xs', color: 'gray-600' });
const cardSwitch = style({ position: 'absolute', top: 12, insetEnd: 12, display: 'inline-flex' });
const empty = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  paddingY: 48,
  paddingX: 24,
  textAlign: 'center',
});
const emptyTitle = style({ margin: 0, font: 'title-sm', color: 'gray-900' });
const emptyBody = style({ margin: 0, maxWidth: 480, font: 'ui-sm', color: 'gray-700' });
const emptyActions = style({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 });
const section = style({ marginTop: 32 });
const diagList = style({ margin: 0, paddingStart: 16, font: 'ui-sm', color: 'gray-700' });
const diagItem = style({ marginBottom: 8, overflowWrap: 'anywhere' });
const diagPath = style({ font: 'code-xs', color: 'gray-600', userSelect: 'text' });
const diagHint = style({ marginTop: 0, marginBottom: 8, font: 'ui-sm', color: 'gray-600' });
const external = style({
  marginTop: 32,
  paddingTop: 16,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-100',
});
const externalTitle = style({ margin: 0, font: 'ui-sm', fontWeight: 'medium', color: 'gray-800' });
const externalBody = style({ marginTop: 4, marginBottom: 0, font: 'ui-sm', color: 'gray-600' });

/**
 * Settings › Skills (product design §6.9; prototype settings-agent-skills.jsx `AgentSkillsManager`, simplified to the scope the backend supports):
 * an intro line → toolbar (search, filter by source, add) → two-column cards → skipped folders (shown only when there are some) → a short section at the bottom, “install the CucCut skill for terminal agents”.
 * Clicking a card opens its details (agent-skill-detail.tsx); the toggle is in the card’s top-right corner. In the browser you can only view and toggle; add and remove are not shown.
 * The list, toggles and changes all go through runtime/skill-commands.ts, and results are written back to state/skills-store.
 */
export function AgentSkills() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const connected = useConnection((s) => s.state.status === 'connected');
  const list = useSkillsLoader();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SkillTab>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  // `/settings/skills/<id>` (the pack page's skill links) opens that skill's details.
  const linked = useShell((s) => (s.route.tab === 'settings' && s.route.section === 'skills' ? (s.route.sub ?? null) : null));
  useEffect(() => {
    if (linked) setOpenId(linked);
  }, [linked]);
  const closeDetail = () => {
    setOpenId(null);
    const { route, replace } = useShell.getState();
    if (route.tab === 'settings' && route.section === 'skills' && route.sub) replace({ tab: 'settings', section: 'skills' });
  };
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SkillSummary | null>(null);

  const rows = filterSkills(list.skills, query, tab);
  const counts = countSkills(list.skills, query);
  const open = openId ? (list.skills.find((s) => s.id === openId) ?? null) : null;
  const q = query.trim();

  const toggle = (skill: SkillSummary, enabled: boolean) =>
    void setSkillEnabled(runtime, skill.id, enabled).then(
      () => ToastQueue.neutral(enabled ? SKILLS_COPY.toggledOn(skill.name) : SKILLS_COPY.toggledOff(skill.name), { timeout: 5000 }),
      (error) => ToastQueue.negative(skillErrorMessage(error, 'toggle'), { timeout: 5000 }),
    );

  // Add from a local folder: the system folder picker → `skills.add`. Once added, its details open (the details say where it is stored).
  const addFolder = async () => {
    const path = await runtime.host.pickDirectory();
    if (!path) return;
    setAdding(true);
    try {
      const { skill } = await addSkillFromFolder(runtime, path);
      ToastQueue.positive(SKILLS_COPY.added(skill.name), { timeout: 4000 });
      setOpenId(skill.id);
    } catch (error) {
      ToastQueue.negative(skillErrorMessage(error, 'add'), { timeout: 8000 });
    } finally {
      setAdding(false);
    }
  };

  const onAdd = (key: string) => {
    if (key === 'folder') void addFolder();
    else if (key === 'github') setImporting(true);
  };

  const remove = async (skill: SkillSummary) => {
    try {
      await removeSkill(runtime, skill.id);
      closeDetail();
      ToastQueue.neutral(SKILLS_COPY.removed(skill.name), { timeout: 4000 });
    } catch (error) {
      ToastQueue.negative(skillErrorMessage(error, 'remove'), { timeout: 6000 });
    }
  };

  let body;
  if (!list.loaded) {
    body = (
      <div className={`${empty} ${PANEL}`} role="status">
        {!connected ? (
          <p className={emptyBody}>{SKILLS_COPY.disconnected}</p>
        ) : list.status === 'failed' ? (
          <>
            <p className={emptyBody}>{SKILLS_COPY.loadFailed(list.error ?? '')}</p>
            <Button variant="secondary" size="S" onPress={list.retry}>
              {SKILLS_COPY.retry}
            </Button>
          </>
        ) : (
          <ProgressCircle isIndeterminate size="S" aria-label={SKILLS_COPY.loading} />
        )}
      </div>
    );
  } else if (!list.skills.length) {
    // When there truly are none (the app does not bundle any skill at the moment): explain what a skill is and offer two add entries. In the browser, only point to the desktop app.
    body = (
      <div className={`${empty} ${PANEL}`}>
        <h2 className={emptyTitle}>{SKILLS_COPY.emptyTitle}</h2>
        <p className={emptyBody}>{web ? SKILLS_COPY.emptyWeb : SKILLS_COPY.emptyBody}</p>
        {web ? null : (
          <div className={emptyActions}>
            <Button variant="secondary" size="S" isPending={adding} onPress={() => void addFolder()}>
              <FolderOpen />
              <Text>{SKILLS_COPY.addFolder}</Text>
            </Button>
            <Button variant="secondary" size="S" onPress={() => setImporting(true)}>
              <Download />
              <Text>{SKILLS_COPY.addGithub}</Text>
            </Button>
          </div>
        )}
      </div>
    );
  } else if (!rows.length) {
    body = (
      <div className={`${empty} ${PANEL}`} role="status">
        <h2 className={emptyTitle}>
          {q ? SKILLS_COPY.noMatch(q) : SKILLS_COPY.noneInTab(SKILL_ORIGIN_LABEL[tab as SkillSummary['origin']])}
        </h2>
        {q ? <p className={emptyBody}>{SKILLS_COPY.noMatchHint}</p> : null}
      </div>
    );
  } else {
    body = (
      <div className={grid} role="list">
        {rows.map((skill) => (
          <div key={skill.id} role="listitem" className={`${card} ${PANEL_HOVER}`}>
            <button type="button" className={cardMain} aria-label={SKILLS_COPY.view(skill.name)} onClick={() => setOpenId(skill.id)}>
              <span className={cardName({ isOff: !skill.enabled })} title={skill.name}>
                {skill.name}
              </span>
              <span className={cardDesc}>{skill.description}</span>
              <span className={cardMeta}>{skillMetaLine(skill)}</span>
            </button>
            <span className={cardSwitch}>
              <Switch aria-label={SKILLS_COPY.enable(skill.name)} isSelected={skill.enabled} onChange={(on) => toggle(skill, on)} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={bar}>
        <SearchField aria-label={SKILLS_COPY.search} placeholder={SKILLS_COPY.search} styles={search} value={query} onChange={setQuery} />
        <SegmentedControl aria-label={SKILLS_COPY.filter} selectedKey={tab} onSelectionChange={(key) => setTab(key as SkillTab)}>
          {SKILL_TABS.map((t) => (
            <SegmentedControlItem key={t.key} id={t.key} aria-label={SKILLS_COPY.tabLabel(t.label, counts[t.key])}>
              {SKILLS_COPY.tab(t.label, counts[t.key])}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <span className={spacer} />
        {web ? null : (
          <MenuTrigger align="end">
            <ActionButton isDisabled={!connected || adding}>
              <Add />
              <Text>{SKILLS_COPY.add}</Text>
            </ActionButton>
            <Menu aria-label={SKILLS_COPY.add} onAction={(key) => onAdd(String(key))}>
              <MenuItem id="folder" textValue={SKILLS_COPY.addFolder}>
                <FolderOpen />
                <Text slot="label">{SKILLS_COPY.addFolder}</Text>
              </MenuItem>
              <MenuItem id="github" textValue={SKILLS_COPY.addGithub}>
                <Download />
                <Text slot="label">{SKILLS_COPY.addGithub}</Text>
              </MenuItem>
            </Menu>
          </MenuTrigger>
        )}
      </div>
      {web && list.skills.length ? <p className={webNote}>{SKILLS_COPY.webNote}</p> : null}
      {body}

      {list.diagnostics.length ? (
        <div className={section}>
          <Disclosure size="S" isQuiet>
            <DisclosureTitle>{SKILLS_COPY.diagnosticsTitle(list.diagnostics.length)}</DisclosureTitle>
            <DisclosurePanel>
              <p className={diagHint}>{SKILLS_COPY.diagnosticsHint}</p>
              <ul className={diagList}>
                {list.diagnostics.map((d) => (
                  <li key={`${d.scope}:${d.path}`} className={diagItem}>
                    {SKILLS_COPY.diagnosticLine(d.dir, SKILLS_COPY.diagnosticCode[d.code] ?? d.code, d.issues[0] ?? d.message)}
                    <div className={diagPath}>{d.path}</div>
                  </li>
                ))}
              </ul>
            </DisclosurePanel>
          </Disclosure>
        </div>
      ) : null}

      <section className={external} aria-label={SKILLS_COPY.externalTitle}>
        <h2 className={externalTitle}>{SKILLS_COPY.externalTitle}</h2>
        <p className={externalBody}>{SKILLS_COPY.externalBody}</p>
      </section>

      <SkillDetailDialog
        skill={open}
        web={web}
        onToggle={(on) => open && toggle(open, on)}
        onRemove={() => open && setRemoving(open)}
        onClose={closeDetail}
      />
      <GithubImportDialog
        open={importing}
        onImport={async (url) => {
          const { skill } = await importSkillFromGithub(runtime, url);
          setImporting(false);
          ToastQueue.positive(SKILLS_COPY.imported(skill.name), { timeout: 4000 });
          setOpenId(skill.id);
        }}
        onClose={() => setImporting(false)}
      />
      <DialogContainer onDismiss={() => setRemoving(null)}>
        {removing ? (
          <AlertDialog
            variant="destructive"
            title={SKILL_DETAIL_COPY.removeTitle(removing.name)}
            primaryActionLabel={SKILL_DETAIL_COPY.remove}
            cancelLabel={SKILL_DETAIL_COPY.cancel}
            onPrimaryAction={() => void remove(removing)}>
            {SKILL_DETAIL_COPY.removeBody(removing.path)}
          </AlertDialog>
        ) : null}
      </DialogContainer>
    </>
  );
}
