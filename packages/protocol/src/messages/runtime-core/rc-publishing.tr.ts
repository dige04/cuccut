import type { RcPublishingMessages } from './rc-publishing.ts';

export const tr: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Bunu yalnızca sahibi, bu bilgisayardaki CucCut uygulamasında yapabilir.',
  desktopOnly: 'Yetkilendirme, gönderme, sonuç kaydetme ve bağlantı yönetimi yalnızca bu bilgisayardaki CucCut uygulamasında kullanılabilir.',
  settingsOwnerOnly: 'Yayın planını yalnızca sahibi değiştirebilir. Yayınlama ayarlarında değiştirmesini isteyin.',
  transferNotAllowed: 'Takvim içe ve dışa aktarma, CucCut uygulamasında ve komut satırında kullanılabilir.',
  authorizationRequired: 'Bir ajanın gönderebilmesi için sahibinin bu tam yayını CucCut’ta yetkilendirmesi gerekir.',
  // Publications.
  publicationArchived: 'Bu yayın arşivlendi. Değiştirmeden önce geri yükleyin.',
  publicationLocked: 'Gönderilen hedefler ortak içeriklerini korur. Başarısız bir hedefi düzenleyin veya yeni bir yayın hazırlayın.',
  destinationLocked: 'Bu hesabın teslimatı zaten başladı. Değiştirmeden önce geri çekin ya da sonucunu kaydedin.',
  destinationKept: 'Gönderilen bir hedef yayında kalır. Kaldırmadan önce geri çekin ya da sonucunu kaydedin.',
  destinationAccountFixed: 'Başka bir hesabı kullanmak için bu hedefi kaldırın ve bunun yerine hesabı ekleyin.',
  destinationNotFound: 'Bu hesap artık yayının bir parçası değil. Yeniden yükleyip tekrar deneyin.',
  duplicateAccount: 'Her hesabı yalnızca bir kez seçin.',
  duplicatePlacement: 'Her hesabın saatini yalnızca bir kez seçin.',
  afterExpiry: 'Bu yayının son kullanma tarihinden önce bir saat seçin.',
  invalid: 'Bu yayın henüz hazır değil. Listelenen sorunları düzeltip tekrar deneyin.',
  nothingToSend: 'Bu yayındaki tüm hesaplara zaten gönderildi. Yeniden göndermek için yeni bir yayın hazırlayın.',
  slotTaken: (p: { account: string }) =>
    `Bu saat, ${p.account} için başka bir yayınla çakışıyor. Başka bir saat seçin ya da Yayınlama ayarlarında gönderiler arasında daha az süreye izin verin.`,
  calendarRange: 'En fazla 93 günlük bir takvim aralığı seçin ve başlangıç, bitişten önce olmalıdır.',
  archiveInFlight: 'Bu yayını arşivlemeden önce bekleyen teslimatları geri çekin ya da sonuçlarını kaydedin.',
  // Delivery.
  providerUnsupported: 'Bu CucCut sürümü yalnızca elle yayınlar. Bu bağlantı için Elle seçeneğini seçin.',
  notWaiting: 'Yalnızca sizi bekleyen bir hesap geri çekilebilir.',
  cancelNotAllowed: 'Yalnızca gönderilmemiş bir hesap iptal edilebilir. Geri çekin ya da önce sonucunu kaydedin.',
  reconcileFinal: 'Yayınlanmış ya da iptal edilmiş bir teslimat geçmişin parçasıdır. Değiştirmek yerine yeni bir yayın hazırlayın.',
  reconcileSending: 'Sonuç kaydetmeden önce mevcut teslimatın bitmesini bekleyin.',
  reconcileFutureTime: 'Ağın bu gönderi için gösterdiği gelecek saati girin.',
  // Pinned exports.
  exportRequired: 'Önce videoyu işleyip sabitleyin.',
  exportChanged: 'Onaylanan dışa aktarma değişti. Yayınlamadan önce doğrulanmış bir dışa aktarma sabitleyin.',
  exportStale: 'Sabitlemeden önce geçerli sürümü dışa aktarın ya da İşle ve sabitle seçeneğini seçin.',
  exportNotFinished: 'Bu dışa aktarma henüz bitmedi. Bekleyin ya da başka bir dışa aktarma seçin.',
  exportNotVideo: 'Tüm videonun tamamlanmış bir MP4 dışa aktarmasını seçin.',
  exportOtherVideo: 'Bu dışa aktarma başka bir video ya da diziye ait. Bu videonun bir dışa aktarmasını seçin.',
  exportFileMissing: 'Dışa aktarılan dosya artık bu bilgisayarda yok. Videoyu yeniden işleyip sabitleyin.',
  exportFileChanged: 'Dışa aktarılan dosya işlendikten sonra değişti. Videoyu yeniden işleyip sabitleyin.',
  pinLocked: 'Gönderilen hedefler sabitlenmiş dışa aktarmalarını korur. Başka bir dışa aktarmayı kullanmak için yeni bir yayın hazırlayın.',
  renderFailed: 'Bu yayının dışa aktarması tamamlanamadı. Yeniden işleyip sabitleyin.',
  renderCancelled: 'Bu yayının dışa aktarması iptal edildi. Hazır olduğunuzda yeniden işleyip sabitleyin.',
  videoNotFound: 'Bu video bu bilgisayarda değil. Projesini açıp tekrar deneyin.',
  sequenceNotFound: "Bu videonun böyle bir dizisi yok. Videonun ana dizisini yayınlamak için diziyi dışarıda bırakın.",
  sequenceOneVideo: 'Dizi yalnızca tek bir video hazırlanırken seçilir.',
  // Settings, connections and accounts.
  accountNotFound: 'Bu hesap artık mevcut değil. Yayınlama ayarlarını yeniden yükleyip tekrar deneyin.',
  connectionNotFound: 'Bu bağlantı artık mevcut değil. Yayınlama ayarlarını yeniden yükleyip tekrar deneyin.',
  defaultAccountMissing: 'Bir varsayılan hesap artık mevcut değil. Varsayılan hesapları yeniden seçin.',
  connectionProviderFixed: 'Bir bağlantı, eklendiği rotayı korur. Başka bir yolla yayınlamak için yeni bir bağlantı ekleyin.',
  accountIdentityFixed: 'Bir hesap bağlantısını ve ağını korur. Bunun yerine yeni bir hesap ekleyin.',
  accountDuplicate: 'Bu hesap zaten bu bağlantıya eklenmiş.',
  accountInUse: (p: { name: string }) =>
    `${p.name} için bekleyen, planlanmış ya da onaylanmamış bir gönderi var. Hesabı kaldırmadan önce sonucunu kaydedin.`,
  linkInvalid: 'Aynı ağda, kendisi bağlı olmayan başka bir hesap seçin.',
  linkCanonical: 'Diğer hesaplar buna bağlı. Bunun yerine diğer rotayı bu hesaba bağlayın.',
  // Copy proposals.
  proposalReason: 'Video, dökümü ve yazım yönergelerinize dayalı taslak. Uygulamadan önce gözden geçirin.',
  proposalUnreadable: "Metin modelinin yanıtı okunamadı. Metin öner’i yeniden deneyin ya da metni kendiniz yazın.",
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut yayınlama',
  // Calendar transfer and cleanup.
  backupFailed: 'Yayınlama verilerinin yedeği yazılamadı, bu yüzden hiçbir şey içe aktarılmadı. Diski kontrol edip tekrar deneyin.',
};
