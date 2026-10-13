import { useEffect, useId, useState, type ReactNode } from 'react';
import { PACK_LIMITS } from '@cuccut/protocol';
import { BookA, FolderOpen, LayoutTemplate, LoaderCircle, MessageSquareText, Palette, Sparkles, Upload } from 'lucide-react';
import { Button } from '../../../cc/ui/button.tsx';
import { Checkbox } from '../../../cc/ui/checkbox.tsx';
import { Input } from '../../../cc/ui/input.tsx';
import { Label } from '../../../cc/ui/label.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../cc/ui/select.tsx';
import { Textarea } from '../../../cc/ui/textarea.tsx';
import {
  emptyExportDraft,
  exportableSkills,
  exportableTemplates,
  exportLibraryGroups,
  exportProblem,
  exportRequest,
  libraryKey,
  libraryKindLabel,
  packErrorMessage,
  packQuickActions,
  sortPacks,
  updateExportDraft,
  type PackExportDraft,
} from '../../../model/packs.ts';
import { useRuntime } from '../../../runtime/context.tsx';
import { exportPack, loadPacks } from '../../../runtime/pack-commands.ts';
import { loadSkills } from '../../../runtime/skill-commands.ts';
import { loadTemplates } from '../../../runtime/template-commands.ts';
import { useConnection } from '../../../state/connection-store.ts';
import { useLibrary } from '../../../state/library-store.ts';
import { usePacks } from '../../../state/packs-store.ts';
import { useShell } from '../../../state/shell-store.ts';
import { useSkills } from '../../../state/skills-store.ts';
import { useTemplateCatalog } from '../../../state/template-catalog-store.ts';
import { PACKS_COPY } from '../packs-copy.ts';
import { Panel, PanelHeading } from '../settings-ui.tsx';
import { ErrorLine, PacksPageHeader, packsRoute } from './packs-ui.tsx';

const E = () => PACKS_COPY.export;

/** The Select's value for "no style guide" (a pack id never looks like this). */
const NO_STYLE = '__none';

type ListKey = 'templates' | 'skills' | 'library' | 'quickActions';

/**
 * Settings › Packs › Export a pack (pack design §2.4, agentcut `ExportFlow`): the person names the pack, picks what
 * travels (their own templates, skills, library items, installed packs' quick actions and one installed pack's style
 * guide) and the folder, and `packs.export` writes it with its `files` index. The ID follows the name, and the folder
 * (`<projects folder>/Packs/<id>`) follows the ID, until either is typed.
 *
 * Writing replaces an earlier export in that folder, so only "Write the pack" does it, never Enter in a field; while
 * it can't be written, the button says why underneath. Back on the list, a line says where the folder went. A browser
 * shows where export is done instead.
 */
export function PackExport() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const id = useId();
  const go = useShell((s) => s.go);
  const connected = useConnection((s) => s.state.status === 'connected');
  const projectsDir = useConnection((s) => (s.state.status === 'connected' ? s.state.runtime.projectsDir : null));
  const templates = useTemplateCatalog((s) => s.templates);
  const skills = useSkills((s) => s.skills);
  const glossaries = useLibrary((s) => s.glossaries);
  const brand = useLibrary((s) => s.brand);
  const packs = usePacks((s) => s.packs);
  const [draft, setDraft] = useState<PackExportDraft>(emptyExportDraft);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || web) return;
    void loadTemplates(runtime);
    void loadSkills(runtime);
    void loadPacks(runtime);
  }, [runtime, connected, web]);

  if (web) {
    return (
      <div data-cc className="flex min-w-0 flex-col gap-5">
        <PacksPageHeader title={E().title} blurb={E().lede} />
        <p className="m-0 text-sm text-muted-foreground">{PACKS_COPY.webOnly}</p>
      </div>
    );
  }

  const set = (patch: Partial<PackExportDraft>) => setDraft((current) => updateExportDraft(current, patch, projectsDir));
  const toggle = (key: ListKey, value: string, on: boolean) =>
    setDraft((current) => ({ ...current, [key]: on ? [...current[key].filter((v) => v !== value), value] : current[key].filter((v) => v !== value) }));
  const checked = (key: ListKey, value: string) => draft[key].includes(value);

  const yours = exportableTemplates(templates);
  const { own, thirdParty } = exportableSkills(skills);
  const libraryGroups = exportLibraryGroups(glossaries, brand);
  const quickActions = packQuickActions(packs);
  const styled = sortPacks(packs.filter((p) => p.hasStyle || p.counts.examples > 0));
  const problem = !connected ? PACKS_COPY.list.disconnected : exportProblem(draft);

  const chooseFolder = async () => {
    const picked = await runtime.host.pickDirectory({ title: E().pickTitle });
    if (picked) set({ dir: picked, dirEdited: true });
  };

  const submit = async () => {
    if (problem || writing) return;
    setWriting(true);
    setError(null);
    try {
      await exportPack(runtime, exportRequest(draft, packs));
      go(packsRoute());
    } catch (reason) {
      setError(packErrorMessage(reason, 'export'));
    } finally {
      setWriting(false);
    }
  };

  const field = (name: string) => `${id}-${name}`;

  return (
    <form
      data-cc
      className="flex min-w-0 flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      // Writing replaces an earlier export in the folder: only the button does it, never Enter in a field.
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') event.preventDefault();
      }}>
      <PacksPageHeader title={E().title} blurb={E().lede} />

      <Panel className="flex flex-col gap-4">
        <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0 @lg:grid-cols-2">
          <legend className="sr-only">{E().about}</legend>
          <Field label={E().name} htmlFor={field('name')}>
            <Input
              id={field('name')}
              value={draft.name}
              maxLength={PACK_LIMITS.name}
              placeholder={E().namePlaceholder}
              onChange={(event) => set({ name: event.target.value })}
            />
          </Field>
          <Field label={E().id} htmlFor={field('id')} hint={E().idHint} hintId={field('id-hint')}>
            <Input
              id={field('id')}
              value={draft.id}
              maxLength={PACK_LIMITS.id}
              spellCheck={false}
              autoComplete="off"
              aria-describedby={field('id-hint')}
              className="font-mono"
              onChange={(event) => set({ id: event.target.value, idEdited: true })}
            />
          </Field>
          <Field label={E().version} htmlFor={field('version')}>
            <Input
              id={field('version')}
              value={draft.version}
              maxLength={PACK_LIMITS.version}
              spellCheck={false}
              className="font-mono"
              onChange={(event) => set({ version: event.target.value })}
            />
          </Field>
          <Field label={E().author} optional htmlFor={field('author')}>
            <Input id={field('author')} value={draft.author} maxLength={PACK_LIMITS.author} onChange={(event) => set({ author: event.target.value })} />
          </Field>
          <div className="@lg:col-span-2">
            <Field label={E().description} optional htmlFor={field('description')}>
              <Textarea
                id={field('description')}
                rows={2}
                value={draft.description}
                maxLength={PACK_LIMITS.description}
                onChange={(event) => set({ description: event.target.value })}
              />
            </Field>
          </div>
          <div className="@lg:col-span-2">
            <Field label={E().folder} htmlFor={field('dir')} hint={E().folderHint} hintId={field('dir-hint')}>
              <div className="flex flex-col gap-2 @md:flex-row">
                <Input
                  id={field('dir')}
                  value={draft.dir}
                  spellCheck={false}
                  autoComplete="off"
                  aria-describedby={field('dir-hint')}
                  className="min-w-0 flex-1 font-mono text-xs md:text-xs"
                  onChange={(event) => set({ dir: event.target.value, dirEdited: true })}
                />
                <Button type="button" variant="outline" onClick={() => void chooseFolder()}>
                  <FolderOpen aria-hidden />
                  {E().chooseFolder}
                </Button>
              </div>
            </Field>
          </div>
        </fieldset>
      </Panel>

      <div className="grid gap-4 @2xl:grid-cols-2">
        <Group icon={<LayoutTemplate />} title={E().templates} hint={E().templatesHint}>
          {yours.length ? (
            yours.map((t) => (
              <Checkbox key={t.id} checked={checked('templates', t.id)} onCheckedChange={(on) => toggle('templates', t.id, on)}>
                <span className="[overflow-wrap:anywhere]">{t.title}</span>
              </Checkbox>
            ))
          ) : (
            <Empty>{E().noTemplates}</Empty>
          )}
        </Group>
        <Group icon={<Sparkles />} title={E().skills} hint={E().skillsHint}>
          {own.length || thirdParty.length ? (
            <>
              {own.map((s) => (
                <Checkbox key={s.id} checked={checked('skills', s.id)} onCheckedChange={(on) => toggle('skills', s.id, on)}>
                  <span className="[overflow-wrap:anywhere]">{s.name}</span>
                </Checkbox>
              ))}
              {thirdParty.length ? (
                <>
                  <p className="m-0 mt-2 text-xs font-medium text-muted-foreground">{E().thirdParty}</p>
                  {thirdParty.map((s) => (
                    <Checkbox key={s.id} checked={checked('skills', s.id)} onCheckedChange={(on) => toggle('skills', s.id, on)}>
                      <span className="[overflow-wrap:anywhere]">{s.name}</span>
                    </Checkbox>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <Empty>{E().noSkills}</Empty>
          )}
        </Group>
      </div>

      <Group icon={<BookA />} title={E().library} hint={E().libraryHint}>
        {libraryGroups.length ? (
          <div className="flex flex-col gap-3">
            {libraryGroups.map((group) => (
              <div key={group.key} className="flex flex-col">
                <p className="m-0 text-xs font-medium text-muted-foreground">{group.label}</p>
                <div className="grid gap-x-4 @lg:grid-cols-2">
                  {group.entries.map((entry) => (
                    <Checkbox
                      key={libraryKey(entry)}
                      checked={checked('library', libraryKey(entry))}
                      onCheckedChange={(on) => toggle('library', libraryKey(entry), on)}>
                      <span className="[overflow-wrap:anywhere]">
                        {entry.name} <span className="text-xs text-muted-foreground">· {libraryKindLabel(entry.kind)}</span>
                      </span>
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{E().noLibrary}</Empty>
        )}
      </Group>

      <div className="grid gap-4 @2xl:grid-cols-2">
        <Group icon={<MessageSquareText />} title={E().quick} hint={E().quickHint}>
          {quickActions.length ? (
            quickActions.map((action) => (
              <Checkbox key={action.key} checked={checked('quickActions', action.key)} onCheckedChange={(on) => toggle('quickActions', action.key, on)}>
                <span className="[overflow-wrap:anywhere]">
                  {action.label} <span className="text-xs text-muted-foreground">{E().fromPack(action.pack.name)}</span>
                </span>
              </Checkbox>
            ))
          ) : (
            <Empty>{E().noQuick}</Empty>
          )}
        </Group>
        <Group icon={<Palette />} title={E().style} hint={E().styleHint}>
          <Select
            value={draft.stylePack || NO_STYLE}
            onValueChange={(value) => setDraft((current) => ({ ...current, stylePack: value && value !== NO_STYLE ? String(value) : '' }))}>
            <SelectTrigger aria-label={E().styleLabel} className="w-full max-w-sm">
              <SelectValue>{(value: unknown) => styled.find((p) => p.id === value)?.name ?? E().styleNone}</SelectValue>
            </SelectTrigger>
            <SelectContent data-cc>
              <SelectItem value={NO_STYLE}>{E().styleNone}</SelectItem>
              {styled.map((pack) => (
                <SelectItem key={pack.id} value={pack.id}>
                  {pack.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Group>
      </div>

      <div className="flex flex-col gap-2">
        <ErrorLine>{error}</ErrorLine>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={writing || problem !== null} aria-describedby={problem ? field('why') : undefined}>
            {writing ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Upload aria-hidden />}
            {writing ? E().writing : E().write}
          </Button>
          <Button type="button" variant="ghost" disabled={writing} onClick={() => go(packsRoute())}>
            {E().cancel}
          </Button>
        </div>
        {problem ? (
          <p id={field('why')} className="m-0 text-xs text-muted-foreground">
            {problem}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** A labelled field with its hint under it. */
function Field({
  label,
  htmlFor,
  optional = false,
  hint,
  hintId,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  hint?: string;
  hintId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">{E().optional}</span> : null}
      </Label>
      {children}
      {hint ? (
        <p id={hintId} className="m-0 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A panel of choices under one heading. */
function Group({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <Panel className="flex min-w-0 flex-col gap-2">
      <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
        <legend className="sr-only">{title}</legend>
        <PanelHeading icon={icon} title={title} hint={hint} className="mb-1" />
        {children}
      </fieldset>
    </Panel>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm text-muted-foreground">{children}</p>;
}
