import { useEffect, useState } from 'react';
import { DEFAULT_OPTIONS, STORAGE_DEFAULTS, getActiveConnection, normalizeExtensionOptions, type ApiConnection } from '../../shared/options';

interface PopupState {
  enabled: boolean;
  supported: boolean | null;
  connections: ApiConnection[];
  activeConnectionId: string;
  version: string;
}

function isBlockedExtensionPage(url: URL): boolean {
  if (url.hostname === 'chromewebstore.google.com') return true;
  if (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')) return true;
  return url.hostname === 'microsoftedge.microsoft.com' && url.pathname.startsWith('/addons');
}

async function isSupportedTab(tab?: chrome.tabs.Tab): Promise<boolean> {
  if (!tab?.url) return false;

  try {
    const url = new URL(tab.url);
    if (url.protocol === 'file:') return chrome.extension.isAllowedFileSchemeAccess();
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (isBlockedExtensionPage(url)) return false;
    return true;
  } catch {
    return false;
  }
}

export function usePopupState() {
  const [state, setState] = useState<PopupState>({
    enabled: DEFAULT_OPTIONS.enabled,
    supported: null,
    connections: DEFAULT_OPTIONS.connections,
    activeConnectionId: DEFAULT_OPTIONS.activeConnectionId,
    version: chrome.runtime.getManifest().version
  });

  useEffect(() => {
    let active = true;

    async function loadState(includeSupport = false) {
      const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
      const options = normalizeExtensionOptions(stored);
      const supported = includeSupport
        ? await isSupportedTab((await chrome.tabs.query({ active: true, currentWindow: true }))[0])
        : undefined;
      if (!active) return;
      setState((current) => ({
        ...current,
        enabled: options.enabled,
        connections: options.connections,
        activeConnectionId: options.activeConnectionId,
        supported: supported ?? current.supported
      }));
    }

    loadState(true);
    const handleStorageChange = (_changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'sync') loadState();
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  async function toggleEnabled() {
    const enabled = !state.enabled;
    setState((current) => ({ ...current, enabled }));
    await chrome.storage.sync.set({ enabled });
  }

  async function selectModel(connectionId: string, model: string) {
    const connections = state.connections.map((connection) => connection.id === connectionId ? { ...connection, model } : connection);
    setState((current) => ({ ...current, connections, activeConnectionId: connectionId }));
    await chrome.storage.sync.set({ connections, activeConnectionId: connectionId });
  }

  const activeConnection = getActiveConnection({ ...DEFAULT_OPTIONS, connections: state.connections, activeConnectionId: state.activeConnectionId });
  return { ...state, activeConnection, toggleEnabled, selectModel };
}
