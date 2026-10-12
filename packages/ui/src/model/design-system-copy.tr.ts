import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('tr', { type: 'conjunction' }).format(labels);

export const tr: DesignSystemMessages = {
  paneLabel: (name) => `“${name}” tasarım sistemi`,
  frameTitle: (name) => `Tasarım sistemi düzenleyici: ${name}`,
  opening: 'Tasarım sistemi açılıyor…',
  unavailableTitle: 'Tasarım sistemi düzenleyici kullanılamıyor',
  unavailableBody: 'Bu CucCut sürümünde tasarım sistemi düzenleyici yok. Tasarım sistemi dosyaları hâlâ klasöründe.',
  hostBlockedTitle: 'Tasarım sistemi düzenleyici bu adreste açılamıyor',
  hostBlockedBody: 'Tasarım sistemlerini düzenlemek için CucCut Web’i 127.0.0.1 veya localhost adresinde açın. Tasarım sistemi dosyaları hâlâ klasöründe.',
  openFailed: (reason) => `Tasarım sistemi açılamadı: ${reason}`,
  open: 'Tasarım sistemini aç',
  openInEditor: 'Tasarım sistemi düzenleyicide aç',
  annotate: 'Not ekle',
  noteLabel: 'Not',
  notePlaceholder: 'Ne değişmeli?',
  addToChat: 'Sohbete ekle',
  cancel: 'İptal',
  where: (name, label) => `“${name}” tasarım sistemi › ${label}`,
  token: (n) => `Tasarım sistemi notları · ${n}`,
  added: (token) => `Sohbete eklendi · ${token}`,
  removeAll: 'Tüm tasarım sistemi notlarını kaldır',
  removeOne: (n) => `${n}. notu kaldır`,
  item: (n, label, text) => `Not ${n}, ${label}: ${text}`,
  empty: 'Önce notu yazın, sonra sohbete ekleyin',
  tooLong: (max) => `Bir not en fazla ${max} karakter olabilir`,
  tooMany: (max) => `Bir mesaj en fazla ${max} tasarım sistemi notu taşıyabilir. Önce bunları gönderin.`,
  noConversation: 'Bu sekme henüz bir oturuma ait değil. Bir oturum başlatmak için mesaj gönderin, ardından not ekleyin.',
  message: 'Tasarım sistemini bu notlara göre düzelt.',
  flushFailed: (names) =>
    `${list(names.map((n) => `“${n}”`))} tasarım sistemindeki değişiklikler henüz kaydedilmedi, bu yüzden mesaj gönderilmedi. Yeniden deneyin ya da önce tasarım sistemi notlarını kaldırın.`,
};
