export interface ApiConnection {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
}

export interface ExtensionOptions {
  enabled: boolean;
  connections: ApiConnection[];
  activeConnectionId: string;
  temperature: number;
  enableAnswerFormatInstruction: boolean;
  answerFormatInstruction: string;
}

export const DEFAULT_CONNECTION: ApiConnection = Object.freeze({
  id: 'openai',
  name: 'OpenAI',
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  models: ['gpt-4o-mini']
});

export const DEFAULT_OPTIONS: ExtensionOptions = Object.freeze({
  enabled: true,
  connections: [DEFAULT_CONNECTION],
  activeConnectionId: DEFAULT_CONNECTION.id,
  temperature: 0.2,
  enableAnswerFormatInstruction: true,
  answerFormatInstruction: ''
});

export const STORAGE_DEFAULTS: Record<string, unknown> = {
  enabled: DEFAULT_OPTIONS.enabled,
  connections: null,
  activeConnectionId: '',
  temperature: DEFAULT_OPTIONS.temperature,
  enableAnswerFormatInstruction: DEFAULT_OPTIONS.enableAnswerFormatInstruction,
  answerFormatInstruction: DEFAULT_OPTIONS.answerFormatInstruction,
  apiBaseUrl: '',
  apiKey: '',
  model: '',
  models: []
};

export function normalizeModels(models: unknown, activeModel: unknown): string[] {
  const configured = Array.isArray(models)
    ? models.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const active = String(activeModel || '').trim();
  const normalized = [...new Set([...configured, ...(active && !configured.includes(active) ? [active] : [])])];
  return normalized.length ? normalized : [DEFAULT_CONNECTION.model];
}

function normalizeConnection(value: unknown, index: number): ApiConnection | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ApiConnection>;
  const model = String(source.model || '').trim() || DEFAULT_CONNECTION.model;
  return {
    id: String(source.id || `connection-${index + 1}`).trim() || `connection-${index + 1}`,
    name: String(source.name || `服务 ${index + 1}`).trim() || `服务 ${index + 1}`,
    apiBaseUrl: String(source.apiBaseUrl || '').trim(),
    apiKey: String(source.apiKey || '').trim(),
    model,
    models: normalizeModels(source.models, model)
  };
}

export function normalizeExtensionOptions(stored: Record<string, unknown>): ExtensionOptions {
  const configuredConnections = Array.isArray(stored.connections)
    ? stored.connections.map(normalizeConnection).filter((item): item is ApiConnection => Boolean(item))
    : [];

  const legacyModel = String(stored.model || DEFAULT_CONNECTION.model).trim() || DEFAULT_CONNECTION.model;
  const legacyConnection: ApiConnection = {
    ...DEFAULT_CONNECTION,
    apiBaseUrl: String(stored.apiBaseUrl || DEFAULT_CONNECTION.apiBaseUrl).trim() || DEFAULT_CONNECTION.apiBaseUrl,
    apiKey: String(stored.apiKey || '').trim(),
    model: legacyModel,
    models: normalizeModels(stored.models, legacyModel)
  };
  const connections = configuredConnections.length ? configuredConnections : [legacyConnection];
  const requestedActiveId = String(stored.activeConnectionId || '');
  const activeConnectionId = connections.some((connection) => connection.id === requestedActiveId)
    ? requestedActiveId
    : connections[0].id;

  const temperature = Number(stored.temperature);
  return {
    enabled: stored.enabled === undefined ? DEFAULT_OPTIONS.enabled : Boolean(stored.enabled),
    connections,
    activeConnectionId,
    temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : DEFAULT_OPTIONS.temperature,
    enableAnswerFormatInstruction: stored.enableAnswerFormatInstruction === undefined
      ? DEFAULT_OPTIONS.enableAnswerFormatInstruction
      : Boolean(stored.enableAnswerFormatInstruction),
    answerFormatInstruction: String(stored.answerFormatInstruction || '').trim()
  };
}

export function getActiveConnection(options: ExtensionOptions): ApiConnection {
  return options.connections.find((connection) => connection.id === options.activeConnectionId)
    || options.connections[0]
    || DEFAULT_CONNECTION;
}
