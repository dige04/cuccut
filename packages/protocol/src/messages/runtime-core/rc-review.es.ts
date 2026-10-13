import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const es: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Este vídeo aún no cumple tu estándar: ${p.count} ${s(p.count, 'hallazgo detiene', 'hallazgos detienen')} esta exportación`,
  blockedRemedy: 'Corrige lo indicado y exporta de nuevo, o abre la revisión y deja en pie un hallazgo con un motivo.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} es ${p.value}, y el estándar pide ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `al menos ${p.min}`,
  limitAtMost: (p: { max: number }) => `como máximo ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `entre ${p.min} y ${p.max}`,
  limitYes: 'sí',
  limitNo: 'no',
  limitAny: 'cualquiera',
  valueYes: 'sí',
  valueNo: 'no',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Di por qué: dejar en pie un hallazgo o rebajar su importancia necesita un motivo',
  reasonTooLong: (p: { limit: number }) => `Mantén el motivo por debajo de ${p.limit} caracteres`,
  unknownFinding: (p: { id: string }) => `El estándar de este vídeo no tiene ninguna comprobación ni pregunta llamada “${p.id}”`,
  criteriaInvalid: 'El estándar tiene problemas que corregir antes de poder guardarse',
  criteriaConflict: 'El estándar se cambió en otro lugar; vuelve a leerlo e inténtalo de nuevo',
  answersInvalid: 'Las respuestas no tienen el formato esperado: una entrada por pregunta, con un veredicto y una evidencia',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Decisiones de revisión',
  waiveLabel: (p: { id: string }) => `Dejar en pie “${p.id}”`,
  unwaiveLabel: (p: { id: string }) => `Volver a exigir “${p.id}” según el estándar`,
  severityLabel: (p: { id: string }) => `Cambiar la importancia de “${p.id}”`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Aún no has definido un estándar, así que estas son las comprobaciones integradas.',
  reasonUser: 'Revisado según tu estándar (Ajustes › Revisión).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'La revisión no llegó a esta pregunta.',
  evidenceMissing: 'Respondido con “se cumple” sin nada que mirar.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Respondido con “se cumple”, pero la evidencia no es un momento dentro del vídeo.';
      case 'frame':
        return 'Respondido con “se cumple”, pero la evidencia no es un fotograma tomado de este vídeo.';
      case 'field':
        return 'Respondido con “se cumple”, pero la evidencia no nombra nada de este vídeo.';
      case 'quote':
        return 'Respondido con “se cumple”, pero la cita no aparece en la transcripción ni en los subtítulos de este vídeo.';
      default:
        return 'Respondido con “se cumple”, pero la evidencia no se puede comprobar.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Rellena o quita los recuadros de marcador de posición antes de entregar.',
  builtinFixBlank: 'Tapa o cierra el hueco donde no hay nada en pantalla.',
  builtinFixTextEdge: 'Mueve o estrecha el texto para que quede dentro del encuadre.',
};
