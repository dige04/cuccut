import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const tr: RuntimeStoragePublishingMessages = {
  unreadable: "Yayın verileri okunamadı. CucCut dosyayı olduğu gibi bıraktı ve değiştirmeyecek. Bir yedekten geri yükleyin ya da baştan başlamak için dosyayı başka yere taşıyın.",
  newerVersion: "Yayın verileri CucCut'ın daha yeni bir sürümü tarafından kaydedilmiş. Değiştirmek için CucCut'ı güncelleyin; o zamana kadar yalnızca görüntüleyebilirsiniz.",
  conflict: "Bu yayın başka bir yerde değiştirildi. Değişikliklerinizi uygulamadan önce kayıtlı sürümü yeniden yükleyin.",
  settingsConflict: "Yayın ayarları başka bir yerde değiştirildi. Kaydetmeden önce yeniden yükleyin.",
  notFound: "Bu yayın artık mevcut değil.",
  invalidRecord: "Bu değişiklik bir yayın kaydını eksik bırakacağı için kaydedilmedi. Değerleri kontrol edip yeniden deneyin.",
  writeFailed: "Yayın verileri diske kaydedilemedi. Diskte boş alan olduğunu ve CucCut'ın klasörüne yazabildiğini kontrol edip yeniden deneyin.",
};
