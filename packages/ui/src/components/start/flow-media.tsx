import { ActionButton, Badge, Text, TextField } from '@react-spectrum/s2';
import Folder from '@react-spectrum/s2/icons/Folder';
import Link from '@react-spectrum/s2/icons/Link';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { linkFacts, urlValid } from '../../model/new-flow.ts';
import { DownloaderCard, type DownloaderView } from './downloader-card.tsx';
import { ST } from './start-copy.ts';

/*
 * The video link tier (design draft new-media.jsx link tier): after a link is pasted, a link card appears (it writes only what the address itself reveals; the real title is resolved when downloading),
 * with a persistent “Download to…” row and the download tool card. Shared by Tools › Import from link and the link source for transcription.
 *
 * Differences from the design draft: there is no “which computer to download on”, because the Runtime's downloads run only locally.
 */

const mediaCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginTop: 8,
  padding: 12,
  borderRadius: 'lg',
  backgroundColor: 'gray-25',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const thumb = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 40,
  height: 40,
  borderRadius: 'default',
  color: 'gray-700',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const cardText = style({ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 });
const cardTitle = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900', truncate: true });
const cardMeta = style({ font: 'ui-sm', color: 'gray-700' });
const cardPath = style({ font: 'code-xs', color: 'gray-600', truncate: true });
const urlField = style({ width: 'full', marginTop: 8 });
const hint = style({ marginTop: 8, marginBottom: 0, font: 'ui-xs', color: 'gray-600' });
const saveRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 12,
  color: 'gray-600',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const saveText = style({ flexGrow: 1, minWidth: 0, font: 'ui-sm', color: 'gray-700', truncate: true });

export interface LinkSourceProps {
  url: string;
  onUrl(url: string): void;
  downloader: DownloaderView;
  /** Position of the “Download to …” row. */
  downloadDir: string;
  onChangeDir(): void;
  /** The description below “Download to”. */
  note: string;
}

/** Link tier: address, link card, “Download to …” and the download tool card. */
export function LinkSource({ url, onUrl, downloader, downloadDir, onChangeDir, note }: LinkSourceProps) {
  const trimmed = url.trim();
  const ok = urlValid(trimmed);
  const facts = ok ? linkFacts(trimmed) : null;
  return (
    <>
      <TextField aria-label={ST.link.field} styles={urlField} placeholder={ST.link.placeholder} value={url} onChange={onUrl} inputMode="url" />
      {facts ? (
        <div className={mediaCard}>
          <span className={thumb} aria-hidden>
            <Link />
          </span>
          <span className={cardText}>
            <span className={cardTitle} title={facts.title}>
              {facts.title}
            </span>
            <span className={cardMeta}>{ST.link.plan}</span>
            <span className={cardPath} title={trimmed}>
              {trimmed}
            </span>
          </span>
          <Badge variant="neutral" fillStyle="subtle" size="S">
            {ST.link.waiting}
          </Badge>
        </div>
      ) : (
        <p className={hint}>{url ? ST.link.invalid : ST.link.hint}</p>
      )}
      <div className={saveRow}>
        <Folder aria-hidden />
        <span className={saveText} title={downloadDir}>
          {ST.link.downloadTo(downloadDir)}
        </span>
        <ActionButton isQuiet size="XS" onPress={onChangeDir}>
          <Text>{ST.link.change}</Text>
        </ActionButton>
      </div>
      <p className={hint}>{note}</p>
      <DownloaderCard view={downloader} />
    </>
  );
}
