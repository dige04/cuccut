import type { RuntimeMessages } from './runtime-copy.ts';

export const pl: RuntimeMessages = {
  missingContext: "Brak RuntimeContext",
  mediaStatus: (status) => `Usługa multimediów zwróciła ${status}`,
  noRootSequence: "Nowe wideo nie ma głównej sekwencji",
  waveformName: "Przebieg fali",
  noDuration: "Wideo nie ma jeszcze długości, więc nie dodano przebiegu fali",
  noOpenVideo: "Żadne wideo nie jest otwarte",
  notCaughtUp: "Wideo nie jest jeszcze zsynchronizowane i nie można go teraz zmienić",
};
