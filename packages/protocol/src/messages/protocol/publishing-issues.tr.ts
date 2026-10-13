import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const tr: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Yayınlamadan önce sabitlenmiş dışa aktarmayı onaylayın.',
  exportRequired: 'Yayınlamak için videoyu işleyip sabitleyin.',
  accountsRequired: 'En az bir hesap seçin.',
  timezoneInvalid: 'Geçerli bir saat dilimi seçin.',
  accountUnavailable: 'Bu hesap artık kullanılamıyor. Yeniden bağlayın veya başka bir hesap seçin.',
  accountDuplicateRoute: 'Aynı hesap iki rota üzerinden seçilmiş. Bir rota seçin.',
  accountNotConnected: 'Göndermeden önce bu hesabı Yayınlama ayarlarında bağlayın.',
  formatMismatch: 'Bu biçim hesabın ağıyla uyuşmuyor. Başka bir biçim seçin.',
  descriptionRequired: 'Bu hesap için bir açıklama yazın.',
  titleLength: (p: { max: number }) => `YouTube, 1 ila ${p.max} karakter arasında bir başlık ister.`,
  audienceRequired: 'Bu YouTube videosunun çocuklara yönelik olup olmadığını seçin.',
  tagsTooLong: (p: { max: number }) => `YouTube etiketlerini ${p.max} karakter içinde tutun, aksi halde YouTube bunları kaldırabilir.`,
  shortTooLong: 'YouTube Shorts en fazla üç dakika olabilir. YouTube videosunu seçin veya dışa aktarmayı kısaltın.',
  shortsClassification: 'YouTube, üç dakikaya kadar olan kare veya dikey videoları Shorts olarak sınıflandırır. Bu dışa aktarma için YouTube Short seçin.',
  portraitRequired: 'Bu biçim dikey veya kare bir dışa aktarma gerektirir. Dikey bir sürüm işleyin ya da başka bir biçim seçin.',
  captionTooLong: (p: { length: number; max: number }) => `Açıklama ve etiketler ${p.length} karakter; bu ağ ${p.max} karaktere izin veriyor. Kısaltın.`,
  timeInPast: 'Bu saat geçti. Gelecekteki bir saat seçin ya da hemen göndermek için temizleyin.',
  expiresBefore: 'Bu yayın yayına girmeden önce sona eriyor. Daha erken bir saat ya da daha sonraki bir son kullanma tarihi seçin.',
  deliveryUnsettled:
    'Bu videonun bu hesaba yönelik başka bir yayını hâlâ bekliyor ya da onaylanmadı. Yeniden göndermeden önce sonucunu kaydedin.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'Listelenmemiş görünürlük yalnızca YouTube’da kullanılabilir.',
  optionTagsYoutubeOnly: 'Etiketler yalnızca YouTube’da kullanılabilir. Bunun yerine etiketleri açıklamaya ekleyin.',
  optionPhoneYoutubeTags: 'Telefon rotası YouTube etiketlerini ayarlayamaz. Bunları kaldırın ya da başka bir rota seçin.',
  optionPostbridgeYoutubeAudience:
    'Postbridge, YouTube hedef kitlesini ya da görünürlüğünü ayarlayamaz. Postbridge’de yapılandırılan ayarları kabul edin ya da başka bir rota seçin.',
  optionPostgunSynthetic: 'Postgun, YouTube’un yapay medya bildirimini ekleyemez. Başka bir rota seçin.',
  optionYoutubeApiInteractions: 'Bu rota, seçilen YouTube etkileşim ya da iş birliği seçeneklerini uygulayamaz.',
  optionInstagramApi: 'Bu rota, seçilen Instagram görünürlük, bildirim ya da etkileşim seçeneklerini uygulayamaz.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Geçerli bir tarih ve saat girin.',
  timeRequired: 'Bir tarih ve saat seçin.',
  timeGap: (p: { timezone: string }) => `Saatler değiştiği için bu saat ${p.timezone} saat diliminde yok. Başka bir saat seçin.`,
  timeFold: (p: { timezone: string }) =>
    `Saatler değiştiği için bu saat ${p.timezone} saat diliminde iki kez oluşuyor. UTC farkı içeren tam bir zaman damgası girin.`,
  timestampInvalid: 'UTC farkı içeren bir zaman damgası girin, örneğin 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Son kullanma tarihinden önce uygun boş zaman yok. Hesaplarını, haftalık saatleri ve aralığı kontrol edin.',
  destinationMissing: 'Bu hesap artık yayının bir parçası değil. Yayını yeniden yükleyip tekrar deneyin.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Desteklenen bir sürümle dışa aktarılmış bir CucCut takvim dosyası (JSON) seçin.',
  archiveDuplicatePublications: 'Takvim dosyası bir yayını iki kez listeliyor. Orijinal bilgisayardan yeniden dışa aktarın.',
  archiveDuplicateAccounts: 'Takvim dosyası bir hesabı iki kez listeliyor. Orijinal bilgisayardan yeniden dışa aktarın.',
  archiveDuplicateConnections: 'Takvim dosyası bir bağlantıyı iki kez listeliyor. Orijinal bilgisayardan yeniden dışa aktarın.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `“${p.label}”, takvim dosyasında aynı hesabı iki kez listeliyor. Orijinal bilgisayardan yeniden dışa aktarın.`,
  archiveTimezone: (p: { timezone: string }) => `Takvim dosyası bilinmeyen bir saat dilimi kullanıyor (${p.timezone}). Orijinal bilgisayardan yeniden dışa aktarın.`,
  archiveMissingConnection: (p: { name: string }) => `Takvim dosyasında “${p.name}” için bağlantı yok.`,
  archiveLinkedAccount: (p: { name: string }) => `Takvim dosyasındaki “${p.name}” için bağlı hesap geçersiz.`,
  archiveMissingAccount: (p: { label: string }) => `Takvim dosyasında “${p.label}” tarafından kullanılan bir hesap eksik.`,
  archiveInvalidDate: (p: { label: string }) => `Takvim dosyasında “${p.label}” için geçersiz bir tarih var.`,
  importConnectionConflict: (p: { name: string }) =>
    `Takvim dosyasındaki “${p.name}” bağlantısı, bu bilgisayardaki bir bağlantıyla çakışıyor.`,
  importAccountConflict: (p: { name: string }) => `Takvim dosyasındaki “${p.name}” hesabı, bu bilgisayardaki bir hesapla çakışıyor.`,
  importedInFlight: 'Teslimat sürerken içe aktarıldı. Yeniden göndermeden önce ağın uygulamasında sonucu kontrol edin ve kaydedin.',
};
