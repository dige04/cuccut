import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const ja: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Approve the pinned export before publishing.',
  exportRequired: 'Render and pin the video to publish it.',
  accountsRequired: 'Choose at least one account.',
  timezoneInvalid: 'Choose a valid timezone.',
  accountUnavailable: 'This account is no longer available. Reconnect it or choose another account.',
  accountDuplicateRoute: 'The same account is selected through two routes. Choose one route.',
  accountNotConnected: 'Connect this account in Publishing settings before sending.',
  formatMismatch: "This format doesn't match the account's network. Choose another format.",
  descriptionRequired: 'Write a description for this account.',
  titleLength: (p: { max: number }) => `YouTube needs a title of 1 to ${p.max} characters.`,
  audienceRequired: 'Choose whether this YouTube video is made for kids.',
  tagsTooLong: (p: { max: number }) => `Keep YouTube tags within ${p.max} characters, or YouTube may drop them.`,
  shortTooLong: 'YouTube Shorts can be at most three minutes. Choose YouTube video or shorten the export.',
  shortsClassification: 'YouTube treats square or vertical videos up to three minutes as Shorts. Choose YouTube Short for this export.',
  portraitRequired: 'This format needs a portrait or square export. Render a vertical version or choose another format.',
  captionTooLong: (p: { length: number; max: number }) => `The description and hashtags are ${p.length} characters; this network allows ${p.max}. Shorten them.`,
  timeInPast: 'This time has passed. Choose a future time, or clear it to send now.',
  expiresBefore: 'This publication expires before it goes live. Choose an earlier time or a later expiration.',
  deliveryUnsettled:
    'Another release of this video to this account is still waiting or unconfirmed. Record its result before sending again.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'Unlisted visibility is available only on YouTube.',
  optionTagsYoutubeOnly: 'Tags are available only on YouTube. Put hashtags in the description instead.',
  optionPhoneYoutubeTags: "The phone route can't set YouTube tags. Remove them or choose another route.",
  optionPostbridgeYoutubeAudience:
    "Postbridge can't set YouTube audience or visibility. Accept the settings configured in Postbridge, or choose another route.",
  optionPostgunSynthetic: "Postgun can't add YouTube's synthetic-media disclosure. Choose another route.",
  optionYoutubeApiInteractions: "This route can't apply the selected YouTube interaction or partnership options.",
  optionInstagramApi: "This route can't apply the selected Instagram visibility, disclosure or interaction options.",
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Enter a valid date and time.',
  timeRequired: 'Choose a date and time.',
  timeGap: (p: { timezone: string }) => `This time doesn't exist in ${p.timezone} because the clocks change. Choose another time.`,
  timeFold: (p: { timezone: string }) =>
    `This time happens twice in ${p.timezone} because the clocks change. Enter an exact timestamp with its UTC offset.`,
  timestampInvalid: 'Enter a timestamp with its UTC offset, like 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'No free time fits before it expires. Check its accounts, the weekly times and the spacing.',
  destinationMissing: 'This account is no longer part of the publication. Reload it and try again.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Choose a CucCut calendar file (JSON) exported by a supported version.',
  archiveDuplicatePublications: 'The calendar file lists a publication twice. Export it again from the original computer.',
  archiveDuplicateAccounts: 'The calendar file lists an account twice. Export it again from the original computer.',
  archiveDuplicateConnections: 'The calendar file lists a connection twice. Export it again from the original computer.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `"${p.label}" lists the same account twice in the calendar file. Export it again from the original computer.`,
  archiveTimezone: (p: { timezone: string }) => `The calendar file uses an unknown timezone (${p.timezone}). Export it again from the original computer.`,
  archiveMissingConnection: (p: { name: string }) => `The calendar file is missing the connection for "${p.name}".`,
  archiveLinkedAccount: (p: { name: string }) => `The linked account for "${p.name}" in the calendar file is invalid.`,
  archiveMissingAccount: (p: { label: string }) => `The calendar file is missing an account used by "${p.label}".`,
  archiveInvalidDate: (p: { label: string }) => `The calendar file has an invalid date for "${p.label}".`,
  importConnectionConflict: (p: { name: string }) =>
    `The connection "${p.name}" in the calendar file conflicts with a connection on this computer.`,
  importAccountConflict: (p: { name: string }) => `The account "${p.name}" in the calendar file conflicts with an account on this computer.`,
  importedInFlight: 'Imported while delivery was in progress. Check the result in the network\'s app and record it before sending again.',
};
