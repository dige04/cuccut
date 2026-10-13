import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const pl: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Ten film nie spełnia jeszcze Twojego standardu: ${p.count} ${s(p.count, 'uwaga zatrzymuje', 'uwag zatrzymuje')} ten eksport`,
  blockedRemedy: 'Popraw wymienione punkty i eksportuj ponownie albo otwórz recenzję i pozostaw uwagę z uzasadnieniem.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} wynosi ${p.value}, a standard wymaga: ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `co najmniej ${p.min}`,
  limitAtMost: (p: { max: number }) => `co najwyżej ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `od ${p.min} do ${p.max}`,
  limitYes: 'tak',
  limitNo: 'nie',
  limitAny: 'dowolne',
  valueYes: 'tak',
  valueNo: 'nie',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Podaj powód: pozostawienie uwagi lub obniżenie jej wagi wymaga uzasadnienia',
  reasonTooLong: (p: { limit: number }) => `Uzasadnienie powinno mieć mniej niż ${p.limit} znaków`,
  unknownFinding: (p: { id: string }) => `Standard tego filmu nie ma kontroli ani pytania o nazwie „${p.id}”`,
  criteriaInvalid: 'Standard ma problemy, które trzeba naprawić przed zapisem',
  criteriaConflict: 'Standard został zmieniony w innym miejscu; przeczytaj go ponownie i spróbuj jeszcze raz',
  answersInvalid: 'Odpowiedzi nie mają oczekiwanego kształtu: jeden wpis na pytanie, z oceną i dowodem',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Decyzje recenzji',
  waiveLabel: (p: { id: string }) => `Pozostaw „${p.id}”`,
  unwaiveLabel: (p: { id: string }) => `Ponownie wymagaj „${p.id}” zgodnie ze standardem`,
  severityLabel: (p: { id: string }) => `Zmień wagę „${p.id}”`,
  severityCritical: 'krytyczne',
  severitySuggestion: 'sugestia',
  severityNitpick: 'drobiazg',
  planProtected: 'Review decisions change only through the review: let a finding stand, hold it again or change what it’s worth there',

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Nie ustawiono jeszcze standardu, więc obowiązują wbudowane kontrole.',
  reasonUser: 'Sprawdzane według Twojego standardu (Ustawienia › Recenzja).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'Recenzja nie dotarła do tego pytania.',
  evidenceMissing: 'Odpowiedziano „spełnia”, ale nie ma nic do sprawdzenia.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Odpowiedziano „spełnia”, ale dowód nie jest chwilą w filmie.';
      case 'frame':
        return 'Odpowiedziano „spełnia”, ale dowód nie jest klatką z tego filmu.';
      case 'field':
        return 'Odpowiedziano „spełnia”, ale dowód nie wskazuje niczego w tym filmie.';
      case 'quote':
        return 'Odpowiedziano „spełnia”, ale cytatu nie ma w transkrypcji ani w napisach tego filmu.';
      default:
        return 'Odpowiedziano „spełnia”, ale dowodu nie da się sprawdzić.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Przed dostarczeniem wypełnij lub usuń ramki zastępcze.',
  builtinFixBlank: 'Zakryj lub wypełnij lukę, w której na ekranie nic nie ma.',
  builtinFixTextEdge: 'Przesuń lub zwęź tekst, aby mieścił się w kadrze.',
};
