import type { SettingsMessages } from './settings-copy.ts';

export const tr: SettingsMessages = {
help: `Kullanım:
  cuccut settings                  Tüm tercihleri listele: anahtar, mevcut değer, varsayılan olup olmadığı ve bir satırlık açıklama
  cuccut settings get <key>        Ayarın mevcut değerini yazdır (JSON)
  cuccut settings set <key> <value>
                                   Ayarı değiştir; değer JSON olarak ayrıştırılır (true, 20,
                                   {"cjk":18,"other":40}); ayrıştırılamazsa dize olarak alınır.
                                   Bilinmeyen anahtarlar ve geçersiz değerler reddedilir, hiçbir şey kaydedilmez
  cuccut settings reset <key>      Varsayılan değeri geri yükle`,
usage: 'Kullanım: cuccut settings [get <key> | set <key> <value> | reset <key>]',
setUsage: 'Kullanım: cuccut settings set <key> <value> (değer JSON olarak ayrıştırılır; JSON olmayan dize olarak alınır; boşluk içeren değerleri tırnak içine alın)',
unknownKey: (key, keys) => `Bilinmeyen ayar: ${key}. Kullanılabilir: ${keys.join(', ')}`, isDefault: 'varsayılan', modified: (defaultValue) => `değiştirildi (varsayılan ${defaultValue})`, settingRejected: (key, value, description) => `${key}, ${value} kabul etmez: ${description}`,
};
