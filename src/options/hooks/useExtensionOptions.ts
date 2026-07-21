import { useEffect, useState } from 'react';
import {
  DEFAULT_CONNECTION,
  DEFAULT_OPTIONS,
  STORAGE_DEFAULTS,
  normalizeExtensionOptions,
  normalizeModels,
  type ApiConnection,
  type ExtensionOptions
} from '../../shared/options';

function createConnection(index: number): ApiConnection {
  return {
    ...DEFAULT_CONNECTION,
    id: `connection-${Date.now().toString(36)}-${index}`,
    name: `服务 ${index}`,
    apiBaseUrl: '',
    apiKey: '',
    models: [...DEFAULT_CONNECTION.models]
  };
}

export function useExtensionOptions() {
  const [options, setOptions] = useState<ExtensionOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState('');

  useEffect(() => {
    chrome.storage.sync.get(STORAGE_DEFAULTS).then((stored) => {
      setOptions(normalizeExtensionOptions(stored));
    });

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== 'sync' || !changes.colorMode) return;

      setOptions((current) => ({
        ...current,
        colorMode: changes.colorMode.newValue === 'dark' ? 'dark' : 'light'
      }));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  function updateOption<Key extends keyof ExtensionOptions>(key: Key, value: ExtensionOptions[Key]) {
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
    const normalizedConnections = options.connections.map((connection, index) => {
      const model = connection.model.trim() || connection.models[0] || DEFAULT_CONNECTION.model;
      return {
        ...connection,
        name: connection.name.trim() || `服务 ${index + 1}`,
        apiBaseUrl: connection.apiBaseUrl.trim() || DEFAULT_CONNECTION.apiBaseUrl,
        apiKey: connection.apiKey.trim(),
        model,
        models: normalizeModels(connection.models, model)
      };
    });
    const nextOptions = normalizeExtensionOptions({ ...options, connections: normalizedConnections });

    await chrome.storage.sync.set(nextOptions);
    setOptions(nextOptions);
    setStatus('设置已保存');
    window.setTimeout(() => setStatus(''), 1600);
  }

  function exportOptions() {
    const payload = {
      format: 'askinpage-settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: options
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `askinpage-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus('配置已导出');
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
      await chrome.storage.sync.set(imported);
      setOptions(imported);
      setStatus('配置已导入并生效');
    } catch {
      setStatus('导入失败：请选择有效的 AskInPage JSON 配置');
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
