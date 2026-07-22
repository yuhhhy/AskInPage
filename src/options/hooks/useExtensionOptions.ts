import { useEffect, useState } from 'react';
import { getApiBaseUrlError } from '../../shared/api-url';
import {
  DEFAULT_CONNECTION,
  DEFAULT_OPTIONS,
  normalizeExtensionOptions,
  normalizeModels,
  type ApiConnection,
  type ExtensionOptions
} from '../../shared/options';
import { loadExtensionOptions, saveExtensionOptions as persistExtensionOptions } from '../../shared/storage';
import { getUiLanguage, normalizeUiLanguagePreference, setUiLanguagePreference, t } from '../../shared/i18n';
import { loadUsageStats } from '../../shared/usage-stats';

function getLocalizedApiUrlError(code: string): string {
  if (code === 'invalid') return t('apiUrlInvalid');
  if (code === 'https-required') return t('apiUrlHttpsRequired');
  return t('apiUrlUnsupportedProtocol');
}

function createConnection(index: number): ApiConnection {
  return {
    ...DEFAULT_CONNECTION,
    id: `connection-${Date.now().toString(36)}-${index}`,
    name: t('defaultServiceName', String(index)),
    apiBaseUrl: '',
    apiKey: '',
    models: [...DEFAULT_CONNECTION.models]
  };
}

export function useExtensionOptions() {
  const [options, setOptions] = useState<ExtensionOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadExtensionOptions().then(setOptions);

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== 'sync' || (!changes.colorMode && !changes.uiLanguage)) return;

      setOptions((current) => ({
        ...current,
        ...(changes.colorMode ? { colorMode: changes.colorMode.newValue === 'dark' ? 'dark' : 'light' } : {}),
        ...(changes.uiLanguage ? { uiLanguage: normalizeUiLanguagePreference(changes.uiLanguage.newValue) } : {})
      }));
      if (changes.uiLanguage) {
        setUiLanguagePreference(changes.uiLanguage.newValue || DEFAULT_OPTIONS.uiLanguage);
        document.documentElement.lang = getUiLanguage();
        document.title = t('optionsPageTitle');
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  function updateOption<Key extends keyof ExtensionOptions>(key: Key, value: ExtensionOptions[Key]) {
    if (key === 'uiLanguage') {
      setUiLanguagePreference(value as ExtensionOptions['uiLanguage']);
      document.documentElement.lang = getUiLanguage();
      document.title = t('optionsPageTitle');
    }
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function selectConnection(id: string) {
    setOptions((current) => ({ ...current, activeConnectionId: id }));
  }

  function updateConnection(id: string, patch: Partial<ApiConnection>) {
    setOptions((current) => ({
      ...current,
      connections: current.connections.map((connection) => connection.id === id ? { ...connection, ...patch } : connection)
    }));
  }

  function addConnection() {
    setOptions((current) => {
      const connection = createConnection(current.connections.length + 1);
      return { ...current, connections: [...current.connections, connection], activeConnectionId: connection.id };
    });
  }

  function removeConnection(id: string) {
    setOptions((current) => {
      if (current.connections.length === 1) return current;
      const connections = current.connections.filter((connection) => connection.id !== id);
      return {
        ...current,
        connections,
        activeConnectionId: current.activeConnectionId === id ? connections[0].id : current.activeConnectionId
      };
    });
  }

  async function saveOptions() {
    if (options.translateShortcut === options.askShortcut) {
      setStatus(t('shortcutSaveFailed'));
      window.setTimeout(() => setStatus(''), 2600);
      return;
    }
    const normalizedConnections = options.connections.map((connection, index) => {
      const model = connection.model.trim() || connection.models[0] || DEFAULT_CONNECTION.model;
      return {
        ...connection,
        name: connection.name.trim() || t('defaultServiceName', String(index + 1)),
        apiBaseUrl: connection.apiBaseUrl.trim() || DEFAULT_CONNECTION.apiBaseUrl,
        apiKey: connection.apiKey.trim(),
        model,
        models: normalizeModels(connection.models, model)
      };
    });
    const invalidConnection = normalizedConnections.find((connection) => getApiBaseUrlError(connection.apiBaseUrl));
    if (invalidConnection) {
      setStatus(t('invalidConnection', [invalidConnection.name, getLocalizedApiUrlError(getApiBaseUrlError(invalidConnection.apiBaseUrl))]));
      window.setTimeout(() => setStatus(''), 3200);
      return;
    }
    const nextOptions = normalizeExtensionOptions({ ...options, connections: normalizedConnections });

    setOptions(await persistExtensionOptions(nextOptions));
    setStatus(t('settingsSaved'));
    window.setTimeout(() => setStatus(''), 1600);
  }

  async function exportOptions() {
    const usageStats = await loadUsageStats();
    const payload = {
      format: 'askinpage-settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: options,
      usageStats
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `askinpage-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(t('settingsExported'));
    window.setTimeout(() => setStatus(''), 1600);
  }

  async function importOptions(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const source = parsed?.format === 'askinpage-settings' && parsed.settings && typeof parsed.settings === 'object'
        ? parsed.settings as Record<string, unknown>
        : parsed;
      if (!source || typeof source !== 'object' || (!Array.isArray(source.connections) && !('apiBaseUrl' in source))) {
        throw new Error('invalid settings file');
      }
      const imported = normalizeExtensionOptions(source);
      const invalidConnection = imported.connections.find((connection) => getApiBaseUrlError(connection.apiBaseUrl));
      if (invalidConnection) throw new Error(getApiBaseUrlError(invalidConnection.apiBaseUrl));
      const persisted = await persistExtensionOptions(imported);
      setUiLanguagePreference(persisted.uiLanguage);
      document.documentElement.lang = getUiLanguage();
      document.title = t('optionsPageTitle');
      setOptions(persisted);
      setStatus(t('settingsImported'));
    } catch {
      setStatus(t('invalidImport'));
    }
    window.setTimeout(() => setStatus(''), 2600);
  }

  return {
    options,
    status,
    updateOption,
    selectConnection,
    updateConnection,
    addConnection,
    removeConnection,
    saveOptions,
    exportOptions,
    importOptions
  };
}
