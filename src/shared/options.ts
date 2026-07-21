import {
  DEFAULT_ASK_SHORTCUT,
  DEFAULT_TRANSLATE_SHORTCUT,
  normalizeKeyboardShortcut
} from './shortcuts';

export interface ApiConnection {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
}

export type TriggerPlacement = 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';
export type ColorMode = 'light' | 'dark';
export type ThemeColor = 'purple' | 'blue' | 'green' | 'orange' | 'rose';

export interface ExtensionOptions {
  enabled: boolean;
  colorMode: ColorMode;
  superMode: boolean;
  quickMode: boolean;
  themeColor: ThemeColor;
  connections: ApiConnection[];
  activeConnectionId: string;
  temperature: number;
  enableAnswerFormatInstruction: boolean;
  answerFormatInstruction: string;
  triggerPlacement: TriggerPlacement;
  panelWidth: number;
  panelHeight: number;
  translateShortcut: string;
  askShortcut: string;
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
  colorMode: 'light',
  superMode: false,
  quickMode: false,
  themeColor: 'purple',
  connections: [DEFAULT_CONNECTION],
  activeConnectionId: DEFAULT_CONNECTION.id,
  temperature: 0.2,
  enableAnswerFormatInstruction: true,
  answerFormatInstruction: '',
  triggerPlacement: 'bottom-right',
  panelWidth: 360,
  panelHeight: 360,
  translateShortcut: DEFAULT_TRANSLATE_SHORTCUT,
  askShortcut: DEFAULT_ASK_SHORTCUT
});

export const STORAGE_DEFAULTS: Record<string, unknown> = {
  enabled: DEFAULT_OPTIONS.enabled,
  colorMode: DEFAULT_OPTIONS.colorMode,
  superMode: DEFAULT_OPTIONS.superMode,
  quickMode: DEFAULT_OPTIONS.quickMode,
  themeColor: DEFAULT_OPTIONS.themeColor,
  connections: null,
  activeConnectionId: '',
  temperature: DEFAULT_OPTIONS.temperature,
  enableAnswerFormatInstruction: DEFAULT_OPTIONS.enableAnswerFormatInstruction,
  answerFormatInstruction: DEFAULT_OPTIONS.answerFormatInstruction,
  triggerPlacement: DEFAULT_OPTIONS.triggerPlacement,
  panelWidth: DEFAULT_OPTIONS.panelWidth,
  panelHeight: DEFAULT_OPTIONS.panelHeight,
  translateShortcut: DEFAULT_OPTIONS.translateShortcut,
  askShortcut: DEFAULT_OPTIONS.askShortcut,
  apiBaseUrl: '',
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
  const triggerPlacement = String(stored.triggerPlacement || '');
  const panelWidth = Number(stored.panelWidth);
  const panelHeight = Number(stored.panelHeight);
  const colorMode = String(stored.colorMode || '');
  const themeColor = String(stored.themeColor || '');
  return {
    enabled: stored.enabled === undefined ? DEFAULT_OPTIONS.enabled : Boolean(stored.enabled),
    colorMode: colorMode === 'dark' ? 'dark' : DEFAULT_OPTIONS.colorMode,
    superMode: stored.superMode === undefined ? DEFAULT_OPTIONS.superMode : Boolean(stored.superMode),
    quickMode: stored.quickMode === undefined ? DEFAULT_OPTIONS.quickMode : Boolean(stored.quickMode),
    themeColor: ['purple', 'blue', 'green', 'orange', 'rose'].includes(themeColor)
      ? themeColor as ThemeColor
      : DEFAULT_OPTIONS.themeColor,
    connections,
    activeConnectionId,
    temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : DEFAULT_OPTIONS.temperature,
    enableAnswerFormatInstruction: stored.enableAnswerFormatInstruction === undefined
      ? DEFAULT_OPTIONS.enableAnswerFormatInstruction
      : Boolean(stored.enableAnswerFormatInstruction),
    answerFormatInstruction: String(stored.answerFormatInstruction || '').trim(),
    triggerPlacement: ['top-left', 'bottom-left', 'top-right', 'bottom-right'].includes(triggerPlacement)
      ? triggerPlacement as TriggerPlacement
      : DEFAULT_OPTIONS.triggerPlacement,
    panelWidth: Number.isFinite(panelWidth) ? Math.round(Math.min(720, Math.max(300, panelWidth))) : DEFAULT_OPTIONS.panelWidth,
    panelHeight: Number.isFinite(panelHeight) ? Math.round(Math.min(720, Math.max(220, panelHeight))) : DEFAULT_OPTIONS.panelHeight,
    translateShortcut: normalizeKeyboardShortcut(stored.translateShortcut, DEFAULT_OPTIONS.translateShortcut),
    askShortcut: normalizeKeyboardShortcut(stored.askShortcut, DEFAULT_OPTIONS.askShortcut)
  };
}

export function getActiveConnection(options: ExtensionOptions): ApiConnection {
  return options.connections.find((connection) => connection.id === options.activeConnectionId)
    || options.connections[0]
    || DEFAULT_CONNECTION;
}
