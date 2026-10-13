import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const de: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Dieses Video erfüllt deinen Maßstab noch nicht: ${p.count} ${s(p.count, 'Befund blockiert', 'Befunde blockieren')} diesen Export`,
  blockedRemedy: 'Behebe die aufgelisteten Punkte und exportiere erneut, oder öffne die Prüfung und lass einen Befund mit Begründung bestehen.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} ist ${p.value}, der Maßstab verlangt aber ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `mindestens ${p.min}`,
  limitAtMost: (p: { max: number }) => `höchstens ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `zwischen ${p.min} und ${p.max}`,
  limitYes: 'ja',
  limitNo: 'nein',
  limitAny: 'beliebig',
  valueYes: 'ja',
  valueNo: 'nein',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Begründe es: Einen Befund bestehen zu lassen oder seine Bedeutung zu senken braucht eine Begründung',
  reasonTooLong: (p: { limit: number }) => `Halte die Begründung unter ${p.limit} Zeichen`,
  unknownFinding: (p: { id: string }) => `Der Maßstab dieses Videos hat keine Prüfung oder Frage namens „${p.id}“`,
  criteriaInvalid: 'Der Maßstab hat Probleme, die vor dem Speichern behoben werden müssen',
  criteriaConflict: 'Der Maßstab wurde woanders geändert; lies ihn erneut und versuche es noch einmal',
  answersInvalid: 'Die Antworten haben nicht das erwartete Format: ein Eintrag pro Frage, mit Ergebnis und Beleg',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Prüfentscheidungen',
  waiveLabel: (p: { id: string }) => `„${p.id}“ bestehen lassen`,
  unwaiveLabel: (p: { id: string }) => `„${p.id}“ wieder am Maßstab messen`,
  severityLabel: (p: { id: string }) => `Bedeutung von „${p.id}“ ändern`,
  severityCritical: 'kritisch',
  severitySuggestion: 'Vorschlag',
  severityNitpick: 'Kleinigkeit',
  planProtected: 'Review decisions change only through the review: let a finding stand, hold it again or change what it’s worth there',

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Du hast noch keinen Maßstab festgelegt, daher gelten die eingebauten Prüfungen.',
  reasonUser: 'Nach deinem Maßstab geprüft (Einstellungen › Prüfung).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'Die Prüfung hat diese Frage nicht erreicht.',
  evidenceMissing: 'Mit „erfüllt“ beantwortet, aber es gibt nichts zu prüfen.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Mit „erfüllt“ beantwortet, aber der Beleg ist kein Zeitpunkt im Video.';
      case 'frame':
        return 'Mit „erfüllt“ beantwortet, aber der Beleg ist kein Bild aus diesem Video.';
      case 'field':
        return 'Mit „erfüllt“ beantwortet, aber der Beleg benennt nichts in diesem Video.';
      case 'quote':
        return 'Mit „erfüllt“ beantwortet, aber das Zitat steht nicht im Transkript oder in den Untertiteln dieses Videos.';
      default:
        return 'Mit „erfüllt“ beantwortet, aber der Beleg kann nicht geprüft werden.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Fülle die Platzhalter-Felder aus oder entferne sie, bevor du lieferst.',
  builtinFixBlank: 'Decke die Lücke ab oder schließe sie, wo nichts auf dem Bildschirm zu sehen ist.',
  builtinFixTextEdge: 'Verschiebe oder verschmälere den Text, damit er im Bildrahmen bleibt.',
};
