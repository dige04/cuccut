import { useEffect, useState } from 'react';
import {
  ActionButton,
  AlertDialog,
  Badge,
  Button,
  DialogContainer,
  Switch,
  TextField,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import Delete from '@react-spectrum/s2/icons/Delete';
import { CloudDownload, HardDrive } from 'lucide-react';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { agoLabel } from '../../model/format.ts';
import {
  catalogueCount,
  clearConfirmBody,
  clearedText,
  downloadedList,
  familyKey,
  fmtBytes,
  fontError,
  mirrorError,
  removeToast,
  type DownloadedRow,
} from '../../model/font-library.ts';
import { useRuntime } from '../../runtime/context.tsx';
import {
  clearDownloaded,
  loadCatalogue,
  loadDownloaded,
  removeFamily,
  requestSample,
  startFontLibrarySync,
  useFontLibrary,
} from '../../state/font-library-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { FONT_COPY } from './font-settings-copy.ts';
import { Panel, PanelHeading, RowList, SettingsGroup, SettingsRow } from './settings-ui.tsx';
import { useSaveSettings, useSettingsReady } from './save-settings.ts';

/*
 * Settings › Fonts (product design §5.9 “Fonts” and §7.6; prototype settings-fonts.jsx): a download group (the auto-download toggle and two mirror addresses, one for the stylesheet and one for the font files; only https is accepted, and anything non-compliant is flagged on the spot and not saved), and a group of downloaded fonts (total size and number of families; each family has a row that can be deleted; clearing everything asks for confirmation first).
 * A family still in use by an export that has not finished is labeled “In use for export” (导出在用), and its delete button is disabled (`inUse` from `fonts.downloaded`; the Runtime rejects deletion with `FONT_IN_USE`).
 * Shown only on desktop: a browser session has no `fonts.*`.
 */

const mirror = style({ display: 'flex', flexDirection: 'column', gap: 4, width: 280, maxWidth: 'full' });
const error = style({ font: 'ui-xs', color: 'negative' });
const empty = style({ marginTop: 0, marginBottom: 8, font: 'ui-sm', color: 'gray-600' });
const name = style({ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 });
const family = style({
  font: 'ui',
  fontWeight: 'bold',
  color: 'gray-900',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const facts = style({ font: 'ui-sm', color: 'gray-600' });
// The dividers between rows are drawn by RowList (settings-ui.tsx).
const row = style({ display: 'flex', alignItems: 'center', gap: 8, paddingY: 12 });

export function FontSettings() {
  const { client } = useRuntime();
  const ready = useSettingsReady();
  const save = useSaveSettings();
  const auto = useSetting('fonts.autoDownload') !== false;
  const css = useSetting('fonts.cssEndpoint');
  const file = useSetting('fonts.fileEndpoint');
  const statuses = useFontLibrary((s) => s.statuses);
  const loaded = useFontLibrary((s) => s.loaded);

  useEffect(() => {
    void loadCatalogue(client).catch(() => {});
    void loadDownloaded(client).catch(() => {});
    return startFontLibrarySync(client);
  }, [client]);

  const total = loaded ? catalogueCount(Object.values(statuses)) : null;
  return (
    <>
      <SettingsGroup title={FONT_COPY.download} hint={FONT_COPY.lead(total)} icon={<CloudDownload />}>
        <SettingsRow label={FONT_COPY.autoDownload} desc={FONT_COPY.autoDownloadDesc}>
          <Switch
            aria-label={FONT_COPY.autoDownload}
            isDisabled={!ready}
            isSelected={auto}
            onChange={(on) => void save({ 'fonts.autoDownload': on })}
          />
        </SettingsRow>
        <SettingsRow label={FONT_COPY.cssEndpoint} desc={FONT_COPY.cssEndpointDesc}>
          <MirrorField
            label={FONT_COPY.cssEndpoint}
            placeholder="https://fonts.googleapis.com"
            value={css}
            isDisabled={!ready}
            onSave={(v) => save({ 'fonts.cssEndpoint': v })}
          />
        </SettingsRow>
        <SettingsRow label={FONT_COPY.fileEndpoint} desc={FONT_COPY.fileEndpointDesc}>
          <MirrorField
            label={FONT_COPY.fileEndpoint}
            placeholder="https://fonts.gstatic.com"
            value={file}
            isDisabled={!ready}
            onSave={(v) => save({ 'fonts.fileEndpoint': v })}
          />
        </SettingsRow>
      </SettingsGroup>
      <DownloadedFonts />
    </>
  );
}

/** Mirror addresses: a non-compliant one is flagged on the spot (on the line below the field) and not saved. Saved on blur; if left empty, it is stored as null (use the default). */
function MirrorField({
  label,
  placeholder,
  value,
  isDisabled,
  onSave,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  isDisabled: boolean;
  onSave(value: string | null): Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value ?? '';
  const problem = mirrorError(shown);
  const commit = () => {
    if (draft === null || mirrorError(draft)) return;
    const next = draft.trim() || null;
    if (next === (value ?? null)) return setDraft(null);
    void onSave(next).then((ok) => ok && setDraft(null));
  };
  return (
    <div className={mirror}>
      <TextField
        aria-label={label}
        size="S"
        placeholder={placeholder}
        value={shown}
        isDisabled={isDisabled}
        isInvalid={!!problem}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {problem ? <span className={error}>{problem}</span> : null}
    </div>
  );
}

function DownloadedFonts() {
  const { client } = useRuntime();
  const downloaded = useFontLibrary((s) => s.downloaded);
  const [confirming, setConfirming] = useState(false);
  const { rows, totalBytes } = downloaded ? downloadedList(downloaded.faces, downloaded.inUse) : { rows: [], totalBytes: 0 };
  const clearAll = async () => {
    try {
      const result = await clearDownloaded(client);
      ToastQueue.positive(clearedText(result.removed, result.freedBytes, result.kept), { timeout: 5000 });
    } catch (e) {
      ToastQueue.negative(fontError(e).message, { timeout: 5000 });
    }
  };
  return (
    <Panel label={FONT_COPY.downloaded} className="flex flex-col gap-2 pb-1.5">
      <PanelHeading
        title={FONT_COPY.downloaded}
        hint={rows.length ? FONT_COPY.summary(rows.length, fmtBytes(totalBytes)) : FONT_COPY.none}
        icon={<HardDrive />}
        action={
          <Button variant="secondary" size="S" isDisabled={!rows.length} onPress={() => setConfirming(true)}>
            {FONT_COPY.clearAll}
          </Button>
        }
      />
      {rows.length ? (
        <RowList>
          {rows.map((r) => (
            <DownloadedFontRow key={r.family} row={r} />
          ))}
        </RowList>
      ) : (
        <p className={empty}>{FONT_COPY.empty}</p>
      )}
      <DialogContainer onDismiss={() => setConfirming(false)}>
        {confirming ? (
          <AlertDialog
            variant="destructive"
            title={FONT_COPY.clearTitle}
            primaryActionLabel={FONT_COPY.clear}
            cancelLabel={FONT_COPY.cancel}
            onPrimaryAction={() => void clearAll()}>
            {clearConfirmBody(rows, totalBytes)}
          </AlertDialog>
        ) : null}
      </DialogContainer>
    </Panel>
  );
}

function DownloadedFontRow({ row: r }: { row: DownloadedRow }) {
  const { client } = useRuntime();
  const sample = useFontLibrary((s) => s.samples[familyKey(r.family)]);
  useEffect(() => void requestSample(client, r.family), [client, r.family]);
  const remove = () =>
    removeFamily(client, r.family).then(
      ({ freedBytes }) => ToastQueue.neutral(FONT_COPY.removed(r.family, fmtBytes(freedBytes)), { timeout: 4000 }),
      (e: unknown) => ToastQueue.info(removeToast(r.family, e).text, { timeout: 5000 }),
    );
  const tip = r.inUse ? FONT_COPY.inUseTip : FONT_COPY.removeTip;
  return (
    <div className={row}>
      <span className={name}>
        <b className={family} style={sample?.state === 'ready' ? { fontFamily: `${sample.css}, system-ui, sans-serif` } : undefined}>
          {r.family}
        </b>
        <span className={facts}>{FONT_COPY.facts(String(r.weights), fmtBytes(r.sizeBytes), r.licence, r.at ? agoLabel(r.at) : null)}</span>
      </span>
      {r.inUse ? (
        <Badge variant="notice" size="S" fillStyle="subtle">
          {FONT_COPY.inUse}
        </Badge>
      ) : null}
      <TooltipTrigger placement="top">
        <ActionButton isQuiet size="S" aria-label={FONT_COPY.removeLabel(tip, r.family)} isDisabled={r.inUse} onPress={() => void remove()}>
          <Delete />
        </ActionButton>
        <Tooltip>{tip}</Tooltip>
      </TooltipTrigger>
    </div>
  );
}
