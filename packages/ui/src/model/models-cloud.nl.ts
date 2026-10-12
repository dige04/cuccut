import type { OnlineCapability } from '@cuccut/protocol';
import type { ModelsCloudMessages } from './models-cloud.ts';

export const nl: ModelsCloudMessages = {

  capabilityShort: {
    transcribe: "Spraakherkenning",
    synthesizeSpeech: "Spraaksynthese",
    generateImage: "Afbeeldingsgeneratie",
    generateText: "Tekstgeneratie",
  } as Record<OnlineCapability, string>,

  noModels: "Geen modellen gedeclareerd",

  unavailableItem: (label: string, unavailable: string) => `${label} (${unavailable})`,
};
