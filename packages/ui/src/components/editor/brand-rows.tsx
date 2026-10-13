import { useEffect, useState } from 'react';
import type { BrandContent, LibraryEntry, LibraryEntrySummary } from '@cuccut/protocol';
import { ActionButton, ColorSwatch, Menu, MenuItem, MenuSection, MenuTrigger, Text } from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Animation from '@react-spectrum/s2/icons/Animation';
import Copy from '@react-spectrum/s2/icons/Copy';
import Delete from '@react-spectrum/s2/icons/Delete';
import Image from '@react-spectrum/s2/icons/Image';
import More from '@react-spectrum/s2/icons/More';
import Rename from '@react-spectrum/s2/icons/Rename';
import Video from '@react-spectrum/s2/icons/Video';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { brandMeta, brandPlacement, colorCss, isLottieSticker } from '../../model/library-brand.ts';
import { useLibraryEntry, useLibraryFileUrl } from '../use-library-entry.ts';
import { BRAND_COPY as IB } from './brand-copy.ts';

export type BrandRowAction = 'place' | 'rename' | 'copy' | 'delete';

/** One brand library row (design mockup .brow): a 32px thumbnail cell, name and description, and “more” on the right. */
const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingY: 8,
  paddingStart: 8,
  paddingEnd: 4,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-25',
});
const thumb = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 32,
  height: 32,
  borderRadius: 'default',
  backgroundColor: 'gray-100',
  font: 'ui-sm',
  color: 'gray-700',
  overflow: 'hidden',
  fontWeight: 'bold',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const thumbImage = style({ width: 'full', height: 'full', objectFit: 'contain' });
const info = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 });
const nameStyle = style({
  font: 'ui-sm',
  fontWeight: 'bold',
  color: 'gray-900',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const meta = style({ font: 'ui-xs', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

/** How the “put into video” item is described: depends on where it goes. */
function placeLabel(content: BrandContent): string | null {
  if (content.kind === 'color') return null;
  if (content.kind === 'captionStyle') return IB.applyToCaptions;
  const placement = brandPlacement(content);
  if (placement === 'lottie') return IB.placeOnCanvas;
  if (placement === 'asset') return IB.placeOnTimeline;
  return IB.copyToAssets;
}

/**
 * One item in the brand library: a thumbnail (images and image stickers use the file; fonts show their own “Aa”; colors are swatches), name and description, and an action menu.
 * When “put into video” is unavailable, the reason is stated (`placeBlocked`).
 */
export function BrandRow({
  summary,
  placeBlocked,
  onAction,
}: {
  summary: LibraryEntrySummary;
  /** The reason the item cannot be put into the video; null when it can. */
  placeBlocked: string | null;
  onAction(action: BrandRowAction, summary: LibraryEntrySummary, entry: LibraryEntry | null): void;
}) {
  const { entry, error } = useLibraryEntry(summary);
  const content = entry ? (entry.content as BrandContent) : null;
  const place = content ? placeLabel(content) : null;
  const disabled = [
    ...(content ? [] : ['place', 'rename', 'copy']),
    ...(placeBlocked ? ['place'] : []),
  ];
  return (
    <li className={row}>
      <BrandThumb summary={summary} content={content} />
      <span className={info}>
        <span className={nameStyle} title={summary.name}>
          {summary.name}
        </span>
        <span className={meta}>{content ? brandMeta(content) : error ? IB.unreadable(error) : IB.loading}</span>
      </span>
      <MenuTrigger>
        <ActionButton isQuiet size="S" aria-label={IB.actionsFor(summary.name)}>
          <More />
        </ActionButton>
        <Menu
          aria-label={IB.actionsFor(summary.name)}
          disabledKeys={disabled}
          onAction={(key) => onAction(key as BrandRowAction, summary, entry)}>
          <MenuSection>
            {place ? (
              <MenuItem id="place" textValue={place}>
                <Add />
                <Text slot="label">{place}</Text>
                {placeBlocked ? <Text slot="description">{placeBlocked}</Text> : null}
              </MenuItem>
            ) : null}
            {summary.kind === 'color' ? (
              <MenuItem id="copy" textValue={IB.copyValue}>
                <Copy />
                <Text slot="label">{IB.copyValue}</Text>
              </MenuItem>
            ) : null}
            <MenuItem id="rename" textValue={IB.rename}>
              <Rename />
              <Text slot="label">{IB.renameEllipsis}</Text>
            </MenuItem>
          </MenuSection>
          <MenuSection>
            <MenuItem id="delete" textValue={IB.deleteFromLibrary}>
              <Delete />
              <Text slot="label">{IB.deleteFromLibraryEllipsis}</Text>
            </MenuItem>
          </MenuSection>
        </Menu>
      </MenuTrigger>
    </li>
  );
}

function BrandThumb({ summary, content }: { summary: LibraryEntrySummary; content: BrandContent | null }) {
  const still = !!content && (content.kind === 'image' || (content.kind === 'sticker' && !isLottieSticker(content)));
  const font = content?.kind === 'font';
  const url = useLibraryFileUrl(still || font ? summary : null);
  const family = useFontFamily(font ? url : null, `${summary.id}-${summary.version}`);
  if (content?.kind === 'color') return <ColorSwatch color={colorCss(content.value)} size="M" />;
  if (still && url) {
    return (
      <span className={thumb} aria-hidden>
        <img className={thumbImage} src={url} alt="" draggable={false} />
      </span>
    );
  }
  if (content?.kind === 'video') {
    return (
      <span className={thumb} aria-hidden>
        <Video />
      </span>
    );
  }
  if (content?.kind === 'sticker' && isLottieSticker(content)) {
    return (
      <span className={thumb} aria-hidden>
        <Animation />
      </span>
    );
  }
  if (content?.kind === 'image' || content?.kind === 'sticker') {
    return (
      <span className={thumb} aria-hidden>
        <Image />
      </span>
    );
  }
  return (
    // Brand fonts preview their “Aa” in their own face: the font name is the user's file, not the interface font.
    <span className={thumb} aria-hidden style={family ? { fontFamily: `"${family}"` } : undefined}>
      Aa
    </span>
  );
}

/** Loads the brand font file into the page for the thumbnail; if it cannot be loaded (format, network), null, falling back to the interface font. */
function useFontFamily(url: string | null, key: string): string | null {
  const [loaded, setLoaded] = useState<{ key: string; family: string } | null>(null);
  useEffect(() => {
    if (!url || typeof FontFace === 'undefined') return;
    const family = `cuccut-brand-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
    let live = true;
    const face = new FontFace(family, `url("${url}")`);
    face.load().then(
      () => {
        document.fonts.add(face);
        if (live) setLoaded({ key, family });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [url, key]);
  return loaded?.key === key ? loaded.family : null;
}
