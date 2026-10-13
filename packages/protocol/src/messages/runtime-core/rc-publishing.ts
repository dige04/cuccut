import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-publishing.zh-Hans.ts';
import { zhHant } from './rc-publishing.zh-Hant.ts';
import { ja } from './rc-publishing.ja.ts';
import { ko } from './rc-publishing.ko.ts';
import { es } from './rc-publishing.es.ts';
import { fr } from './rc-publishing.fr.ts';
import { de } from './rc-publishing.de.ts';
import { nl } from './rc-publishing.nl.ts';
import { ptBR } from './rc-publishing.pt-BR.ts';
import { it } from './rc-publishing.it.ts';
import { ru } from './rc-publishing.ru.ts';
import { pl } from './rc-publishing.pl.ts';
import { tr } from './rc-publishing.tr.ts';
import { vi } from './rc-publishing.vi.ts';

/** The publishing service (`packages/runtime-core/src/publishing/*`): errors of `publishing.*`, render-and-pin and copy proposal outcomes. */
const en = {
  // Who may do what (design §4.2).
  ownerOnly: 'Only the owner can do this, in the CucCut app on this computer.',
  desktopOnly: 'Authorizing, sending, recording results and managing connections are available only in the CucCut app on this computer.',
  settingsOwnerOnly: 'Only the owner can change the publishing schedule. Ask them to change it in Publishing settings.',
  transferNotAllowed: 'Calendar import and export are available in the CucCut app and the command line.',
  authorizationRequired: 'The owner must authorize this exact publication in CucCut before an agent can send it.',
  // Publications.
  publicationArchived: 'This publication is archived. Restore it before changing it.',
  publicationLocked: 'Submitted destinations keep their shared content. Edit a failed destination, or prepare a new release.',
  destinationLocked: "This account's delivery has already started. Withdraw it or record its result before changing it.",
  destinationKept: 'A submitted destination stays in the publication. Withdraw it or record its result before removing it.',
  destinationAccountFixed: 'To use another account, remove this destination and add the account instead.',
  destinationNotFound: 'This account is no longer part of the publication. Reload it and try again.',
  duplicateAccount: 'Choose each account only once.',
  duplicatePlacement: "Choose each account's time only once.",
  afterExpiry: 'Choose a time before this publication expires.',
  invalid: "This publication isn't ready yet. Fix the problems listed, then try again.",
  nothingToSend: 'Every account of this publication was already sent. Prepare a new release to send it again.',
  slotTaken: (p: { account: string }) =>
    `This time conflicts with another publication for ${p.account}. Choose another time, or allow less time between posts in Publishing settings.`,
  slotsHaveDestinationTimes:
    'Some of these publications have their own time for an account. Clear those times before reserving shared times.',
  calendarRange: 'Choose a calendar range of at most 93 days, with the start before the end.',
  archiveInFlight: 'Withdraw deliveries that are waiting, or record their result, before archiving this publication.',
  // Delivery.
  providerUnsupported: 'This version of CucCut publishes by hand only. Choose By hand for this connection.',
  notWaiting: 'Only an account waiting for you can be withdrawn.',
  cancelNotAllowed: 'Only an account that was not sent can be cancelled. Withdraw it, or record its result first.',
  reconcileFinal: 'A published or cancelled delivery is part of the history. Prepare a new release instead of changing it.',
  reconcileSending: 'Wait for the current delivery to finish before recording a result.',
  reconcileFutureTime: 'Enter the future time the network shows for this post.',
  // Pinned exports.
  exportRequired: 'Render and pin the video first.',
  exportChanged: 'Approved export changed. Pin a verified export before publishing.',
  exportStale: 'Export the current revision before pinning it, or choose Render and pin.',
  exportNotFinished: "This export hasn't finished. Wait for it, or choose another export.",
  exportNotVideo: 'Choose a finished MP4 export of the whole video.',
  exportOtherVideo: 'This export is of another video or sequence. Choose an export of this video.',
  exportFileMissing: 'The exported file is no longer on this computer. Render and pin the video again.',
  exportFileChanged: 'The exported file changed after it was rendered. Render and pin the video again.',
  pinLocked: 'Submitted destinations keep their pinned export. Prepare a new release to use another export.',
  renderFailed: "The export for this publication didn't finish. Render and pin it again.",
  renderCancelled: 'The export for this publication was cancelled. Render and pin it again when you are ready.',
  videoNotFound: "This video isn't on this computer. Open its project, then try again.",
  // Settings, connections and accounts.
  accountNotFound: 'This account no longer exists. Reload Publishing settings and try again.',
  connectionNotFound: 'This connection no longer exists. Reload Publishing settings and try again.',
  defaultAccountMissing: 'A default account no longer exists. Choose the default accounts again.',
  connectionProviderFixed: 'A connection keeps the route it was added with. Add a new connection to publish another way.',
  accountIdentityFixed: 'An account keeps its connection and network. Add a new account instead.',
  accountDuplicate: 'This account is already added to this connection.',
  accountInUse: (p: { name: string }) =>
    `${p.name} has a post that is waiting, scheduled or unconfirmed. Record its result before removing the account.`,
  linkInvalid: 'Choose another account on the same network that is not linked itself.',
  linkCanonical: 'Other accounts are linked to this one. Link the other route to this account instead.',
  // Copy proposals.
  proposalReason: 'Draft based on the video, its transcript and your writing guidance. Review it before applying.',
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut publishing',
  // Calendar transfer and cleanup.
  backupFailed: "A backup of the publishing data couldn't be written, so nothing was imported. Check the disk and try again.",
};

export type RcPublishingMessages = typeof en;

export const RcPublishing = defineCatalog('rcPublishing', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
