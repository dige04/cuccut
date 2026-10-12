import type { McpMessages } from './mcp-copy.ts';
export const es: McpMessages = {
 previousClientUnknown: 'No se pudo identificar el cliente usado por el elemento reemplazado, por lo que no se revocó ningún cliente: cuccut mcp status lista los clientes existentes; revoca los que no se usen con cuccut services mcp revoke <clientId>', defaultProjectRegistered: (name, path) => `CucCut no tenía proyectos: se registró el proyecto predeterminado «${name}» (${path}) para que los agentes externos creen vídeos en él`,
 help: `Uso:
  cuccut mcp install --agent <claude-code|codex|cursor|gemini> [--level ask|auto] [--name <client name>] [--yes]
                                   Conectar un agente externo al servicio MCP de CucCut: iniciar el servicio (y con el
                                   Runtime), crear un cliente y token nuevos para el agente y escribir dirección y token en
                                   su configuración MCP (entrada cuccut); después reiniciar el agente
                                   Si CucCut no tiene proyectos, registrar el proyecto CLI en la carpeta predeterminada de proyectos
    --level ask|auto               Nivel de acceso: ask pide confirmar cada escritura y tarea en CucCut (predeterminado del servicio);
                                   auto las ejecuta directamente. Si se omite, se conserva el nivel actual
    --name <client name>           Nombre del cliente en CucCut (por defecto el del agente); se puede revocar por separado
    --yes                          Si ya hay una entrada cuccut en la configuración, reemplazarla y revocar su cliente anterior
                                   (identificado por el token anterior; si no se identifica, se listan los clientes del mismo nombre
                                   para que decidas cuáles revocar). Sin él, no se sobrescribe nada ni se crea un cliente
  Dónde se guarda el token: Claude Code lo guarda en env (CUCCUT_MCP_TOKEN) de ~/.claude/settings.json y la configuración solo lo referencia.
  Codex (~/.codex/config.toml), Cursor (~/.cursor/mcp.json) y Gemini CLI (~/.gemini/settings.json) no tienen un lugar para variables
  de entorno, por lo que el token se escribe en texto plano en su configuración: no confirmes ni compartas estos archivos y prefiere
  el nivel ask; si se filtra un token, revócalo con cuccut services mcp revoke <clientId>.
  El servicio solo está disponible mientras se ejecuta el Runtime de CucCut (abre CucCut o ejecuta cuccut runtime ensure).
  cuccut mcp status                Estado, dirección, nivel y clientes del servicio MCP, y si la configuración de cada agente tiene
                                   una entrada cuccut (sin tokens)`,
 entryExists: (file, entry) => `${file} ya tiene una entrada ${entry}; no se cambió nada. Añade --yes para reemplazarla`, serviceNotAvailable: 'Esta versión de CucCut no ofrece el servicio MCP', serviceStartFailed: (reason) => `El servicio MCP no se inició: ${reason ?? 'motivo desconocido'}`, connected: (host, url) => `${host} conectado al servicio MCP de CucCut: ${url}`, configEnv: (configFile, envFile, envVar) => `Configuración: ${configFile} (el token está en env.${envVar} de ${envFile}; la configuración solo lo referencia)`, configPlaintext: (configFile, clientId) => `Configuración: ${configFile} (el token está escrito en texto plano en este archivo: no lo confirmes ni compartas; si se filtra, revócalo con cuccut services mcp revoke ${clientId})`, clientLine: (name, clientId, level) => `Cliente: ${name} (${clientId})  Nivel: ${level ?? '—'}`, restartHint: (host) => `Reinicia ${host} para que se aplique. El servicio se ejecuta con el Runtime de CucCut: si no está en ejecución, abre CucCut o ejecuta cuccut runtime ensure primero`, replacedRevoked: (name, clientId) => `Se reemplazó la entrada anterior y se revocó su cliente: ${name} (${clientId})`, replacedRevokeFailed: (reason) => `Se reemplazó la entrada anterior, pero no se pudo revocar su cliente: ${reason}`, oldClientRemains: (ids) => `El cliente anterior sigue ahí: ${ids.join(', ')}. Si ya no se usa: cuccut services mcp revoke <clientId>`, sameNameClientsRemain: (ids, unrecognized) => `${unrecognized ? 'No se pudo identificar el cliente de la entrada anterior; los clientes' : 'Los clientes'} del mismo nombre siguen ahí: ${ids.join(', ')}. Si ya no se usan: cuccut services mcp revoke <clientId>`, hostsHeading: (entry) => `Si la configuración de cada agente tiene una entrada ${entry}:`, hostUnreadable: (problem) => `no se puede leer (${problem})`, hostConfigured: 'sí', hostNotConfigured: 'no', noServiceStatus: 'El Runtime no informó del estado del servicio MCP', levelChoice: (value) => `--level debe ser ask o auto: ${value}`,
};
