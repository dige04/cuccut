import type { PacksMessages } from './packs-copy.ts';

export const de: PacksMessages = {
  packsHelp: `Verwendung:
  cuccut packs inspect <source>    Liest ein Pack und zeigt alles, was es enthält, ohne es zu installieren.
                                   <source>: ein Ordner, eine GitHub-Adresse (owner/repo, eine Repository-URL oder
                                   …/tree/<branch>/<folder>) oder eine https://-Adresse, die pack.json bereitstellt
  cuccut packs install <source>    Liest ein Pack und installiert seine Vorlagen, Skills, Bibliothekseinträge, den
                                   Stilleitfaden und die Schnellaktionen
    --replace                      Ersetzt deine eigenen Vorlagen und Skills mit denselben IDs (sie landen im
                                   Papierkorb); ohne diese Option bleiben sie erhalten und werden übersprungen
  cuccut packs remove <id>         Löscht ein Pack: es und die Vorlagen und Skills, die es mitgebracht hat, landen für
                                   24 Stunden im Papierkorb; Bibliothekseinträge und deine Änderungen bleiben
  cuccut packs restore <trashId>   Macht eine Löschung innerhalb von 24 Stunden rückgängig
  cuccut packs style <id> [<file>|-]
                                   Gibt den Stilleitfaden des Packs aus; mit einer Datei (oder - für die Standardeingabe)
                                   wird die Datei als Leitfaden gespeichert (eine leere Datei entfernt ihn)
  cuccut packs export <folder> --name <name>
                                   Schreibt einen Packordner aus deinen Vorlagen, Skills und Bibliothekseinträgen,
                                   mit Dateiindex, zum unveränderten Versand, zum Hochladen auf GitHub oder zur
                                   Bereitstellung über einen beliebigen statischen Host. Der Ordner muss leer oder ein
                                   früherer Export dieses Packs sein
    --id <id>                      Die ID des Packs (Standard: aus dem Namen erzeugt)
    --version <version>            Standard 1.0.0
    --author <name>, --description <text>
    --template <id>                Eine eigene Vorlage (wiederholbar)
    --skill <id>                   Ein nicht eingebauter Skill (wiederholbar)
    --library <glossaries|brand>:<entryId>
                                   Ein Bibliothekseintrag (wiederholbar); Stimmen bleiben draußen
    --quick-actions <packId>       Die Schnellaktionen eines installierten Packs (wiederholbar)
    --style-from <packId>          Der Stilleitfaden und die Referenzdateien eines installierten Packs`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, von ${author}` : ''}`,
  notInstalled: 'Nicht installiert: zuerst lesen.',
  installedVersion: (version: string) =>
    `Version ${version} ist installiert. Eine erneute Installation aktualisiert, was das Pack besitzt, und behält deine Änderungen bei.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} ${templates === 1 ? 'Vorlage' : 'Vorlagen'}` : '',
      skills ? `${skills} ${skills === 1 ? 'Skill' : 'Skills'}` : '',
      library ? `${library} ${library === 1 ? 'Bibliothekseintrag' : 'Bibliothekseinträge'}` : '',
      style ? 'ein Stilleitfaden' : '',
      quickActions ? `${quickActions} ${quickActions === 1 ? 'Schnellaktion' : 'Schnellaktionen'}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Nichts Eigenes';
  },
  sectionTemplates: 'Vorlagen',
  sectionSkills: 'Skills',
  sectionLibrary: 'Bibliothek',
  sectionStyle: 'Stilleitfaden: Agenten lesen ihn, bevor sie auswählen und bearbeiten',
  sectionExamples: 'Referenzdateien',
  sectionQuick: 'Schnellaktionen: Nachrichten, die mit einem Klick an den Agenten gesendet werden',
  sectionReserved: 'Regeln und Prüfstandard: bleiben beim Pack; CucCut nutzt sie noch nicht',
  sectionWarnings: 'Warnungen',
  agentReads: 'Text, dem ein Agent folgt. Lies ihn.',
  stateNew: 'neu',
  stateUpdate: 'aktualisiert die Kopie, die dieses Pack installiert hat',
  stateChanged: 'du hast sie seit der Installation geändert: bleibt erhalten, außer mit --replace',
  stateExists: 'du hast bereits eine mit dieser ID: deine bleibt erhalten, außer mit --replace',
  stateBuiltin: 'eine eingebaute mit dieser ID existiert, daher wird diese nicht installiert',
  skillFiles: (files: number) => `${files} ${files === 1 ? 'Datei' : 'Dateien'}`,
  duplicate: 'bereits in deiner Bibliothek; nicht erneut hinzugefügt',
  bytes: (bytes: number) => `${bytes} Bytes`,
  missingSkill: (template: string, skill: string) =>
    `${template} empfiehlt den Skill „${skill}“, der weder auf diesem Computer noch im Pack liegt`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, Zeile ${line}: ${why}${text ? ` („${text}“)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Dieses Pack wird nicht installiert: Zeile ${line} von ${file} ${why}${text ? ` („${text}“)` : ''}`,
  installHint: (source: string) => `Installiere es mit: cuccut packs install ${source}`,
  replaceHint: 'Füge --replace hinzu, um deine eigenen Einträge mit denselben IDs zu ersetzen.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `${name} v${version} installiert: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `${kind === 'template' ? 'Vorlage' : kind === 'skill' ? 'Skill' : 'Bibliothekseintrag'} ${id} übersprungen: ${
      reason === 'builtin'
        ? 'eine eingebaute hat diese ID'
        : reason === 'exists'
          ? 'du hast eine eigene mit dieser ID (--replace hinzufügen)'
          : 'du hast sie seit der Installation geändert (--replace hinzufügen)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name} gelöscht: ${templates} ${templates === 1 ? 'Vorlage' : 'Vorlagen'} und ${skills} ${skills === 1 ? 'Skill' : 'Skills'} wurden mit entfernt. Bibliothekseinträge bleiben.`,
  kept: (count: number, ids: string) => `${count} ${count === 1 ? 'von dir geändertes bleibt' : 'von dir geänderte bleiben'}: ${ids}`,
  undo: (trashId: string) => `Rückgängig innerhalb von 24 Stunden: cuccut packs restore ${trashId}`,
  replacedUndo: (ids: string, trashId: string) => `Replaced your own ${ids}. Undo within 24 hours: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `${name} v${version} wiederhergestellt`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} hat keinen Stilleitfaden. Speichere einen mit cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Stilleitfaden von ${name} gespeichert (${chars} / ${limit} Zeichen)`,
  styleRemoved: (name: string) => `Stilleitfaden von ${name} entfernt`,
  takesEffect: 'Gilt ab der nächsten neuen Agentensitzung.',
  idFormat: (value: string) => `Keine Pack-ID (Kleinbuchstaben, Ziffern und einzelne Bindestriche): ${value}`,

  // Export
  exportNeedsName: 'Gib dem Pack mit --name einen Namen.',
  exportNoId: (name: string) => `Aus „${name}“ lässt sich keine ID erzeugen; gib eine mit --id an.`,
  libraryFormat: (value: string) => `Kein Bibliothekseintrag (glossaries:<entryId> oder brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `${dir} geschrieben: ${files} ${files === 1 ? 'Datei' : 'Dateien'}, ${bytes} Bytes. Sende den Ordner unverändert, lade ihn auf GitHub hoch oder stelle ihn über einen beliebigen statischen Host bereit.`,
  exportedCheck: (dir: string) => `Zum Lesen: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `${file} kann nicht gelesen werden: ${reason}`,
};
