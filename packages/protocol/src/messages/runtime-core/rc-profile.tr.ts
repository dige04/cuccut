import type { RcProfileMessages } from './rc-profile.ts';

export const tr: RcProfileMessages = {
  readOnly: 'Profil CucCut’un daha yeni bir sürümü tarafından kaydedildi; bu yüzden burada gösteriliyor ama değiştirilmiyor',
  projectNotFound: 'Proje bulunamadı',
  projectUnavailable: 'Proje klasörü eksik veya yazılamıyor; bu yüzden kuralları ve tercihleri kaydedilemiyor',
  projectTextOnly: 'Bir projenin, kendisine ait olarak ayarlanmış tek bir tercih metni vardır. Görüşme bölümü yalnızca çalışma alanı düzeyinde bulunur',
  noAnswers: 'En az bir soruyu yanıtlayın veya atlayın.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Görüşmedeki adlar',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `Kural kaydedilmedi: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Kural bulunamadı: ${p.id}`,
  ruleOrder: 'Yeni sıra, bu düzeydeki her kuralı tam olarak bir kez listelemelidir',
  ruleLimit: (p: { limit: number }) => `Bir düzey en fazla ${p.limit} kural içerebilir`,
  templateMissing: (p: { id: string }) => `“${p.id}” şablonu yüklü değil. Kural kaydedildi; yüklenene kadar agent şablonu atlar`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Kimlik',
  fieldName: 'Kural adı',
  fieldWhen: 'Ne zaman',
  fieldInstruction: 'Talimat',
  fieldTemplate: 'Şablon',
  fieldNote: 'Not',
  fieldOrder: 'Sıra',
  required: 'zorunlu',
  tooLong: (p: { limit: number }) => `${p.limit} karakterden uzun`,
  badId: 'küçük harf, rakam ve kısa çizgi kullanın; bir harf veya rakamla başlayın; en fazla 64 karakter olsun',
  badTemplateId: 'geçerli bir şablon kimliği değil (küçük harf ve rakamlar, tek kısa çizgilerle birleştirilmiş)',
  badOrder: 'tam sayı olmalı',
  needInstructionOrTemplate: 'bir talimat yazın veya bir şablon seçin',

  // A write from the answers (profile-writer)
  writeBusy: 'Tercihler zaten yanıtlardan yazılıyor. Bu yazma bitene kadar bekleyin',
  writeStopped: 'CucCut kapanıyor, bu yüzden tercihler yazılmadı. Yanıtlarınız kaydedildi',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Bu oturum bir projede değil, bu yüzden proje düzeyi yok. workspace düzeyini kullanın ya da oturumu projede açın',
  levelWorkspace: 'her proje için',
  levelProject: (p: { name: string }) => `${p.name} projesi için`,
  toolAnswerSummary: (p: { questions: string }) => `Görüşme yanıtlarını kaydet: ${p.questions}`,
  toolSkipSummary: 'Görüşmeyi atla (yanıtlar korunur)',
  toolWriteSummary: 'Tercihlerinizi görüşme yanıtlarından yaz',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Tercihlerinize ${p.where} ekle: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Tercihlerinizi ${p.where} şununla değiştir: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `“${p.name}” kuralını ${p.where} kaydet: ${p.when} olduğunda, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `${p.id} şablonunu kullan`,
  toolRuleRemove: (p: { where: string; name: string }) => `“${p.name}” kuralını ${p.where} kaldır`,
};
