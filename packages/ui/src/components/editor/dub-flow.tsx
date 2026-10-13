import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DocumentRecord,
  DubOriginalAudio,
  DubParams,
  Id,
  LibraryEntrySummary,
  SpeakerVoiceBinding,
  SpeechModelInfo,
  TextModelInfo,
} from '@cuccut/protocol';
import {
  Button,
  Content,
  Heading,
  InlineAlert,
  NumberField,
  Picker,
  PickerItem,
  ProgressBar,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Text,
  TextArea,
  TextField,
  ToastQueue,
} from '@react-spectrum/s2';
import DownloadIcon from '@react-spectrum/s2/icons/Download';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { guessLanguage } from '../../model/cue-edit.ts';
import {
  choiceKeyOf,
  clampDuckDb,
  DEFAULT_DUCK_DB,
  defaultDubLanguage,
  DUB_STYLE_MAX,
  dubLanguageOptions,
  dubParams,
  DUCK_DB_MAX,
  DUCK_DB_MIN,
  speakerRows,
  speechSpeakers,
  voiceChoices,
  voiceName,
  withBinding,
  type SpeakerRow,
  type VoiceChoice,
} from '../../model/dub-setup.ts';
import { downloadView, inlineInstallMode, separationDownload } from '../../model/models-install.ts';
import { bundleName } from '../../model/models-local.ts';
import { textModelLine } from '../../model/models-text.ts';
import { cloudModelOptions, findOption, initialModelKey, langName, parseModelKey, type ToolModelOption } from '../../model/tools-models.ts';
import { speechModelLine } from '../../model/tools-tts.ts';
import { existingTranslations } from '../../model/translate-setup.ts';
import { isStale, pairRows, readTranslation, speechSentences } from '../../model/translation-doc.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { useVoices } from '../../state/voices-store.ts';
import { InstallDialog } from '../models/install-dialog.tsx';
import { ModelGate, ModelLine } from '../tools/tool-model.tsx';
import { SectionLink } from '../tools/tool-parts.tsx';
import { GATE_COPY } from '../tools/tools-copy.ts';
import { DUB_COPY as C, DUB_SPEAKER_SOURCE } from './dub-copy.ts';
import { awaitDubInstall, bindDub, startDub, useDubRun, type DubDeps, type DubIntent } from './dub-run.ts';
import { DubNotices, DubRunHead, useDubLive } from './dub-status.tsx';
import { useEditorActions } from './editor-context.tsx';
import { PanelHead } from './panel-head.tsx';
import { useDocumentBody } from './use-document-body.ts';
import { GlossarySection, useVideoSelection } from './translate-flow.tsx';
import { EDITOR_COPY as E } from './editor-copy.ts';

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 4, paddingBottom: 16 });
/** A section subheading (design SecHead). */
const secHead = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 });
const secTitle = style({ flexGrow: 1, margin: 0, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const secAside = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-600' });
const summary = style({ margin: 0, marginTop: 12, font: 'ui-sm', color: 'gray-800', lineHeight: '[1.5]' });
const hint = style({ margin: 0, marginTop: '[6px]', font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const warn = style({ margin: 0, marginTop: '[6px]', font: 'ui-xs', color: 'orange-1000', lineHeight: '[1.5]' });
const field = style({ width: 'full' });
const customField = style({ width: 'full', marginTop: 8 });
const duckField = style({ width: 112 });
const unit = style({ font: 'ui-sm', color: 'gray-700' });
const row = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 });
const rowLabel = style({ flexShrink: 0, width: 64, font: 'ui-sm', color: 'gray-700' });
const speakerList = style({ display: 'flex', flexDirection: 'column', gap: 12 });
const speakerCard = style({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 });
const speakerHead = style({ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 });
const speakerName = style({
  flexGrow: 1,
  minWidth: 0,
  font: 'ui-sm',
  fontWeight: 'bold',
  color: 'gray-900',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const speakerMeta = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-600' });
const effective = style({ font: 'ui-xs', color: 'gray-700' });
const footer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '[6px]',
  flexShrink: 0,
  paddingX: 12,
  paddingY: 12,
  borderTopWidth: 1,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const alertActions = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 });
const blankTop = style({ marginTop: 12 });
const gateTop = style({ marginTop: 8 });
const progressRow = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui-sm', color: 'gray-800' });
const progressBar = style({ width: 120 });

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A notice when dubbing finishes or bindings change: a success notice has “Undo”. */
const dubToast: DubDeps['toast'] = (kind, message, undo) =>
  ToastQueue[kind](message, undo ? { timeout: 5000, actionLabel: E.undo, onAction: undo, shouldCloseOnAction: true } : { timeout: 5000 });

/** Text model: translation needs structured output; unsupported models are listed but marked as unusable (the Runtime also rejects them; same as the translation settings page). */
function translateModelOptions(options: ToolModelOption<TextModelInfo>[]): ToolModelOption<TextModelInfo>[] {
  return options.map((o) => (o.usable && o.info.structuredOutput === false ? { ...o, usable: false, why: C.noStructured } : o));
}

/** The number of stale sentences in the existing translation (marked stale, or the source sentence has changed): the Runtime does not synthesize them. null while still computing, or for a translation that is not `/2`. */
function useStaleUnits(speechBody: unknown, translation: DocumentRecord | null): number | null {
  const translationBody = useDocumentBody(translation ?? undefined);
  return useMemo(() => {
    if (!translation || speechBody === undefined) return null;
    const sentences = speechSentences(speechBody);
    const parsed = readTranslation(translationBody);
    if (!sentences || !parsed) return null;
    return pairRows(sentences, parsed).filter((r) => r.unit && isStale(r.state)).length;
  }, [translation, speechBody, translationBody]);
}

/**
 * Tool page › Translated voice-over (design panel-dub-setup.jsx `DubSetup`): which language to dub into (use an existing translation, or translate first), the source, the voice model, the default voice, per-speaker voice bindings, the mix (lower / mute / leave the original; separating the background is not available in the first version), the model used for translation with its style and glossary. “Dub into X” submits `pipelines.start` (`dub`). Authorization, progress, failures and receipts are shown at the top of this page (dub-status.tsx).
 * In CucCut opened in a browser there is no fixed flow, so only the reason is stated.
 */
export function DubFlow({
  videoId,
  documents,
  onBack,
  onStarted,
}: {
  videoId: Id;
  documents: Record<Id, DocumentRecord>;
  onBack(): void;
  /** Submitted successfully (a task ID was received). */
  onStarted?(): void;
}) {
  const runtime = useRuntime();
  useEffect(() => bindDub({ runtime, toast: dubToast }), [runtime]);
  if (runtime.host.platform === 'web') {
    return (
      <>
        <PanelHead title={C.title} back={{ label: C.back, onPress: onBack }} />
        <div className={body}>
          <div className={blankTop}>
            <InlineAlert variant="informative">
              <Heading>{C.web}</Heading>
              <Content>{C.webBody}</Content>
            </InlineAlert>
          </div>
        </div>
      </>
    );
  }
  return <DubSetupPage runtime={runtime} videoId={videoId} documents={documents} onBack={onBack} onStarted={onStarted} />;
}

function DubSetupPage({
  runtime,
  videoId,
  documents,
  onBack,
  onStarted,
}: {
  runtime: RuntimeSession;
  videoId: Id;
  documents: Record<Id, DocumentRecord>;
  onBack(): void;
  onStarted?(): void;
}) {
  const go = useShell((s) => s.go);
  const editable = useVideo((s) => canEdit(s.video));
  const videoName = useVideo((s) => s.video?.state?.video.name ?? s.video?.ref?.name ?? null);
  const live = useDubLive(videoId);
  const granting = useDubRun((s) => s.asks[videoId]?.status === 'granting');
  const busy = !!live || granting;

  // ---- Source ----
  const speeches = useMemo(() => Object.values(documents).filter((d) => d.kind === 'speech' && !!d.sourceAssetId), [documents]);
  const [speechId, setSpeechId] = useState<Id | null>(null);
  const speech = speeches.find((d) => d.id === speechId) ?? speeches[0] ?? null;
  const speechBody = useDocumentBody(speech ?? undefined);
  const sentences = useMemo(() => (speechBody === undefined ? undefined : speechSentences(speechBody)), [speechBody]);
  const text = useMemo(() => (sentences ?? []).map((s) => s.text).join('\n'), [sentences]);
  const sourceLanguage = speech?.language ?? (text ? (guessLanguage(text.slice(0, 2000)) ?? null) : null);
  const speakers = useMemo(() => (speechBody === undefined ? [] : speechSpeakers(speechBody)), [speechBody]);
  const speakerNames = useMemo(() => new Map(speakers.map((s) => [s.speakerId, s.name])), [speakers]);

  // ---- Language ----
  const languages = useMemo(
    () => dubLanguageOptions(sourceLanguage, speech ? existingTranslations(documents, speech.id) : []),
    [sourceLanguage, speech, documents],
  );
  const [languagePick, setLanguagePick] = useState<string | null>(null);
  const languageKey = languages.find((o) => o.key === languagePick && !o.disabled)?.key ?? defaultDubLanguage(languages, sourceLanguage);
  const language = languages.find((o) => o.key === languageKey) ?? null;
  const needTranslate = !!language && language.translationId === null;
  const translation = language?.translationId ? (documents[language.translationId] ?? null) : null;
  const staleUnits = useStaleUnits(speechBody, translation);

  // ---- Voice model and default voice ----
  const view = useModels((s) => s.capabilities);
  const voiceModels = useMemo(() => (view ? cloudModelOptions(view, 'synthesizeSpeech') : []), [view]);
  const [voiceModelKey, setVoiceModelKey] = useState<string | null>(null);
  const voiceModel = findOption(voiceModels, initialModelKey(voiceModels, voiceModelKey, view?.synthesizeSpeech.effective ?? null));
  const voiceReady = !!voiceModel?.usable;
  const info: SpeechModelInfo | null = voiceModel?.info ?? null;
  const providerId = voiceModel?.providerId ?? null;
  const providerLabel = voiceModel?.provider ?? C.providerFallback;
  const library = useVoices((s) => s.voices);
  const toTts = () => go({ tab: 'models', category: 'tts', page: 'cloud' });
  const toVoices = () => go({ tab: 'models', category: 'tts', page: 'voices' });
  const voiceSection = useRef<HTMLDivElement>(null);

  const paramChoices = useMemo(
    () => voiceChoices({ info, providerId, providerLabel, library, defaultLabel: C.voiceDefault, forParams: true }),
    [info, providerId, providerLabel, library],
  );
  const [voicePick, setVoicePick] = useState<string>('default');
  const [customVoice, setCustomVoice] = useState('');
  const voiceChoice = paramChoices.find((c) => c.key === voicePick && !c.disabled) ?? paramChoices.find((c) => !c.disabled) ?? null;
  const paramVoice = voiceChoice?.key === 'custom' ? customVoice.trim() || null : (voiceChoice?.voice ?? null);

  // ---- Translation ----
  const textModels = useMemo(() => (view ? translateModelOptions(cloudModelOptions(view, 'generateText')) : []), [view]);
  const [textModelKey, setTextModelKey] = useState<string | null>(null);
  const textModel = findOption(textModels, initialModelKey(textModels, textModelKey, view?.generateText.effective ?? null));
  const textReady = !!textModel?.usable;
  const toLlm = () => go({ tab: 'models', category: 'llm', page: 'cloud' });
  const textSection = useRef<HTMLDivElement>(null);
  const [styleHint, setStyleHint] = useState('');

  // ---- Mix ----
  const [originalAudio, setOriginalAudio] = useState<DubOriginalAudio>('duck');
  const [duckDb, setDuckDb] = useState(DEFAULT_DUCK_DB);
  // Separate background sound: when untouched, it follows whether a usable separation model is installed locally (on if so, the design's default-on).
  const separateReady = !!view?.separateAudio.effective;
  const [separatePick, setSeparatePick] = useState<boolean | null>(null);
  const separate = separatePick ?? separateReady;
  const toSeparate = () => go({ tab: 'models', category: 'sep', page: 'local' });
  // Separation is on, the local separation model is not installed, and this computer can download it: the gate card says which model to download, and the primary button “Download model and set up…” downloads it first, then starts (design panel-dub-setup.jsx).
  const bundles = useModels((s) => s.bundles);
  const sepBundle = useMemo(() => (separateReady ? null : separationDownload(bundles)), [separateReady, bundles]);
  const sepDownload = separate && sepBundle ? sepBundle : null;
  const sepView = sepDownload ? downloadView(sepDownload) : null;
  const sepWait = useDubRun((s) => s.installs[videoId] ?? null);
  // If the weights are present and only the shared components are missing, the separation model goes through a completion install (`inlineInstallMode`), decided when the dialog opens.
  const [sepConfirm, setSepConfirm] = useState<{ params: DubParams; intent: DubIntent; mode: 'install' | 'complete' } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  if (!speech) {
    return (
      <>
        <PanelHead title={C.title} back={{ label: C.back, onPress: onBack }} />
        {live ? <DubRunHead live={live} /> : null}
        <div className={body}>
          <DubNotices videoId={videoId} videoName={videoName} speakerNames={speakerNames} flush />
          <div className={blankTop}>
            <InlineAlert variant="informative">
              <Heading>{C.noSpeechTitle}</Heading>
              <Content>{C.noSpeech}</Content>
            </InlineAlert>
          </div>
        </div>
      </>
    );
  }

  const languageLabel = language ? langName(language.language) : null;
  const sentenceCount = sentences ? sentences.length : null;

  const start = async () => {
    if (!language || busy || submitting || sepWait || !editable) return;
    // Do not gray out the button: say clearly what is missing and bring that section into view (same as the translation settings page).
    if (!voiceReady) {
      voiceSection.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      ToastQueue.neutral(voiceModels.length ? (voiceModel?.why ?? C.ttsMissingTitle) : C.ttsMissingTitle, { timeout: 4000 });
      return;
    }
    if (voiceChoice?.key === 'custom' && !paramVoice) {
      voiceSection.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      ToastQueue.neutral(C.voiceCustomEmpty, { timeout: 4000 });
      return;
    }
    if (needTranslate && !textReady) {
      textSection.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      ToastQueue.neutral(textModels.length ? (textModel?.why ?? C.textMissingTitle) : C.textMissingTitle, { timeout: 4000 });
      return;
    }
    const voiceKey = voiceModel ? parseModelKey(voiceModel.key) : null;
    const textKey = needTranslate && textModel ? parseModelKey(textModel.key) : null;
    const params = dubParams({
      videoId,
      speechDocumentId: speech.id,
      translationId: language.translationId,
      targetLanguage: language.language,
      voiceModel: voiceKey ? { providerId: voiceKey.providerId, modelId: voiceKey.modelId } : null,
      voice: paramVoice,
      textModel: textKey ? { providerId: textKey.providerId, modelId: textKey.modelId } : null,
      style: styleHint,
      originalAudio,
      duckDb,
      separateBackground: separate,
    });
    const intent: DubIntent = { videoId, language: language.language, videoName };
    if (sepDownload) {
      // Already downloading (started on the settings page): wait for it to finish; otherwise go through the install dialog first, and after submitting the download, wait.
      const jobId = sepView?.state === 'running' ? sepDownload.install?.jobId : null;
      if (jobId) awaitDubInstall(jobId, params, intent);
      else setSepConfirm({ params, intent, mode: inlineInstallMode(sepDownload, bundles) });
      return;
    }
    setSubmitting(true);
    const jobId = await startDub(params, intent);
    setSubmitting(false);
    if (jobId) onStarted?.();
  };

  return (
    <>
      <PanelHead title={C.title} back={{ label: C.back, onPress: onBack }} />
      {live ? <DubRunHead live={live} /> : null}
      <div className={`${body} cc-scroll`}>
        <DubNotices videoId={videoId} videoName={videoName} speakerNames={speakerNames} flush />
        {languageLabel ? <p className={summary}>{C.summary(languageLabel, sentenceCount, needTranslate)}</p> : null}

        <div className={secHead}>
          <h3 className={secTitle}>{C.language}</h3>
        </div>
        <Picker
          aria-label={C.languagePicker}
          size="S"
          styles={field}
          selectedKey={languageKey}
          disabledKeys={languages.filter((o) => o.disabled).map((o) => o.key)}
          onSelectionChange={(key) => setLanguagePick(String(key))}>
          {languages.map((o) => (
            <PickerItem key={o.key} id={o.key} textValue={o.label}>
              <Text slot="label">{o.label}</Text>
              <Text slot="description">{o.disabled ? `${o.description} · ${o.disabled}` : o.description}</Text>
            </PickerItem>
          ))}
        </Picker>
        {language ? <p className={hint}>{C.languageLine(needTranslate, sentenceCount)}</p> : <p className={hint}>{C.allTaken}</p>}
        {staleUnits ? <p className={warn}>{C.staleNote(staleUnits)}</p> : null}

        <div className={secHead}>
          <h3 className={secTitle}>{C.source}</h3>
        </div>
        {speeches.length > 1 ? (
          <Picker
            aria-label={C.sourcePicker}
            size="S"
            styles={field}
            selectedKey={speech.id}
            onSelectionChange={(key) => {
              setSpeechId(String(key));
              setLanguagePick(null);
            }}>
            {speeches.map((d) => (
              <PickerItem key={d.id} id={d.id} textValue={d.name}>
                <Text slot="label">{d.name}</Text>
                {d.language ? <Text slot="description">{langName(d.language)}</Text> : null}
              </PickerItem>
            ))}
          </Picker>
        ) : null}
        <p className={hint}>
          {C.sourceLine(sourceLanguage ? langName(sourceLanguage) : C.unknownLanguage, sentenceCount)}
          {speeches.length > 1 ? null : ` · ${speech.name}`}
        </p>

        <div ref={voiceSection} className={secHead}>
          <h3 className={secTitle}>{C.voiceModel}</h3>
          <SectionLink onPress={toTts}>{C.manageVoiceModels}</SectionLink>
        </div>
        {!view ? (
          <p className={hint}>{C.voiceModelsLoading}</p>
        ) : voiceModels.length ? (
          <>
            <ModelLine
              label={C.voiceModelPicker}
              options={voiceModels}
              selected={voiceModel}
              disableUnusable
              onSelect={(o) => {
                setVoiceModelKey(o.key);
                setVoicePick('default');
              }}
              factsOf={(o) => speechModelLine(o.info)}
            />
            <ModelGate
              selected={voiceModel}
              options={voiceModels}
              body={GATE_COPY.ttsBody}
              onConnect={toTts}
              onSwitch={(o) => {
                setVoiceModelKey(o.key);
                setVoicePick('default');
              }}
            />
          </>
        ) : (
          <InlineAlert variant="notice">
            <Heading>{C.ttsMissingTitle}</Heading>
            <Content>
              {GATE_COPY.ttsBody}
              <div className={alertActions}>
                <Button size="S" variant="secondary" onPress={toTts}>
                  {C.goTts}
                </Button>
              </div>
            </Content>
          </InlineAlert>
        )}

        {voiceModel ? (
          <>
            <div className={secHead}>
              <h3 className={secTitle}>{C.voice}</h3>
              <SectionLink onPress={toVoices}>{C.manageVoices}</SectionLink>
            </div>
            <VoicePicker label={C.voicePicker} choices={paramChoices} selectedKey={voiceChoice?.key ?? null} onSelect={setVoicePick} />
            {voiceChoice?.key === 'custom' ? (
              <TextField
                aria-label={C.voiceCustom}
                size="S"
                styles={customField}
                placeholder={C.voiceCustomPlaceholder}
                value={customVoice}
                onChange={setCustomVoice}
              />
            ) : null}
            <p className={hint}>{C.voiceHint}</p>

            <SpeakerSection
              runtime={runtime}
              videoId={videoId}
              documents={documents}
              speechId={speech.id}
              speakers={speakers}
              loading={speechBody === undefined}
              info={info}
              providerId={providerId}
              providerLabel={providerLabel}
              paramVoice={paramVoice}
              library={library}
              editable={editable}
            />
          </>
        ) : null}

        <div className={secHead}>
          <h3 className={secTitle}>{C.mix}</h3>
        </div>
        <Switch size="S" isSelected={separate} onChange={setSeparatePick}>
          {C.separate}
        </Switch>
        {sepDownload ? (
          <div className={gateTop}>
            <InlineAlert variant="notice">
              <Heading>
                {sepView?.size ? `${C.separateDownload(bundleName(sepDownload))} · ${sepView.size}` : C.separateDownload(bundleName(sepDownload))}
              </Heading>
              <Content>
                {C.separateDownloadBody}
                <div className={alertActions}>
                  {sepView?.state === 'running' ? (
                    <span className={progressRow} role="status">
                      <ProgressBar
                        size="S"
                        aria-label={GATE_COPY.downloading(sepView.percent)}
                        isIndeterminate={sepView.percent === null}
                        {...(sepView.percent === null ? {} : { value: sepView.percent })}
                        styles={progressBar}
                      />
                      {GATE_COPY.downloading(sepView.percent)}
                    </span>
                  ) : null}
                  <SectionLink onPress={toSeparate}>{GATE_COPY.manageLocal}</SectionLink>
                </div>
              </Content>
            </InlineAlert>
          </div>
        ) : (
          <>
            <p className={hint}>{separate && !separateReady ? C.separateMissing : C.separateHint}</p>
            {separate && !separateReady ? <SectionLink onPress={toSeparate}>{C.installSeparate}</SectionLink> : null}
          </>
        )}
        <div className={row}>
          <span className={rowLabel}>{C.original}</span>
          <SegmentedControl aria-label={C.originalPicker} selectedKey={originalAudio} onSelectionChange={(key) => setOriginalAudio(key as DubOriginalAudio)}>
            <SegmentedControlItem id="duck">{C.originalLabel.duck}</SegmentedControlItem>
            <SegmentedControlItem id="mute">{C.originalLabel.mute}</SegmentedControlItem>
            <SegmentedControlItem id="keep">{C.originalLabel.keep}</SegmentedControlItem>
          </SegmentedControl>
        </div>
        {originalAudio === 'duck' ? (
          <div className={row}>
            <span className={rowLabel}>{C.duckLabel}</span>
            <NumberField
              aria-label={C.duckDb}
              size="S"
              styles={duckField}
              minValue={DUCK_DB_MIN}
              maxValue={DUCK_DB_MAX}
              step={1}
              value={duckDb}
              onChange={(value) => setDuckDb(clampDuckDb(value))}
            />
            <span className={unit}>{C.duckUnit}</span>
          </div>
        ) : null}
        <p className={hint}>
          {C.mixHint({ separated: separate && (separateReady || !!sepDownload), original: originalAudio, duckDb: clampDuckDb(duckDb) })}
        </p>

        {needTranslate ? (
          <>
            <div ref={textSection} className={secHead}>
              <h3 className={secTitle}>{C.translate}</h3>
              <SectionLink onPress={toLlm}>{C.manageTextModels}</SectionLink>
            </div>
            {!view ? (
              <p className={hint}>{C.textModelsLoading}</p>
            ) : textModels.length ? (
              <>
                <ModelLine
                  label={C.textModelPicker}
                  options={textModels}
                  selected={textModel}
                  disableUnusable
                  onSelect={(o) => setTextModelKey(o.key)}
                  factsOf={(o) => textModelLine(o.info)}
                />
                <ModelGate selected={textModel} options={textModels} body={GATE_COPY.textBody} onConnect={toLlm} onSwitch={(o) => setTextModelKey(o.key)} />
              </>
            ) : (
              <InlineAlert variant="notice">
                <Heading>{C.textMissingTitle}</Heading>
                <Content>
                  {GATE_COPY.textBody}
                  <div className={alertActions}>
                    <Button size="S" variant="secondary" onPress={toLlm}>
                      {C.goLlm}
                    </Button>
                  </div>
                </Content>
              </InlineAlert>
            )}
            <div className={secHead}>
              <h3 className={secTitle}>{C.style}</h3>
            </div>
            <TextArea
              aria-label={C.style}
              size="S"
              styles={field}
              placeholder={C.stylePlaceholder}
              value={styleHint}
              maxLength={DUB_STYLE_MAX}
              onChange={setStyleHint}
            />
            <p className={hint}>{C.styleHint}</p>
            <GlossarySection
              runtime={runtime}
              videoId={videoId}
              documents={documents}
              sourceLanguage={sourceLanguage}
              target={language?.language ?? null}
              text={text}
              editable={editable}
            />
          </>
        ) : null}
      </div>
      <div className={footer}>
        <Button
          variant="secondary"
          styles={field}
          isDisabled={!language || busy || !editable}
          isPending={submitting || !!sepWait}
          onPress={() => void start()}>
          {sepDownload && !sepWait ? <DownloadIcon /> : null}
          <Text>{sepDownload && !sepWait ? C.ctaDownload(languageLabel ?? '…') : C.cta(languageLabel ?? '…')}</Text>
        </Button>
        <p className={hint} role={sepWait ? 'status' : undefined}>
          {busy
            ? C.busy
            : !editable
              ? C.readOnly
              : sepWait && sepBundle
                ? C.separateWaiting(bundleName(sepBundle), sepView?.state === 'running' ? sepView.percent : null)
                : C.ctaHint(languageLabel ?? '…', { separated: separate && (separateReady || !!sepDownload), original: originalAudio })}
        </p>
        {sepConfirm && sepDownload ? (
          <InstallDialog
            bundleId={sepDownload.bundleId}
            name={bundleName(sepDownload)}
            license={sepDownload.license ?? null}
            mode={sepConfirm.mode}
            onClose={() => setSepConfirm(null)}
            onStarted={(jobId) => {
              setSepConfirm(null);
              awaitDubInstall(jobId, sepConfirm.params, sepConfirm.intent);
            }}
          />
        ) : null}
      </div>
    </>
  );
}

/** Voice dropdown: one item per row, with the explanation on the second line (whether the library voice is usable with this provider). */
function VoicePicker({
  label,
  choices,
  selectedKey,
  onSelect,
  isDisabled,
}: {
  label: string;
  choices: readonly VoiceChoice[];
  selectedKey: string | null;
  onSelect(key: string): void;
  isDisabled?: boolean;
}) {
  return (
    <Picker
      aria-label={label}
      size="S"
      styles={field}
      selectedKey={selectedKey}
      isDisabled={isDisabled}
      disabledKeys={choices.filter((c) => c.disabled).map((c) => c.key)}
      onSelectionChange={(key) => key !== null && onSelect(String(key))}>
      {choices.map((c) => (
        <PickerItem key={c.key} id={c.key} textValue={c.label}>
          <Text slot="label">{c.label}</Text>
          {c.description || c.disabled ? <Text slot="description">{c.disabled && !c.description ? c.disabled : c.description}</Text> : null}
        </PickerItem>
      ))}
    </Picker>
  );
}

/**
 * Speakers section: the voice in effect for each speaker (binding → default voice → model default) and its source. Changing a binding is written to `library-selection` in the video (`library.setVideoSelection`, one undoable edit), and the next dub uses it. Bindings are frozen when dubbing starts; changes made afterwards take effect only after re-dubbing.
 */
function SpeakerSection({
  runtime,
  videoId,
  documents,
  speechId,
  speakers,
  loading,
  info,
  providerId,
  providerLabel,
  paramVoice,
  library,
  editable,
}: {
  runtime: RuntimeSession;
  videoId: Id;
  documents: Record<Id, DocumentRecord>;
  speechId: Id;
  speakers: ReturnType<typeof speechSpeakers>;
  loading: boolean;
  info: SpeechModelInfo | null;
  providerId: string | null;
  providerLabel: string;
  paramVoice: string | null;
  library: readonly LibraryEntrySummary[];
  editable: boolean;
}) {
  const { undo } = useEditorActions();
  const selection = useVideoSelection(runtime, videoId, documents);
  const [writing, setWriting] = useState(false);
  const bindings = useMemo(() => selection?.selection?.speakerVoices ?? [], [selection]);
  const rows = useMemo(
    () => speakerRows({ speakers, bindings, documentId: speechId, providerId, providerLabel, voice: paramVoice, info, library }),
    [speakers, bindings, speechId, providerId, providerLabel, paramVoice, info, library],
  );
  const choices = useMemo(
    () => voiceChoices({ info, providerId, providerLabel, library, defaultLabel: C.bindingNone, forParams: false }),
    [info, providerId, providerLabel, library],
  );

  const bind = async (speaker: SpeakerRow, choice: VoiceChoice) => {
    const next = withBinding(
      bindings,
      speechId,
      speaker.speakerId,
      choice.voice ? { voice: choice.voice, ...(choice.providerId ? { providerId: choice.providerId } : {}) } : null,
    );
    setWriting(true);
    try {
      const result = await runtime.setVideoSelection({ videoId, speakerVoices: next });
      ToastQueue.positive(choice.voice ? C.bindingSaved(speaker.name) : C.bindingCleared(speaker.name), {
        timeout: 5000,
        actionLabel: E.undo,
        onAction: () => void undo({ transaction: result.receipt.transactionId }),
        shouldCloseOnAction: true,
      });
    } catch (error) {
      ToastQueue.negative(C.bindingFailed(messageOf(error)), { timeout: 5000 });
    } finally {
      setWriting(false);
    }
  };

  return (
    <>
      <div className={secHead}>
        <h3 className={secTitle}>{C.speakers}</h3>
        {rows.length ? <span className={secAside}>{C.speakersAside(rows.length)}</span> : null}
      </div>
      {loading ? (
        <p className={hint}>{C.bindingLoading}</p>
      ) : !rows.length ? (
        <p className={hint}>{C.speakersNone}</p>
      ) : selection?.error ? (
        <p className={hint}>{C.bindingReadFailed(selection.error)}</p>
      ) : !selection ? (
        <p className={hint}>{C.bindingLoading}</p>
      ) : (
        <div className={speakerList}>
          {rows.map((r) => (
            <SpeakerLine
              key={r.speakerId}
              row={r}
              choices={choices}
              info={info}
              library={library}
              providerLabel={providerLabel}
              isDisabled={!editable || writing}
              onBind={(choice) => void bind(r, choice)}
            />
          ))}
        </div>
      )}
      {rows.length ? <p className={hint}>{editable ? C.speakersNote : C.bindingReadOnly}</p> : null}
    </>
  );
}

function SpeakerLine({
  row: r,
  choices,
  info,
  library,
  providerLabel,
  isDisabled,
  onBind,
}: {
  row: SpeakerRow;
  choices: readonly VoiceChoice[];
  info: SpeechModelInfo | null;
  library: readonly LibraryEntrySummary[];
  providerLabel: string;
  isDisabled: boolean;
  onBind(choice: VoiceChoice): void;
}) {
  const binding: SpeakerVoiceBinding | null = r.binding;
  const known = binding ? choiceKeyOf(binding.voice, choices) : 'default';
  // A bound voice that is not in this model's list (a preset voice from another provider, or a hand-typed ID) is listed as one item, so the dropdown does not show blank.
  const list: VoiceChoice[] =
    binding && known === null
      ? [{ key: 'bound', label: C.bindingOther(voiceName(binding.voice, info, library)), description: null, voice: binding.voice, disabled: null }, ...choices]
      : [...choices];
  const selectedKey = known ?? 'bound';
  return (
    <div className={speakerCard}>
      <div className={speakerHead}>
        <span className={speakerName} title={r.name}>
          {r.name}
        </span>
        <span className={speakerMeta}>{C.speakerLine(r.sentences)}</span>
      </div>
      <VoicePicker
        label={C.speakerBinding(r.name)}
        choices={list}
        selectedKey={selectedKey}
        isDisabled={isDisabled}
        onSelect={(key) => {
          if (key === selectedKey || key === 'bound') return;
          const choice = list.find((c) => c.key === key);
          if (choice) onBind(choice);
        }}
      />
      <span className={effective}>{C.effective(r.effective.label, r.effective.source === 'default' ? null : DUB_SPEAKER_SOURCE[r.effective.source])}</span>
      {r.bindingIgnored ? <span className={warn}>{C.bindingIgnored(providerLabel)}</span> : null}
      {r.warning ? <span className={warn}>{C.speakerWarning(r.warning)}</span> : null}
    </div>
  );
}
