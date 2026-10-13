import { useState } from 'react';
import { DEFAULT_AGENT_MODE, type AttachmentRef, type Id, type SkillSendRef, type TemplateSendRef } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { Scissors, Sparkles } from 'lucide-react';
import { cn } from 'cn';
import { S } from './shell-copy.ts';
import { HOME_COPY } from '../copy.ts';
import { applyAgentChange, draftSelection } from '../model/agent-choice.ts';
import { sendFailureMessage } from '../model/agent-skills.ts';
import {
  addMaterials,
  canStartHome,
  EMPTY_HOME_BRIEF,
  gateGuide,
  homeBrief,
  homeGate,
  MAX_HOME_MATERIALS,
  pickTemplate,
  type HomeBriefState,
} from '../model/home-brief.ts';
import { starterTarget, type HomeStarter } from '../model/home-starters.ts';
import { templateOf, type HomeTemplate } from '../model/home-templates.ts';
import { slotLabels } from '../model/prompt-slots.ts';
import { urlValid } from '../model/new-flow.ts';
import { recentVideos, videoTargetOf } from '../model/space.ts';
import { workspaceKey } from '../model/workspace.ts';
import { setDefaultAccessMode } from '../runtime/agent-commands.ts';
import { useRuntime } from '../runtime/context.tsx';
import { templatePrompt } from '../runtime/template-commands.ts';
import { defaultDriver, useConnection } from '../state/connection-store.ts';
import { useDirectory, useProject } from '../state/directory-store.ts';
import { useDraftImages } from '../state/draft-images-store.ts';
import { useDraftSkillIds, useDraftSkills } from '../state/draft-skills-store.ts';
import { useSetting } from '../state/settings-store.ts';
import { useHomeMemory } from '../state/home-memory-store.ts';
import { useHomeTemplates } from '../state/home-templates-store.ts';
import { useTemplateCatalog } from '../state/template-catalog-store.ts';
import { useShell } from '../state/shell-store.ts';
import { useSkills } from '../state/skills-store.ts';
import { useSpace } from '../state/space-store.ts';
import { useStartBrief, useStartBriefOf } from '../state/start-brief-store.ts';
import { useVideo } from '../state/video-store.ts';
import { Glass } from '../cc/ui/glass.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../cc/ui/tabs.tsx';
import { Composer } from './composer.tsx';
import { BlankCanvas } from './landing/blank-canvas.tsx';
import { ClipStart } from './landing/clip-start.tsx';
import { LANDING_COPY } from './landing/landing-copy.ts';
import { LegacyImportBanner } from './legacy-import/legacy-import-task.tsx';
import { createBlankVideo, type BlankRatio } from './start/blank-video.ts';
import { BriefTokens } from './start/brief-tokens.tsx';
import { GateCard } from './start/gate-card.tsx';
import { HomeStarters } from './start/home-starters.tsx';
import { HomeTemplateShelf } from './start/home-template-shelf.tsx';
import { startDraftKey } from './start/open-home.ts';
import { ProjectPicker } from './start/project-picker.tsx';
import { SlotHint } from './start/slot-hint.tsx';
import { useTemplateCatalogLoader } from './start/use-templates.ts';
import { useEditorReference } from './use-editor-reference.ts';
import { focusPromptEnd } from './use-prompt-value.ts';

/**
 * The start page of a new session, laid out after agentcut's home (`NewProject` + `StartChatPanel`): two ways in as
 * centred tabs — "Create a video" (the heading and the composer in one thin glass panel, the project row, the blank
 * canvas shapes) and "Clip a long video" (the drop card) — then the quick start cards and the template shelf as solid
 * sections. The session is only created when the first message goes out.
 *
 * `layout`: `page` sits inside a page that scrolls as a whole (the landing page); `column` scrolls on its own (the
 * session layout's conversation column, which may be narrow — the grids follow the container's width, not the window's).
 */
export function StartPage({ projectId: routeProjectId, layout = 'column', quietSend = false }: {
  projectId: string | null;
  layout?: 'page' | 'column';
  /** The video editor beside the start page holds the view's one tinted action (Export): Send goes neutral. */
  quietSend?: boolean;
}) {
  const runtime = useRuntime();
  const projects = useDirectory((s) => s.projects);
  const pickable = projects.filter((p) => !p.archived).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  // When the editor beside it has a video open from a project, the new session is created in that project so the agent can read and write this video (§1.5).
  const videoProjectId = useVideo((s) => s.video?.ref?.source.projectId ?? null);
  // When the route carries no project, use the one last picked in the tray (remembered on this computer; it counts only if it still exists and is not archived; product design §3.2.1); otherwise no project.
  const lastProject = useHomeMemory((s) => s.project);
  const remembered = lastProject && pickable.some((p) => p.id === lastProject) ? lastProject : null;
  const projectId = routeProjectId ?? videoProjectId ?? remembered;
  const project = useProject(projectId);
  // The target language last filled in for “Transcribe and translate”: quick start reuses it; when there is none, that sentence waits for the field to be filled.
  const lastTarget = useHomeMemory((s) => s.target);
  const go = useShell((s) => s.go);
  const draftKey = startDraftKey(routeProjectId);
  // Access mode for a new session: whatever was picked on the draft, otherwise the default in settings (`agent.defaultAccessMode`, which remembers the last choice made here).
  const draftMode = useShell((s) => s.draftAccessModes[draftKey]);
  const defaultMode = useSetting('agent.defaultAccessMode');
  const accessMode = draftMode ?? defaultMode ?? DEFAULT_AGENT_MODE;
  // Agent · model · effort: whatever was picked on the draft, otherwise the default Agent and its default model and effort from preferences.
  const choice = useShell((s) => s.draftAgents[draftKey]);
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  // If the Agent picked on the draft is still being detected for the first time, show “Detecting” and do not fall back to the default one (sending still uses the draft's choice).
  const driver =
    choice?.driverId && checking.includes(choice.driverId)
      ? null
      : (drivers?.find((d) => d.id === choice?.driverId) ?? defaultDriver(drivers, checking));
  const driverId = driver?.id ?? null;
  const { model, effort } = draftSelection(driver, choice);
  const editor = useEditorReference({ conversationId: null, projectId });
  const brief = useStartBriefOf(draftKey);
  // Unfilled fields in the input box (template pack spec §5.5): the hint line below the box lists them.
  const slots = slotLabels(useShell((s) => s.drafts[draftKey] ?? ''));
  // Each press selects the next unfilled field in the input box (Composer `start.selectSlot`).
  const [slotTick, setSlotTick] = useState(0);
  // Template catalog: fetched once when the start page mounts (it is fetched again when the popup opens or the connection is restored).
  const catalog = useTemplateCatalogLoader();
  const template = templateOf(catalog.templates, brief.template);
  const shelf = useHomeTemplates((s) => s.recent);
  // Skills picked via “+ › Use Skill”: markers and templates share one line (the list is taken from the input box).
  const skillIds = useDraftSkillIds(draftKey);
  const skillCatalog = useSkills((s) => s.skills);
  const pickedSkills = skillIds.map((id) => ({ id, name: skillCatalog.find((k) => k.id === id)?.name ?? id }));
  // “+ › Recent videos”: among the videos that can still be picked, those with the most recent activity.
  const spaceEntries = useSpace((s) => s.entries);
  const recent = recentVideos(
    spaceEntries,
    pickable.map((p) => p.id),
  );
  // While the Agent is still being detected, draw no conclusion and do not flash the guidance card.
  const gate = homeGate(drivers, checking);
  const guide = gateGuide(gate);
  // "Create a video" or "Clip a long video" (agentcut's `make` / `clips`).
  const [flow, setFlow] = useState<'make' | 'clips'>('make');
  // The clip card's field lives here so switching tabs (which unmounts the hidden panel) keeps what was typed.
  const [clipSource, setClipSource] = useState('');

  const patch = (next: Partial<HomeBriefState>) => useStartBrief.getState().patch(draftKey, next);
  const currentBrief = () => useStartBrief.getState().briefs[draftKey] ?? EMPTY_HOME_BRIEF;

  // When the popup closes, S2 returns focus to the button that opened it: wait until that finishes, then put focus back in the input box (same as the input box's own refocus).
  // If the draft has unfilled fields, select the first one (spec §5.5); otherwise put the cursor at the end.
  const focusComposer = () =>
    window.setTimeout(() => {
      if (slotLabels(useShell.getState().drafts[draftKey] ?? '').length) setSlotTick((n) => n + 1);
      else focusPromptEnd(document.querySelector(`[data-composer="${CSS.escape(draftKey)}"]`));
    }, 400);

  // Fill one sentence of prompt into the input box (shared by quick start, work examples and scene templates; prototype page-new.jsx `fillPrompt`): if the box already has text, replace it directly without asking, and offer one undo;
  // after filling, focus returns to the input box (if there are unfilled fields, select the first one; otherwise the cursor goes to the end). `undo` is what to restore besides the text when undoing.
  const fillPrompt = (next: string, undo?: () => void) => {
    const shell = useShell.getState();
    const before = shell.drafts[draftKey] ?? '';
    shell.setDraft(draftKey, next);
    focusComposer();
    if (!before.trim() || before === next) return;
    ToastQueue.neutral(HOME_COPY.promptPlaced, {
      timeout: 6000,
      actionLabel: HOME_COPY.undo,
      shouldCloseOnAction: true,
      onAction: () => {
        useShell.getState().setDraft(draftKey, before);
        undo?.();
        focusComposer();
      },
    });
  };

  // Scene templates (template pack spec §5.2, §5.5; prototype page-new.jsx `pickScene`): attached to the input box, recorded in the template grid (most recently used first), and the brief is filled into the input box (with unfilled fields; choosing another template replaces the text). Picking one that is already attached does not refill it.
  // Removing the template (clicking the same card again, or the × on the marker) removes only the template and leaves the text alone. Undo restores the text and template together (same as applyExample).
  const pickScene = (picked: HomeTemplate | null) => {
    const before = currentBrief();
    if (picked) useHomeTemplates.getState().pick(picked.id, useTemplateCatalog.getState().templates);
    patch(pickTemplate(before, picked));
    if (!picked?.brief || picked.id === before.template) return;
    fillPrompt(picked.brief, () => patch({ template: before.template }));
  };

  // Quick start: only replaces the text in the input box; templates and materials are left alone; does not send.
  const applyStarter = (starter: HomeStarter) => fillPrompt(starter.prompt);

  // Work example (spec §5.1; prototype page-new.jsx `applyExample`): replaces the whole prompt in the input box (after that it is the user's own words) and removes any attached scene template.
  // Undo restores the text and template together.
  const applyExample = async (example: HomeTemplate) => {
    let text: string;
    try {
      text = await templatePrompt(runtime, example.id, example.version, example.language);
    } catch (error) {
      ToastQueue.negative(HOME_COPY.templatePromptFailed((error as Error).message), { timeout: 5000 });
      return;
    }
    const before = currentBrief();
    patch({ template: null });
    useHomeTemplates.getState().pick(example.id, useTemplateCatalog.getState().templates);
    fillPrompt(text, () => patch({ template: before.template }));
  };

  // A new blank video (prototype `createBlank`) of the chosen shape, in this page's project (one is created first when
  // none is picked: without a session the video has nowhere else to live).
  const createBlank = (ratio: BlankRatio) => createBlankVideo(runtime, projectId, ratio);

  // Choosing files is asynchronous: when merging, compute from the latest version in the store, not from the snapshot taken at render time.
  const addPaths = (paths: readonly string[]) => {
    if (!paths.length) return;
    const current = useStartBrief.getState().briefs[draftKey] ?? EMPTY_HOME_BRIEF;
    const { list, rejected } = addMaterials(current.materials, paths);
    patch({ materials: list });
    if (rejected) ToastQueue.neutral(HOME_COPY.materialsFull(MAX_HOME_MATERIALS, rejected), { timeout: 5000 });
  };

  // Switching project: the start page is remounted per project; the input text, attached images, picked skills, templates and materials, access mode and Agent choice all move over together;
  // if the editor is open, its feature-area tab also follows to that project's start page.
  const moveDraft = (id: Id | null) => {
    const to = startDraftKey(id);
    const shell = useShell.getState();
    const text = shell.drafts[draftKey];
    if (text) {
      shell.setDraft(to, text);
      shell.setDraft(draftKey, '');
    }
    useDraftImages.getState().move(draftKey, to);
    useDraftSkills.getState().move(draftKey, to);
    useStartBrief.getState().move(draftKey, to);
    const mode = shell.draftAccessModes[draftKey];
    if (mode) {
      shell.setDraftAccessMode(to, mode);
      shell.setDraftAccessMode(draftKey, null);
    }
    const agent = shell.draftAgents[draftKey];
    if (agent) {
      shell.setDraftAgent(to, agent);
      shell.setDraftAgent(draftKey, null);
    }
    const { route } = useShell.getState();
    if (route.tab === 'home') shell.carryWorkspace(workspaceKey(route.conversationId, route.projectId), workspaceKey(null, id));
  };

  // The project picked in the tray (null = no project) is remembered, so the next visit to the start page still uses it; when arriving with a project from elsewhere (e.g. the sidebar's “Create session here”), it is not remembered.
  const switchProject = (id: Id | null) => {
    useHomeMemory.getState().setProject(id);
    if (id === routeProjectId) return;
    const { route } = useShell.getState();
    const pane = route.tab === 'home' ? route.pane : undefined;
    moveDraft(id);
    go({ tab: 'home', conversationId: null, projectId: id, ...(pane ? { pane } : {}) });
  };

  // “+ › Recent videos; prototype page-new.jsx `pickRecent`”: the start page switches to that video's project and opens it in the feature area, so the session is created in that project,
  // and a reference tag for this video appears above the input box so the agent can read and write it. This applies only to a single video: an already-attached video or audio material gives way, and one undo is offered.
  const pickRecent = (entryId: string) => {
    const entry = useSpace.getState().entries.find((e) => e.id === entryId);
    const to = entry?.source.projectId;
    if (!entry || !to) return;
    const materials = currentBrief().materials;
    const media = materials.filter((m) => m.kind === 'media');
    if (to !== routeProjectId) moveDraft(to);
    const toKey = startDraftKey(to);
    if (media.length) useStartBrief.getState().patch(toKey, { materials: materials.filter((m) => m.kind !== 'media') });
    useShell.getState().openVideo(videoTargetOf(entry), { conversationId: null, projectId: to });
    if (!media.length) return;
    ToastQueue.neutral(HOME_COPY.recentReplaced(entry.name, S.list(media.map((m) => m.name))), {
      timeout: 6000,
      actionLabel: HOME_COPY.undo,
      shouldCloseOnAction: true,
      onAction: () => {
        const now = useStartBrief.getState().briefs[toKey] ?? EMPTY_HOME_BRIEF;
        const restored = addMaterials(
          now.materials,
          media.map((m) => m.path),
        ).list;
        useStartBrief.getState().patch(toKey, { materials: restored });
      },
    });
  };

  /**
   * Creates the session and sends its first message: the composer's send, and the clip card's prefilled request.
   * `materials` are local paths written into the message (homeBrief); `scene` is the template on the composer.
   * Composer sends clear the start brief and, on a failed send after the session exists, carry the draft's images and
   * skills over to it; clip starts leave the composer's draft alone.
   */
  const startSession = async (
    raw: string,
    attachments: AttachmentRef[],
    skills: SkillSendRef[],
    from: { materials: readonly string[]; scene?: TemplateSendRef; composer: boolean },
  ): Promise<boolean> => {
    // The target language filled in for “Transcribe and translate” is remembered, so the next time this quick start is clicked it is reused directly (if the sentence is not recognized, nothing is remembered).
    const target = from.composer ? starterTarget(raw) : null;
    if (target) useHomeMemory.getState().setTarget(target);
    const text = homeBrief(raw, { images: attachments.length, materials: [...from.materials] });
    let conversationId: string | null = null;
    try {
      // Pass only what was picked on the draft; anything not picked is supplied by the Runtime from preferences (default Agent, its default model and effort).
      // Items not picked are not passed, so the session follows settings; items that were picked are also recorded as the default for new sessions (prototype “global seed”).
      const conversation = await runtime.createConversation(projectId, {
        ...(draftMode ? { accessMode: draftMode } : {}),
        ...(choice?.driverId ? { driverId: choice.driverId } : {}),
        ...(choice && 'model' in choice ? { model: choice.model ?? null } : {}),
        ...(choice && 'effort' in choice ? { effort: choice.effort ?? null } : {}),
      });
      conversationId = conversation.id;
      if (draftMode && draftMode !== defaultMode) void setDefaultAccessMode(runtime, draftMode).catch(() => {});
      useShell.getState().setDraftAccessMode(draftKey, null);
      useShell.getState().setDraftAgent(draftKey, null);
      if (from.composer) useStartBrief.getState().clear(draftKey);
      const context = await editor.capture();
      // If the editor is open, keep it open and switch the session to the one just created.
      const { route } = useShell.getState();
      const pane = route.tab === 'home' ? route.pane : undefined;
      if (route.tab === 'home') useShell.getState().carryWorkspace(workspaceKey(route.conversationId, route.projectId), conversation.id);
      go({ tab: 'home', conversationId: conversation.id, projectId: null, ...(pane ? { pane } : {}) });
      await runtime.send(
        conversation.id,
        text,
        context,
        attachments.map((a) => a.id),
        from.scene,
        skills,
      );
      editor.reset();
      return true;
    } catch (error) {
      ToastQueue.negative(sendFailureMessage(error), { timeout: 5000 });
      // Session already created: put the whole text (with settings and materials), images and picked skills back into that session's input box, so the user's input is not swallowed.
      // A scene template cannot attach to the session's input box (there is no template there), so this time's template is dropped.
      if (conversationId) {
        useShell.getState().setDraft(conversationId, text);
        if (from.composer) {
          useDraftImages.getState().move(draftKey, conversationId);
          useDraftSkills.getState().move(draftKey, conversationId);
        }
        return true;
      }
      // Session not created: restore the original text in the input box; the template, settings and materials remain on the start page.
      return false;
    }
  };

  // "Clip a long video": the same session start with a prefilled request. A link goes into the message (the agent
  // fetches it with the download tool); a local file rides along as an asset.
  const startClips = (source: string) => {
    const link = urlValid(source);
    return startSession(link ? `${LANDING_COPY.clips.prompt}\n${source}` : LANDING_COPY.clips.prompt, [], [], {
      materials: link ? [] : [source],
      composer: false,
    });
  };

  const ready = gate === null || gate.ok;

  return (
    <div className={cn('@container flex flex-col', layout === 'column' && 'cc-scroll min-h-0 flex-1 overflow-y-auto')}>
      <div className={cn('mx-auto box-border flex w-full flex-col gap-12', layout === 'column' && 'max-w-6xl px-4 pt-4 pb-12 @xl:px-6')}>
        {/* A legacy project import is running, or left items not yet imported (import exists only on desktop). */}
        <LegacyImportBanner />
        <div className="mx-auto w-full max-w-3xl pt-4 @3xl:pt-10">
          <Tabs value={flow} onValueChange={(value) => setFlow(value === 'clips' ? 'clips' : 'make')} className="gap-7">
            <TabsList data-cc className="mx-auto max-w-full" aria-label={LANDING_COPY.tabs}>
              <TabsTrigger value="make">
                <Sparkles aria-hidden />
                {LANDING_COPY.create}
              </TabsTrigger>
              <TabsTrigger value="clips">
                <Scissors aria-hidden />
                {LANDING_COPY.clip}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="make" className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 text-center">
                <h1 className="m-0 text-3xl leading-tight font-medium tracking-tight text-balance text-foreground @3xl:text-4xl">
                  {LANDING_COPY.heading}
                </h1>
                <p className="m-0 text-sm leading-relaxed text-pretty text-muted-foreground">{LANDING_COPY.lede}</p>
              </div>
              <Glass shape="panel" thickness="thin" className="p-3 text-foreground @xl:p-4">
                <div aria-hidden className="mb-2 px-1 text-sm font-medium">
                  {LANDING_COPY.composerLabel}
                </div>
                <Composer
                  quietSend={quietSend}
                  draftKey={draftKey}
                  driverId={driverId}
                  model={model}
                  effort={effort}
                  lockedTo={null}
                  onAgentChange={(change) => useShell.getState().setDraftAgent(draftKey, applyAgentChange(choice, driverId, change))}
                  accessMode={accessMode}
                  onAccessModeChange={(mode) => useShell.getState().setDraftAccessMode(draftKey, mode)}
                  busy={false}
                  autoFocus
                  reference={editor.reference}
                  placeholder={brief.template ? HOME_COPY.templatePlaceholder : HOME_COPY.placeholder}
                  mentionScope={{ projectId, conversationId: null }}
                  start={{
                    tokens: (
                      <BriefTokens
                        skills={pickedSkills}
                        onRemoveSkill={(id) => useDraftSkills.getState().remove(draftKey, id)}
                        template={template}
                        materials={brief.materials}
                        onRemoveTemplate={() => pickScene(null)}
                        onRemoveMaterial={(path) => patch({ materials: brief.materials.filter((m) => m.path !== path) })}
                      />
                    ),
                    ready,
                    selectSlot: slotTick,
                    // Cannot send with only a template chosen and no sentence written; attaching images or materials is fine (the input box itself blocks sending when the Agent is unavailable).
                    canSendEmpty: (images) => canStartHome({ text: '', images, materials: brief.materials.length, gate: null }).ok,
                    onPaths: addPaths,
                    recent: {
                      items: recent.map((entry) => ({
                        id: entry.id,
                        label: entry.name,
                        description: projects.find((p) => p.id === entry.source.projectId)?.name ?? entry.relPath,
                      })),
                      onPick: pickRecent,
                    },
                  }}
                  onSend={(raw, attachments, skills) => {
                    // Materials are written into this message when it is sent (the brief of prototype `AgentHero`); unfilled fields are written as “[label]” (spec §5.5, homeBrief). Attached scene templates and picked skills pass only their identifiers;
                    // the brief guidance, template body and SKILL.md are assembled for the agent by the Runtime (template pack spec §5.2, product design §6.9),
                    // and the message in the session additionally carries the markers “Template: title” and “Skill: name”.
                    const scene = brief.template
                      ? { id: brief.template, ...(template ? { version: template.version, language: template.language } : {}) }
                      : undefined;
                    return startSession(raw, attachments, skills, {
                      materials: brief.materials.map((m) => m.path),
                      ...(scene ? { scene } : {}),
                      composer: true,
                    });
                  }}
                />
                <ProjectPicker
                  project={project ?? null}
                  projects={pickable}
                  noneDisabled={!!videoProjectId}
                  onSelect={switchProject}
                />
                <SlotHint labels={ready ? slots : []} onNext={() => setSlotTick((n) => n + 1)} />
                <BlankCanvas onCreate={createBlank} />
              </Glass>
              {guide ? <GateCard guide={guide} /> : null}
            </TabsContent>
            <TabsContent value="clips" className="flex flex-col gap-4">
              {guide ? <GateCard guide={guide} /> : null}
              <ClipStart
                onStart={startClips}
                blocked={ready ? null : LANDING_COPY.clips.needsAgent}
                source={clipSource}
                onSourceChange={setClipSource}
              />
            </TabsContent>
          </Tabs>
        </div>
        <HomeStarters target={lastTarget} onPick={applyStarter} />
        <HomeTemplateShelf
          catalog={catalog.templates}
          scene={brief.template}
          shelf={shelf}
          onScene={pickScene}
          onExample={(example) => void applyExample(example)}
        />
      </div>
    </div>
  );
}
