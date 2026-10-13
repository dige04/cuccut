import { useState } from 'react';
import { Button, Disclosure, DisclosurePanel, DisclosureTitle, Picker, PickerItem, Text, TextField } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { endpointProblem } from '../../model/general-settings.ts';
import {
  MIRROR_PLACEHOLDER,
  MODEL_SOURCE_COPY as M,
  customEndpoint,
  modelSources,
  sourceDesc,
  sourceEndpoint,
  sourceLabel,
  sourceNotes,
  sourceOf,
  type ModelSourceId,
} from '../../model/model-source.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useSetting } from '../../state/settings-store.ts';
import { useSaveSettings, useSettingsReady } from '../settings/save-settings.ts';
import { Card } from './model-parts.tsx';

/*
 * Download source for local models (architecture design §6.3 “来源”(Source); design mock settings-local.jsx `SourceRow`, `ModelDisclosure`): Hugging Face / ModelScope / custom, writes `models.downloadEndpoint`. The “下载与存储”(Download and storage) section at the bottom of the local models page and 设置 › 通用 › 下载来源与离线(Settings › General › Download source and offline) share this row.
 * Choosing “自定义”(Custom) first shows the base URL box; the change only takes effect after filling it in and saving. In the browser it is read-only: the Web allowlist does not include `settings.set`, and local models cannot be downloaded there.
 * The design mock locks the picker when an environment variable is set; the Runtime does not tell the UI whether an environment variable is set, so this only mentions it in the description.
 */

const row = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingY: { default: 16, isCompact: 12 },
  borderTopWidth: 0,
  borderXWidth: 0,
  borderBottomWidth: { default: 1, ':last-child': 0 },
  borderStyle: 'solid',
  borderColor: 'gray-100',
});
const head = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 });
const rowText = style({ flexGrow: 1, flexBasis: 0, minWidth: 200 });
const rowLabel = style({ font: 'ui', fontWeight: 'medium', color: 'gray-900' });
const rowDesc = style({ marginTop: 4, font: 'ui-sm', color: 'gray-600', overflowWrap: 'anywhere' });
const notesLine = style({ margin: 0, font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere' });
/** Why it cannot be changed in the browser: one level deeper than the description; same as the reason for the greyed-out rows on the general page. */
const webLine = style({ margin: 0, font: 'ui-sm', color: 'gray-800', overflowWrap: 'anywhere' });
const fieldLine = style({ display: 'flex', alignItems: 'start', flexWrap: 'wrap', gap: 8 });
const field = style({ flexGrow: 1, minWidth: 220, maxWidth: 360 });
const fold = style({ marginTop: 24 });
const foldSummary = style({ marginStart: 8, font: 'ui-sm', fontWeight: 'normal', color: 'gray-600' });

/** Download source row: the row name and a description of the selected source on the left, the picker on the right; below, the full-width supplementary note and (if “自定义”(Custom) is selected) the base URL box. */
export function ModelSourceRow({ label = M.label, compact = false }: { label?: string; compact?: boolean }) {
  const web = useRuntime().host.platform === 'web';
  const ready = useSettingsReady();
  const save = useSaveSettings();
  const saved = useSetting('models.downloadEndpoint') ?? null;
  const savedId = sourceOf(saved);
  const [custom, setCustom] = useState(false); // “自定义”(Custom) selected, not saved yet
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const off = web || !ready || busy;
  const picked: ModelSourceId = custom && !web ? 'custom' : savedId;
  const shown = draft ?? (savedId === 'custom' ? (saved ?? '') : '');
  const next = customEndpoint(shown);
  const problem = endpointProblem(shown);

  const commit = async (endpoint: string | null) => {
    setBusy(true);
    const ok = await save(
      { 'models.downloadEndpoint': endpoint },
      M.changed(sourceOf(endpoint) === 'custom' ? endpoint! : sourceLabel(endpoint)),
    );
    setBusy(false);
    if (ok) {
      setCustom(false);
      setDraft(null);
    }
  };
  const choose = (id: ModelSourceId) => {
    if (id === 'custom') {
      setCustom(true);
      return;
    }
    setCustom(false);
    setDraft(null);
    if (id !== savedId) void commit(sourceEndpoint(id));
  };

  return (
    <div className={row({ isCompact: compact })}>
      <div className={head}>
        <div className={rowText}>
          <div className={rowLabel}>{label}</div>
          {ready ? <div className={rowDesc}>{sourceDesc(picked)}</div> : null}
        </div>
        <Picker
          aria-label={label}
          size="S"
          align="end"
          menuWidth={280}
          selectedKey={ready ? picked : null}
          isDisabled={off}
          onSelectionChange={(key) => {
            if (key !== null) choose(key as ModelSourceId);
          }}>
          {modelSources().map((s) => (
            <PickerItem key={s.id} id={s.id} textValue={s.name}>
              <Text slot="label">{s.name}</Text>
              <Text slot="description">{s.hint}</Text>
            </PickerItem>
          ))}
        </Picker>
      </div>
      {ready ? <p className={notesLine}>{sourceNotes(picked, saved).join(' ')}</p> : null}
      {/* Also drawn in the browser (greyed out), so the saved mirror address stays visible. */}
      {picked === 'custom' ? (
        <div className={fieldLine}>
          <TextField
            aria-label={M.fieldLabel}
            size="S"
            value={shown}
            onChange={setDraft}
            placeholder={MIRROR_PLACEHOLDER}
            isInvalid={problem !== null}
            errorMessage={problem ?? undefined}
            isDisabled={off}
            styles={field}
          />
          <Button
            variant="secondary"
            size="S"
            isDisabled={off || next === null || problem !== null || next === saved}
            onPress={() => void commit(next)}>
            {M.save}
          </Button>
        </div>
      ) : null}
      {web ? <p className={webLine}>{M.webNote}</p> : null}
    </div>
  );
}

/** The collapsible “下载与存储”(Download and storage) section at the bottom of the local models page: the title shows where downloads currently come from; expanding it shows the download source row. */
export function ModelSourceFold() {
  const saved = useSetting('models.downloadEndpoint');
  const ready = useSettingsReady();
  const [open, setOpen] = useState(false);
  return (
    <Disclosure isQuiet size="S" styles={fold} isExpanded={open} onExpandedChange={setOpen}>
      <DisclosureTitle>
        {M.fold}
        {ready ? <span className={foldSummary}>{sourceLabel(saved)}</span> : null}
      </DisclosureTitle>
      <DisclosurePanel>
        <Card label={M.label}>
          <ModelSourceRow compact />
        </Card>
      </DisclosurePanel>
    </Disclosure>
  );
}
