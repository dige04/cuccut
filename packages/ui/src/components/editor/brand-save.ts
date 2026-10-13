import type { AssetRecord, BrandMediaKind, CaptionStyleBody, DocumentRecord, LibrarySource } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { isDefaultStyleName } from '../../model/caption-presets.ts';
import { BRAND_SECTIONS, captionStyleProblem, clipBrandName } from '../../model/library-brand.ts';
import { libraryErrorText } from '../../model/library-entry.ts';
import { putLibraryEntry } from '../../runtime/library-commands.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useVideo } from '../../state/video-store.ts';
import { BRAND_COPY as IB } from './brand-copy.ts';

/**
 * Stores the caption style in use in this video into the brand library (shared by the brand page's “Store current style” and the stage caption toolbar's “Store to brand library”): reads the current version of that `caption-style` document and reports the result with a toast. Returns true if it was stored.
 */
export async function saveCaptionStyleToBrand(runtime: RuntimeSession, record: DocumentRecord): Promise<boolean> {
  const video = useVideo.getState().video;
  if (!video?.videoId) return false;
  try {
    const { body } = await runtime.client.request('documents.read', {
      videoId: video.videoId,
      documentId: record.id,
      revision: record.currentRevision,
    });
    const problem = captionStyleProblem(body);
    if (problem) {
      ToastQueue.negative(IB.saveProblem(problem), { timeout: 6000 });
      return false;
    }
    const videoName = video.state?.video.name;
    // Default style documents all share one name (in the language used when they were created), so the video name is added: several stored styles can then be told apart.
    const isDefaultName = isDefaultStyleName(record.name) || record.name === IB.captionStyle;
    const name = clipBrandName(isDefaultName && videoName ? IB.captionStyleName(videoName) : record.name) || IB.captionStyle;
    await putLibraryEntry(runtime, { library: 'brand', content: { name, kind: 'captionStyle', style: body as CaptionStyleBody } });
    ToastQueue.positive(IB.savedStyle(name), { timeout: 4000 });
    return true;
  } catch (error) {
    ToastQueue.negative(libraryErrorText(IB.actionSaveStyle, error), { timeout: 6000 });
    return false;
  }
}

/**
 * Stores one asset from the video into a section of the brand library (shared by the brand page's asset list and the stage toolbar's “Store to brand library”): generated assets use the product, linked assets use the original file (`source` comes from `assetLibrarySource`). The result is reported with a toast; returns true if it was stored.
 */
export async function saveAssetToBrand(runtime: RuntimeSession, asset: AssetRecord, kind: BrandMediaKind, source: LibrarySource): Promise<boolean> {
  const name = clipBrandName(asset.name) || IB.untitled;
  try {
    await putLibraryEntry(runtime, { library: 'brand', content: { name, kind }, source });
    ToastQueue.positive(IB.addedOne(BRAND_SECTIONS.find((section) => section.kind === kind)?.title ?? kind, name), { timeout: 4000 });
    return true;
  } catch (error) {
    ToastQueue.negative(libraryErrorText(IB.actionSaveToBrand, error), { timeout: 6000 });
    return false;
  }
}
