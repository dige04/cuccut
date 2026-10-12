import type { JobsTranslateMessages } from './translate.ts';

export const tr: JobsTranslateMessages = {
label: 'Çevir', description: 'Videodaki dökümü cümle cümle başka bir dile çevirir ve sonucu yeni çeviri belgesi olarak yazar. İşlemi metin modeli yapar; ajan başlatılmaz.', stepFreezeSource: 'Kaynağı oku', stepTranslate: 'Çevir', stepAssemble: 'Çeviriyi birleştir', stepWrite: 'Videoya yaz', videoNotOpen: 'Video açık değil', noStructuredOutput: (p) => `${p.model} modeli yapılandırılmış çıktıyı desteklemiyor; çeviri için kullanılamaz`, workerMismatch: 'Speech Worker çevirisi sabitlenen kaynakla eşleşmiyor', targetLanguageInvalid: "TargetLanguage parametresi BCP 47 dil etiketi olmalı", flagInvalid: (p) => `${p.key} parametresi true veya false olmalı`, bilingualNeedsCaptions: "Bilingual parametresi yalnızca captions true olduğunda verilebilir (altyazı katmanı ekleme)", noDocument: (p) => `Videoda ${p.documentId} belgesi yok`, notSpeech: (p) => `${p.documentId} belgesi ${p.kind}; yalnızca dökümler (speech) çevrilebilir`, noTranscript: 'Videoda döküm yok. Çevirmeden önce yazıya dökün.', multipleTranscripts: 'Videoda birden fazla döküm var. Çevrilecek olanı documentId ile seçin.', videoClosed: 'Video kapatıldı', sourceGone: 'Kaynak belge artık videoda yok', noSentences: 'Dökümde çevrilecek cümle yok', sameLanguage: (p) => `Döküm dili ${p.source}, hedef dil ${p.target} ile aynı; çeviri gerekmiyor`, workerMissing: 'Speech Worker (speech-worker) bulunamadı. Önce npm run build:engine çalıştırın.', documentName: (p) => `Çeviri ${p.language}`, videoClosedKept: 'Video kapatıldı. Çeviri çıktılarda korunur.', sourceChanged: 'Çeviri sırasında kaynak belge değişti; videoya yazılmadı. Yeniden denendiğinde kaynak belgenin mevcut sürümü çevrilir.', transactionLabel: (p) => `${p.language} diline çevir`, noDocumentId: 'Çeviri videoya yazıldı, ancak belge ID döndürülmedi', rejected: 'Videoya yazma işlemi reddedildi. Çeviri çıktılarda korunur.',
  sentencesNeedTranslation: "sentences parametresi yalnızca translationId ile birlikte verilebilir",
  refreshNoCaptions: "captions, captionStyle ve bilingual parametreleri translationId ile kullanılamaz. Bu çeviriden oluşturulan altyazı katmanları yerinde güncellenir.",
  notTranslation: (p) => `${p.documentId} belgesi ${p.kind} türünde, çeviri değil`,
  translationNotRefreshable: (p) => `${p.documentId} çevirisi kaynak dökümünü kaydetmiyor veya güncel çeviri biçiminde değil, bu yüzden yerinde güncellenemez. Dökümü yeniden çevirin.`,
  translationSourceMismatch: (p) => `${p.documentId} çevirisi ${p.source} belgesinden çevrildi; documentId ile eşleşmiyor`,
  translationLanguageMismatch: (p) => `Çeviri ${p.language} dilinde, ancak targetLanguage ${p.target}`,
  unknownSentence: (p) => `Dökümde ${p.sentenceId} cümlesi yok`,
  nothingStale: "Bu çeviride eskimiş veya çevrilmemiş cümle yok. Yeniden çevrilecek cümleleri sentences ile seçin.",
  translationGone: "Çeviri belgesi artık videoda değil",
  translationChanged: "Yeniden çeviri sırasında çeviri düzenlendi; videoya yazılmadı. Yeniden denendiğinde güncel sürüm üzerinden yeniden çevrilir.",
  refreshLabel: (p) => `${p.language} cümlelerini yeniden çevir`,
};
