import type { RcProfileMessages } from './rc-profile.ts';

export const es: RcProfileMessages = {
  readOnly: 'El perfil lo guardó una versión más reciente de CucCut, así que se muestra aquí pero no se cambia',
  projectNotFound: 'No se encontró el proyecto',
  projectUnavailable: 'La carpeta del proyecto falta o no se puede escribir, así que sus reglas y preferencias no se pueden guardar',
  projectTextOnly: 'Un proyecto tiene un único texto de preferencias, definido como propio. La sección de la entrevista existe solo a nivel del espacio de trabajo',
  noAnswers: 'Responde al menos una pregunta o sáltate la entrevista.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Nombres de la entrevista',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `La regla no se guardó: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `No se encontró la regla: ${p.id}`,
  ruleOrder: 'El nuevo orden debe incluir cada regla de este nivel exactamente una vez',
  ruleLimit: (p: { limit: number }) => `Un nivel admite como máximo ${p.limit} reglas`,
  templateMissing: (p: { id: string }) => `La plantilla «${p.id}» no está instalada. La regla se guardó; el agente omite la plantilla hasta que se instale`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Nombre de la regla',
  fieldWhen: 'Cuándo',
  fieldInstruction: 'Instrucción',
  fieldTemplate: 'Plantilla',
  fieldNote: 'Nota',
  fieldOrder: 'Orden',
  required: 'obligatorio',
  tooLong: (p: { limit: number }) => `más largo que ${p.limit} caracteres`,
  badId: 'usa letras minúsculas, dígitos y guiones, empezando por una letra o un dígito, con un máximo de 64 caracteres',
  badTemplateId: 'no es un id de plantilla (letras minúsculas y dígitos, unidos por guiones simples)',
  badOrder: 'debe ser un número entero',
  needInstructionOrTemplate: 'escribe una instrucción o elige una plantilla',

  // A write from the answers (profile-writer)
  writeBusy: 'Las preferencias ya se están escribiendo a partir de las respuestas. Espera a que termine esa escritura',
  writeStopped: 'CucCut se está cerrando, así que las preferencias no se escribieron. Tus respuestas están guardadas',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Esta sesión no está en un proyecto, así que no hay nivel de proyecto. Usa el nivel workspace o abre una sesión en el proyecto',
  levelWorkspace: 'para todos los proyectos',
  levelProject: (p: { name: string }) => `para el proyecto ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Guardar respuestas de la entrevista: ${p.questions}`,
  toolSkipSummary: 'Saltar la entrevista (las respuestas se conservan)',
  toolWriteSummary: 'Escribir tus preferencias a partir de las respuestas de la entrevista',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Añadir a tus preferencias ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Reemplazar tus preferencias ${p.where} por: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Guardar la regla «${p.name}» ${p.where}: cuando ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `usa la plantilla ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Eliminar la regla «${p.name}» ${p.where}`,
};
