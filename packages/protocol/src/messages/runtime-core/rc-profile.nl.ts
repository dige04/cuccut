import type { RcProfileMessages } from './rc-profile.ts';

export const nl: RcProfileMessages = {
  readOnly: 'Het profiel is opgeslagen door een nieuwere versie van CucCut, dus het wordt hier getoond maar niet gewijzigd',
  projectNotFound: 'Project niet gevonden',
  projectUnavailable: 'De projectmap ontbreekt of is niet beschrijfbaar, dus de regels en voorkeuren ervan kunnen niet worden opgeslagen',
  projectTextOnly: 'Een project heeft één voorkeurentekst, ingesteld als eigen. De sectie van het interview bestaat alleen op werkruimteniveau',
  noAnswers: 'Beantwoord ten minste één vraag, of sla over.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Namen uit het interview',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `De regel is niet opgeslagen: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Regel niet gevonden: ${p.id}`,
  ruleOrder: 'De nieuwe volgorde moet elke regel op dit niveau precies één keer bevatten',
  ruleLimit: (p: { limit: number }) => `Een niveau bevat maximaal ${p.limit} regels`,
  templateMissing: (p: { id: string }) => `De sjabloon “${p.id}” is niet geïnstalleerd. De regel is opgeslagen; de agent slaat de sjabloon over tot hij is geïnstalleerd`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Regelnaam',
  fieldWhen: 'Wanneer',
  fieldInstruction: 'Instructie',
  fieldTemplate: 'Sjabloon',
  fieldNote: 'Notitie',
  fieldOrder: 'Volgorde',
  required: 'verplicht',
  tooLong: (p: { limit: number }) => `langer dan ${p.limit} tekens`,
  badId: 'gebruik kleine letters, cijfers en koppeltekens, beginnend met een letter of cijfer, maximaal 64 tekens',
  badTemplateId: 'is geen sjabloon-id (kleine letters en cijfers, verbonden door enkele koppeltekens)',
  badOrder: 'moet een geheel getal zijn',
  needInstructionOrTemplate: 'geef een instructie of kies een sjabloon',

  // A write from the answers (profile-writer)
  writeBusy: 'Voorkeuren worden al geschreven op basis van de antwoorden. Wacht tot die schrijfactie klaar is',
  writeStopped: 'CucCut wordt afgesloten, dus de voorkeuren zijn niet geschreven. Je antwoorden zijn opgeslagen',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Deze sessie hoort niet bij een project, dus er is geen projectniveau. Gebruik niveau workspace, of open een sessie in het project',
  levelWorkspace: 'voor elk project',
  levelProject: (p: { name: string }) => `voor het project ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Antwoorden op het interview opslaan: ${p.questions}`,
  toolSkipSummary: 'Het interview overslaan (de antwoorden blijven bewaard)',
  toolWriteSummary: 'Je voorkeuren schrijven op basis van de interviewantwoorden',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Toevoegen aan je voorkeuren ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Je voorkeuren ${p.where} vervangen door: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `De regel “${p.name}” ${p.where} opslaan: wanneer ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `gebruik de sjabloon ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `De regel “${p.name}” ${p.where} verwijderen`,
};
