import type { McpMessages } from './mcp-copy.ts';

export const ru: McpMessages = {
  previousClientUnknown: "Не удалось определить клиент заменённой записи, ни один не отозван: cuccut mcp status покажет клиентов; отзовите неиспользуемых через cuccut services mcp revoke <clientId>",
  defaultProjectRegistered: (name, path) => `В CucCut не было проектов: зарегистрирован проект по умолчанию «${name}" (${path}) для создания видео внешними агентами`,

  help: "Использование:\n  cuccut mcp install --agent <claude-code|codex|cursor|gemini> [--level ask|auto] [--name <client name>] [--yes]\n                                   Подключить внешнего агента к MCP CucCut: запустить сервис вместе с Runtime,\n                                   создать клиент и токен для агента, записать адрес и токен в конфигурацию MCP\n                                   агента (запись cuccut), затем перезапустить агента\n                                   Если проектов нет, зарегистрировать проект CLI в папке проектов по умолчанию\n    --level ask|auto               Уровень доступа: ask требует подтверждения каждой записи и задачи в CucCut (по умолчанию);\n                                   auto выполняет напрямую. Без параметра текущий уровень сохраняется\n    --name <client name>           Имя клиента в CucCut (по умолчанию имя агента); отзывается отдельно\n    --yes                          Заменить существующую запись cuccut и отозвать её клиент (определяется по старому\n                                   токену; если не определён, одноимённые клиенты показываются для выбора).\n                                   Без параметра ничего не перезаписывается и клиент не создаётся\n  Где хранится токен: Claude Code сохраняет в env (CUCCUT_MCP_TOKEN) файла ~/.claude/settings.json, конфигурация ссылается на него.\n  У Codex (~/.codex/config.toml), Cursor (~/.cursor/mcp.json) и Gemini CLI (~/.gemini/settings.json) нет места для переменных\n  окружения, токен записывается открытым текстом: не публикуйте и не передавайте файлы, предпочитайте ask;\n  при утечке отзовите через cuccut services mcp revoke <clientId>.\n  Сервис доступен только при работе Runtime CucCut (откройте CucCut или выполните cuccut runtime ensure).\n  cuccut mcp status                Статус сервиса MCP, адрес, уровень и клиенты, наличие записи cuccut\n                                   в конфигурации каждого агента (без токенов)",
  entryExists: (file, entry) => `${file} уже имеет запись ${entry}; ничего не изменено. Добавьте --yes для замены`,
  serviceNotAvailable: "Эта версия CucCut не предоставляет сервис MCP",
  serviceStartFailed: (reason) => `Сервис MCP не запущен: ${reason ?? 'unknown reason'}`,
  connected: (host, url) => `Подключено: ${host} к сервису MCP CucCut: ${url}`,
  configEnv: (configFile, envFile, envVar) => `Конфигурация: ${configFile} (токен в env.${envVar} из ${envFile}; конфигурация только ссылается на него)`,
  configPlaintext: (configFile, clientId) => `Конфигурация: ${configFile} (токен в этом файле открытым текстом: не публикуйте и не передавайте; при утечке отзовите через cuccut services mcp revoke ${clientId})`,
  clientLine: (name, clientId, level) => `Клиент: ${name} (${clientId})  Уровень: ${level ?? '—'}`,
  restartHint: (host) => `Перезапустите ${host} для применения. Сервис работает с Runtime CucCut: если не запущен, откройте CucCut или выполните cuccut runtime ensure`,
  replacedRevoked: (name, clientId) => `Старая запись заменена, её клиент отозван: ${name} (${clientId})`,
  replacedRevokeFailed: (reason) => `Старая запись заменена, но её клиент не отозван: ${reason}`,
  oldClientRemains: (ids) => `Старый клиент ещё существует: ${ids.join(", ")}. Если не используется: cuccut services mcp revoke <clientId>`,
  sameNameClientsRemain: (ids, unrecognized) => `${unrecognized ? "Клиент старой записи не определён; клиенты" : "Клиенты"} с тем же именем ещё существуют: ${ids.join(", ")}. Если не используются: cuccut services mcp revoke <clientId>`,
  hostsHeading: (entry) => `Наличие записи в конфигурации каждого агента: ${entry}:`,
  hostUnreadable: (problem) => `не удалось прочитать (${problem})`,
  hostConfigured: "да",
  hostNotConfigured: "нет",
  noServiceStatus: "Runtime не сообщил статус сервиса MCP",
  levelChoice: (value) => `--level должен быть ask или auto: ${value}`,
};
