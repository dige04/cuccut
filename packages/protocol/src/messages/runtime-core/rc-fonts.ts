import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-fonts.zh-Hans.ts';
import { zhHant } from './rc-fonts.zh-Hant.ts';
import { ja } from './rc-fonts.ja.ts';
import { ko } from './rc-fonts.ko.ts';
import { es } from './rc-fonts.es.ts';
import { fr } from './rc-fonts.fr.ts';
import { de } from './rc-fonts.de.ts';
import { nl } from './rc-fonts.nl.ts';
import { ptBR } from './rc-fonts.pt-BR.ts';
import { it } from './rc-fonts.it.ts';
import { ru } from './rc-fonts.ru.ts';
import { pl } from './rc-fonts.pl.ts';
import { tr } from './rc-fonts.tr.ts';
import { vi } from './rc-fonts.vi.ts';

/** Errors, remedies and skip reasons for fonts (fonts/). English is the source of keys and types; translations are in `rc-fonts.<language>.ts`. */
const en = {
  manageOnlyInAppOrCli: 'Fonts can only be downloaded, deleted, and checked in the desktop app or the CLI',
  catalogueInvalid: "The font catalog's format is wrong",

  // Remedies (by error code)
  remedyNetwork:
    'The network is unreachable or the download was interrupted. Check the network and download again, or switch mirrors in "Stylesheet URL" and "Font file URL" under Settings › Fonts',
  remedySource: "The font service didn't provide a file for this font. Check the family name and weight, or the mirror addresses in Settings",
  remedyIntegrity:
    "The download isn't a usable font (wrong family name, unreadable, or too large). The bad file was deleted; switch to another mirror and download again",
  remedyNoSpace: 'The disk with the Runtime Home is out of space. Free up space, then download again',

  // Download (font-download)
  diskFullWriting: (p: { what: string }) => `The disk filled up while writing ${p.what}`,
  sourceHttpStatus: (p: { what: string; status: number }) => `The font service returned HTTP ${p.status} for ${p.what}`,
  downloadFailed: (p: { what: string; reason: string }) => `Downloading ${p.what} failed: ${p.reason}`,
  overByteLimit: (p: { what: string; limit: number }) => `${p.what} exceeds the ${p.limit}-byte limit`,

  // Service (font-service)
  downloadCancelled: 'Font download cancelled',
  cancelled: 'Download cancelled',
  offlineStrict: "Fonts aren't downloaded in strict offline mode",
  autoDownloadOff: 'Automatic font download is off ("Download fonts automatically" under Settings › Fonts)',
  downloadFailedOutcome: (p: { reason: string }) => `Download failed: ${p.reason}`,
  notInCatalogue: (p: { family: string }) => `"${p.family}" isn't in the font catalog`,
  noNeedToDownload: (p: { family: string; bundled: boolean }) =>
    `"${p.family}" ${p.bundled ? 'comes with the app' : 'is already installed on this computer'}, so it doesn't need to be downloaded`,
  inUseByExport: (p: { family: string }) => `"${p.family}" is in use by an unfinished export. Delete it after the export ends`,

  // Specimen
  sampleLabel: (p: { family: string }) => `the ${p.family} sample`,
  sampleCss: (p: { label: string }) => `the stylesheet for ${p.label}`,
  noSampleBlock: (p: { label: string }) => `The font service's response doesn't include ${p.label}`,
  sampleNotOnHost: (p: { label: string }) => `${p.label} isn't on the configured font file host`,
  sampleNotUsable: (p: { label: string }) => `The downloaded ${p.label} isn't a usable font`,

  // Glyphs (one weight/italic)
  faceLabel: (p: { family: string; weight: number; italic: boolean }) => `${p.family} ${p.weight}${p.italic ? ' Italic' : ''}`,
  faceCss: (p: { label: string }) => `the font stylesheet for ${p.label}`,
  noFaceBlock: (p: { label: string }) => `The font service's response doesn't include ${p.label}`,
  faceSplit: (p: { label: string }) => `The font service split ${p.label} into per-character subsets, which CucCut can't merge yet`,
  faceNotOnHost: (p: { label: string }) => `The file for ${p.label} isn't on the configured font file host`,
  faceNotUsable: (p: { label: string }) => `The downloaded ${p.label} isn't a usable font`,
  familyMismatch: (p: { label: string }) => `The family name of the downloaded ${p.label} doesn't match`,
};

export type RcFontsMessages = typeof en;

export const RcFonts = defineCatalog('rcFonts', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
