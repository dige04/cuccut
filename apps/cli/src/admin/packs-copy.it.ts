import type { PacksMessages } from './packs-copy.ts';

export const it: PacksMessages = {
  packsHelp: `Uso:
  cuccut packs inspect <source>    Legge un pack e mostra tutto ciò che contiene, senza installarlo.
                                   <source>: una cartella, un indirizzo GitHub (owner/repo, un URL di repository o
                                   …/tree/<branch>/<folder>) o un indirizzo https:// che serve pack.json
  cuccut packs install <source>    Legge un pack e installa i suoi modelli, competenze, elementi della libreria, guida
                                   di stile e azioni rapide
    --replace                      Sostituisce i tuoi modelli e le tue competenze con gli stessi id (vanno nel
                                   cestino); senza questa opzione vengono mantenuti e saltati
  cuccut packs remove <id>         Elimina un pack: il pack e i modelli e le competenze che ha portato vanno nel
                                   cestino per 24 ore; gli elementi della libreria e le tue modifiche restano
  cuccut packs restore <trashId>   Annulla un’eliminazione, entro 24 ore
  cuccut packs style <id> [<file>|-]
                                   Stampa la guida di stile del pack; con un file (o - per lo standard input),
                                   salva il file come guida (un file vuoto la rimuove)
  cuccut packs export <folder> --name <name>
                                   Scrive una cartella di pack dai tuoi modelli, competenze ed elementi della libreria,
                                   con l’indice dei file, da inviare così com’è, caricare su GitHub o servire da
                                   un host statico qualsiasi. La cartella deve essere vuota o una precedente esportazione del pack
    --id <id>                      L’id del pack (predefinito: ricavato dal nome)
    --version <version>            Predefinito 1.0.0
    --author <name>, --description <text>
    --template <id>                Un modello tuo (ripetibile)
    --skill <id>                   Una competenza non integrata (ripetibile)
    --library <glossaries|brand>:<entryId>
                                   Un elemento della libreria (ripetibile); le voci restano
    --quick-actions <packId>       Le azioni rapide di un pack installato (ripetibile)
    --style-from <packId>          La guida di stile e i file di riferimento di un pack installato`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, di ${author}` : ''}`,
  notInstalled: 'Non installato: leggilo prima.',
  installedVersion: (version: string) =>
    `La versione ${version} è installata. Reinstallare aggiorna ciò che il pack possiede e mantiene ciò che hai cambiato.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} ${templates === 1 ? 'modello' : 'modelli'}` : '',
      skills ? `${skills} ${skills === 1 ? 'competenza' : 'competenze'}` : '',
      library ? `${library} ${library === 1 ? 'elemento della libreria' : 'elementi della libreria'}` : '',
      style ? 'una guida di stile' : '',
      quickActions ? `${quickActions} ${quickActions === 1 ? 'azione rapida' : 'azioni rapide'}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Niente di proprio';
  },
  sectionTemplates: 'Modelli',
  sectionSkills: 'Competenze',
  sectionLibrary: 'Libreria',
  sectionStyle: 'Guida di stile: gli agenti la leggono prima di scegliere e modificare',
  sectionExamples: 'File di riferimento',
  sectionQuick: 'Azioni rapide: messaggi inviati all’agente con un clic',
  sectionReserved: 'Regole e standard di revisione: conservati con il pack; CucCut non li usa ancora',
  sectionWarnings: 'Avvisi',
  agentReads: 'Testo che un agente seguirà. Leggilo.',
  stateNew: 'nuovo',
  stateUpdate: 'aggiorna la copia installata da questo pack',
  stateChanged: 'l’hai modificato dopo l’installazione: mantenuto a meno di --replace',
  stateExists: 'ne hai già uno con questo id: il tuo viene mantenuto a meno di --replace',
  stateBuiltin: 'uno integrato ha questo id, quindi questo non viene installato',
  skillFiles: (files: number) => `${files} ${files === 1 ? 'file' : 'file'}`,
  duplicate: 'già nella tua libreria; non aggiunto di nuovo',
  bytes: (bytes: number) => `${bytes} byte`,
  missingSkill: (template: string, skill: string) =>
    `${template} consiglia la competenza “${skill}”, che non è né su questo computer né nel pack`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, riga ${line}: ${why}${text ? ` (“${text}”)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Questo pack non verrà installato: la riga ${line} di ${file} ${why}${text ? ` (“${text}”)` : ''}`,
  installHint: (source: string) => `Installalo con: cuccut packs install ${source}`,
  replaceHint: 'Aggiungi --replace per sostituire i tuoi elementi con gli stessi id.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `Installato ${name} v${version}: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `Saltato ${kind === 'template' ? 'il modello' : kind === 'skill' ? 'la competenza' : 'l’elemento della libreria'} ${id}: ${
      reason === 'builtin'
        ? 'uno integrato ha questo id'
        : reason === 'exists'
          ? 'hai il tuo con questo id (aggiungi --replace)'
          : 'l’hai modificato dopo l’installazione (aggiungi --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name} eliminato: ${templates} ${templates === 1 ? 'modello' : 'modelli'} e ${skills} ${skills === 1 ? 'competenza' : 'competenze'} sono andati con lui. Gli elementi della libreria restano.`,
  kept: (count: number, ids: string) => `${count} ${count === 1 ? 'che hai modificato resta' : 'che hai modificato restano'}: ${ids}`,
  undo: (trashId: string) => `Annulla entro 24 ore: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `Ripristinato ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} non ha una guida di stile. Salvane una con cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Guida di stile di ${name} salvata (${chars} / ${limit} caratteri)`,
  styleRemoved: (name: string) => `Guida di stile di ${name} rimossa`,
  takesEffect: 'Ha effetto dalla prossima nuova sessione dell’agente.',
  idFormat: (value: string) => `Non è un id di pack (lettere minuscole, cifre e trattini singoli): ${value}`,

  // Export
  exportNeedsName: 'Dai un nome al pack con --name.',
  exportNoId: (name: string) => `Impossibile creare un id da "${name}"; indicane uno con --id.`,
  libraryFormat: (value: string) => `Non è un elemento della libreria (glossaries:<entryId> o brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `Scritto ${dir}: ${files} ${files === 1 ? 'file' : 'file'}, ${bytes} byte. Invia la cartella così com’è, caricala su GitHub o servila da un host statico qualsiasi.`,
  exportedCheck: (dir: string) => `Rileggilo con: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Impossibile leggere ${file}: ${reason}`,
};
