import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_SELECTED_GLOSSARIES, type DocumentRecord, type Id, type LibrarySelection, type TextModelInfo } from '@cuccut/protocol';
import {
  Button,
  Checkbox,
  Content,
  Heading,
  InlineAlert,
  Picker,
  PickerItem,
  Switch,
  Text,
  TextArea,
  ToastQueue,
} from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { languageName } from '../../model/caption-tracks.ts';
import { guessLanguage } from '../../model/cue-edit.ts';
import { textModelLine } from '../../model/models-text.ts';
import { cloudModelOptions, findOption, initialModelKey, langName, parseModelKey, type ToolModelOption } from '../../model/tools-models.ts';
import {
  defaultTarget,
  existingTranslations,
  glossaryRows,
  targetOptions,
  toggleGlossary,
  type GlossaryCandidate,
} from '../../model/translate-setup.ts';
import { speechSentences } from '../../model/translation-doc.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { onLibraryEntries } from '../../state/library-feed.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { ModelGate, ModelLine } from '../tools/tool-model.tsx';
import { SectionLink } from '../tools/tool-parts.tsx';
import { GATE_COPY } from '../tools/tools-copy.ts';
import { useEditorActions } from './editor-context.tsx';
import { PanelHead } from './panel-head.tsx';
import { useDocumentBody } from './use-document-body.ts';
import { TRANSLATE_COPY as C } from './translate-copy.ts';
import { startTranslate, useTranslateRun } from './translate-run.ts';

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 4, paddingBottom: 16 });
/** Small heading for a section (prototype SecHead). */
const secHead = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 });
const secTitle = style({ flexGrow: 1, margin: 0, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const hint = style({ margin: 0, marginTop: '[6px]', font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const field = style({ width: 'full' });
const glossaryList = style({ display: 'flex', flexDirection: 'column', gap: 4 });
const glossaryRow = style({ display: 'flex', flexDirection: 'column', minWidth: 0 });
const glossaryMeta = style({ paddingStart: 24, font: 'ui-xs', color: { default: 'gray-600', isOff: 'orange-1000' } });
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

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Text model: translation needs structured output. A model without it is listed but marked as unusable (Runtime rejects it too). */
function translateModelOptions(options: ToolModelOption<TextModelInfo>[]): ToolModelOption<TextModelInfo>[] {
  return options.map((o) => (o.usable && o.info.structuredOutput === false ? { ...o, usable: false, why: C.noStructured } : o));
}

/** The glossary used in library translation (the summary of the `library` topic; then read the content of each version for direction and entries). */
function useTranslationGlossaries(runtime: RuntimeSession): { ready: boolean; candidates: GlossaryCandidate[] } {
  const [summaries, setSummaries] = useState<{ id: Id; name: string; version: number }[] | null>(null);
  const [contents, setContents] = useState<Record<string, GlossaryCandidate['content']>>({});
  useEffect(
    () =>
      onLibraryEntries((entries) =>
        setSummaries(
          entries.filter((e) => e.library === 'glossaries' && e.kind === 'translation').map((e) => ({ id: e.id, name: e.name, version: e.version })),
        ),
      ),
    [],
  );
  // Record a version as read (or being read). When the summary changes, read only the new one. A read in progress is not dropped by a re-render.
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!summaries) return;
    for (const summary of summaries) {
      const key = `${summary.id}@${summary.version}`;
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      runtime.getLibraryEntry({ library: 'glossaries', id: summary.id, version: summary.version }).then(
        (entry) => {
          if (!mounted.current) return;
          const content = entry.content as GlossaryCandidate['content'] & { kind?: string };
          setContents((c) => ({ ...c, [key]: content && content.kind === 'translation' ? content : null }));
        },
        () => mounted.current && setContents((c) => ({ ...c, [key]: null })),
      );
    }
  }, [runtime, summaries]);
  const candidates = useMemo(
    () => (summaries ?? []).map((s) => ({ id: s.id, name: s.name, content: contents[`${s.id}@${s.version}`] })),
    [summaries, contents],
  );
  return { ready: summaries !== null, candidates };
}

/**
 * Entries enabled in the video (`library.getVideoSelection`). They are re-read following the version of the `library-selection` document in the video, so undo and changes made elsewhere are picked up. The UI keeps no separate copy.
 */
export function useVideoSelection(runtime: RuntimeSession, videoId: Id, documents: Record<Id, DocumentRecord>) {
  const doc = Object.values(documents).find((d) => d.kind === 'library-selection');
  const key = `${videoId}:${doc?.id ?? ''}:${doc?.currentRevision ?? ''}`;
  const [state, setState] = useState<{ key: string; selection: LibrarySelection | null; error: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    runtime.getVideoSelection(videoId).then(
      (result) => alive && setState({ key, selection: result.selection, error: null }),
      (error) => alive && setState({ key, selection: null, error: messageOf(error) }),
    );
    return () => {
      alive = false;
    };
  }, [runtime, videoId, key]);
  // When the version changes and the new one has not been read back yet, use the previous one first, so the checkboxes do not flicker.
  return state;
}

/**
 * Translation settings page (prototype panel-aitools-flows.jsx `TranslateFlow`): target language, source, text model, style hints, glossary entries enabled for the video, and bilingual display. “Translate to X” submits `pipelines.start`. It is a page of its own: it is entered from the subtitle track bar's “＋ 翻译成…” (Add: translate to…), and the tools page's “Translate subtitles” also leads here.
 * If no text model is configured, it explains that in place and gives a route to “Models › Text generation”. The start button is not greyed out.
 */
export function TranslateFlow({
  videoId,
  documents,
  onBack,
  onStarted,
  backLabel = C.back,
}: {
  videoId: Id;
  documents: Record<Id, DocumentRecord>;
  onBack(): void;
  /** On successful submit, the subtitle panel closes this page and returns to the list (progress shows on the track bar and the list). */
  onStarted(): void;
  /** The explanation for the page header's back button. When entered from the tools page, it is that page's “Back.” */
  backLabel?: string;
}) {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const busy = useTranslateRun((s) => !!s.runs[videoId]);
  const editable = useVideo((s) => canEdit(s.video));

  const speeches = useMemo(
    () => Object.values(documents).filter((d) => d.kind === 'speech' && !!d.sourceAssetId),
    [documents],
  );
  const [speechId, setSpeechId] = useState<Id | null>(null);
  const speech = speeches.find((d) => d.id === speechId) ?? speeches[0] ?? null;
  const speechBody = useDocumentBody(speech ?? undefined);
  const sentences = useMemo(() => (speechBody === undefined ? undefined : speechSentences(speechBody)), [speechBody]);
  const text = useMemo(() => (sentences ?? []).map((s) => s.text).join('\n'), [sentences]);
  const sourceLanguage = speech?.language ?? (text ? (guessLanguage(text.slice(0, 2000)) ?? null) : null);

  const targets = useMemo(
    () => targetOptions(sourceLanguage, speech ? existingTranslations(documents, speech.id) : []),
    [sourceLanguage, speech, documents],
  );
  const [targetPick, setTargetPick] = useState<string | null>(null);
  const target = targets.find((o) => o.tag === targetPick && !o.disabled)?.tag ?? defaultTarget(targets, sourceLanguage);

  const view = useModels((s) => s.capabilities);
  const options = useMemo(() => (view ? translateModelOptions(cloudModelOptions(view, 'generateText')) : []), [view]);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const option = findOption(options, initialModelKey(options, modelKey, view?.generateText.effective ?? null));
  const ready = !!option?.usable;
  const toModels = () => go({ tab: 'models', category: 'llm', page: 'cloud' });
  const modelSection = useRef<HTMLDivElement>(null);

  const [styleHint, setStyleHint] = useState('');
  const [bilingual, setBilingual] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!speech) {
    return (
      <>
        <PanelHead title={C.title} back={{ label: backLabel, onPress: onBack }} />
        <div className={body}>
          <div className={style({ marginTop: 12 })}>
            <InlineAlert variant="informative">
              <Heading>{C.noSpeechTitle}</Heading>
              <Content>{C.noSpeech}</Content>
            </InlineAlert>
          </div>
        </div>
      </>
    );
  }

  const targetLabel = target ? languageName(target) : null;
  const start = async () => {
    if (!target || busy || submitting) return;
    if (!ready) {
      // Don't grey the button out: say what is missing, and bring the model section into view.
      modelSection.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      ToastQueue.neutral(options.length ? (option?.why ?? C.notConfiguredTitle) : C.notConfiguredTitle, { timeout: 4000 });
      return;
    }
    setSubmitting(true);
    const model = option ? parseModelKey(option.key) : null;
    const ok = await startTranslate({
      videoId,
      speechDocumentId: speech.id,
      targetLanguage: target,
      style: styleHint,
      model: model ? { providerId: model.providerId, modelId: model.modelId } : null,
      bilingual,
    });
    setSubmitting(false);
    // When rejected, the issue card is attached to the subtitle panel (with the reason and where to go). This page still closes, so it does not cover the card.
    if (ok || useTranslateRun.getState().problems[videoId]) onStarted();
  };

  return (
    <>
      <PanelHead title={C.title} back={{ label: backLabel, onPress: onBack }} />
      <div className={`${body} cc-scroll`}>
        <div className={secHead}>
          <h3 className={secTitle}>{C.target}</h3>
        </div>
        <Picker
          aria-label={C.targetPicker}
          size="S"
          styles={field}
          selectedKey={target}
          disabledKeys={targets.filter((o) => o.disabled).map((o) => o.tag)}
          onSelectionChange={(key) => setTargetPick(String(key))}>
          {targets.map((o) => (
            <PickerItem key={o.tag} id={o.tag} textValue={o.label}>
              <Text slot="label">{o.label}</Text>
              <Text slot="description">{o.disabled ? `${o.description} · ${o.disabled}` : o.description}</Text>
            </PickerItem>
          ))}
        </Picker>
        {target ? null : <p className={hint}>{C.allTaken}</p>}

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
              setTargetPick(null);
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
          {C.sourceLine(sourceLanguage ? langName(sourceLanguage) : C.unknownLanguage, sentences ? sentences.length : null)}
          {speeches.length > 1 ? null : ` · ${speech.name}`}
        </p>

        <div ref={modelSection} className={secHead}>
          <h3 className={secTitle}>{C.model}</h3>
          <SectionLink onPress={toModels}>{C.manage}</SectionLink>
        </div>
        {!view ? (
          <p className={hint}>{C.modelsLoading}</p>
        ) : options.length ? (
          <>
            <ModelLine
              label={C.modelPicker}
              options={options}
              selected={option}
              disableUnusable
              onSelect={(o) => setModelKey(o.key)}
              factsOf={(o) => textModelLine(o.info)}
            />
            <ModelGate selected={option} options={options} body={GATE_COPY.textBody} onConnect={toModels} onSwitch={(o) => setModelKey(o.key)} />
          </>
        ) : (
          <InlineAlert variant="notice">
            <Heading>{C.notConfiguredTitle}</Heading>
            <Content>
              {C.notConfiguredBody}
              <div className={alertActions}>
                <Button size="S" variant="secondary" onPress={toModels}>
                  {C.goModels}
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
          maxLength={500}
          onChange={setStyleHint}
        />
        <p className={hint}>{C.styleHint}</p>

        <GlossarySection
          runtime={runtime}
          videoId={videoId}
          documents={documents}
          sourceLanguage={sourceLanguage}
          target={target}
          text={text}
          editable={editable}
        />

        <div className={secHead}>
          <h3 className={secTitle}>{C.bilingual}</h3>
        </div>
        <Switch isSelected={bilingual} onChange={setBilingual}>
          {C.bilingual}
        </Switch>
        <p className={hint}>{C.bilingualHint}</p>
      </div>
      <div className={footer}>
        <Button variant="secondary" styles={field} isDisabled={!target || busy || !editable} isPending={submitting} onPress={() => void start()}>
          {targetLabel ? C.cta(targetLabel) : C.cta('…')}
        </Button>
        <p className={hint}>{busy ? C.busy : !editable ? C.readOnly : C.ctaHint}</p>
      </div>
    </>
  );
}

/** Glossary section: a check mark means enabled in this video (`library.setVideoSelection`, an undoable edit). Entries that are enabled but not usable this time say why. */
export function GlossarySection({
  runtime,
  videoId,
  documents,
  sourceLanguage,
  target,
  text,
  editable,
}: {
  runtime: RuntimeSession;
  videoId: Id;
  documents: Record<Id, DocumentRecord>;
  sourceLanguage: string | null;
  target: string | null;
  text: string;
  editable: boolean;
}) {
  const go = useShell((s) => s.go);
  const { undo } = useEditorActions();
  const library = useTranslationGlossaries(runtime);
  const selection = useVideoSelection(runtime, videoId, documents);
  const [writing, setWriting] = useState(false);
  const enabled = selection?.selection?.glossaries.translate ?? [];
  const rows = target ? glossaryRows(library.candidates, enabled, sourceLanguage, target, text) : [];

  const toggle = async (id: Id, name: string, on: boolean) => {
    const next = toggleGlossary(enabled, id, on);
    if (!next) {
      if (on && enabled.length >= MAX_SELECTED_GLOSSARIES) ToastQueue.neutral(C.glossaryLimit(MAX_SELECTED_GLOSSARIES), { timeout: 4000 });
      return;
    }
    setWriting(true);
    try {
      const result = await runtime.setVideoSelection({ videoId, glossaries: { translate: next } });
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
    <>
      <div className={secHead}>
        <h3 className={secTitle}>{C.glossary}</h3>
        <SectionLink onPress={() => go({ tab: 'settings', section: 'glossary' })}>{C.glossaryManage}</SectionLink>
      </div>
      {selection?.error ? (
        <p className={hint}>{C.glossaryFailed(selection.error)}</p>
      ) : !library.ready || !selection ? (
        <p className={hint}>{C.glossaryLoading}</p>
      ) : !rows.length ? (
        <p className={hint}>{C.glossaryEmpty(target ? langName(target) : C.targetLanguage)}</p>
      ) : (
        <div className={glossaryList}>
          {rows.map((row) => (
            <div key={row.id} className={glossaryRow}>
              <Checkbox
                size="S"
                isSelected={row.enabled}
                isDisabled={!editable || writing || (!row.enabled && row.terms === null)}
                onChange={(on) => void toggle(row.id, row.name, on)}>
                {row.name}
              </Checkbox>
              <span className={glossaryMeta({ isOff: row.enabled && !row.used })}>
                {row.note ?? (row.terms === null ? '' : C.glossaryCount(row.terms, row.hits ?? 0))}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className={hint}>{editable ? C.glossaryNote : C.glossaryReadOnly}</p>
    </>
  );
}
