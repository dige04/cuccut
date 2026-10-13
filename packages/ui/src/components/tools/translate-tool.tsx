import { useMemo, useState } from 'react';
import type { TextModelInfo, ToolCandidateDocument } from '@cuccut/protocol';
import { Button, DropZone, Picker, PickerItem, Switch, Text, ToastQueue } from '@react-spectrum/s2';
import FileText from '@react-spectrum/s2/icons/FileText';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { DropItem } from 'react-aria-components';
import { TARGET_LANGUAGES } from '../../model/new-flow.ts';
import { toolRequest, translateFileParams, translateModelOptions, translateVideoParams, type RunMeta } from '../../model/tool-runs.ts';
import { defaultTargetLang, DUPLICATE_TITLE, duplicateNote, langLabel, pick, sourceDocument, targetLangs, type PickerRow } from '../../model/tool-targets.ts';
import { modelReason, saveTarget } from '../../model/tool-frame.ts';
import { inputKindOf } from '../../model/tool-space-input.ts';
import { findOption, initialModelKey, type ToolModelOption } from '../../model/tools-models.ts';
import { baseName } from '../../model/tools-transcribe.ts';
import { sameLanguage } from '../../model/translate-setup.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useModels } from '../../state/models-store.ts';
import { SaveDirRow } from './tool-frame.tsx';
import { GrantCard, ToolFrame, ToolSourceSwitch } from './tool-run-view.tsx';
import { detail, Section, submitOnModEnter } from './tool-parts.tsx';
import { SpacePicker, useCandidates, useSpaceRows } from './tool-video-picker.tsx';
import { FORM_COPY, FRAME_COPY, TRANSCRIBE_COPY, TRANSLATE_COPY } from './tools-copy.ts';
import { blockOf, useToolStatus } from './use-tool-status.ts';
import { useToolStart, useVideoTools, type TranslateDraft } from './use-video-tools.ts';
import { DuplicateAlert, firstWhy, lede, SubmitBar, TextModelField, usePreset } from './video-tool-parts.tsx';

/*
 * Tools › Translate subtitles (design mockup tool-translate.jsx `TranslateToolPage`): start from a Space item (a transcribed video or a subtitle entry) or a local SRT / VTT file. For a video: a new translated subtitle layer in the target language is added (the directory has `captions: true` in `execution.params`); it can be shown bilingually, and the original is left untouched; if a translation in the same language already exists, another one is added rather than overwriting it. For subtitle files and subtitle entries (`input` gives `{ entryId }`): file to file, and the translation is saved to the save location. Text models are all online services; a model the user has not yet agreed to is authorized right on this page.
 *
 * Differences from the mockup: paste and examples are not included.
 */

const SUBTITLE = /\.(srt|vtt)$/i;
const subtitleFilters = () => [{ name: TRANSLATE_COPY.subtitleFiles, extensions: ['srt', 'vtt'] }];

const dropZone = style({ width: 'full', minHeight: 160 });
const dropBody = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingY: 24, paddingX: 24, textAlign: 'center' });
const dropIcon = style({ display: 'flex', color: 'gray-700', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const dropName = style({ font: 'title-sm', color: 'gray-900', overflowWrap: 'anywhere' });
const dropPath = style({ font: 'code-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const buttons = style({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 });
const field = style({ width: 'full' });

/** Which text model to translate with: the selected one if it is still there, otherwise the effective default (if usable), otherwise the first usable one. */
export function useTextModel(saved: string | null): {
  ready: boolean;
  options: ToolModelOption<TextModelInfo>[];
  option: ToolModelOption<TextModelInfo> | null;
} {
  const view = useModels((s) => s.capabilities);
  return useMemo(() => {
    if (!view) return { ready: false, options: [], option: null };
    const options = translateModelOptions(view);
    return { ready: true, options, option: findOption(options, initialModelKey(options, saved, view.generateText.effective ?? null)) };
  }, [view, saved]);
}

/** The text-model status line: still loading, none available, or unusable. */
export function textModelWhy(m: ReturnType<typeof useTextModel>): string | null {
  if (!m.ready) return FORM_COPY.loading;
  return modelReason(m.options, m.option, FRAME_COPY.textNoun);
}

/** Target language: for a video source, the transcript's own language is removed; by default, as in the mockup (English source translated to Simplified Chinese (简体中文), everything else translated to English). */
function useTargets(row: PickerRow | null, doc: ToolCandidateDocument | null, video: boolean, want: string | null) {
  const codes = TARGET_LANGUAGES.map((l) => l.code);
  const available = video ? targetLangs(codes, doc) : codes;
  const lang = defaultTargetLang(available, want, video ? (doc?.language ?? null) : null);
  const translated = video && row ? row.documents.flatMap((d) => d.translations.map((t) => t.language)).filter((l): l is string => !!l) : [];
  const has = (code: string) => translated.some((l) => sameLanguage(l, code));
  return { languages: TARGET_LANGUAGES.filter((l) => available.includes(l.code)), lang, has };
}

export function TranslateTool() {
  const status = useToolStatus();
  const draft = useVideoTools((s) => s['translate-subtitles']);
  const patchVideoTools = useVideoTools((s) => s.patch);
  const patch = (p: Partial<TranslateDraft>) => patchVideoTools('translate-subtitles', p);
  const data = useCandidates('translate-subtitles');
  const rows = useSpaceRows('translate-subtitles', data);
  const space = draft.source === 'space';

  usePreset('translate-subtitles', (entryId) => patch({ source: 'space', entryId, documentId: null }));

  const entryId = space ? pick(rows, draft.entryId) : null;
  const picked = entryId ? (rows.find((r) => r.entryId === entryId) ?? null) : null;
  // A video is written into; subtitle entries and local files are file to file.
  const row = picked?.video ?? null;
  const video = !!row;
  const subtitleEntry = picked && !video ? picked : null;
  const input = space ? (picked ? inputKindOf('translate-subtitles', picked.kind) : 'video') : 'file';
  const doc = sourceDocument(row, draft.documentId);
  const { languages, lang, has } = useTargets(row, doc, video, draft.lang);
  const text = useTextModel(draft.model);
  // Results from subtitle files are written to the save location; “更改…” (change…) only changes it this once (no such line when writing into a video).
  const [saveOverride, setSaveOverride] = useState<string | null>(null);
  const model = text.option?.usable ? { provider: text.option.providerId, model: text.option.modelId } : {};

  const outDir = saveTarget(status.saveDirectory, saveOverride);
  const file = subtitleEntry ? { entryId: subtitleEntry.entryId } : !space ? draft.file : null;
  let params: Record<string, unknown> | null = null;
  if (lang && row)
    params = translateVideoParams({ entryId: row.entryId, documentId: doc?.documentId ?? null, targetLanguage: lang, bilingual: draft.bilingual, ...model });
  else if (lang && file) params = translateFileParams({ input: file, targetLanguage: lang, bilingual: false, ...model, outDir });
  const request = params ? toolRequest(status.byId.get('translate-subtitles'), input, params) : null;
  const key = request ? JSON.stringify(request) : '';
  const starter = useToolStart('translate-subtitles', key);

  const why = firstWhy(
    blockOf(status, 'translate-subtitles', input),
    space && !picked && FORM_COPY.needEntry,
    !space && !draft.file && TRANSLATE_COPY.notSubtitle,
    !lang && FORM_COPY.needLang,
    textModelWhy(text),
    !!starter.asking && FORM_COPY.needGrant,
    !request && FORM_COPY.loading,
  );

  const start = () => {
    if (why || !request || !lang) return;
    const what = picked ? picked.name : baseName(draft.file ?? '');
    const meta: RunMeta = {
      tool: 'translate-subtitles',
      input,
      title: `${TRANSLATE_COPY.title} · ${what} → ${langLabel(lang)}`,
      videoName: row?.name ?? null,
      sourceLanguage: doc?.language ?? null,
    };
    starter.start(request, meta, key);
  };

  const dup = video && row ? duplicateNote('translate-subtitles', row, lang) : null;

  return (
    <ToolFrame
      tool="translate-subtitles"
      title={TRANSLATE_COPY.title}
      bar={<SubmitBar why={why} label={TRANSLATE_COPY.submit} busy={starter.busy} onPress={start} yields={!!starter.asking} />}
      onKeyDown={submitOnModEnter(start)}>
      <p className={lede}>{space && !subtitleEntry ? TRANSLATE_COPY.ledeVideo : TRANSLATE_COPY.ledeFile}</p>
      <ToolSourceSwitch tool="translate-subtitles" value={draft.source} onChange={(source) => patch({ source })} />
      {space ? (
        <>
          <SpacePicker tool="translate-subtitles" data={data} value={entryId} onChange={(id) => patch({ entryId: id, documentId: null })} />
          {row ? <DocumentLine row={row} doc={doc} onChange={(id) => patch({ documentId: id })} /> : null}
        </>
      ) : (
        <SubtitleFile path={draft.file} onPath={(file) => patch({ file })} />
      )}
      <Section title={TRANSLATE_COPY.target}>
        <Picker
          aria-label={TRANSLATE_COPY.target}
          styles={field}
          items={languages}
          selectedKey={lang}
          onSelectionChange={(k) => k !== null && patch({ lang: String(k) })}>
          {(l) => (
            <PickerItem id={l.code} textValue={`${l.name} · ${l.native}`}>
              <Text slot="label">{l.name}</Text>
              <Text slot="description">{has(l.code) ? `${l.native} · ${TRANSLATE_COPY.hasTranslation}` : l.native}</Text>
            </PickerItem>
          )}
        </Picker>
        {video ? (
          <Switch isSelected={draft.bilingual} onChange={(bilingual) => patch({ bilingual })}>
            {TRANSLATE_COPY.bilingual}
          </Switch>
        ) : null}
      </Section>
      {dup ? <DuplicateAlert title={DUPLICATE_TITLE['translate-subtitles']} body={dup} /> : null}
      <TextModelField options={text.options} option={text.option} onChange={(model) => patch({ model })} />
      {video ? null : <SaveDirRow saveDirectory={status.saveDirectory} override={saveOverride} onChange={setSaveOverride} />}
      {starter.asking ? <GrantCard items={starter.asking} onAgree={starter.agree} busy={starter.busy} hint={TRANSLATE_COPY.grantHint} /> : null}
    </ToolFrame>
  );
}

/** Which transcript to translate from: one sentence when there is only one; selectable when there are several; when the content has not finished loading, say the Runtime chooses. */
function DocumentLine({ row, doc, onChange }: { row: PickerRow; doc: ToolCandidateDocument | null; onChange: (id: string) => void }) {
  if (!doc) return <span className={detail}>{TRANSLATE_COPY.fromPending}</span>;
  if (row.documents.length < 2) return <span className={detail}>{TRANSLATE_COPY.from(row.name, langLabel(doc.language))}</span>;
  return (
    <Picker
      label={TRANSLATE_COPY.document}
      styles={field}
      items={row.documents}
      selectedKey={doc.documentId}
      onSelectionChange={(k) => k !== null && onChange(String(k))}>
      {(d) => (
        <PickerItem id={d.documentId} textValue={d.name}>
          <Text slot="label">{d.name}</Text>
          <Text slot="description">{TRANSLATE_COPY.docLang(langLabel(d.language))}</Text>
        </PickerItem>
      )}
    </Picker>
  );
}

/** Subtitle file: drag in or choose an SRT / VTT (local paths only). */
function SubtitleFile({ path, onPath }: { path: string | null; onPath: (path: string | null) => void }) {
  const runtime = useRuntime();
  const pickFiles = runtime.host.pickFiles?.bind(runtime.host);
  const take = (next: string) => {
    if (!SUBTITLE.test(next)) {
      ToastQueue.neutral(TRANSLATE_COPY.notSubtitle, { timeout: 4000 });
      return;
    }
    onPath(next);
  };
  const choose = () => {
    if (!pickFiles) return;
    void pickFiles({ title: TRANSLATE_COPY.filePick, filters: subtitleFilters() }).then((paths) => {
      if (paths[0]) take(paths[0]);
    });
  };
  const drop = async (items: readonly DropItem[]) => {
    const item = items.find((i) => i.kind === 'file');
    if (!item || item.kind !== 'file') return;
    const file = await item.getFile();
    const local = runtime.host.pathForFile(file);
    if (!local) {
      ToastQueue.negative(TRANSCRIBE_COPY.noPath, { timeout: 6000 });
      return;
    }
    take(local);
  };
  return (
    <DropZone styles={dropZone} isFilled={!!path} replaceMessage={TRANSLATE_COPY.fileChange} onDrop={(e) => void drop(e.items)}>
      <div className={dropBody}>
        <span className={dropIcon} aria-hidden>
          <FileText />
        </span>
        <span className={dropName}>{path ? baseName(path) : TRANSLATE_COPY.fileDrop}</span>
        {path ? <span className={dropPath}>{path}</span> : null}
        <span className={detail}>{TRANSLATE_COPY.fileFormats}</span>
        {pickFiles ? null : <span className={detail}>{FORM_COPY.noPicker}</span>}
        {pickFiles || path ? (
          <div className={buttons}>
            {pickFiles ? (
              <Button variant="secondary" onPress={choose}>
                {path ? TRANSLATE_COPY.fileChange : TRANSLATE_COPY.filePick}
              </Button>
            ) : null}
            {path ? (
              <Button variant="secondary" fillStyle="outline" onPress={() => onPath(null)}>
                {TRANSLATE_COPY.fileClear}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </DropZone>
  );
}
