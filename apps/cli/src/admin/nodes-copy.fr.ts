import type { NodesMessages } from './nodes-copy.ts';

export const fr: NodesMessages = {
  nodesHelp: (port: number) => `Utilisation :
  cuccut nodes                     Lister les nœuds du réseau local jumelés (avec une sonde active pour chacun)
  cuccut nodes discover            Parcourir les nœuds du réseau local partageant des capacités (macOS)
  cuccut nodes pair <address[:port]> <pairing code> [--alias <alias>]
                                   Jumeler avec le code fourni dans Partager cet ordinateur sur l’autre ordinateur ;
                                   port par défaut ${port}
  cuccut nodes remove <nodeId|alias>
                                   Supprimer le nœud et le jeton enregistrés sur cet ordinateur`,
  noPairedNodes: "Aucun nœud jumelé. Utilisez cuccut nodes pair <address[:port]> <pairing code> pour en jumeler un",
  noNodesDiscovered: "Aucun nœud partageant des capacités trouvé (recherche disponible sur macOS uniquement ; vous pouvez aussi saisir une adresse)",
  pairUsage: "Utilisation : cuccut nodes pair <address[:port]> <pairing code> [--alias <alias>]",
  removeUsage: "Utilisation : cuccut nodes remove <nodeId|alias>",
  paired: (description: string) => `Jumelé : ${description}`,
  noSuchNode: (ref: string) => `Aucun nœud jumelé : ${ref}`,
  removed: (alias: string, nodeId: string) => `Supprimé : ${alias} (${nodeId})`,
  invalidPort: (port: string | undefined) => `Port invalide : ${port}`,
  shareHelp: (port: number, capabilities: readonly string[]) => `Utilisation :
  cuccut share [status]            État de Partager cet ordinateur : adresse, port, activation par capacité,
                                   code de jumelage, ordinateurs jumelés
  cuccut share start [options]     Démarrer le partage et générer un code de jumelage
    --port <port>                  Par défaut ${port}
    --name <name>                  Nom visible par les autres, nom de l’hôte par défaut
    --allow-any-source             Accepter toute adresse source (réseau local uniquement par défaut)
  cuccut share stop                Arrêter le partage (annule les tâches soumises par d’autres)
  cuccut share code                Invalider l’ancien code de jumelage et en générer un nouveau
  cuccut share revoke <clientId>   Révoquer un ordinateur jumelé
  cuccut share capability <capability> <on|off>
                                   Activer ou désactiver le partage d’une capacité (${capabilities.join(", ")}) avec effet immédiat :
                                   une fois désactivée, les nouvelles tâches des autres sont refusées ;
                                   les tâches déjà acceptées vont jusqu’au bout`,
  portRange: "--port doit être un entier de 0 à 65535",
  shareRevokeUsage: "Utilisation : cuccut share revoke <clientId>",
  capabilityLabels: { transcribe: "Transcription" } as Record<string, string>,
  capabilityUsage: "Utilisation : cuccut share capability <capability> <on|off> (par exemple cuccut share capability transcribe off)",
  shareOff: "Désactivé",
  shareOn: "Activé",
  shareNotListening: (error: string | null) => `Activé mais sans écoute${error ? ` : ${error}` : ""}`,
  shareState: (state: string) => `Partager cet ordinateur : ${state}`,
  name: (name: string, nodeId: string | null) => `Nom : ${name}${nodeId ? ` (${nodeId})` : ""}`,
  port: (port: number, anySource: boolean) => `Port : ${port}${anySource ? " (toute adresse source)" : ""}`,
  addresses: (addresses: string | null) => `Adresses : ${addresses ?? "(aucune adresse de réseau local)"}`,
  capabilitiesHead: (empty: boolean) => `Capacités : ${empty ? "aucun" : ""}`,
  capabilityLine: (label: string, capability: string, enabled: boolean) =>
    `  ${label} (${capability}) : ${enabled ? "activé" : `désactivé (activez avec cuccut share capability ${capability} on)`}`,
  pairingCode: (code: string, until: string) => `Code de jumelage : ${code} (valide jusqu’à ${until})`,
  pairingLocked: (until: string) => `Jumelage verrouillé jusqu’à ${until} (cuccut share code le déverrouille immédiatement)`,
  noPairingCode: "Code de jumelage : aucun (cuccut share code en crée un)",
  clientsHead: (empty: boolean) => `Ordinateurs jumelés : ${empty ? "aucun" : ""}`,
  clientLine: (name: string, clientId: string, pairedAt: string, lastSeenAt: string | null) =>
    `  ${name}  ${clientId}  jumelé ${pairedAt}${lastSeenAt ? `  dernière présence ${lastSeenAt}` : ""}`,
  remoteTasks: (running: number, queued: number) => `Tâches distantes : ${running} en cours, ${queued} en file d’attente`,
  unreachable: "Connexion impossible",
  versionMismatch: "Version du protocole incompatible",
  unpaired: "Jumelage invalide (jumelez à nouveau)",
  available: "Disponible",
  transcribeReady: (bundles: readonly string[], running: number, queued: number) =>
    `Disponible · modèles ${bundles.length > 0 ? bundles.join(", ") : "aucun"} · ${running} en cours, ${queued} en file d’attente`,
  transcribeOff: "Indisponible · le nœud a désactivé le partage de transcription (activez-le sur cet ordinateur)",
};
