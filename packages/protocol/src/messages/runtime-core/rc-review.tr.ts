import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const tr: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Bu video henüz ölçütünüze uymuyor: ${p.count} ${s(p.count, 'bulgu', 'bulgu')} bu dışa aktarmayı durduruyor`,
  blockedRemedy: 'Listelenenleri düzeltin ve yeniden dışa aktarın ya da incelemeyi açıp bir bulguyu gerekçesiyle olduğu gibi bırakın.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} ${p.value}, ölçüt ise ${p.limit} istiyor.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `en az ${p.min}`,
  limitAtMost: (p: { max: number }) => `en fazla ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `${p.min} ile ${p.max} arası`,
  limitYes: 'evet',
  limitNo: 'hayır',
  limitAny: 'fark etmez',
  valueYes: 'evet',
  valueNo: 'hayır',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Nedenini yazın: bir bulguyu olduğu gibi bırakmak ya da önemini düşürmek bir gerekçe ister',
  reasonTooLong: (p: { limit: number }) => `Nedeni ${p.limit} karakterin altında tutun`,
  unknownFinding: (p: { id: string }) => `Bu videonun ölçütünde “${p.id}” adlı bir kontrol ya da soru yok`,
  criteriaInvalid: 'Ölçütte kaydedilmeden önce düzeltilmesi gereken sorunlar var',
  criteriaConflict: 'Ölçüt başka bir yerde değiştirildi; yeniden okuyup tekrar deneyin',
  answersInvalid: 'Yanıtlar beklenen biçimde değil: soru başına bir girdi, bir karar ve bir kanıt içermeli',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'İnceleme kararları',
  waiveLabel: (p: { id: string }) => `“${p.id}” olduğu gibi kalsın`,
  unwaiveLabel: (p: { id: string }) => `“${p.id}” yeniden ölçüte göre incelensin`,
  severityLabel: (p: { id: string }) => `“${p.id}” önemini değiştir`,
  severityCritical: 'kritik',
  severitySuggestion: 'öneri',
  severityNitpick: 'ayrıntı',
  planProtected: 'Review decisions change only through the review: let a finding stand, hold it again or change what it’s worth there',

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Henüz bir ölçüt belirlemediğiniz için yerleşik kontroller geçerli.',
  reasonUser: 'Ölçütünüze göre incelendi (Ayarlar › İnceleme).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'İnceleme bu soruya ulaşamadı.',
  evidenceMissing: 'Bakılacak bir şey olmadan “uygun” diye yanıtlandı.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return '“Uygun” diye yanıtlandı, ama kanıt videoda bir an değil.';
      case 'frame':
        return '“Uygun” diye yanıtlandı, ama kanıt bu videodan alınmış bir kare değil.';
      case 'field':
        return '“Uygun” diye yanıtlandı, ama kanıt bu videoda hiçbir şeyi adlandırmıyor.';
      case 'quote':
        return '“Uygun” diye yanıtlandı, ama alıntı bu videonun dökümünde ya da altyazısında yok.';
      default:
        return '“Uygun” diye yanıtlandı, ama kanıt kontrol edilemiyor.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Teslim etmeden önce yer tutucu kutuları doldurun ya da kaldırın.',
  builtinFixBlank: 'Ekranda hiçbir şeyin olmadığı boşluğu kapatın ya da doldurun.',
  builtinFixTextEdge: 'Metni kadraj içinde kalacak şekilde taşıyın ya da daraltın.',
};
