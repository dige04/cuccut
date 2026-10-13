import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const tr: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Uzunluk', what: 'Tamamlanmış videonun süresi.' },
    'video.shortSidePx': { label: 'Kısa kenar', what: 'Tuvalin kısa kenarı, piksel olarak.' },
    'video.shots': { label: 'Çekimler', what: 'Ana parçadaki video ve görsel klipleri.' },
    'video.cutsPerMin': { label: 'Dakikadaki kesme', what: 'Ana parçanın bir sonraki klibe ne sıklıkla geçtiği.' },
    'video.longestShotSec': { label: 'En uzun çekim', what: 'Ana parçadaki en uzun klip.' },
    'video.longestBlankSec': { label: 'En uzun boş an', what: 'Ekranda hiçbir şeyin olmadığı en uzun aralık.' },
    'captions.on': { label: 'Altyazı gösterimi', what: 'Videonun altyazı gösterip göstermediği.' },
    'captions.wordsPerSec': { label: 'Saniyedeki altyazı kelimesi', what: 'Altyazıların ne kadar hızlı okunmak istediği.' },
    'hook.present': { label: 'Kanca', what: 'Bir kanca cümlesi: kısa videonun kesildiği cümle ya da ilk 2 saniyede başlayan bir metin.' },
    'hook.words': { label: 'Kanca kelimeleri', what: 'Kancanın kaç kelime olduğu.' },
    'text.offCanvas': { label: 'Kenarı aşan metin', what: 'Bir metin kutusunun kadrajın sol ya da sağ kenarından taşıp taşmadığı.' },
    'items.placeholders': { label: 'Yer tutucu kutular', what: 'Hâlâ medya bekleyen yer tutucu kutular.' },
    'transitions.count': { label: 'Geçişler', what: 'Klipler arasındaki geçişler.' },
    'layers.max': { label: 'Ek katmanlar', what: 'İlk parçanın ötesinde kullanılan görüntü parçaları; 0 tek parça demektir.' },
    'export.durationSec': { label: 'Dışa aktarılan uzunluk', what: 'Dışa aktarılan dosyanın süresi.' },
    'export.width': { label: 'Dışa aktarılan genişlik', what: 'Dışa aktarılan görüntünün genişliği, piksel olarak.' },
    'export.height': { label: 'Dışa aktarılan yükseklik', what: 'Dışa aktarılan görüntünün yüksekliği, piksel olarak.' },
    'export.loudnessLufs': { label: 'Ses yüksekliği', what: 'Normalleştirme sonrası dışa aktarmanın ses yüksekliği; yalnızca normalleştirilmişse okunur.' },
    'export.truePeakDb': { label: 'Gerçek tepe', what: 'Normalleştirme sonrası dışa aktarmanın en yüksek tepesi; yalnızca normalleştirilmişse okunur.' },
  },
};
