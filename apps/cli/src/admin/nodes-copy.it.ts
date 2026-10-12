import type { NodesMessages } from './nodes-copy.ts';

export const it: NodesMessages = {
  nodesHelp: (port: number) => `Uso:
  cuccut nodes                     Elenca i nodi LAN abbinati (con verifica in tempo reale)
  cuccut nodes discover            Cerca nodi LAN che condividono capacità (macOS)
  cuccut nodes pair <address[:port]> <pairing code> [--alias <alias>]
                                   Abbina con il codice di Condividi questo computer dell’altro computer;
                                   porta predefinita ${port}
  cuccut nodes remove <nodeId|alias>
                                   Elimina il nodo e il token memorizzati su questo computer`,
  noPairedNodes: 'Nessun nodo abbinato. Abbinalo con cuccut nodes pair <address[:port]> <pairing code>', noNodesDiscovered: 'Nessun nodo che condivide capacità trovato (la ricerca funziona solo su macOS; puoi anche abbinare inserendo un indirizzo)', pairUsage: 'Uso: cuccut nodes pair <address[:port]> <pairing code> [--alias <alias>]', removeUsage: 'Uso: cuccut nodes remove <nodeId|alias>', paired: (description: string) => `Abbinato: ${description}`, noSuchNode: (ref: string) => `Nessun nodo abbinato: ${ref}`, removed: (alias: string, nodeId: string) => `Eliminato: ${alias} (${nodeId})`, invalidPort: (port: string | undefined) => `Porta non valida: ${port}`,
  shareHelp: (port: number, capabilities: readonly string[]) => `Uso:
  cuccut share [status]            Stato di Condividi questo computer: indirizzo, porta,
                                   interruttori per capacità, codice di abbinamento, computer abbinati
  cuccut share start [options]     Avvia la condivisione e genera un codice di abbinamento
    --port <port>                  Predefinita ${port}
    --name <name>                  Nome visto dagli altri, predefinito: nome dell’host
    --allow-any-source             Accetta qualsiasi indirizzo di origine (solo indirizzi LAN per impostazione predefinita)
  cuccut share stop                Interrompe la condivisione (annulla attività inviate da altri)
  cuccut share code                Invalida il vecchio codice di abbinamento e ne genera uno nuovo
  cuccut share revoke <clientId>   Revoca un computer abbinato
  cuccut share capability <capability> <on|off>
                                   Attiva o disattiva la condivisione di una capacità (${capabilities.join(', ')}), con effetto
                                   immediato: quando disattivata, le nuove attività altrui vengono rifiutate; quelle già
                                   accettate vengono eseguite fino al completamento`,
  portRange: '--port deve essere un intero da 0 a 65535', shareRevokeUsage: 'Uso: cuccut share revoke <clientId>', capabilityLabels: { transcribe: 'Trascrizione' }, capabilityUsage: 'Uso: cuccut share capability <capability> <on|off> (ad esempio cuccut share capability transcribe off)', shareOff: 'Disattivato', shareOn: 'Attivato', shareNotListening: (error: string | null) => `Attivato ma non in ascolto${error ? `: ${error}` : ''}`, shareState: (state: string) => `Condividi questo computer: ${state}`, name: (name: string, nodeId: string | null) => `Nome: ${name}${nodeId ? ` (${nodeId})` : ''}`, port: (port: number, anySource: boolean) => `Porta: ${port}${anySource ? ' (qualsiasi indirizzo di origine)' : ''}`, addresses: (addresses: string | null) => `Indirizzi: ${addresses ?? '(nessun indirizzo di rete locale)'}`, capabilitiesHead: (empty: boolean) => `Capacità: ${empty ? 'nessuna' : ''}`, capabilityLine: (label: string, capability: string, enabled: boolean) => `  ${label} (${capability}): ${enabled ? 'on' : `off (attiva con cuccut share capability ${capability} on)`}`, pairingCode: (code: string, until: string) => `Codice di abbinamento: ${code} (valido fino a ${until})`, pairingLocked: (until: string) => `L’abbinamento è bloccato fino a ${until} (cuccut share code lo sblocca ora)`, noPairingCode: 'Codice di abbinamento: nessuno (cuccut share code ne crea uno)', clientsHead: (empty: boolean) => `Computer abbinati: ${empty ? 'nessuno' : ''}`, clientLine: (name: string, clientId: string, pairedAt: string, lastSeenAt: string | null) => `  ${name}  ${clientId}  abbinato ${pairedAt}${lastSeenAt ? `  visto l’ultima volta ${lastSeenAt}` : ''}`,
  remoteTasks: (running: number, queued: number) => `Attività remote: ${running} in corso, ${queued} in coda`, unreachable: 'Impossibile connettersi', versionMismatch: 'Versione del protocollo incompatibile', unpaired: 'Abbinamento non più valido (abbina di nuovo)', available: 'Disponibile', transcribeReady: (bundles: readonly string[], running: number, queued: number) => `Disponibile · modelli ${bundles.length > 0 ? bundles.join(', ') : 'nessuno'} · ${running} in corso, ${queued} in coda`, transcribeOff: 'Non disponibile · il nodo ha disattivato la condivisione della trascrizione (attivala su quel computer)',
};
