import { useEffect, useMemo, useState } from 'react';
import {
  MAX_SELECTED_GLOSSARIES,
  type DocumentRecord,
  type Id,
  type LibraryEntrySummary,
  type LibrarySelection,
  type ModelBundleStatus,
} from '@cuccut/protocol';
import {
  Button,
  Checkbox,
  Disclosure,
  DisclosurePanel,
  DisclosureTitle,
  Header,
  Heading,
  Picker,
  PickerItem,
  PickerSection,
  ProgressBar,
  Text,
  TextArea,
  ToastQueue,
} from '@react-spectrum/s2';
import DownloadIcon from '@react-spectrum/s2/icons/Download';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { entryKey } from '../../model/library-entry.ts';
import { isLocalProvider } from '../../model/models-cloud.ts';
import { downloadableBundle, downloadView, inlineInstallMode } from '../../model/models-install.ts';
import {
  budgetLine,
  DEFAULT_TRANSCRIBE_SETUP,
  effectiveLanguage,
  hintBlock,
  hintBudget,
  languageChoices,
  modelFacts,
  pickModel,
  setupSummary,
  TRANSCRIBE_HINT_MAX,
  transcribeGlossaryRows,
  transcribeModelOptions,
  transcribeRequestOptions,
  type GlossaryContentState,
  type TranscribeModelOption,
  type TranscribeOptions,
} from '../../model/transcribe-setup.ts';
import { toggleGlossary } from '../../model/translate-setup.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { getLibraryEntry } from '../../runtime/library-commands.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useLibrary } from '../../state/library-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { InstallDialog } from '../models/install-dialog.tsx';
import { SectionLink } from '../tools/tool-parts.tsx';
import { GATE_COPY } from '../tools/tools-copy.ts';
import { useEditorActions } from './editor-context.tsx';
import { TRANSCRIBE_SETUP_COPY as C } from './transcribe-copy.ts';
import { patchSetup, useSubtitleRun } from './transcribe-run.ts';

const disclosure = style({ width: 'full' });
/** Content of the title button is laid out horizontally; the title and summary are wrapped into a vertical block, with the summary on its own line. */
const titleStack = style({ display: 'flex', flexDirection: 'column', alignItems: 'start', minWidth: 0, textAlign: 'start' });
const summary = style({ marginTop: 2, font: 'ui-xs', fontWeight: 'normal', color: 'gray-600' });
const panelBody = style({ display: 'flex', flexDirection: 'column', minWidth: 0 });
/** Subheading of a section (same look as the translation settings page). */
const secHead = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 });
const secTitle = style({ flexGrow: 1, margin: 0, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const hint = style({ margin: 0, marginTop: '[6px]', font: 'ui-xs', color: { default: 'gray-600', isWarn: 'orange-1000' }, lineHeight: '[1.5]' });
const blocked = style({ margin: 0, marginBottom: 8, font: 'ui-xs', color: 'gray-700', lineHeight: '[1.5]' });
const field = style({ width: 'full' });
const pendingLine = style({ display: 'flex', flexDirection: 'column', gap: 4, marginTop: '[6px]' });
const downloadRow = style({ display: 'flex', marginTop: 8 });
const glossaryList = style({ display: 'flex', flexDirection: 'column', gap: 4 });
const glossaryRow = style({ display: 'flex', flexDirection: 'column', minWidth: 0 });
const glossaryMeta = style({ paddingStart: 24, font: 'ui-xs', color: { default: 'gray-600', isOff: 'orange-1000' } });

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** This video's transcription settings (defaults if untouched) and the model that will be used this time. */
function useSetup(videoId: Id) {
  const view = useModels((s) => s.capabilities);
  const setup = useSubtitleRun((s) => s.setups[videoId]) ?? DEFAULT_TRANSCRIBE_SETUP;
  const options = useMemo(() => (view ? transcribeModelOptions(view) : []), [view]);
  const picked = pickModel(options, setup.model, view?.transcribe.effective ?? null);
  return { view, setup, options, picked };
}

/** Options given to `models.transcribe` by “Generate subtitles”. Empty when the settings are untouched, so all defaults are used, as before. */
export function useTranscribeRequest(videoId: Id): TranscribeOptions {
  const { setup, picked } = useSetup(videoId);
  return transcribeRequestOptions(setup, picked);
}

/** Contents of the library's transcription glossary (the summary has no language or spelling). Read per version (`library-commands` caches it); when the version changes, the previous one is kept meanwhile. */
function useGlossaryContents(runtime: RuntimeSession, summaries: readonly LibraryEntrySummary[]): Record<Id, GlossaryContentState> {
  const list = useMemo(() => summaries.filter((s) => s.kind === 'transcription'), [summaries]);
  const signature = list.map(entryKey).join('|');
  const [contents, setContents] = useState<Record<Id, GlossaryContentState>>({});
  useEffect(() => {
    if (!list.length) return;
    let live = true;
    void Promise.all(
      list.map((summary) =>
        getLibraryEntry(runtime, summary).then(
          ({ content }): [Id, GlossaryContentState] => [summary.id, 'kind' in content && content.kind === 'transcription' ? content : null],
          (): [Id, GlossaryContentState] => [summary.id, null],
        ),
      ),
    ).then((pairs) => {
      if (live) setContents(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
    // signature summarizes the list.
  }, [runtime, signature]);
  return contents;
}

/**
 * Entries enabled in the video (`library.getVideoSelection`). Re-read following the version of the `library-selection` document in the video, so undo and changes made elsewhere are picked up (same approach as the translation settings page). When the version changes and the new one hasn't been read back yet, the previous one is used, so the checkboxes don't flicker.
 */
function useVideoSelection(runtime: RuntimeSession, videoId: Id, documents: Record<Id, DocumentRecord>) {
  const doc = Object.values(documents).find((d) => d.kind === 'library-selection');
  const key = `${videoId}:${doc?.id ?? ''}:${doc?.currentRevision ?? ''}`;
  const [state, setState] = useState<{ selection: LibrarySelection | null; error: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    runtime.getVideoSelection(videoId).then(
      (result) => alive && setState({ selection: result.selection, error: null }),
      (error) => alive && setState({ selection: null, error: messageOf(error) }),
    );
    return () => {
      alive = false;
    };
  }, [runtime, videoId, key]);
  return state;
}

interface ProviderGroup {
  providerId: string;
  provider: string;
  items: TranscribeModelOption[];
}

/** How a downloadable model pack is downloaded in place: “Download {size}”, “Continue download…” if stopped halfway, and progress while downloading. */
function downloadAction(bundle: ModelBundleStatus): string {
  const view = downloadView(bundle);
  if (view.state === 'running') return GATE_COPY.downloading(view.percent);
  return view.state === 'paused' ? GATE_COPY.resume : view.size ? GATE_COPY.downloadSize(view.size) : GATE_COPY.downloadButton;
}

/** The line under an item in the menu. If it isn't installed yet and can be downloaded on this computer, it says how to download after the reason; otherwise it gives the reason. */
function itemNote(o: TranscribeModelOption, bundle: ModelBundleStatus | null): string | null {
  if (!bundle) return o.why;
  return o.why ? `${o.why} · ${downloadAction(bundle)}` : downloadAction(bundle);
}

function groups(options: readonly TranscribeModelOption[]): ProviderGroup[] {
  const out: ProviderGroup[] = [];
  for (const o of options) {
    const g = out.find((x) => x.providerId === o.providerId);
    if (g) g.items.push(o);
    else out.push({ providerId: o.providerId, provider: o.provider, items: [o] });
  }
  return out;
}

/**
 * Transcription settings for “Generate subtitles” in the subtitle panel (prototype tool-transcribe.jsx: speech model and language; glossary-tool.jsx `AsrHintBlock`):
 * when collapsed, only one summary line shows. Clicking “Generate subtitles” without touching it uses the defaults. The settings are kept per video in `useSubtitleRun.setups`.
 * Glossary checkboxes are written to the video (`library.setVideoSelection`, a reversible edit) and used in every future transcription.
 */
export function TranscribeSettings({ videoId, documents, editable }: { videoId: Id; documents: Record<Id, DocumentRecord>; editable: boolean }) {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const { undo } = useEditorActions();
  const { view, setup, options, picked } = useSetup(videoId);
  const option = picked.option;
  const patch = (next: Partial<typeof setup>) => patchSetup(videoId, DEFAULT_TRANSCRIBE_SETUP, next);

  const libraryReady = useLibrary((s) => s.ready);
  const library = useLibrary((s) => s.glossaries);
  const contents = useGlossaryContents(runtime, library);
  const selection = useVideoSelection(runtime, videoId, documents);
  const enabled = selection?.selection?.glossaries.transcribe ?? [];
  const rows = transcribeGlossaryRows(library, contents, enabled);
  const used = rows.filter((r) => r.used);
  const [writing, setWriting] = useState(false);

  const language = effectiveLanguage(setup.language, option);
  const languages = languageChoices(option);
  const blockedBy = view ? hintBlock(option, options) : null;
  const usedContents = used.map((r) => contents[r.id]).filter((c): c is NonNullable<GlossaryContentState> => !!c);
  const budget = hintBudget(setup.prompt, usedContents);

  // A local model that isn't installed is not greyed out (design draft panel-aitools.jsx). Clicking it first goes through the install dialog, and it is selected automatically once downloaded; if it is already downloading, clicking just waits.
  // When the selected one isn't installed, a “Download {size}” line appears below the dropdown (with progress while downloading), and no reselecting is needed after the download.
  const bundles = useModels((s) => s.bundles);
  const jobs = useJobs((s) => s.jobs);
  const [installing, setInstalling] = useState<{
    option: TranscribeModelOption;
    bundle: ModelBundleStatus;
    /** Weights are already present and only the shared components are missing: the fill-in is done by completing the install (`inlineInstallMode`), decided when opened. */
    mode: 'install' | 'complete';
  } | null>(null);
  const [pending, setPending] = useState<{ key: string; jobId: Id | null } | null>(null);
  const pendingOption = pending ? (options.find((o) => o.key === pending.key) ?? null) : null;
  const pendingBundle = pendingOption ? (bundles.find((b) => b.bundleId === pendingOption.modelId) ?? null) : null;
  const pendingJob = pending?.jobId ? jobs.find((j) => j.jobId === pending.jobId) : undefined;
  const pendingFailed = !!pendingJob && !isJobLive(pendingJob) && pendingJob.state !== 'completed';
  useEffect(() => {
    if (!pending) return;
    if (pendingOption?.usable) {
      setPending(null);
      if (pendingOption.key !== option?.key) patch({ model: pendingOption.key, language: effectiveLanguage(setup.language, pendingOption) });
    } else if (!pendingOption || pendingFailed) setPending(null);
    // Only follows whether the model being waited on is usable, or whether its download failed; the patch is new on every render.
  }, [pending, pendingOption?.usable, pendingFailed]);
  const download = (o: TranscribeModelOption, bundle: ModelBundleStatus) => {
    if (downloadView(bundle).state !== 'running') setInstalling({ option: o, bundle, mode: inlineInstallMode(bundle, bundles) });
    else if (o.key !== option?.key) setPending({ key: o.key, jobId: bundle.install?.jobId ?? null });
  };
  const disabledKeys = options.filter((o) => !o.usable && o.key !== option?.key && !downloadableBundle(bundles, o)).map((o) => o.key);
  const selectedDownload = option && !pending ? downloadableBundle(bundles, option) : null;
  const pendingProgress = pendingBundle ? downloadView(pendingBundle) : null;
  const selectedProgress = selectedDownload ? downloadView(selectedDownload) : null;
  const toModels = () =>
    go({ tab: 'models', category: 'asr', page: view && option && !isLocalProvider(view, 'transcribe', option.providerId) ? 'cloud' : 'local' });

  const toggle = async (id: Id, name: string, on: boolean) => {
    const next = toggleGlossary(enabled, id, on);
    if (!next) {
      if (on && enabled.length >= MAX_SELECTED_GLOSSARIES) ToastQueue.neutral(C.glossaryLimit(MAX_SELECTED_GLOSSARIES), { timeout: 4000 });
      return;
    }
    setWriting(true);
    try {
      const result = await runtime.setVideoSelection({ videoId, glossaries: { transcribe: next } });
      ToastQueue.positive(on ? C.glossaryOn(name) : C.glossaryOff(name), {
        timeout: 5000,
        actionLabel: C.undo,
        onAction: () => void undo({ transaction: result.receipt.transactionId }),
        shouldCloseOnAction: true,
      });
    } catch (error) {
      ToastQueue.negative(C.glossaryWriteFailed(messageOf(error)), { timeout: 5000 });
    } finally {
      setWriting(false);
    }
  };

  return (
    <Disclosure isQuiet size="S" styles={disclosure}>
      <DisclosureTitle>
        <span className={titleStack}>
          <span>{C.title}</span>
          <span className={summary}>{view ? setupSummary(setup, picked, used.length, !!blockedBy) : C.modelsLoading}</span>
        </span>
      </DisclosureTitle>
      <DisclosurePanel>
        <div className={panelBody}>
          <div className={secHead}>
            <h4 className={secTitle}>{C.model}</h4>
            <SectionLink onPress={toModels}>{C.manageModels}</SectionLink>
          </div>
          {!view ? (
            <p className={hint({})}>{C.modelsLoading}</p>
          ) : (
            <>
              <Picker
                aria-label={C.model}
                size="S"
                styles={field}
                menuWidth={300}
                placeholder={C.noDefault}
                isDisabled={!options.length}
                selectedKey={option?.key ?? null}
                disabledKeys={disabledKeys}
                onSelectionChange={(key) => {
                  const next = options.find((o) => o.key === key);
                  if (!next || next.key === option?.key) return;
                  const bundle = downloadableBundle(bundles, next);
                  if (bundle) download(next, bundle);
                  else {
                    // A usable one was switched to manually: no longer waits to auto-select after the download (the download still continues).
                    setPending(null);
                    patch({ model: next.key, language: effectiveLanguage(setup.language, next) });
                  }
                }}>
                {groups(options).map((g) => (
                  <PickerSection key={g.providerId} id={`provider:${g.providerId}`}>
                    <Header>
                      <Heading>{g.provider}</Heading>
                    </Header>
                    {g.items.map((o) => (
                      <PickerItem key={o.key} id={o.key} textValue={`${o.provider} · ${o.label}`}>
                        <Text slot="label">{o.label}</Text>
                        {itemNote(o, downloadableBundle(bundles, o)) ? (
                          <Text slot="description">{itemNote(o, downloadableBundle(bundles, o))}</Text>
                        ) : null}
                      </PickerItem>
                    ))}
                  </PickerSection>
                ))}
              </Picker>
              {pending && pendingOption ? (
                <div className={pendingLine} role="status">
                  <p className={hint({})}>{C.downloadThenSelect(pendingOption.label, pendingProgress?.percent ?? null)}</p>
                  <ProgressBar
                    size="S"
                    aria-label={C.downloadThenSelect(pendingOption.label, null)}
                    isIndeterminate={pendingProgress?.percent == null}
                    {...(pendingProgress?.percent == null ? {} : { value: pendingProgress.percent })}
                    styles={field}
                  />
                </div>
              ) : (
                <>
                  <p className={hint({ isWarn: !!option && !option.usable })}>{modelFacts(picked)}</p>
                  {selectedDownload && option && selectedProgress?.state === 'running' ? (
                    <div className={pendingLine} role="status">
                      <p className={hint({})}>{GATE_COPY.downloading(selectedProgress.percent)}</p>
                      <ProgressBar
                        size="S"
                        aria-label={GATE_COPY.downloading(null)}
                        isIndeterminate={selectedProgress.percent === null}
                        {...(selectedProgress.percent === null ? {} : { value: selectedProgress.percent })}
                        styles={field}
                      />
                    </div>
                  ) : selectedDownload && option ? (
                    <div className={downloadRow}>
                      <Button variant="secondary" size="S" onPress={() => download(option, selectedDownload)}>
                        <DownloadIcon />
                        <Text>{downloadAction(selectedDownload)}</Text>
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
              {installing ? (
                <InstallDialog
                  bundleId={installing.bundle.bundleId}
                  name={installing.option.label}
                  license={installing.bundle.license ?? null}
                  mode={installing.mode}
                  onClose={() => setInstalling(null)}
                  // When downloading the one already selected, there is no need to wait to select it; the “Start download” hint shows as usual.
                  {...(installing.option.key === option?.key
                    ? {}
                    : {
                        onStarted: (jobId: Id) => {
                          setInstalling(null);
                          setPending({ key: installing.option.key, jobId });
                          ToastQueue.neutral(C.downloadThenSelect(installing.option.label, null), { timeout: 4000 });
                        },
                      })}
                />
              ) : null}
            </>
          )}

          <div className={secHead}>
            <h4 className={secTitle}>{C.language}</h4>
          </div>
          <Picker
            aria-label={C.language}
            size="S"
            styles={field}
            items={languages}
            selectedKey={language}
            onSelectionChange={(key) => key !== null && patch({ language: String(key) })}>
            {(l) => <PickerItem id={l.key}>{l.label}</PickerItem>}
          </Picker>

          <div className={secHead}>
            <h4 className={secTitle}>{C.hint}</h4>
            <SectionLink onPress={() => go({ tab: 'settings', section: 'glossary' })}>{C.manageGlossary}</SectionLink>
          </div>
          {blockedBy ? <p className={blocked}>{blockedBy}</p> : null}
          <div className={secHead}>
            <h5 className={secTitle}>{C.glossary}</h5>
          </div>
          {selection?.error ? (
            <p className={hint({})}>{C.glossaryFailed(selection.error)}</p>
          ) : !libraryReady || !selection ? (
            <p className={hint({})}>{C.glossaryLoading}</p>
          ) : !rows.length ? (
            <p className={hint({})}>{C.glossaryEmpty}</p>
          ) : (
            <div className={glossaryList}>
              {rows.map((row) => (
                <div key={row.id} className={glossaryRow}>
                  <Checkbox
                    size="S"
                    isSelected={row.enabled}
                    isDisabled={!editable || writing || !!blockedBy}
                    onChange={(on) => void toggle(row.id, row.name, on)}>
                    {row.name}
                  </Checkbox>
                  {row.meta ? <span className={glossaryMeta({ isOff: row.enabled && !row.used })}>{row.meta}</span> : null}
                </div>
              ))}
            </div>
          )}
          <p className={hint({})}>{editable ? C.glossaryNote : C.glossaryReadOnly}</p>

          <div className={secHead}>
            <h5 className={secTitle}>{C.prompt}</h5>
          </div>
          <TextArea
            aria-label={C.prompt}
            size="S"
            styles={field}
            placeholder={C.promptPlaceholder}
            value={setup.prompt}
            maxLength={TRANSCRIBE_HINT_MAX}
            isDisabled={!!blockedBy}
            onChange={(prompt) => patch({ prompt })}
          />
          {blockedBy ? null : (
            <>
              <p className={hint({})}>{C.how}</p>
              {option ? <p className={hint({ isWarn: budget.dropped > 0 })}>{budgetLine(option.label, budget)}</p> : null}
            </>
          )}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
