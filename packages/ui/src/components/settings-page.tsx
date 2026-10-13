import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LOCALE_NATIVE_NAMES, PROTOCOL_VERSION, RUNTIME_VERSION, resolveLanguage } from '@cuccut/protocol';
import { Button, ToastQueue } from '@react-spectrum/s2';
import {
  Activity,
  AudioLines,
  Bot,
  BookA,
  Captions,
  CircleHelp,
  Eye,
  HardDrive,
  Image as ImageIcon,
  Info,
  Keyboard,
  Lock,
  MessageSquareText,
  Music,
  Puzzle,
  Send,
  Server,
  SlidersHorizontal,
  Split,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { BackHeader, PageRail, RailPage, SectionHeader, type RailGroup } from '../cc/components/page-chrome.tsx';
import { CucCutTile } from '../cc/components/cuccut-mark.tsx';
import { Button as CcButton } from '../cc/ui/button.tsx';
import { HELP_COPY, revealLabel } from '../copy.ts';
import { shortenPath } from '../model/format.ts';
import { bundleCategory, isBundleInstalled } from '../model/models-local.ts';
import { publishingRailSummary } from '../model/publishing-settings.ts';
import {
  MODEL_CATEGORY_INFO,
  SETTINGS_GROUPS,
  SETTINGS_SECTION_INFO,
  modelPageFor,
  type ModelCategory,
  type ModelPage,
} from '../model/settings-nav.ts';
import { useRuntime } from '../runtime/context.tsx';
import { loadSkills } from '../runtime/skill-commands.ts';
import { useAppUpdate } from '../state/app-update-store.ts';
import { defaultDriver, useConnection } from '../state/connection-store.ts';
import { useGrants } from '../state/grants-store.ts';
import { useHelp } from '../state/help-store.ts';
import { useLibrary } from '../state/library-store.ts';
import { useModels } from '../state/models-store.ts';
import { usePublishing } from '../state/publishing-store.ts';
import { useShell, type SettingsSection } from '../state/shell-store.ts';
import { useSkills } from '../state/skills-store.ts';
import { ModelSettings } from './models-page.tsx';
import { PC } from './publishing/publishing-copy.ts';
import { UpdateStatus } from './app-update/update-status.tsx';
import { RuntimeCard } from './services/runtime-card.tsx';
import { S } from './shell-copy.ts';
import { AGENT_COPY, SKILLS_COPY } from './settings/agent-copy.ts';
import { AgentPermissions } from './settings/agent-permissions.tsx';
import { AgentSettings } from './settings/agent-settings.tsx';
import { AgentSkills } from './settings/agent-skills.tsx';
import { DataGrants } from './settings/data-grants.tsx';
import { FontSettings } from './settings/font-settings.tsx';
import { GeneralSettings } from './settings/general-settings.tsx';
import { M as GENERAL } from './settings/general-settings-copy.ts';
import { GLOSSARY_COPY } from './settings/glossary-copy.ts';
import { GlossarySettings } from './settings/glossary-settings.tsx';
import { OpenCalendarLink, PublishingSettings } from './settings/publishing-settings.tsx';
import { ResourceCapacity } from './settings/resource-capacity.tsx';
import { KeyCombo, Panel, PanelHeading, RowList, SettingsGroup, SettingsRow } from './settings/settings-ui.tsx';
import { W } from './settings/workspace-copy.ts';

/** Rail icons per section (lucide, like the rest of the page chrome). */
const SECTION_ICON: Record<SettingsSection, LucideIcon> = {
  general: SlidersHorizontal,
  shortcuts: Keyboard,
  fonts: Type,
  agent: Bot,
  skills: Puzzle,
  publishing: Send,
  glossary: BookA,
  privacy: Lock,
  diagnostics: Activity,
  about: Info,
};

/** Rail icons per model category. */
const CATEGORY_ICON: Record<ModelCategory, LucideIcon> = {
  asr: Captions,
  tts: AudioLines,
  llm: MessageSquareText,
  image: ImageIcon,
  music: Music,
  sep: Split,
  vision: Eye,
};

const labelOf = (key: SettingsSection) => SETTINGS_SECTION_INFO.find((s) => s.key === key)?.label ?? S.settingsPage.general;

/**
 * Settings, as agentcut's workspace shell: a glass back header ("Settings", and a note that everything here applies to
 * every project), a rail of every section and model category with what each one holds written under its name, and the
 * section in the middle — a heading with one sentence of what it decides, then solid panels of controls.
 *
 * Every section is a URL (`/settings/<section>`, `/settings/models/<category>/<page>`); switching sections replaces
 * nothing else on the page. On narrow windows the rail wraps into chips above the section. Help sits in the header.
 */
export function SettingsPage({ section = 'general', model, platform }: {
  section?: SettingsSection;
  model?: { category: ModelCategory; page?: ModelPage };
  platform: string;
}) {
  const web = useRuntime().host.platform === 'web';

  const header = (
    <BackHeader
      title={S.common.settings}
      aside={
        <>
          <HardDrive aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{W.aside}</span>
        </>
      }
      actions={
        <CcButton variant="ghost" size="sm" onClick={(event) => useHelp.getState().open(event.currentTarget)}>
          <CircleHelp aria-hidden />
          <span className="max-sm:sr-only">{HELP_COPY.settingsEntry}</span>
        </CcButton>
      }
    />
  );

  return (
    <RailPage header={header} rail={<SettingsRail section={section} model={model} web={web} />}>
      <SectionBody key={model?.category ?? section}>
        {model ? (
          <ModelSettings category={model.category} page={model.page} />
        ) : section === 'general' ? (
          <Section title={labelOf('general')} blurb={W.generalBlurb}>
            <GeneralSettings />
          </Section>
        ) : section === 'shortcuts' ? (
          <Section title={labelOf('shortcuts')} blurb={W.shortcutsBlurb}>
            <Shortcuts mac={platform === 'darwin'} />
          </Section>
        ) : section === 'fonts' && !web ? (
          <Section title={labelOf('fonts')} blurb={W.fontsBlurb}>
            <FontSettings />
          </Section>
        ) : section === 'agent' ? (
          <Section title={AGENT_COPY.pageTitle} blurb={AGENT_COPY.lede}>
            <AgentSettings />
          </Section>
        ) : section === 'skills' ? (
          <Section title={labelOf('skills')} blurb={SKILLS_COPY.lede}>
            <AgentSkills />
          </Section>
        ) : section === 'publishing' ? (
          <Section title={labelOf('publishing')} blurb={PC.settings.blurb} actions={<OpenCalendarLink />}>
            <PublishingSettings />
          </Section>
        ) : section === 'glossary' ? (
          <Section title={labelOf('glossary')} blurb={GLOSSARY_COPY.list.lede}>
            <GlossarySettings />
          </Section>
        ) : section === 'privacy' ? (
          <Section title={labelOf('privacy')} blurb={W.privacyBlurb}>
            <Privacy />
          </Section>
        ) : section === 'diagnostics' ? (
          <Section title={labelOf('diagnostics')} blurb={W.diagnosticsBlurb}>
            <Diagnostics />
          </Section>
        ) : (
          <Section title={labelOf('about')} blurb={W.aboutBlurb}>
            <About />
          </Section>
        )}
      </SectionBody>
    </RailPage>
  );
}

/**
 * The section in the middle. It is a size container (the skill grid and other Spectrum layouts measure it, not the
 * window) and, being keyed by section, brings the page back to the top when the section changes.
 */
function SectionBody({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = ref.current?.closest('.cc-scroll');
    if (scroller && scroller.scrollTop > 0) scroller.scrollTop = 0;
  }, []);
  return (
    <div ref={ref} className="@container flex min-w-0 flex-col gap-5">
      {children}
    </div>
  );
}

/** One heading shape for every section: the name, a sentence saying what it decides, then its panels. */
function Section({ title, blurb, actions, children }: { title: ReactNode; blurb?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <SectionHeader title={title} blurb={blurb} actions={actions} />
      {children}
    </>
  );
}

/**
 * The rail: every section and model category, each with what it holds written under its name. It is its own component
 * so that what it watches (model bundles carry download progress) re-renders only the rail, and every summary is a
 * derived primitive compared by value, so a progress tick that changes no count re-renders nothing.
 */
function SettingsRail({ section, model, web }: {
  section: SettingsSection;
  model?: { category: ModelCategory; page?: ModelPage };
  web: boolean;
}) {
  const last = useShell((s) => s.modelPages);
  const summary = useRailSummaries(web);
  const selected: SettingsSection | ModelCategory = model?.category ?? section;

  const entry = (key: SettingsSection) => ({
    key,
    label: labelOf(key),
    summary: summary[key],
    Icon: SECTION_ICON[key],
    route: { tab: 'settings' as const, section: key },
    current: selected === key,
  });
  const sectionGroups: RailGroup[] = SETTINGS_GROUPS.map((group) => ({
    key: group.id,
    label: group.label,
    // Fonts exist only on the desktop: a browser session has no `fonts.*`.
    entries: group.keys.filter((key) => key !== 'fonts' || !web).map(entry),
  }));
  const modelGroup: RailGroup = {
    key: 'models',
    label: S.settingsPage.models,
    entries: MODEL_CATEGORY_INFO.map((info) => ({
      key: info.key,
      label: info.label,
      summary: summary[info.key],
      Icon: CATEGORY_ICON[info.key],
      route: {
        tab: 'models' as const,
        category: info.key,
        page: modelPageFor(info.key, model?.category === info.key ? model.page : undefined, last[info.key]),
      },
      current: selected === info.key,
    })),
  };
  // Models sit between the agents and the app group.
  const groups = sectionGroups.flatMap((group) => (group.key === 'app' ? [modelGroup, group] : [group]));
  return <PageRail label={S.settingsPage.sections} groups={groups} />;
}

type RailSummaries = Record<SettingsSection | ModelCategory, string>;

/** Installed bundles per local model category, or null before the models snapshot; a plain record compared shallowly. */
const installedCounts = (s: ReturnType<typeof useModels.getState>): Partial<Record<ModelCategory, number>> | null => {
  if (!s.ready) return null;
  const counts: Partial<Record<ModelCategory, number>> = {};
  for (const bundle of s.bundles) {
    if (!isBundleInstalled(bundle)) continue;
    const category = bundleCategory(bundle);
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
};

/** The default text-generation provider's name, '' when there is none, null before the capabilities arrive. */
const textProvider = (s: ReturnType<typeof useModels.getState>): string | null => {
  const text = s.ready ? s.capabilities?.generateText : undefined;
  if (!text) return null;
  const effective = text.effective;
  return (effective ? text.providers.find((p) => p.providerId === effective.providerId)?.label : undefined) ?? '';
};

/**
 * What each rail entry holds, from data the shell already mirrors. Every entry gets a line, so the rail keeps one row
 * height whatever has loaded: while a mirror is still on its way the line says so, and the skill list (fetched on
 * demand elsewhere) is asked for here once the Runtime is connected.
 */
function useRailSummaries(web: boolean): RailSummaries {
  const runtime = useRuntime();
  const language = useShell((s) => s.language);
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  const connected = useConnection((s) => s.state.status === 'connected');
  const skills = useSkills((s) => (s.loaded ? s.skills.length : s.status === 'failed' ? -1 : null));
  const glossaries = useLibrary((s) => (s.ready ? s.glossaries.length : null));
  const grants = useGrants((s) => (s.ready ? s.grants.filter((g) => g.state === 'active').length : null));
  const app = useAppUpdate((s) => s.snapshot?.current?.version ?? null);
  const installed = useModels(useShallow(installedCounts));
  const publishing = usePublishing((s) => publishingRailSummary(s.ready, s.accounts));
  const provider = useModels(textProvider);

  useEffect(() => {
    if (connected) void loadSkills(runtime);
  }, [runtime, connected]);

  const languages = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  const agent = defaultDriver(drivers, checking);
  const models = (category: ModelCategory) => (installed ? W.installed(installed[category] ?? 0) : W.checking);
  return {
    general: language === 'system' ? GENERAL.languageSystem(LOCALE_NATIVE_NAMES[resolveLanguage('system', languages)]) : LOCALE_NATIVE_NAMES[language],
    shortcuts: W.shortcutCount(SHELL_KEYS.length),
    fonts: W.fontsSummary,
    agent: agent ? agent.name : drivers === null || checking.length ? W.checking : W.noAgent,
    skills: skills === null ? W.checking : skills < 0 ? W.loadFailed : W.skillCount(skills),
    publishing: publishing ?? W.checking,
    glossary: web ? W.desktopOnly : glossaries === null ? W.checking : W.glossaryCount(glossaries),
    // Grants and agent permissions are changed only in the desktop app (a browser has no `grants` topic).
    privacy: web ? W.desktopOnly : grants === null ? W.checking : W.grantCount(grants),
    diagnostics: connected ? W.runtimeOn : W.runtimeOff,
    about: W.version(app ?? RUNTIME_VERSION),
    asr: models('asr'),
    tts: models('tts'),
    llm: provider === null ? W.checking : provider || W.noDefault,
    image: models('image'),
    music: models('music'),
    sep: models('sep'),
    // No local models exist for visual understanding yet (its page says so).
    vision: W.notYet,
  };
}

/** Shell shortcuts: [copy key (or a fixed name), macOS keys, other platforms]; names are read at render so a language switch updates them. */
const SHELL_KEYS: [string, string, string][] = [
  ['newSession', '⌘N', 'Ctrl+N'],
  ['Space', '⇧⌘H', 'Ctrl+Shift+H'],
  ['tasks', '⇧⌘B', 'Ctrl+Shift+B'],
  ['settings', '⌘,', 'Ctrl+,'],
  ['sidebar', '⌃⌘S', '—'],
  ['back', '⌘[', 'Alt+←'],
  ['forward', '⌘]', 'Alt+→'],
];
const shellKeyLabel = (key: string): string => {
  const p = S.settingsPage;
  const labels: Record<string, string> = {
    newSession: p.shortcutNewSession,
    tasks: p.shortcutTasks,
    settings: p.shortcutSettings,
    sidebar: p.shortcutSidebar,
    back: p.shortcutBack,
    forward: p.shortcutForward,
  };
  return labels[key] ?? key;
};

function Shortcuts({ mac }: { mac: boolean }) {
  return (
    <SettingsGroup title={W.shortcutsPanel} icon={<Keyboard />}>
      {SHELL_KEYS.map(([key, macKey, otherKey]) => (
        <SettingsRow key={key} label={shellKeyLabel(key)}>
          <KeyCombo keys={mac ? macKey : otherKey} />
        </SettingsRow>
      ))}
    </SettingsGroup>
  );
}

/** A path on this machine; "Show in Finder" only on the desktop (a browser can't open the Runtime machine's file manager). */
function PathRow({ label, path }: { label: string; path: string | null }) {
  const runtime = useRuntime();
  return (
    <SettingsRow label={label} desc={path ? <span className="font-mono">{shortenPath(path)}</span> : '—'}>
      {runtime.host.platform === 'web' ? null : (
        <Button variant="secondary" size="S" isDisabled={!path} onPress={() => path && void runtime.host.revealPath(path)}>
          {revealLabel()}
        </Button>
      )}
    </SettingsRow>
  );
}

function useRuntimeInfo() {
  return useConnection((s) => (s.state.status === 'connected' ? s.state.runtime : null));
}

function Privacy() {
  const info = useRuntimeInfo();
  return (
    <>
      <SettingsGroup title={S.settingsPage.privacyTitle} hint={S.settingsPage.privacyHint} icon={<HardDrive />}>
        <PathRow label={S.settingsPage.dataDir} path={info?.home ?? null} />
        <PathRow label={S.settingsPage.projectsDir} path={info?.projectsDir ?? null} />
        <WebDataRow />
      </SettingsGroup>
      <DataGrants />
      <AgentPermissions />
    </>
  );
}

/** Data of web tabs in the workspace (`persist:web` partition): cookies, sign-ins, storage and cache. Only the desktop host has web tabs. */
function WebDataRow() {
  const web = useRuntime().host.web;
  const [busy, setBusy] = useState(false);
  const clear = () => {
    if (!web) return;
    setBusy(true);
    web
      .clearData()
      .then(() => ToastQueue.positive(S.settingsPage.webCleared, { timeout: 3000 }))
      .catch((error: Error) => ToastQueue.negative(S.settingsPage.webClearFailed(error.message), { timeout: 5000 }))
      .finally(() => setBusy(false));
  };
  return (
    <SettingsRow label={S.settingsPage.webData} desc={web ? S.settingsPage.webDataHint : S.settingsPage.webDataNone}>
      <Button variant="secondary" size="S" isDisabled={!web} isPending={busy} onPress={clear}>
        {S.settingsPage.clear}
      </Button>
    </SettingsRow>
  );
}

function Diagnostics() {
  const info = useRuntimeInfo();
  // Connection state, version, process, start time and data folder live in the Runtime card.
  return (
    <>
      <Panel label="Runtime" className="flex flex-col gap-3 pb-1.5">
        <PanelHeading title="Runtime" hint={S.settingsPage.runtimeHint} icon={<Server />} />
        <RuntimeCard />
        <RowList>
          <PathRow label={S.settingsPage.logsDir} path={info?.logsDir ?? null} />
        </RowList>
      </Panel>
      <ResourceCapacity />
    </>
  );
}

/** About: the CucCut mark and the versions of the desktop app, the interface and the Runtime, then updates. */
function About() {
  const info = useRuntimeInfo();
  // The desktop app's own version and build (what updates compare); the web host has none.
  const app = useAppUpdate((s) => s.snapshot?.current ?? null);
  const lines = [
    app ? S.settingsPage.appVersion(app.version, app.build) : null,
    S.settingsPage.uiVersion(RUNTIME_VERSION, PROTOCOL_VERSION),
    `Runtime ${info ? S.settingsPage.runtimeVersion(info.runtimeVersion, info.protocolVersion) : '—'}`,
  ].filter((line): line is string => line !== null);
  return (
    <>
      <Panel label={S.settingsPage.version} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <CucCutTile className="size-11 shrink-0" />
          <div className="min-w-0">
            <div className="text-xl font-bold tracking-[-0.04em] text-foreground">CucCut</div>
            <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 font-mono text-xs text-muted-foreground select-text">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="m-0 text-xs text-muted-foreground">{S.settingsPage.versionNote}</p>
      </Panel>
      <UpdateStatus />
    </>
  );
}
