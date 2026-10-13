import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const tr: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json tek bir JSON nesnesi içermeli',
  formatMissing: 'pack.json içinde "format": "cuccut.pack" yok, bu yüzden bir CucCut paketi değil',
  foreignFormat: 'Bu bir agentcut paketi: pack.json dosyasında "format" alanı yok. CucCut yalnızca cuccut.pack klasörlerini okur',
  otherFormat: (p: { format: string }) => `pack.json biçimini "${p.format}" olarak belirtiyor, "cuccut.pack" olarak değil`,
  unsupportedSchema: (p: { schema: string }) => `${p.schema} paket şeması desteklenmiyor; bu CucCut sürümü şema 1’i okur`,
  unsupportedField: (p: { field: string }) => `"${p.field}" desteklenmiyor: bu CucCut sürümünde paketler kod taşımaz`,
  idChars: 'Paket kimliği küçük harflerden, rakamlardan ve tek kısa çizgilerden oluşur ve bir harfle başlar',
  idReserved: (p: { id: string }) => `“${p.id}” ayrılmış bir addır ve paket kimliği olamaz`,
  versionChars: 'Sürüm harflerden, rakamlardan, noktalardan, kısa çizgilerden ve artı işaretlerinden oluşur',
  templateIdChars: 'Şablon kimliği küçük harflerden, rakamlardan ve tek kısa çizgilerden oluşur ve bir harfle başlar',
  ruleIdChars: 'Kural kimliği küçük harflerden, rakamlardan ve tek kısa çizgilerden oluşur',
  duplicateTemplates: 'Aynı şablon iki kez adlandırılmış',
  duplicateSkills: 'Aynı beceri iki kez adlandırılmış',
  duplicateLibrary: 'Aynı kütüphane dosyası iki kez adlandırılmış',
  duplicateExamples: 'Aynı referans dosyası iki kez adlandırılmış',
  duplicateQuickActions: 'İki hızlı eylemin etiketi aynı',
  duplicateRules: 'Aynı kural iki kez adlandırılmış',
  duplicateFiles: 'Aynı dosya files içinde iki kez listelenmiş',
  libraryDir: (p: { dir: string }) => `Kütüphane dosyaları ${p.dir}/ altında olmalı`,
  libraryVoice: 'Sesler pakette taşınamaz: bir ses, sahibinin onayını gerektirir',
  examplesDir: (p: { dir: string }) => `Referans dosyaları ${p.dir}/ altında olmalı`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Bir ${p.kind} referansı şunlardan biri olmalı: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Bir kare bir görseldir: ${p.extensions}`,
  styleFile: 'Stil rehberi, paketin kök dizininde bir Markdown dosyasıdır (.md)',
  reviewFile: 'İnceleme standardı, paketin kök dizininde bir JSON dosyasıdır',
  sha256Hex: 'sha256, 64 küçük harfli onaltılık rakamdır',

  // Paths inside a pack
  pathRelative: 'Yol, paket klasörüne göre göreli olmalı',
  pathHidden: 'Paket yolları gizli dosya ya da klasörleri (nokta ile başlayan) gösteremez',
  fileNotNamed: (p: { path: string }) => `${p.path}, pack.json içinde adlandırılmamış`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `${p.length} karakter uzunluğunda; bir stil rehberi en fazla ${p.limit} karakter tutabilir`,
  whyIgnoreInstructions: 'ajana kendi talimatlarını yok saymasını söylüyor',
  whyChangeIdentity: 'ajanın kim olduğunu değiştirmeye çalışıyor',
  whyRevealSecrets: 'gizli bilgi ya da istemi (prompt) istiyor',
  whyCredential: 'bir kimlik bilgisi içeriyor',
  whyCommand: 'çalıştırılacak bir komut içeriyor',
  whyDeleteWork: 'ajandan işi silmesini istiyor',
  whySendUrl: 'ajandan bir web adresine bir şey göndermesini istiyor',
  whyPromptBoundary: 'bir istem (prompt) sınırını taklit ediyor',
};
