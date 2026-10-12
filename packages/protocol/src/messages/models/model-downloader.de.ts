import type { ModelsModelDownloaderMessages } from './model-downloader.ts';

export const de: ModelsModelDownloaderMessages = {
  remedyNoSpace: "Die Festplatte mit dem Modellordner ist voll. Genug Speicherplatz freigeben (oder den Modellordner in den Einstellungen auf eine andere Festplatte verschieben) und erneut installieren",
  remedyNetwork: "Netzwerk nicht erreichbar oder Download unterbrochen. Netzwerk prüfen und erneut installieren; bereits heruntergeladene Teile werden fortgesetzt. Unter „Modelldownloadquelle“ in „Einstellungen › Allgemein“ kann auch ein anderer Spiegelserver gewählt werden",
  remedyIntegrity: "Eine heruntergeladene Datei stimmt in Größe oder sha256 nicht mit dem Manifest überein (Quelle oder Spiegelserver liefert falschen Inhalt). Die fehlerhafte Datei wurde gelöscht; eine andere Downloadquelle wählen und erneut installieren",
  remedySource: "Die Downloadquelle enthält diese Datei nicht oder verweigert den Zugriff. Prüfen, ob der Spiegelserver unter „Modelldownloadquelle“ in „Einstellungen › Allgemein“ (oder der Umgebungsvariablen CUCCUT_MODELS_ENDPOINT) vollständig ist",
  remedyManifestIncomplete: "Im integrierten Manifest dieses Modellpakets fehlt ein vertrauenswürdiger sha256; es kann daher nicht installiert werden. Auf ein CucCut-Update warten",
  downloadFailed: (p: { file: string; reason: string }) => `Herunterladen fehlgeschlagen: ${p.file}: ${p.reason}`,
  integrityMismatch: (p: { file: string }) => `Die Größe oder der sha256 von ${p.file} stimmt nicht mit dem Manifest überein`,
  sourceHttp: (p: { file: string; status: number }) => `Die Downloadquelle gab HTTP zurück: ${p.status} für ${p.file}`,
  diskFull: "Die Festplatte wurde beim Schreiben der Modelldateien voll",
  archiveUnpackable: (p: { file: string; reason: string }) => `${p.file} konnte nicht entpackt werden: ${p.reason}`,
  executableMissing: (p: { file: string; executable: string }) => `${p.file} enthält ${p.executable} nicht`,
  engineProbeFailed: (p: { executable: string; reason: string }) => `${p.executable} wurde entpackt, startet aber nicht: ${p.reason}`,
};
