import type { ReactNode } from 'react';
import { ActionButton, Button, Text, ToastQueue } from '@react-spectrum/s2';
import Folder from '@react-spectrum/s2/icons/Folder';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { modelWarning, noModelText, saveDirLabel } from '../../model/tool-frame.ts';
import type { ToolModelOption } from '../../model/tools-models.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useSetting } from '../../state/settings-store.ts';
import { ModelLine } from './tool-model.tsx';
import { detail, Section, SectionLink } from './tool-parts.tsx';
import { FRAME_COPY } from './tools-copy.ts';

/*
 * The rows of the common tool page skeleton (product design §2.7; design file tool-frame.jsx `ToolModelRow`): input → model → options → save location → start.
 * The “模型” (Model) row lists the local and cloud models configured for this capability; when none is usable, this row offers “去设置” (Go to settings), and the reason is written next to the primary button (`modelReason`), without blocking the whole page.
 * The “保存位置” (Save location) row (`ToolSaveDirRow`) shows where this result will be saved; “更改…” (Change…) changes it for this time only. Runs that write into an existing video, and the web service (which does not provide a save location), do not have this row.
 */

const warnLine = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0 });
const warnText = style({ flexGrow: 1, flexBasis: 0, minWidth: 160, font: 'ui-sm', color: 'orange-900', margin: 0 });
const emptyText = style({ flexGrow: 1, flexBasis: 0, minWidth: 160, font: 'ui-sm', color: 'gray-700', margin: 0 });

/** A notice line plus “去设置” (Go to settings). */
function SettingsLine({ text, warn, onSettings }: { text: string; warn: boolean; onSettings: () => void }) {
  return (
    <div className={warnLine}>
      <p className={warn ? warnText : emptyText}>{text}</p>
      <Button variant="secondary" size="S" onPress={onSettings}>
        {FRAME_COPY.goSettings}
      </Button>
    </div>
  );
}

/**
 * The “模型” (Model) row. `noun` is what this kind of model is called (also the Picker's accessible name); `manage` is the sentence at the top right that links to the models page. When `localGate` is true, the page itself shows the reminder that a local model is not installed
 * (image generation has an in-place download card), so it is not repeated here. `children` are placed under the Picker (reasoning effort, download card, ...).
 */
export function ModelRow<M>({
  title = FRAME_COPY.model,
  noun,
  manage,
  onSettings,
  options,
  selected,
  onSelect,
  factsOf,
  disableUnusable,
  localGate = false,
  local = true,
  children,
}: {
  /** The title of this section; when a page has two models (the text model and the dubbing engine for translate-and-dub), each has its own title. */
  title?: string;
  noun: string;
  manage: string;
  onSettings: () => void;
  options: readonly ToolModelOption<M>[];
  selected: ToolModelOption<M> | null;
  onSelect: (option: ToolModelOption<M>) => void;
  factsOf: (option: ToolModelOption<M>) => string;
  disableUnusable?: boolean;
  localGate?: boolean;
  /** Whether this capability has a local model (the empty-state line uses this to decide whether to say “安装一个本机模型” (Install a local model)). */
  local?: boolean;
  children?: ReactNode;
}) {
  const warning = localGate && selected?.local ? null : modelWarning(selected);
  return (
    <Section title={title} aside={<SectionLink onPress={onSettings}>{manage}</SectionLink>}>
      {options.length ? (
        <>
          <ModelLine label={noun} options={options} selected={selected} onSelect={onSelect} factsOf={factsOf} disableUnusable={disableUnusable} />
          {warning ? <SettingsLine text={warning} warn onSettings={onSettings} /> : null}
          {children}
        </>
      ) : (
        <SettingsLine text={noModelText(noun, local)} warn={false} onSettings={onSettings} />
      )}
    </Section>
  );
}

const saveLine = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0, '--iconPrimary': { type: 'fill', value: 'gray-700' } });
const saveText = style({ flexGrow: 1, flexBasis: 0, minWidth: 160, font: 'ui-sm', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const savePath = style({ font: 'code-xs', color: 'gray-900' });

/**
 * The save location row (design file tool-frame.jsx `ToolSaveDirRow`): “保存到 …” (Save to …), whether it is the default from settings, “更改…” (Change…) (the system folder picker,
 * which changes it for this time only, without writing back to settings), and “改回默认” (Reset to default). `saveDirectory` is the save location given by `tools.list`; when it is null (the web service does not provide one), nothing is drawn.
 */
export function SaveDirRow({
  saveDirectory,
  override,
  onChange,
  note,
}: {
  saveDirectory: string | null;
  override: string | null;
  onChange: (dir: string | null) => void;
  /** The first half of the sentence below this row (default: the result appears as a Space entry ...). */
  note?: string;
}) {
  const runtime = useRuntime();
  const setting = useSetting('downloads.directory');
  if (saveDirectory === null) return null;
  const dir = override?.trim() || saveDirectory;
  const pick = () => {
    runtime.host.pickDirectory({ title: FRAME_COPY.pickTitle }).then(
      (next) => {
        if (next) onChange(next);
      },
      (error: unknown) => ToastQueue.negative(FRAME_COPY.pickFailed(error instanceof Error ? error.message : String(error)), { timeout: 5000 }),
    );
  };
  return (
    <Section title={FRAME_COPY.saveTitle}>
      <div className={saveLine}>
        <Folder aria-hidden />
        <span className={saveText} title={dir}>
          {FRAME_COPY.saveTo}
          <span className={savePath}>{saveDirLabel(dir)}</span>
        </span>
        {override ? (
          <SectionLink onPress={() => onChange(null)}>{FRAME_COPY.backToDefault}</SectionLink>
        ) : (
          <span className={detail}>{setting ? FRAME_COPY.settingDir : FRAME_COPY.defaultDir}</span>
        )}
        <ActionButton isQuiet size="S" onPress={pick}>
          <Text>{FRAME_COPY.change}</Text>
        </ActionButton>
      </div>
      <span className={detail}>
        {FRAME_COPY.saveFoot(note ?? FRAME_COPY.saveNote, !!override)}
      </span>
    </Section>
  );
}
