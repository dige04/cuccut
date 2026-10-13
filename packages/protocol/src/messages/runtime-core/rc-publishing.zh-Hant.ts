import type { RcPublishingMessages } from './rc-publishing.ts';

export const zhHant: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: '只有擁有者可以在這台電腦上的 CucCut 應用程式中執行此操作。',
  desktopOnly: '授權、傳送、記錄結果和管理連線只能在這台電腦上的 CucCut 應用程式中進行。',
  settingsOwnerOnly: '只有擁有者可以變更發布排程。請讓擁有者在發布設定中修改。',
  transferNotAllowed: '行事曆匯入和匯出可在 CucCut 應用程式和命令列中使用。',
  authorizationRequired: '擁有者需要先在 CucCut 中授權這個確切的發布，代理人才能傳送它。',
  // Publications.
  publicationArchived: '此發布已封存。請先還原，再進行變更。',
  publicationLocked: '已傳送的目標會保留共用內容。請編輯失敗的目標，或準備新的發布。',
  destinationLocked: '此帳號的投遞已經開始。請先撤回或記錄結果，再進行變更。',
  destinationKept: '已傳送的目標會保留在發布中。請先撤回或記錄結果，再將其移除。',
  destinationAccountFixed: '若要使用其他帳號，請移除此目標，並改為新增該帳號。',
  destinationNotFound: '此帳號已不在此發布中。請重新載入後再試。',
  duplicateAccount: '每個帳號只能選擇一次。',
  duplicatePlacement: '每個帳號的時間只能選擇一次。',
  afterExpiry: '請選擇此發布到期之前的時間。',
  invalid: '此發布尚未就緒。請修正列出的問題後重試。',
  nothingToSend: '此發布的所有帳號都已傳送。如要再次傳送，請準備新的發布。',
  slotTaken: (p: { account: string }) =>
    `此時間與 ${p.account} 的另一則發布衝突。請選擇其他時間，或在發布設定中允許較短的發布間隔。`,
  calendarRange: '請選擇不超過 93 天的行事曆範圍，且開始時間早於結束時間。',
  archiveInFlight: '封存此發布前，請撤回待處理的投遞或記錄其結果。',
  // Delivery.
  providerUnsupported: '目前版本的 CucCut 只支援手動發布。請為此連線選擇「手動」。',
  notWaiting: '只能撤回正在等待您處理的帳號。',
  cancelNotAllowed: '只能取消尚未傳送的帳號。請撤回它，或先記錄其結果。',
  reconcileFinal: '已發布或已取消的投遞屬於歷史紀錄。請準備新的發布，而不是修改它。',
  reconcileSending: '請等待目前的投遞完成後再記錄結果。',
  reconcileFutureTime: '請輸入網路為此貼文顯示的未來時間。',
  // Pinned exports.
  exportRequired: '請先算繪並釘選影片。',
  exportChanged: '已核准的匯出已變更。發布前請釘選已驗證的匯出。',
  exportStale: '釘選前請匯出目前的版本，或選擇「算繪並釘選」。',
  exportNotFinished: '此匯出尚未完成。請等待或選擇其他匯出。',
  exportNotVideo: '請選擇整部影片已完成的 MP4 匯出。',
  exportOtherVideo: '此匯出屬於其他影片或序列。請選擇此影片的匯出。',
  exportFileMissing: '匯出的檔案已不在這台電腦上。請重新算繪並釘選影片。',
  exportFileChanged: '匯出的檔案在算繪後已有變更。請重新算繪並釘選影片。',
  pinLocked: '已傳送的目標會保留其釘選的匯出。如要使用其他匯出，請準備新的發布。',
  renderFailed: '此發布的匯出未能完成。請重新算繪並釘選。',
  renderCancelled: '此發布的匯出已取消。準備好後請重新算繪並釘選。',
  videoNotFound: '這台電腦上找不到此影片。請開啟其專案後重試。',
  sequenceNotFound: "This video has no such sequence. Leave the sequence out to publish the video's main sequence.",
  sequenceOneVideo: 'Choose a sequence only when preparing one video.',
  // Settings, connections and accounts.
  accountNotFound: '此帳號已不存在。請重新載入發布設定後再試。',
  connectionNotFound: '此連線已不存在。請重新載入發布設定後再試。',
  defaultAccountMissing: '預設帳號已不存在。請重新選擇預設帳號。',
  connectionProviderFixed: '連線會保留新增時所用的管道。如要以其他方式發布，請新增新連線。',
  accountIdentityFixed: '帳號會保留其連線和網路。請改為新增新帳號。',
  accountDuplicate: '此帳號已新增到該連線中。',
  accountInUse: (p: { name: string }) =>
    `${p.name} 有待處理、已排程或未確認的貼文。請先記錄其結果，再移除該帳號。`,
  linkInvalid: '請選擇同一網路中、本身未被關聯的其他帳號。',
  linkCanonical: '其他帳號已關聯到此帳號。請改為將另一管道關聯到此帳號。',
  // Copy proposals.
  proposalReason: '根據影片、逐字稿和您的寫作指南產生的草稿。套用前請先檢查。',
  proposalUnreadable: "The text model's answer couldn't be read. Try Propose text again, or write the text yourself.",
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut 發布',
  // Calendar transfer and cleanup.
  backupFailed: '無法寫入發布資料的備份，因此未匯入任何內容。請檢查磁碟後重試。',
};
