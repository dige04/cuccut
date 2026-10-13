import { useState } from 'react';
import type { ModelInfoBase, OnlineCapability } from '@cuccut/protocol';
import { Button, Header, Heading, Picker, PickerItem, PickerSection, Text, ToastQueue } from '@react-spectrum/s2';
import AddIcon from '@react-spectrum/s2/icons/Add';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { capabilityCategory, categoryCapability, cloudDefaultPicker, cloudProviders, refreshAfterKey, type DefaultOption } from '../../model/models-cloud.ts';
import { probeFromJob, type ProbeState } from '../../model/models-probe.ts';
import type { ModelCategory } from '../../model/settings-nav.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { CODEX_IMAGE_PROVIDER } from '../settings/codex-image.ts';
import { CodexImageCard, codexDefaultState, useCodexImage } from './codex-image-card.tsx';
import { chooseCloudDefault, refreshProvider, startProbe } from './model-actions.ts';
import { Card, Lede, PageStatus, SettingRow } from './model-parts.tsx';
import { CLOUD_COPY, MODELS_PAGE_COPY } from './models-copy.ts';
import { ProbeDialog } from './probe-dialog.tsx';
import { ProviderCard } from './provider-card.tsx';
import { AddModelDialog, CustomProviderDialog, KeyDialog } from './provider-dialogs.tsx';
import { TextParamRows } from './text-params.tsx';

/**
 * Models › Cloud models (design mockup settings-cloud.jsx:220-342): the title and description; the default model (text generation has two more rows: reasoning effort and the concurrent request count); the provider list (the first card in the image tier is Codex CLI); and four dialogs: keys, self-hosted providers, add model, and test. The use tier is set by the capability category on the left. Source separation and image understanding exist only on the local page, so a deep link to the cloud page says they are not available. In the browser you can only view and test: the Web allowlist does not include `models.configure`, `models.setDefault` and the like, so the default model, parameters, keys, refresh and add are disabled, with one sentence under the page header.
 */
export function CloudModels({ category }: { category: ModelCategory }) {
  const capability = categoryCapability(category);
  if (!capability) return <PageStatus>{CLOUD_COPY.noCloud}</PageStatus>;
  return <CloudCapability key={capability} capability={capability} />;
}

type DialogState =
  | { kind: 'key'; providerId: string }
  | { kind: 'custom' }
  | { kind: 'model'; providerId: string; label: string; modelId?: string; capability: OnlineCapability }
  | { kind: 'probe'; providerId: string; modelId: string }
  | null;

const EMPTY_KEY = 'empty';
const webNote = style({ marginTop: 0, marginBottom: 16, font: 'ui-sm', color: 'gray-800', overflowWrap: 'anywhere' });
/** Group ids and option ids share one collection and must be kept apart (a group with id `none` colliding with the "use local model" option's `none` would crash the whole page). */
const sectionId = (key: string) => `section:${key}`;

/** One item of the menu. Returns a PickerItem directly (wrapping it in a component would stop S2's collection from recognizing it). */
function pickerOption(item: DefaultOption) {
  return (
    <PickerItem key={item.key} id={item.key} textValue={item.label}>
      <Text slot="label">{item.label}</Text>
      {item.description ? <Text slot="description">{item.description}</Text> : null}
    </PickerItem>
  );
}

function CloudCapability({ capability }: { capability: OnlineCapability }) {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const view = useModels((s) => s.capabilities);
  const connected = useConnection((s) => s.state.status === 'connected');
  const jobs = useJobs((s) => s.jobs);
  const replace = useShell((s) => s.replace);
  const codex = useCodexImage(capability === 'generateImage');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // Tests since the page was opened: model → status; the ones still running are read from the `jobs` topic.
  const [runs, setRuns] = useState<Record<string, ProbeState>>({});
  const [busy, setBusy] = useState(false);
  // The provider currently refreshing (the mockup refreshes one at a time: while one is refreshing, every refresh and key button waits).
  const [refreshing, setRefreshing] = useState<string | null>(null);

  if (!view) return <PageStatus>{connected ? MODELS_PAGE_COPY.loading : MODELS_PAGE_COPY.offline}</PageStatus>;

  const cards = cloudProviders(view, capability);
  const codexState = capability === 'generateImage' ? codexDefaultState(codex) : null;
  const picker = cloudDefaultPicker(view, capability, codexState, {
    none: CLOUD_COPY.none[capability],
    noneDesc: CLOUD_COPY.noneDesc[capability],
    codex: CLOUD_COPY.codexItem,
    codexDesc: CLOUD_COPY.codexItemDesc,
    unavailable: CLOUD_COPY.unavailable,
    localDesc: CLOUD_COPY.localDefaultDesc,
  });
  const defaultRef = view[capability].default;

  const runKey = (providerId: string, modelId: string) => `${providerId}/${modelId}`;
  const liveState = (key: string): ProbeState | undefined => {
    const run = runs[key];
    return run?.status === 'running' ? probeFromJob(run.jobId, jobs.find((j) => j.jobId === run.jobId)) : run;
  };

  /** After adding something for a different use, jump to that category's cloud page (mockup `setKind`). */
  const showCapability = (next: OnlineCapability) => {
    if (next !== capability) replace({ tab: 'models', category: capabilityCategory(next), page: 'cloud' });
  };

  const choose = async (key: string) => {
    setBusy(true);
    try {
      await chooseCloudDefault(runtime, capability, key);
      ToastQueue.neutral(CLOUD_COPY.defaultSet, { timeout: 3000 });
    } catch (err) {
      ToastQueue.negative(CLOUD_COPY.defaultFailed((err as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };

  /** The "Refresh" on the card header (mockup settings-cloud.jsx `refresh` / `refreshVoices`): expands this provider; results come back through the `models` topic to the note line and the model rows. */
  const refresh = async (providerId: string) => {
    if (refreshing) return;
    setRefreshing(providerId);
    expand(providerId);
    try {
      await refreshProvider(runtime, providerId);
    } catch (err) {
      ToastQueue.negative(CLOUD_COPY.refreshFailed((err as Error).message), { timeout: 5000 });
    } finally {
      setRefreshing(null);
    }
  };

  const runProbe = async (providerId: string, model: ModelInfoBase, voice: string) => {
    const key = runKey(providerId, model.modelId);
    setRuns((old) => ({ ...old, [key]: { status: 'submitting' } }));
    try {
      const jobId = await startProbe(runtime, capability, providerId, model, voice);
      setRuns((old) => ({ ...old, [key]: { status: 'running', jobId } }));
    } catch (err) {
      setRuns((old) => ({ ...old, [key]: { status: 'failed', message: (err as Error).message } }));
    }
  };

  const toggle = (providerId: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (!next.delete(providerId)) next.add(providerId);
      return next;
    });
  const expand = (providerId: string) => setExpanded((old) => new Set(old).add(providerId));

  const keyCard = dialog?.kind === 'key' ? cards.find((c) => c.providerId === dialog.providerId) : undefined;
  const probeCard = dialog?.kind === 'probe' ? cards.find((c) => c.providerId === dialog.providerId) : undefined;
  const probeModel = dialog?.kind === 'probe' ? probeCard?.models.find((m) => m.modelId === dialog.modelId) : undefined;

  return (
    <>
      <Lede first title={CLOUD_COPY.heading[capability]} desc={CLOUD_COPY.lede[capability]} />
      {web ? <p className={webNote}>{CLOUD_COPY.webNote}</p> : null}
      <Card label={CLOUD_COPY.defaultLabel[capability]}>
        <SettingRow label={CLOUD_COPY.defaultLabel[capability]} desc={CLOUD_COPY.defaultDesc[capability]}>
          <Picker
            aria-label={CLOUD_COPY.defaultLabel[capability]}
            size="S"
            align="end"
            menuWidth={300}
            selectedKey={picker.selectedKey}
            disabledKeys={[EMPTY_KEY]}
            isDisabled={web || busy || !connected}
            onSelectionChange={(key) => {
              if (key !== null && key !== picker.selectedKey && key !== EMPTY_KEY) void choose(String(key));
            }}>
            {picker.sections.map((section) =>
              section.title ? (
                <PickerSection key={section.key} id={sectionId(section.key)}>
                  <Header>
                    <Heading>{section.title}</Heading>
                  </Header>
                  {section.items.map(pickerOption)}
                </PickerSection>
              ) : (
                <PickerSection key={section.key} id={sectionId(section.key)} aria-label={section.items[0]?.label}>
                  {section.items.map(pickerOption)}
                </PickerSection>
              ),
            )}
            {picker.empty ? (
              <PickerSection id={sectionId('empty')} aria-label={CLOUD_COPY.pickerEmpty.other}>
                {pickerOption({ key: EMPTY_KEY, label: capability === 'generateImage' ? CLOUD_COPY.pickerEmpty.image : CLOUD_COPY.pickerEmpty.other })}
              </PickerSection>
            ) : null}
          </Picker>
        </SettingRow>
        {capability === 'generateText' ? <TextParamRows view={view} connected={connected} /> : null}
      </Card>

      <Lede
        title={CLOUD_COPY.providers}
        desc={CLOUD_COPY.providersDesc + CLOUD_COPY.providersExtra[capability]}
        action={
          <Button variant="secondary" size="S" isDisabled={web || !connected} onPress={() => setDialog({ kind: 'custom' })}>
            <AddIcon />
            <Text>{CLOUD_COPY.addCustom}</Text>
          </Button>
        }
      />
      {capability === 'generateImage' ? <CodexImageCard codex={codex} isDefault={defaultRef?.providerId === CODEX_IMAGE_PROVIDER} /> : null}
      {cards.length ? (
        cards.map((card) => (
          <ProviderCard
            key={card.providerId}
            card={card}
            capability={capability}
            defaultRef={defaultRef}
            expanded={expanded.has(card.providerId)}
            probes={Object.fromEntries(
              card.models.flatMap((m) => {
                const state = liveState(runKey(card.providerId, m.modelId));
                return state ? [[m.modelId, state] as const] : [];
              }),
            )}
            onToggle={() => toggle(card.providerId)}
            onKey={() => setDialog({ kind: 'key', providerId: card.providerId })}
            onAddModel={() => setDialog({ kind: 'model', providerId: card.providerId, label: card.label, capability })}
            onProbe={(model) => setDialog({ kind: 'probe', providerId: card.providerId, modelId: model.modelId })}
            refreshing={refreshing === card.providerId}
            refreshBusy={refreshing !== null}
            onRefresh={() => void refresh(card.providerId)}
          />
        ))
      ) : (
        <PageStatus>{CLOUD_COPY.emptyProviders}</PageStatus>
      )}

      {keyCard ? (
        <KeyDialog
          key={keyCard.providerId}
          card={keyCard}
          onClose={() => setDialog(null)}
          onSaved={() => {
            if (refreshAfterKey(keyCard)) void refresh(keyCard.providerId);
          }}
        />
      ) : null}
      {dialog?.kind === 'custom' ? (
        <CustomProviderDialog
          view={view}
          initialCapability={capability}
          onClose={() => setDialog(null)}
          onAdded={(providerId, next) => {
            setDialog(null);
            expand(providerId);
            showCapability(next);
          }}
          onUseExisting={(providerId, modelId, next) => {
            const label = cards.find((c) => c.providerId === providerId)?.label ?? providerId;
            setDialog({ kind: 'model', providerId, label, modelId, capability: next });
          }}
        />
      ) : null}
      {dialog?.kind === 'model' ? (
        <AddModelDialog
          view={view}
          providerId={dialog.providerId}
          label={dialog.label}
          initialModelId={dialog.modelId}
          initialCapability={dialog.capability}
          onClose={() => setDialog(null)}
          onAdded={(next) => {
            expand(dialog.providerId);
            setDialog(null);
            showCapability(next);
          }}
        />
      ) : null}
      {probeCard && probeModel ? (
        <ProbeDialog
          capability={capability}
          providerLabel={probeCard.label}
          model={probeModel}
          state={liveState(runKey(probeCard.providerId, probeModel.modelId)) ?? { status: 'ready' }}
          onStart={(voice) => void runProbe(probeCard.providerId, probeModel, voice)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
