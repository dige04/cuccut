import type { McpMessages } from './mcp-copy.ts';

export const ptBR: McpMessages = {
  previousClientUnknown: 'Não foi possível identificar o cliente usado pela entrada substituída, então nenhum cliente foi revogado: cuccut mcp status lista os clientes existentes; revogue os que não usa com cuccut services mcp revoke <clientId>', defaultProjectRegistered: (name, path) => `O CucCut não tinha projetos: o projeto padrão “${name}” (${path}) foi registrado para os agentes externos criarem vídeos`,
  help: `Uso:
  cuccut mcp install --agent <claude-code|codex|cursor|gemini> [--level ask|auto] [--name <client name>] [--yes]
                                   Conectar um agente externo ao serviço MCP do CucCut: iniciar o serviço (também na inicialização
                                   do Runtime), criar um cliente e token para o agente e gravar o endereço e token na configuração
                                   MCP do agente (entrada cuccut); depois reinicie o agente
                                   Se o CucCut não tiver projetos, registrar o projeto do CLI na pasta padrão de projetos para os agentes externos
    --level ask|auto               Nível de acesso: ask exige sua confirmação para cada escrita e tarefa no CucCut (padrão do serviço);
                                   auto executa diretamente. Se omitido, o nível atual é mantido
    --name <client name>           Nome do cliente no CucCut (padrão: nome do agente); pode ser revogado separadamente
    --yes                          Se a configuração do agente já tiver uma entrada cuccut, substituí-la e revogar o cliente usado
                                   pela entrada antiga (identificado pelo token antigo; se não for identificado, os clientes de
                                   mesmo nome são listados para você decidir qual revogar). Sem esta opção, nada é sobrescrito ou criado
  Onde fica o token: o Claude Code o guarda em env (CUCCUT_MCP_TOKEN) de ~/.claude/settings.json; a configuração apenas o referencia.
  Codex (~/.codex/config.toml), Cursor (~/.cursor/mcp.json) e Gemini CLI (~/.gemini/settings.json) não têm lugar para variáveis
  de ambiente, então o token é gravado em texto simples na configuração: não faça commit nem compartilhe esses arquivos e prefira
  o nível ask; se o token vazar, revogue-o com cuccut services mcp revoke <clientId>.
  O serviço só fica disponível enquanto o Runtime do CucCut está em execução (abra o CucCut ou execute cuccut runtime ensure).
  cuccut mcp status                Estado, endereço, nível e clientes do serviço MCP, e se a configuração de cada agente tem
                                   uma entrada cuccut (sem tokens)`,
  entryExists: (file, entry) => `${file} já tem uma entrada ${entry}; nada foi alterado. Adicione --yes para substituí-la`, serviceNotAvailable: 'Esta versão do CucCut não oferece o serviço MCP', serviceStartFailed: (reason) => `O serviço MCP não iniciou: ${reason ?? 'motivo desconhecido'}`, connected: (host, url) => `Conexão de ${host} ao serviço MCP do CucCut: ${url}`, configEnv: (configFile, envFile, envVar) => `Configuração: ${configFile} (o token está em env.${envVar} de ${envFile}; a configuração apenas o referencia)`, configPlaintext: (configFile, clientId) => `Configuração: ${configFile} (o token é gravado neste arquivo em texto simples: não faça commit nem compartilhe; se vazar, revogue com cuccut services mcp revoke ${clientId})`, clientLine: (name, clientId, level) => `Cliente: ${name} (${clientId})  Nível: ${level ?? '—'}`, restartHint: (host) => `Reinicie ${host} para aplicar. O serviço funciona com o Runtime do CucCut: se ele não estiver em execução, abra o CucCut ou execute cuccut runtime ensure primeiro`, replacedRevoked: (name, clientId) => `A entrada antiga foi substituída e seu cliente revogado: ${name} (${clientId})`, replacedRevokeFailed: (reason) => `A entrada antiga foi substituída, mas não foi possível revogar seu cliente: ${reason}`, oldClientRemains: (ids) => `O cliente antigo permanece: ${ids.join(', ')}. Se não usa mais: cuccut services mcp revoke <clientId>`, sameNameClientsRemain: (ids, unrecognized) => `${unrecognized ? 'Não foi possível identificar o cliente usado pela entrada antiga; os clientes' : 'Os clientes'} de mesmo nome permanecem: ${ids.join(', ')}. Se não usa mais: cuccut services mcp revoke <clientId>`, hostsHeading: (entry) => `Se a configuração de cada agente tem uma entrada ${entry}:`, hostUnreadable: (problem) => `não foi possível ler (${problem})`, hostConfigured: 'sim', hostNotConfigured: 'não', noServiceStatus: 'O Runtime não informou o estado do serviço MCP', levelChoice: (value) => `--level deve ser ask ou auto: ${value}`,
};
