import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const it: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Questo video non soddisfa ancora il tuo standard: ${p.count} ${s(p.count, 'rilievo blocca', 'rilievi bloccano')} questa esportazione`,
  blockedRemedy: 'Correggi quanto elencato ed esporta di nuovo, oppure apri la revisione e lascia valido un rilievo con una motivazione.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} è ${p.value}, e lo standard chiede ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `almeno ${p.min}`,
  limitAtMost: (p: { max: number }) => `al massimo ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `tra ${p.min} e ${p.max}`,
  limitYes: 'sì',
  limitNo: 'no',
  limitAny: 'qualsiasi valore',
  valueYes: 'sì',
  valueNo: 'no',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Scrivi il motivo: lasciare valido un rilievo o abbassarne il peso richiede una motivazione',
  reasonTooLong: (p: { limit: number }) => `Tieni il motivo sotto i ${p.limit} caratteri`,
  unknownFinding: (p: { id: string }) => `Lo standard di questo video non ha alcun controllo o domanda chiamato “${p.id}”`,
  criteriaInvalid: 'Lo standard ha problemi da risolvere prima di poter essere salvato',
  criteriaConflict: 'Lo standard è stato modificato altrove; rileggilo e riprova',
  answersInvalid: 'Le risposte non hanno la forma prevista: una voce per domanda, con un esito e una prova',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Decisioni di revisione',
  waiveLabel: (p: { id: string }) => `Lascia valido “${p.id}”`,
  unwaiveLabel: (p: { id: string }) => `Riporta “${p.id}” allo standard`,
  severityLabel: (p: { id: string }) => `Cambia il peso di “${p.id}”`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Non hai ancora definito uno standard, quindi valgono i controlli integrati.',
  reasonUser: 'Verificato secondo il tuo standard (Impostazioni › Revisione).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'La revisione non è arrivata a questa domanda.',
  evidenceMissing: 'Risposto “rispettato” senza nulla da controllare.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Risposto “rispettato”, ma la prova non è un momento all’interno del video.';
      case 'frame':
        return 'Risposto “rispettato”, ma la prova non è un fotogramma preso da questo video.';
      case 'field':
        return 'Risposto “rispettato”, ma la prova non indica nulla di questo video.';
      case 'quote':
        return 'Risposto “rispettato”, ma la citazione non compare nella trascrizione o nei sottotitoli di questo video.';
      default:
        return 'Risposto “rispettato”, ma la prova non può essere verificata.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Riempi o rimuovi i riquadri segnaposto prima di consegnare.',
  builtinFixBlank: 'Copri o chiudi il vuoto dove non c’è nulla sullo schermo.',
  builtinFixTextEdge: 'Sposta o restringi il testo perché resti dentro il fotogramma.',
};
