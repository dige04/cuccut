import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const es: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json debe contener un único objeto JSON',
  formatMissing: 'pack.json no tiene "format": "cuccut.pack", así que no es un pack de CucCut',
  foreignFormat: 'Este es un pack de agentcut: su pack.json no tiene el campo "format". CucCut solo lee carpetas cuccut.pack',
  otherFormat: (p: { format: string }) => `pack.json indica que su formato es "${p.format}", no "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `El esquema de pack ${p.schema} no es compatible; esta versión de CucCut lee el esquema 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" no es compatible: los packs no incluyen código en esta versión de CucCut`,
  idChars: 'El id de un pack son letras minúsculas, dígitos y guiones simples, y empieza por una letra',
  idReserved: (p: { id: string }) => `"${p.id}" es un nombre reservado y no puede usarse como id de pack`,
  versionChars: 'Una versión son letras, dígitos, puntos, guiones y signos más',
  templateIdChars: 'El id de una plantilla son letras minúsculas, dígitos y guiones simples, y empieza por una letra',
  ruleIdChars: 'El id de una regla son letras minúsculas, dígitos y guiones simples',
  duplicateTemplates: 'La misma plantilla aparece nombrada dos veces',
  duplicateSkills: 'La misma habilidad aparece nombrada dos veces',
  duplicateLibrary: 'El mismo archivo de biblioteca aparece nombrado dos veces',
  duplicateExamples: 'El mismo archivo de referencia aparece nombrado dos veces',
  duplicateQuickActions: 'Dos acciones rápidas tienen la misma etiqueta',
  duplicateRules: 'La misma regla aparece nombrada dos veces',
  duplicateFiles: 'El mismo archivo aparece dos veces en files',
  libraryDir: (p: { dir: string }) => `Los archivos de biblioteca están en ${p.dir}/`,
  libraryVoice: 'Las voces no pueden viajar en un pack: una voz necesita el consentimiento de su propietario',
  examplesDir: (p: { dir: string }) => `Los archivos de referencia están en ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Una referencia de ${p.kind} es una de estas: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Una imagen fija es una imagen: ${p.extensions}`,
  styleFile: 'La guía de estilo es un archivo Markdown (.md) en la raíz del pack',
  reviewFile: 'El estándar de revisión es un archivo JSON en la raíz del pack',
  sha256Hex: 'sha256 son 64 dígitos hexadecimales en minúsculas',

  // Paths inside a pack
  pathRelative: 'La ruta debe ser relativa a la carpeta del pack',
  pathHidden: 'Las rutas del pack no pueden nombrar archivos o carpetas ocultos (que empiezan por un punto)',
  fileNotNamed: (p: { path: string }) => `${p.path} no está nombrado en pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Tiene ${p.length} caracteres; una guía de estilo admite como máximo ${p.limit}`,
  whyIgnoreInstructions: 'indica al agente que ignore sus instrucciones',
  whyChangeIdentity: 'intenta cambiar quién es el agente',
  whyRevealSecrets: 'pide secretos o el prompt',
  whyCredential: 'contiene una credencial',
  whyCommand: 'contiene un comando que ejecutar',
  whyDeleteWork: 'pide al agente que borre trabajo',
  whySendUrl: 'pide al agente que envíe algo a una dirección web',
  whyPromptBoundary: 'imita un límite de prompt',
};
