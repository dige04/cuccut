import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const ru: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json должен содержать один JSON-объект',
  formatMissing: 'В pack.json нет "format": "cuccut.pack", поэтому это не пак CucCut',
  foreignFormat: 'Это пак agentcut: в его pack.json нет поля "format". CucCut читает только папки cuccut.pack',
  otherFormat: (p: { format: string }) => `В pack.json указан формат "${p.format}", а не "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Схема пака ${p.schema} не поддерживается; эта версия CucCut читает схему 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" не поддерживается: в этой версии CucCut паки не содержат код`,
  idChars: 'ID пака состоит из строчных латинских букв, цифр и одиночных дефисов и начинается с буквы',
  idReserved: (p: { id: string }) => `«${p.id}» — зарезервированное имя и не может быть ID пака`,
  versionChars: 'Версия состоит из букв, цифр, точек, дефисов и знаков плюс',
  templateIdChars: 'ID шаблона состоит из строчных латинских букв, цифр и одиночных дефисов и начинается с буквы',
  ruleIdChars: 'ID правила состоит из строчных латинских букв, цифр и одиночных дефисов',
  duplicateTemplates: 'Один и тот же шаблон назван дважды',
  duplicateSkills: 'Один и тот же навык назван дважды',
  duplicateLibrary: 'Один и тот же файл библиотеки назван дважды',
  duplicateExamples: 'Один и тот же справочный файл назван дважды',
  duplicateQuickActions: 'Два быстрых действия имеют одинаковую подпись',
  duplicateRules: 'Одно и то же правило названо дважды',
  duplicateFiles: 'Один и тот же файл дважды перечислен в files',
  libraryDir: (p: { dir: string }) => `Файлы библиотеки находятся в ${p.dir}/`,
  libraryVoice: 'Голоса не могут входить в пак: голосу нужно согласие владельца',
  examplesDir: (p: { dir: string }) => `Справочные файлы находятся в ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Справочный материал типа «${p.kind}» — один из форматов: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Кадр — это изображение: ${p.extensions}`,
  styleFile: 'Гид по стилю — это файл Markdown (.md) в корне пака',
  reviewFile: 'Стандарт проверки — это файл JSON в корне пака',
  sha256Hex: 'sha256 — это 64 шестнадцатеричные цифры в нижнем регистре',

  // Paths inside a pack
  pathRelative: 'Путь должен быть относительным к папке пака',
  pathHidden: 'Пути в паке не могут указывать на скрытые файлы или папки (начинающиеся с точки)',
  fileNotNamed: (p: { path: string }) => `${p.path} не назван в pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Длина ${p.length} символов; гид по стилю может содержать не более ${p.limit}`,
  whyIgnoreInstructions: 'велит агенту игнорировать его инструкции',
  whyChangeIdentity: 'пытается изменить то, кем является агент',
  whyRevealSecrets: 'требует секреты или промпт',
  whyCredential: 'содержит учётные данные',
  whyCommand: 'содержит команду для выполнения',
  whyDeleteWork: 'просит агента удалить работу',
  whySendUrl: 'просит агента отправить что-либо по веб-адресу',
  whyPromptBoundary: 'подражает границе промпта',
};
