import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError, localizeText, refOf, setLocale, type GrantRequestItem } from '@cuccut/protocol';
import { RcAgentTools, RcCommon, RcExport, RcPackage, RcReview, RcSpace } from '@cuccut/protocol/messages/runtime-core';
import { FONT_DOWNLOAD_REMEDIES, fontDownloadRemedy } from './fonts/font-download.ts';
import { grantRequiredDetails } from './grants/grant-errors.ts';
import { taskFailure } from './localized.ts';
import { videoDirName } from './videos/video-service.ts';

/** Text the Runtime emits is generated in the current language, and references travel with errors over the wire (repo convention §5). The test process is pinned to Simplified Chinese by default; here it is switched to English. */
describe('runtime-core 的文案目录', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('英文缺省：共用短句与任务失败的说明是英文，引用可以按简体中文重新生成', () => {
    expect(RcCommon.cancelled().text).toBe('Cancelled');
    const failure = taskFailure('X', RcCommon.cancelled());
    expect(failure.message).toBe('Cancelled');
    expect(failure.messageRef).toEqual({ key: 'rcCommon.cancelled' });
    vi.stubEnv('CUCCUT_LOCALE', 'zh-Hans');
    setLocale('zh-Hans');
    expect(localizeText(failure.message, failure.messageRef)).toBe('已取消');
    expect(new RpcError('conflict', RcCommon.cancelled()).message).toBe('已取消');
  });

  it('授权错误：数据种类按读者的语言列出，补救说明带引用', () => {
    const item = { recipient: 'openai', dataKinds: ['transcript', 'audio'], videoId: null } as unknown as GrantRequestItem;
    const { message, details } = grantRequiredDetails([item]);
    expect(message.text).toBe("Sending transcripts and translations and audio to openai needs the user's grant");
    expect(details.remedy.hint).toMatch(/^An external service's auto level/);
    expect(details.remedy.hintRef).toEqual({ key: 'rcGrants.hintServiceAuto' });
    vi.stubEnv('CUCCUT_LOCALE', 'zh-Hans');
    setLocale('zh-Hans');
    expect(localizeText(message.text, refOf(message))).toBe('把文稿与译文、音频交给 openai 需要用户授权');
  });

  it('字体下载的补救、Space 的引用说明与默认的视频目录名是英文', () => {
    expect(FONT_DOWNLOAD_REMEDIES.FONT_DOWNLOAD_NETWORK).toBe(fontDownloadRemedy('FONT_DOWNLOAD_NETWORK').text);
    expect(FONT_DOWNLOAD_REMEDIES.FONT_DOWNLOAD_NETWORK).not.toMatch(/[一-鿿]/);
    expect(RcSpace.refStrayFiles({ names: 'a.mp4/b.txt/c.png', total: 5 }).text).toBe(
      "The video folder has files the video doesn't manage (a.mp4, b.txt, and c.png, 5 in total). Restore the video and move them out before deleting",
    );
    expect(videoDirName('...')).toBe('Video');
  });

  it('review gate: the refusal, its finding lines and the confirmation summaries are English with references', () => {
    const blocked = RcReview.blocked({ count: 2 });
    expect(blocked.text).toBe('This video doesn’t meet your standard yet: 2 findings stop this export');
    expect(refOf(blocked)).toEqual({ key: 'rcReview.blocked', params: { count: 2 } });
    expect(RcReview.blocked({ count: 1 }).text).toMatch(/1 finding stops/);
    expect(
      RcReview.findingLine({ metric: 'items.placeholders', value: '2', limit: RcReview.limitAtMost({ max: 0 }), fix: 'Fill them.' }).text,
    ).toBe('items.placeholders is 2, and the standard asks for at most 0. Fill them.');
    expect(RcReview.evidenceInvalid({ kind: 'quote' }).text).toMatch(/quote/);
    expect(RcAgentTools.reviewWaive({ id: 'placeholders', reason: 'by design' }).text).toBe('Let the finding “placeholders” stand: by design');
    expect(RcAgentTools.reviewSeverity({ id: 'blank', from: 'critical', to: 'nitpick' }).text).toBe('Change what “blank” is worth: critical → nitpick');
  });

  it('导出与便携包：复数与嵌套的引用', () => {
    expect(RcCommon.videoNotOpen().text).toBe("The video isn't open");
    expect(RcExport.partiallyPublished({ failed: 1, published: 2 }).text).toBe("1 file wasn't exported; 2 were published");
    expect(RcExport.projectItemOmitted({ kind: 'Confetti', itemId: 'i1', name: null, reason: 'not supported' }).text).toBe(
      'Confetti item i1: not supported',
    );
    expect(RcPackage.entryIncludedWithoutPath({ what: RcPackage.entryAsset({ ref: 'a1' }) }).text).toBe(
      'Asset a1 is marked as included but has no path',
    );
  });
});
