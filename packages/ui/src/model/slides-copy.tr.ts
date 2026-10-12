import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('tr', { type: 'conjunction' }).format(labels);

export const tr: SlidesMessages = {
  pages: (n) => `${n} slayt`,
  paneLabel: (name) => `“${name}” slaytları`,
  frameTitle: (name) => `Slayt düzenleyici: ${name}`,
  opening: 'Slaytlar açılıyor…',
  unavailableTitle: 'Slayt düzenleyici kullanılamıyor',
  unavailableBody: 'Bu CucCut sürümünde slayt düzenleyici yok. Slayt dosyaları hâlâ klasöründe.',
  openFailed: (reason) => `Slaytlar açılamadı: ${reason}`,
  open: 'Slaytları aç',
  openCard: (name) => `“${name}” slaytlarını aç`,
  openInEditor: 'Slayt düzenleyicide aç',
  annotate: 'Not ekle',
  noteLabel: 'Not',
  notePlaceholder: 'Ne değişmeli?',
  addToChat: 'Sohbete ekle',
  cancel: 'İptal',
  token: (n) => `Slayt notları · ${n}`,
  added: (token) => `Sohbete eklendi · ${token}`,
  removeAll: 'Tüm slayt notlarını kaldır',
  removeOne: (n) => `${n}. notu kaldır`,
  item: (n, label, text) => `Not ${n}, ${label}: ${text}`,
  empty: 'Önce notu yazın, sonra sohbete ekleyin',
  tooLong: (max) => `Bir not en fazla ${max} karakter olabilir`,
  tooMany: (max) => `Bir mesaj en fazla ${max} slayt notu taşıyabilir. Önce bunları gönderin.`,
  noConversation: 'Bu sekme henüz bir oturuma ait değil. Bir oturum başlatmak için mesaj gönderin, ardından not ekleyin.',
  message: 'Slaytları bu notlara göre düzelt.',
  flushFailed: (names) =>
    `${list(names.map((n) => `“${n}”`))} slaytlarındaki değişiklikler henüz kaydedilmedi, bu yüzden mesaj gönderilmedi. Yeniden deneyin ya da önce slayt notlarını kaldırın.`,
};
