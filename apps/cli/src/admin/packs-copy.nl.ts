import type { PacksMessages } from './packs-copy.ts';

export const nl: PacksMessages = {
  packsHelp: `Gebruik:
  cuccut packs inspect <source>    Leest een pack en toont alles wat het bevat, zonder het te installeren.
                                   <source>: een map, een GitHub-adres (owner/repo, een repository-URL of
                                   …/tree/<branch>/<folder>) of een https://-adres dat pack.json serveert
  cuccut packs install <source>    Leest een pack en installeert de sjablonen, vaardigheden, bibliotheekitems,
                                   stijlgids en snelle acties
    --replace                      Vervangt je eigen sjablonen en vaardigheden met dezelfde id's (ze gaan naar de
                                   prullenbak); zonder dit worden ze behouden en overgeslagen
  cuccut packs remove <id>         Verwijdert een pack: het en de sjablonen en vaardigheden die het meebracht gaan
                                   24 uur naar de prullenbak; bibliotheekitems en wat je hebt gewijzigd blijven
  cuccut packs restore <trashId>   Maakt een verwijdering ongedaan, binnen 24 uur
  cuccut packs style <id> [<file>|-]
                                   Print de stijlgids van het pack; met een bestand (of - voor standaardinvoer)
                                   wordt het bestand als gids opgeslagen (een leeg bestand verwijdert hem)
  cuccut packs export <folder> --name <name>
                                   Schrijft een packmap van je eigen sjablonen, vaardigheden en bibliotheekitems,
                                   met de bestandsindex, om zoals hij is te versturen, naar GitHub te pushen of vanaf
                                   elke statische host te serveren. De map moet leeg zijn of een eerdere export van het pack
    --id <id>                      Het id van het pack (standaard: gemaakt van de naam)
    --version <version>            Standaard 1.0.0
    --author <name>, --description <text>
    --template <id>                Een eigen sjabloon (herhaalbaar)
    --skill <id>                   Een vaardigheid die niet ingebouwd is (herhaalbaar)
    --library <glossaries|brand>:<entryId>
                                   Een bibliotheekitem (herhaalbaar); stemmen blijven hier
    --quick-actions <packId>       De snelle acties van een geïnstalleerd pack (herhaalbaar)
    --style-from <packId>          De stijlgids en referentiebestanden van een geïnstalleerd pack`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, door ${author}` : ''}`,
  notInstalled: 'Niet geïnstalleerd: lees het eerst.',
  installedVersion: (version: string) =>
    `Versie ${version} is geïnstalleerd. Opnieuw installeren werkt wat het pack beheert bij en behoudt je wijzigingen.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} ${templates === 1 ? 'sjabloon' : 'sjablonen'}` : '',
      skills ? `${skills} ${skills === 1 ? 'vaardigheid' : 'vaardigheden'}` : '',
      library ? `${library} ${library === 1 ? 'bibliotheekitem' : 'bibliotheekitems'}` : '',
      style ? 'een stijlgids' : '',
      quickActions ? `${quickActions} ${quickActions === 1 ? 'snelle actie' : 'snelle acties'}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Niets eigens';
  },
  sectionTemplates: 'Sjablonen',
  sectionSkills: 'Vaardigheden',
  sectionLibrary: 'Bibliotheek',
  sectionStyle: 'Stijlgids: agents lezen deze vóór het kiezen en bewerken',
  sectionExamples: 'Referentiebestanden',
  sectionQuick: 'Snelle acties: berichten die met één klik naar de agent worden gestuurd',
  sectionReserved: 'Regels en beoordelingsstandaard: bewaard bij het pack; CucCut gebruikt ze nog niet',
  sectionWarnings: 'Waarschuwingen',
  agentReads: 'Tekst die een agent zal volgen. Lees hem.',
  stateNew: 'nieuw',
  stateUpdate: 'werkt de kopie bij die dit pack heeft geïnstalleerd',
  stateChanged: 'je hebt hem sinds de installatie gewijzigd: behouden tenzij --replace',
  stateExists: 'je hebt er al een met dit id: de jouwe blijft behouden tenzij --replace',
  stateBuiltin: 'er is al een ingebouwde met dit id, dus deze wordt niet geïnstalleerd',
  skillFiles: (files: number) => `${files} ${files === 1 ? 'bestand' : 'bestanden'}`,
  duplicate: 'staat al in je bibliotheek; niet opnieuw toegevoegd',
  bytes: (bytes: number) => `${bytes} bytes`,
  missingSkill: (template: string, skill: string) =>
    `${template} beveelt de vaardigheid “${skill}” aan, die noch op deze computer noch in het pack staat`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, regel ${line}: ${why}${text ? ` („${text}”)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Dit pack wordt niet geïnstalleerd: regel ${line} van ${file} ${why}${text ? ` („${text}”)` : ''}`,
  installHint: (source: string) => `Installeer het met: cuccut packs install ${source}`,
  replaceHint: 'Voeg --replace toe om je eigen items met dezelfde id’s te vervangen.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `${name} v${version} geïnstalleerd: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `${kind === 'template' ? 'Sjabloon' : kind === 'skill' ? 'Vaardigheid' : 'Bibliotheekitem'} ${id} overgeslagen: ${
      reason === 'builtin'
        ? 'er is een ingebouwde met dit id'
        : reason === 'exists'
          ? 'je hebt een eigen item met dit id (voeg --replace toe)'
          : 'je hebt het sinds de installatie gewijzigd (voeg --replace toe)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name} verwijderd: ${templates} ${templates === 1 ? 'sjabloon' : 'sjablonen'} en ${skills} ${skills === 1 ? 'vaardigheid' : 'vaardigheden'} zijn meegegaan. Bibliotheekitems blijven.`,
  kept: (count: number, ids: string) => `${count} ${count === 1 ? 'item dat je hebt gewijzigd blijft' : 'items die je hebt gewijzigd blijven'}: ${ids}`,
  undo: (trashId: string) => `Ongedaan maken binnen 24 uur: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `${name} v${version} teruggezet`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} heeft geen stijlgids. Sla er een op met cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Stijlgids van ${name} opgeslagen (${chars} / ${limit} tekens)`,
  styleRemoved: (name: string) => `Stijlgids van ${name} verwijderd`,
  takesEffect: 'Geldt vanaf de volgende nieuwe agentsessie.',
  idFormat: (value: string) => `Geen pack-id (kleine letters, cijfers en enkele streepjes): ${value}`,

  // Export
  exportNeedsName: 'Geef het pack een naam met --name.',
  exportNoId: (name: string) => `Kan geen id maken van “${name}”; geef er een op met --id.`,
  libraryFormat: (value: string) => `Geen bibliotheekitem (glossaries:<entryId> of brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `${dir} geschreven: ${files} ${files === 1 ? 'bestand' : 'bestanden'}, ${bytes} bytes. Stuur de map zoals die is, push hem naar GitHub of serveer hem vanaf elke statische host.`,
  exportedCheck: (dir: string) => `Lees terug met: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Kan ${file} niet lezen: ${reason}`,
};
