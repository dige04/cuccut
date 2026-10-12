import type { CommentLabelMessages } from './comment-labels.ts';

export const tr: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Renk grubu',
    tset: 'Metin stili seti',
    style: 'Metin stili',
    font: 'Yazı tipi',
    knob: 'Stil ayarı',
    editor: 'Stil düzenleyici',
    picker: 'Renk seçici',
    prop: 'Özellik',
    props: 'Özellikler',
    cell: 'Renk değeri',
    agroup: 'Varlık grubu',
    asset: 'Varlık',
    comp: 'Bileşen',
    doc: 'Belge',
    dialog: 'İletişim kutusu',
    lightbox: 'Varlık önizlemesi',
    note: 'Kullanım notu',
    page: 'Bölüm başlığı',
  },
  specials: {
    cover: 'Kapak',
    'font-files': 'Yazı tipi dosyaları',
  },
  element: 'Öğe',
  quote: (name) => `“${name}”`,
};
