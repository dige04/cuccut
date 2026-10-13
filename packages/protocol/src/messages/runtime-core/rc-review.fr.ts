import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const fr: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Cette vidéo ne respecte pas encore ta norme : ${p.count} ${s(p.count, 'constatation bloque', 'constatations bloquent')} cet export`,
  blockedRemedy: 'Corrige les points listés et exporte à nouveau, ou ouvre la revue et maintiens une constatation avec un motif.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} est ${p.value}, et la norme demande ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `au moins ${p.min}`,
  limitAtMost: (p: { max: number }) => `au plus ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `entre ${p.min} et ${p.max}`,
  limitYes: 'oui',
  limitNo: 'non',
  limitAny: 'peu importe',
  valueYes: 'oui',
  valueNo: 'non',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Indique le motif : maintenir une constatation ou en abaisser la gravité demande une raison',
  reasonTooLong: (p: { limit: number }) => `Garde le motif sous ${p.limit} caractères`,
  unknownFinding: (p: { id: string }) => `La norme de cette vidéo n’a aucun contrôle ni aucune question nommé « ${p.id} »`,
  criteriaInvalid: 'La norme comporte des problèmes à corriger avant de pouvoir être enregistrée',
  criteriaConflict: 'La norme a été modifiée ailleurs ; relis-la et réessaie',
  answersInvalid: 'Les réponses n’ont pas le format attendu : une entrée par question, avec un verdict et une preuve',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Décisions de revue',
  waiveLabel: (p: { id: string }) => `Maintenir « ${p.id} »`,
  unwaiveLabel: (p: { id: string }) => `Soumettre de nouveau « ${p.id} » à la norme`,
  severityLabel: (p: { id: string }) => `Modifier la gravité de « ${p.id} »`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Tu n’as pas encore défini de norme, donc ce sont les contrôles intégrés qui s’appliquent.',
  reasonUser: 'Contrôlé selon ta norme (Réglages › Revue).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'La revue n’a pas atteint cette question.',
  evidenceMissing: 'Répondu « respecté » sans rien à regarder.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Répondu « respecté », mais la preuve n’est pas un moment dans la vidéo.';
      case 'frame':
        return 'Répondu « respecté », mais la preuve n’est pas une image tirée de cette vidéo.';
      case 'field':
        return 'Répondu « respecté », mais la preuve ne désigne rien de cette vidéo.';
      case 'quote':
        return 'Répondu « respecté », mais la citation ne figure pas dans la transcription ni dans les sous-titres de cette vidéo.';
      default:
        return 'Répondu « respecté », mais la preuve ne peut pas être vérifiée.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Remplis ou supprime les cadres de remplacement avant de livrer.',
  builtinFixBlank: 'Couvre ou comble le vide là où rien n’apparaît à l’écran.',
  builtinFixTextEdge: 'Déplace ou réduis le texte pour qu’il reste dans le cadre.',
};
