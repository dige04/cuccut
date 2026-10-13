import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-services.zh-Hans.ts';
import { zhHant } from './rc-services.zh-Hant.ts';
import { ja } from './rc-services.ja.ts';
import { ko } from './rc-services.ko.ts';
import { es } from './rc-services.es.ts';
import { fr } from './rc-services.fr.ts';
import { de } from './rc-services.de.ts';
import { nl } from './rc-services.nl.ts';
import { ptBR } from './rc-services.pt-BR.ts';
import { it } from './rc-services.it.ts';
import { ru } from './rc-services.ru.ts';
import { pl } from './rc-services.pl.ts';
import { tr } from './rc-services.tr.ts';
import { vi } from './rc-services.vi.ts';

/** Errors and descriptions for external services (services/: service management, scope, MCP, clients). English is the source of keys and types; translations are in `rc-services.<language>.ts`. */
const en = {
  mcpServiceLabel: 'MCP service',
  nodeServiceLabel: 'LAN node',
  serviceNotAvailable: (p: { serviceId: string }) => `This version doesn't provide the "${p.serviceId}" service yet`,
  serviceNotFound: (p: { serviceId: string }) => `No "${p.serviceId}" service`,
  runtimeStopping: 'Runtime is stopping',
  clientNotFound: 'No such client',
  portInUse: (p: { port: number }) => `Port ${p.port} is already in use`,
  cannotListen: (p: { port: number; reason: string }) => `Can't listen on port ${p.port}: ${p.reason}`,
  configFileInvalid: (p: { file: string }) => `The services config file is malformed: ${p.file}`,
  routingOnlyForModelApi: 'routing and maxConcurrentPerClient only apply to the model API service (model-api)',
  tokenPlaceholder: (p: { client: string }) => `<token for ${p.client}>`,
  tokenPlaceholderGeneric: '<token>',
  mcpNotRunning: "The MCP service is off: start it first (cuccut services start mcp), or clients can't connect.",
  nodeServiceConfigure: 'Configure the node service with nodes.share.* (cuccut share …)',
  nodeServiceNotListening: "The node service isn't listening",
};

export type RcServicesMessages = typeof en;

export const RcServices = defineCatalog('rcServices', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
