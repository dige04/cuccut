import type { NodesMessages } from './nodes-copy.ts';
export const es: NodesMessages = {
 nodesHelp: (port) => `Uso:
  cuccut nodes                     Listar nodos de LAN emparejados (cada uno con comprobación en vivo)
  cuccut nodes discover            Explorar nodos de LAN que comparten capacidades (macOS)
  cuccut nodes pair <address[:port]> <pairing code> [--alias <alias>]
                                   Emparejar con el código de Compartir este ordenador del otro
                                   ordenador; el puerto predeterminado es ${port}
  cuccut nodes remove <nodeId|alias>
                                   Eliminar el nodo y token recordados en este ordenador`,
 noPairedNodes: 'No hay nodos emparejados. Empareja uno con cuccut nodes pair <address[:port]> <pairing code>', noNodesDiscovered: 'No se encontraron nodos que compartan capacidades (explorar solo funciona en macOS; también puedes emparejar introduciendo una dirección)', pairUsage: 'Uso: cuccut nodes pair <address[:port]> <pairing code> [--alias <alias>]', removeUsage: 'Uso: cuccut nodes remove <nodeId|alias>', paired: (description) => `Emparejado: ${description}`, noSuchNode: (ref) => `No hay un nodo emparejado: ${ref}`, removed: (alias, nodeId) => `Eliminado ${alias} (${nodeId})`, invalidPort: (port) => `Puerto no válido: ${port}`,
 shareHelp: (port, capabilities) => `Uso:
  cuccut share [status]            Estado de Compartir este ordenador: dirección, puerto,
                                   interruptores de capacidades, código de emparejamiento, ordenadores emparejados
  cuccut share start [options]     Empezar a compartir y generar un código de emparejamiento
    --port <port>                  Predeterminado ${port}
    --name <name>                  Nombre que ven otros; por defecto, el nombre del host
    --allow-any-source             Aceptar cualquier dirección de origen (solo direcciones LAN por defecto)
  cuccut share stop                Dejar de compartir (cancela tareas enviadas por otros)
  cuccut share code                Invalidar el código anterior y generar uno nuevo
  cuccut share revoke <clientId>   Revocar un ordenador emparejado
  cuccut share capability <capability> <on|off>
                                   Activar o desactivar compartir una capacidad (${capabilities.join(', ')}), con efecto
                                   inmediato: al desactivar, se rechazan las tareas nuevas de otros; las tareas
                                   ya aceptadas se ejecutan hasta terminar`,
 portRange: '--port debe ser un entero entre 0 y 65535', shareRevokeUsage: 'Uso: cuccut share revoke <clientId>', capabilityLabels: { transcribe: 'Transcripción' }, capabilityUsage: 'Uso: cuccut share capability <capability> <on|off> (p. ej., cuccut share capability transcribe off)', shareOff: 'Desactivado', shareOn: 'Activado', shareNotListening: (error) => `Activado, pero sin escuchar${error ? `: ${error}` : ''}`, shareState: (state) => `Compartir este ordenador: ${state}`, name: (name, nodeId) => `Nombre: ${name}${nodeId ? ` (${nodeId})` : ''}`, port: (port, anySource) => `Puerto: ${port}${anySource ? ' (cualquier dirección de origen)' : ''}`, addresses: (addresses) => `Direcciones: ${addresses ?? '(sin dirección de red local)'}`, capabilitiesHead: (empty) => `Capacidades: ${empty ? 'ninguna' : ''}`, capabilityLine: (label, capability, enabled) => `  ${label} (${capability}): ${enabled ? 'activada' : `desactivada (activa con cuccut share capability ${capability} on)`}`, pairingCode: (code, until) => `Código de emparejamiento: ${code} (válido hasta ${until})`, pairingLocked: (until) => `El emparejamiento está bloqueado hasta ${until} (cuccut share code lo desbloquea ahora)`, noPairingCode: 'Código de emparejamiento: ninguno (cuccut share code crea uno)', clientsHead: (empty) => `Ordenadores emparejados: ${empty ? 'ninguno' : ''}`, clientLine: (name, clientId, pairedAt, lastSeenAt) => `  ${name}  ${clientId}  emparejado ${pairedAt}${lastSeenAt ? `  última conexión ${lastSeenAt}` : ''}`, remoteTasks: (running, queued) => `Tareas remotas: ${running} en curso, ${queued} en cola`, unreachable: 'No se puede conectar', versionMismatch: 'Versión de protocolo incompatible', unpaired: 'Emparejamiento ya no válido (empareja de nuevo)', available: 'Disponible', transcribeReady: (bundles, running, queued) => `Disponible · modelos ${bundles.length > 0 ? bundles.join(', ') : 'ninguno'} · ${running} en curso, ${queued} en cola`, transcribeOff: 'No disponible · el nodo desactivó compartir transcripción (actívalo en ese ordenador)',
};
