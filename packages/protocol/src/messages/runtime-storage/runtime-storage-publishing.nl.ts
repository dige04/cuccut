import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const nl: RuntimeStoragePublishingMessages = {
  unreadable: "Publicatiegegevens konden niet worden gelezen. CucCut heeft het bestand laten staan zoals het is en past het niet aan. Herstel het uit een back-up, of verplaats het om opnieuw te beginnen.",
  newerVersion: "Publicatiegegevens zijn opgeslagen door een nieuwere versie van CucCut. Werk CucCut bij om ze te wijzigen; tot die tijd kun je ze alleen bekijken.",
  conflict: "Deze publicatie is elders gewijzigd. Laad de opgeslagen versie opnieuw voordat je je wijzigingen toepast.",
  settingsConflict: "Publicatie-instellingen zijn elders gewijzigd. Laad ze opnieuw voordat je opslaat.",
  notFound: "Deze publicatie bestaat niet meer.",
  invalidRecord: "Deze wijziging zou een publicatierecord onvolledig maken, dus is niet opgeslagen. Controleer de waarden en probeer het opnieuw.",
  writeFailed: "Publicatiegegevens konden niet naar de schijf worden opgeslagen. Controleer of de schijf ruimte heeft en CucCut in de map kan schrijven, en probeer het daarna opnieuw.",
};
