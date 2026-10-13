import { useEffect } from 'react';
import { ActionButton, Button, Text, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import ChevronLeft from '@react-spectrum/s2/icons/ChevronLeft';
import Download from '@react-spectrum/s2/icons/Download';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { FONT_PRIVACY_NOTE, detailRows, familyKey, fontError, removeToast, rowEnd, type FontRow } from '../../model/font-library.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { cancelFamily, downloadFamily, removeFamily, requestSample, useFontLibrary } from '../../state/font-library-store.ts';
import { FONT_COPY as FC } from './font-copy.ts';

/**
 * Font details (prototype panel-font-picker.jsx's FontDetail): status, source, category and sample text, weights, size and license. Depending on the status it offers download, cancel download, retry, and delete the downloaded files, and finally “用这个字体” (use this font).
 */

const wrap = style({ paddingY: 4 });
const header = style({ display: 'flex', alignItems: 'center', gap: '[6px]', minWidth: 0, font: 'ui' });
const title = style({ flexGrow: 1, minWidth: 0, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const list = style({
  display: 'grid',
  gridTemplateColumns: ['auto', '1fr'],
  columnGap: 12,
  rowGap: '[6px]',
  marginY: 12,
  marginX: 4,
  font: 'ui-sm',
});
const term = style({ color: 'gray-600' });
const value = style({ margin: 0, minWidth: 0, color: 'gray-900', overflowWrap: 'anywhere' });
const fine = style({ marginTop: 0, marginBottom: 12, marginX: 4, font: 'ui-xs', color: 'gray-600' });
const actions = style({ display: 'flex', flexWrap: 'wrap', justifyContent: 'end', gap: '[6px]' });

/** When the Runtime rejects an action, read out its explanation. */
export const toastError = (error: unknown) => ToastQueue.negative(fontError(error).message, { timeout: 5000 });

/**
 * `inline`: expands in place in the properties bar (on the same screen as the editor's “导出” (Export)), and “用这个字体” (use this font) becomes a neutral button. In a popover, it is the only primary button on that layer.
 */
export function FontDetail({ row: f, onBack, onPick, inline = false }: { row: FontRow; onBack(): void; onPick(): void; inline?: boolean }) {
  const { client } = useRuntime();
  const sample = useFontLibrary((s) => s.samples[familyKey(f.family)]);
  useEffect(() => void requestSample(client, f.family), [client, f.family]);
  const end = rowEnd(f);
  const remove = () =>
    removeFamily(client, f.family).then(
      () => ToastQueue.neutral(removeToast(f.family, null).text, { timeout: 4000 }),
      (error: unknown) => ToastQueue.info(removeToast(f.family, error).text, { timeout: 5000 }),
    );
  return (
    <div className={wrap}>
      <div className={header}>
        <TooltipTrigger placement="top">
          <ActionButton isQuiet size="S" aria-label={FC.backToList} onPress={onBack}>
            <ChevronLeft />
          </ActionButton>
          <Tooltip>{FC.backToList}</Tooltip>
        </TooltipTrigger>
        <b className={title} style={sample?.state === 'ready' ? { fontFamily: `${sample.css}, system-ui, sans-serif` } : undefined}>
          {f.family}
        </b>
      </div>
      <dl className={list}>
        {detailRows(f).map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt className={term}>{k}</dt>
            <dd className={value}>{v}</dd>
          </div>
        ))}
      </dl>
      {f.source === 'google-fonts' ? <p className={fine}>{FONT_PRIVACY_NOTE}</p> : null}
      <div className={actions}>
        {end.kind === 'download' ? (
          <Button variant="secondary" size="S" onPress={() => void downloadFamily(client, f.family).catch(toastError)}>
            <Download />
            <Text>{FC.download}</Text>
          </Button>
        ) : null}
        {end.kind === 'progress' ? (
          <Button variant="secondary" size="S" onPress={() => void cancelFamily(client, f.family).catch(toastError)}>
            {FC.cancelDownload}
          </Button>
        ) : null}
        {end.kind === 'retry' ? (
          <Button variant="secondary" size="S" onPress={() => void downloadFamily(client, f.family).catch(toastError)}>
            <Refresh />
            <Text>{FC.retry}</Text>
          </Button>
        ) : null}
        {f.state === 'downloaded' ? (
          <Button variant="secondary" fillStyle="outline" size="S" onPress={() => void remove()}>
            {FC.deleteDownloaded}
          </Button>
        ) : null}
        <Button variant={inline ? 'secondary' : 'accent'} size="S" onPress={onPick}>
          {FC.useThis}
        </Button>
      </div>
    </div>
  );
}
