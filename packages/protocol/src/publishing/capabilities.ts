import type { DestinationOptions, PublishingNetwork, PublishingProvider } from '../publishing.ts';

/**
 * What each delivery route can apply (port of agentcut `lib/capabilities.ts`). Validation and the payload serializer use the same contract: a selection
 * a route cannot apply is reported, never silently dropped. Pure and browser-safe.
 *
 * The `manual` route ("By hand") is the owner posting in the network's own app or upload page, where every option the network has is available; only
 * the network-level rules apply to it.
 */

/** Issue codes (`publishingIssues.<code>`) for the options a route cannot apply. */
export type RouteOptionIssueCode =
  | 'optionUnlistedYoutubeOnly'
  | 'optionTagsYoutubeOnly'
  | 'optionPhoneYoutubeTags'
  | 'optionPostbridgeYoutubeAudience'
  | 'optionPostgunSynthetic'
  | 'optionYoutubeApiInteractions'
  | 'optionInstagramApi';

export function routeOptionIssues(provider: PublishingProvider, network: PublishingNetwork, options: DestinationOptions): RouteOptionIssueCode[] {
  const issues: RouteOptionIssueCode[] = [];
  if (network !== 'youtube' && options.privacy === 'unlisted') issues.push('optionUnlistedYoutubeOnly');
  if (network !== 'youtube' && options.tags.length) issues.push('optionTagsYoutubeOnly');
  if (provider === 'manual') return issues;
  if (provider === 'iphone') {
    if (network === 'youtube' && options.tags.length) issues.push('optionPhoneYoutubeTags');
    return issues;
  }
  if (network === 'youtube') {
    if (provider === 'postbridge' && (!options.useProviderDefaults || options.madeForKids !== null || options.privacy !== 'public')) {
      issues.push('optionPostbridgeYoutubeAudience');
    }
    if (provider === 'postgun' && options.synthetic) issues.push('optionPostgunSynthetic');
    if (options.branded || options.ownBrand || !options.comments || options.duet || options.stitch) issues.push('optionYoutubeApiInteractions');
  }
  if (
    network === 'instagram' &&
    (options.privacy !== 'public' || options.branded || options.ownBrand || options.synthetic || !options.comments || options.duet || options.stitch)
  ) {
    issues.push('optionInstagramApi');
  }
  return issues;
}

/** Whether a route accepts the provider's own YouTube audience defaults in place of an explicit "made for kids" choice. */
export function routeUsesProviderAudience(provider: PublishingProvider, options: DestinationOptions): boolean {
  return provider === 'postbridge' && options.useProviderDefaults;
}

/** YouTube's tag length rule: each tag counts its characters plus a separator, and two quotes when it contains a space. */
export function youtubeTagsLength(tags: readonly string[]): number {
  return tags.reduce((n, tag) => n + [...tag].length + (tag.includes(' ') ? 2 : 0) + 1, 0);
}
