import type { ProfileMessages } from './profile-copy.ts';

export const nl: ProfileMessages = {
  help: `Gebruik:
  cuccut profile show [--project <id>]
                                   Wat CucCut over je weet: het interview, je voorkeuren, je regels
                                   en de namen die goed gespeld moeten worden; met een project (--project, of het project van de
                                   huidige map), ook de voorkeuren en regels van dat project
  cuccut profile answers set <question> <text>
                                   Eén interviewantwoord opslaan (who, record, platforms, annoys, names);
                                   een lege tekst wist het
  cuccut profile interview skip|reopen|write
                                   Het interview overslaan, opnieuw openen, of je voorkeuren schrijven op basis van de
                                   antwoorden met je standaardagent (zonder agent blijven de antwoorden zoals ingetypt)
  cuccut profile preferences [--project <id>] --file <md>
                                   Je eigen voorkeuren, of die van het project, vervangen door een Markdown-bestand
                                   (--file - leest standaardinvoer); de sectie die het interview schreef blijft staan
  cuccut profile rules list [--project <id>]
                                   Je regels (of die van het project) in de volgorde waarin ze worden gelezen
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Regels worden in volgorde gelezen; als er twee tegenspreken, wint de latere
Agents lezen het profiel wanneer een sessie start; sessies die al open zijn, houden wat ze hadden.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Geen interviewvraag: ${value} (gebruik een van: ${ids})`,
  needFile: 'Geef de voorkeuren als Markdown-bestand: --file <md>, of --file - voor standaardinvoer',
  badMove: (value: string) => `Verplaats een regel omhoog, omlaag of naar een positie (1 is de eerste): ${value}`,
  ruleMissing: (id: string) => `Geen regel ${id} op dit niveau (zie cuccut profile rules list)`,
  projectMissing: (id: string) => `Geen project ${id} (zie cuccut projects list)`,
  stdinPrompt: 'Typ of plak de voorkeuren en druk daarna op Ctrl-D:',

  // show
  questionWho: 'Wat maak je, en voor wie is het?',
  questionRecord: 'Wat neem je meestal op?',
  questionPlatforms: 'Waar gaat het naartoe, en hoe lang moet het duren?',
  questionAnnoys: 'Wat irriteert je vandaag aan je video’s?',
  questionNames: 'Namen die goed gespeld moeten worden',
  interviewLine: (status: string, answered: number, total: number) => `Interview: ${status}, ${answered} van ${total} beantwoord`,
  statusPending: 'nog niet gedaan',
  statusSkipped: 'overgeslagen',
  statusDone: 'klaar',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Je voorkeuren',
  interviewHeading: 'Wat het interview heeft geschreven',
  projectHeading: (name: string) => `Voorkeuren voor ${name}`,
  noText: '  (geen)',
  rulesHeading: 'Regels',
  projectRulesHeading: (name: string) => `Regels voor ${name}`,
  noRules: '  Nog geen regels',
  namesLine: (names: string) => `Namen om goed te spellen: ${names}`,
  readOnly: 'Het profiel is opgeslagen door een nieuwere versie van CucCut: het wordt getoond, maar wijzigingen worden geweigerd',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (uit)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Wanneer: ${when}`,
  ruleDo: (instruction: string) => `   Doen: ${instruction}`,
  ruleTemplate: (id: string) => `   Sjabloon: ${id}`,
  stageAny: 'kiezen en bewerken',
  stageClip: 'clips kiezen',
  stageEdit: 'bewerken',
  ruleEnabled: (name: string) => `Ingeschakeld: ${name}`,
  ruleDisabled: (name: string) => `Uitgeschakeld: ${name}`,
  ruleRemoved: (name: string, id: string) => `${name} verwijderd (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `${name} verplaatst naar positie ${position} van ${total}`,

  // Writes
  answerSaved: (question: string) => `Antwoord op “${question}” opgeslagen`,
  answerCleared: (question: string) => `Antwoord op “${question}” gewist`,
  interviewSkipped: 'Interview overgeslagen; de antwoorden blijven bewaard',
  interviewReopened: 'Het interview is weer open, met de vorige antwoorden',
  writing: 'Je voorkeuren worden geschreven op basis van de antwoorden. Dit duurt even…',
  writtenByAgent: 'Voorkeuren geschreven op basis van je antwoorden:',
  keptAsTyped: (reason: string) => `Je antwoorden zijn bewaard zoals ze zijn ingetypt (${reason}):`,
  reasonNoAgent: 'er is geen agent geïnstalleerd en aangemeld',
  reasonAgentFailed: 'de run van de agent is niet afgerond',
  reasonBadOutput: 'de uitvoer van de agent was niet bruikbaar',
  namesAdded: (names: string) => `Namen toegevoegd aan de woordenlijst: ${names}`,
  preferencesSaved: (chars: number) => `Je voorkeuren opgeslagen (${chars} tekens)`,
  projectPreferencesSaved: (name: string, chars: number) => `Voorkeuren voor ${name} opgeslagen (${chars} tekens)`,
  takesEffect: 'Agents lezen dit wanneer een sessie start; sessies die al open zijn, houden wat ze hadden',
};
