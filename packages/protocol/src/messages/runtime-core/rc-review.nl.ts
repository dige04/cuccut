import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const nl: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Deze video voldoet nog niet aan je norm: ${p.count} ${s(p.count, 'bevinding stopt', 'bevindingen stoppen')} deze export`,
  blockedRemedy: 'Los op wat er staat en exporteer opnieuw, of open de review en laat een bevinding met reden staan.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} is ${p.value}, en de norm vraagt ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `minstens ${p.min}`,
  limitAtMost: (p: { max: number }) => `hooguit ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `tussen ${p.min} en ${p.max}`,
  limitYes: 'ja',
  limitNo: 'nee',
  limitAny: 'alles',
  valueYes: 'ja',
  valueNo: 'nee',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Zeg waarom: een bevinding laten staan of de waarde ervan verlagen heeft een reden nodig',
  reasonTooLong: (p: { limit: number }) => `Houd de reden onder ${p.limit} tekens`,
  unknownFinding: (p: { id: string }) => `De norm van deze video heeft geen controle of vraag die “${p.id}” heet`,
  criteriaInvalid: 'De norm heeft problemen die opgelost moeten worden voordat hij kan worden opgeslagen',
  criteriaConflict: 'De norm is elders gewijzigd; lees hem opnieuw en probeer het nog eens',
  answersInvalid: 'De antwoorden hebben niet de verwachte vorm: één item per vraag, met een oordeel en bewijs',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Reviewbeslissingen',
  waiveLabel: (p: { id: string }) => `“${p.id}” laten staan`,
  unwaiveLabel: (p: { id: string }) => `“${p.id}” weer aan de norm houden`,
  severityLabel: (p: { id: string }) => `Wat “${p.id}” waard is wijzigen`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Je hebt nog geen norm ingesteld, dus dit zijn de ingebouwde controles.',
  reasonUser: 'Gecontroleerd volgens jouw norm (Instellingen › Review).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'De review is deze vraag niet toegekomen.',
  evidenceMissing: 'Beantwoord met “voldoet” zonder iets om te bekijken.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Beantwoord met “voldoet”, maar het bewijs is geen tijdstip in de video.';
      case 'frame':
        return 'Beantwoord met “voldoet”, maar het bewijs is geen frame uit deze video.';
      case 'field':
        return 'Beantwoord met “voldoet”, maar het bewijs noemt niets in deze video.';
      case 'quote':
        return 'Beantwoord met “voldoet”, maar het citaat staat niet in het transcript of de ondertitels van deze video.';
      default:
        return 'Beantwoord met “voldoet”, maar het bewijs kan niet worden gecontroleerd.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Vul de tijdelijke vakken in of verwijder ze voordat je oplevert.',
  builtinFixBlank: 'Dek de lege plek af of vul die op waar niets in beeld is.',
  builtinFixTextEdge: 'Verplaats of versmal de tekst zodat hij binnen het beeld blijft.',
};
