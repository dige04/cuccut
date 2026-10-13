import type { SpaceMessages } from './space-copy.ts';

export const tr: SpaceMessages = {
help: `Kullanım:
  cuccut space rescan              Kaynak klasörlerini yeniden tara
  cuccut space rebuild             Kitaplık kataloğunu kaynak klasörleri ve kayıtlardan yeniden oluştur;
                                   içerik dizini tüm videoları arka planda yeniden okur
  cuccut space trash|restore <entry id>
                                   Çöp sepetine taşı / geri yükle (dosyalara dokunulmaz;
                                   video öğelerinde video klasörü Çöp sepetine / dışına taşınır)
  cuccut space purge <entry id>    Çöp sepetindeki öğeyi kalıcı sil; video veya görev hâlâ kullanıyorsa
                                   silinmez ve başvurular listelenir
  cuccut space delete-video <entry id>
                                   Video sil: video klasörünü Çöp sepetine taşır, saklama süresince geri yüklenebilir;
                                   bağlantılı medyanın özgün dosyalarına dokunulmaz
  cuccut space continue <entry id> [--conversation <session id>]
                                   Öğeden oturum sürdür: sonraki mesaja başvuru (yalnızca kimlikler ve meta veriler) eklenir;
                                   oturum verilmezse öğenin konumuna göre seçilir veya oluşturulur`,
usage: ['Kullanım: cuccut space rescan | rebuild | trash <entry id> | restore <entry id> | purge <entry id> | delete-video <entry id>', '          cuccut space continue <entry id> [--conversation <session id>]'].join('\n'), entryUsage: (action) => `Kullanım: cuccut space ${action} <entry id>`, continueUsage: 'Kullanım: cuccut space continue <entry id> [--conversation <session id>]', flagNotAccepted: (action, key) => `cuccut space ${action}, --${key} kabul etmez`, rescanStarted: 'Yeniden tarama başladı', rebuilt: (entries, pendingVideos) => `Katalog yeniden oluşturuldu: ${entries} öğe; içerik dizini ${pendingVideos} videoyu arka planda yeniden okuyor, tamamlanana kadar arama sonuçları eksik`, purgeBlocked: (id) => `${id} hâlâ video veya görev tarafından kullanılıyor; silinmedi`, movedToTrash: (id, name) => `Çöp sepetine taşındı: ${id}  ${name}`, restoredFromTrash: (id, name) => `Çöp sepetinden geri yüklendi: ${id}  ${name}`, purged: (id) => `${id} kalıcı silindi`, notPurged: (id) => `${id} silinmedi: hâlâ başvuruluyor`, videoTrashed: (name, entryId, retentionDays) => `“${name}” adlı video Çöp sepetine taşındı: ${entryId} (cuccut space restore ${entryId} ile geri yükleyin${retentionDays === null ? '' : `; ${retentionDays} gün sonra kalıcı silinir`})`, relatedKept: (n) => `Bu videodan dışa aktarılan veya oluşturulan ${n} öğe yerinde kalır`, continued: (created, id, cwd) => `${created ? 'Oturum oluşturuldu' : 'Oturum kullanılıyor'} ${id}  çalışma klasörü ${cwd}`, referenceNext: (name, id) => `Sonraki mesaja “${name}” öğesinin başvurusu eklenecek: cuccut chat "…" --conversation ${id}`,
};
