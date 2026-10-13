import type { RcPublishingMessages } from './rc-publishing.ts';

export const nl: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Alleen de eigenaar kan dit doen, in de CucCut-app op deze computer.',
  desktopOnly: 'Autoriseren, verzenden, resultaten vastleggen en verbindingen beheren is alleen beschikbaar in de CucCut-app op deze computer.',
  settingsOwnerOnly: 'Alleen de eigenaar kan het publicatieschema wijzigen. Vraag hem of haar dit te wijzigen in de publicatie-instellingen.',
  transferNotAllowed: 'Importeren en exporteren van de kalender zijn beschikbaar in de CucCut-app en op de opdrachtregel.',
  authorizationRequired: 'De eigenaar moet deze exacte publicatie in CucCut autoriseren voordat een agent haar kan verzenden.',
  // Publications.
  publicationArchived: 'Deze publicatie is gearchiveerd. Herstel haar voordat je haar wijzigt.',
  publicationLocked: 'Verzonden bestemmingen behouden hun gedeelde inhoud. Bewerk een mislukte bestemming of bereid een nieuwe release voor.',
  destinationLocked: 'De verzending voor dit account is al gestart. Trek haar in of leg het resultaat vast voordat je haar wijzigt.',
  destinationKept: 'Een verzonden bestemming blijft in de publicatie. Trek haar in of leg het resultaat vast voordat je haar verwijdert.',
  destinationAccountFixed: 'Verwijder deze bestemming en voeg in plaats daarvan het account toe om een ander account te gebruiken.',
  destinationNotFound: 'Dit account maakt niet langer deel uit van de publicatie. Laad haar opnieuw en probeer het nog eens.',
  duplicateAccount: 'Kies elk account maar één keer.',
  duplicatePlacement: 'Kies de tijd van elk account maar één keer.',
  afterExpiry: 'Kies een tijd voordat deze publicatie verloopt.',
  invalid: 'Deze publicatie is nog niet klaar. Los de genoemde problemen op en probeer het opnieuw.',
  nothingToSend: 'Alle accounts van deze publicatie zijn al verzonden. Bereid een nieuwe release voor om haar opnieuw te verzenden.',
  slotTaken: (p: { account: string }) =>
    `Deze tijd conflicteert met een andere publicatie voor ${p.account}. Kies een andere tijd, of sta in de publicatie-instellingen minder tijd tussen berichten toe.`,
  calendarRange: 'Kies een kalenderbereik van maximaal 93 dagen, waarbij het begin vóór het einde ligt.',
  archiveInFlight: 'Trek wachtende verzendingen in of leg hun resultaat vast voordat je deze publicatie archiveert.',
  // Delivery.
  providerUnsupported: 'Deze versie van CucCut publiceert alleen handmatig. Kies Handmatig voor deze verbinding.',
  notWaiting: 'Alleen een account dat op jou wacht, kan worden ingetrokken.',
  cancelNotAllowed: 'Alleen een account dat niet is verzonden, kan worden geannuleerd. Trek het in of leg eerst het resultaat vast.',
  reconcileFinal: 'Een gepubliceerde of geannuleerde verzending maakt deel uit van de geschiedenis. Bereid een nieuwe release voor in plaats van haar te wijzigen.',
  reconcileSending: 'Wacht tot de huidige verzending klaar is voordat je een resultaat vastlegt.',
  reconcileFutureTime: 'Voer de toekomstige tijd in die het netwerk voor dit bericht toont.',
  // Pinned exports.
  exportRequired: 'Render en zet eerst de video vast.',
  exportChanged: 'De goedgekeurde export is gewijzigd. Zet een geverifieerde export vast voordat je publiceert.',
  exportStale: 'Exporteer de huidige revisie voordat je haar vastzet, of kies Renderen en vastzetten.',
  exportNotFinished: 'Deze export is nog niet klaar. Wacht erop of kies een andere export.',
  exportNotVideo: 'Kies een voltooide MP4-export van de hele video.',
  exportOtherVideo: 'Deze export is van een andere video of reeks. Kies een export van deze video.',
  exportFileMissing: 'Het geëxporteerde bestand staat niet meer op deze computer. Render en zet de video opnieuw vast.',
  exportFileChanged: 'Het geëxporteerde bestand is gewijzigd nadat het was gerenderd. Render en zet de video opnieuw vast.',
  pinLocked: 'Verzonden bestemmingen behouden hun vastgezette export. Bereid een nieuwe release voor om een andere export te gebruiken.',
  renderFailed: 'De export voor deze publicatie is niet voltooid. Render en zet hem opnieuw vast.',
  renderCancelled: 'De export voor deze publicatie is geannuleerd. Render en zet hem opnieuw vast wanneer je er klaar voor bent.',
  videoNotFound: 'Deze video staat niet op deze computer. Open het project en probeer het opnieuw.',
  sequenceNotFound: "Deze video heeft geen zodanige reeks. Laat de reeks weg om de hoofdreeks van de video te publiceren.",
  sequenceOneVideo: 'Kies alleen een reeks wanneer je één video voorbereidt.',
  // Settings, connections and accounts.
  accountNotFound: 'Dit account bestaat niet meer. Laad de publicatie-instellingen opnieuw en probeer het nog eens.',
  connectionNotFound: 'Deze verbinding bestaat niet meer. Laad de publicatie-instellingen opnieuw en probeer het nog eens.',
  defaultAccountMissing: 'Een standaardaccount bestaat niet meer. Kies de standaardaccounts opnieuw.',
  connectionProviderFixed: 'Een verbinding behoudt de route waarmee ze is toegevoegd. Voeg een nieuwe verbinding toe om op een andere manier te publiceren.',
  accountIdentityFixed: 'Een account behoudt zijn verbinding en netwerk. Voeg in plaats daarvan een nieuw account toe.',
  accountDuplicate: 'Dit account is al aan deze verbinding toegevoegd.',
  accountInUse: (p: { name: string }) =>
    `${p.name} heeft een bericht dat wacht, gepland is of niet is bevestigd. Leg het resultaat vast voordat je het account verwijdert.`,
  linkInvalid: 'Kies een ander account op hetzelfde netwerk dat zelf niet is gekoppeld.',
  linkCanonical: 'Andere accounts zijn aan dit account gekoppeld. Koppel in plaats daarvan de andere route aan dit account.',
  // Copy proposals.
  proposalReason: 'Concept gebaseerd op de video, het transcript en je schrijfrichtlijnen. Controleer het voordat je het toepast.',
  proposalUnreadable: "Het antwoord van het tekstmodel kon niet worden gelezen. Probeer Tekst voorstellen opnieuw, of schrijf de tekst zelf.",
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut-publiceren',
  // Calendar transfer and cleanup.
  backupFailed: 'Er kon geen back-up van de publicatiegegevens worden geschreven, dus er is niets geïmporteerd. Controleer de schijf en probeer het opnieuw.',
};
