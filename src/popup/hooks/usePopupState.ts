import { useEffect, useState } from 'react';
import { DEFAULT_OPTIONS, getActiveConnection, type ApiConnection, type ColorMode, type ThemeColor } from '../../shared/options';
import { getPublicOptions, loadExtensionOptions } from '../../shared/storage';
import { getUiLanguage, setUiLanguagePreference } from '../../shared/i18n';

interface PopupState {
  enabled: boolean;
  colorMode: ColorMode;
  enableAnswerFormatInstruction: boolean;
  superMode: boolean;
  quickMode: boolean;
  themeColor: ThemeColor;
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
  const [motionReady, setMotionReady] = useState(false);
  const [state, setState] = useState<PopupState>({
    enabled: DEFAULT_OPTIONS.enabled,
    colorMode: DEFAULT_OPTIONS.colorMode,
    enableAnswerFormatInstruction: DEFAULT_OPTIONS.enableAnswerFormatInstruction,
    superMode: DEFAULT_OPTIONS.superMode,
    quickMode: DEFAULT_OPTIONS.quickMode,
    themeColor: DEFAULT_OPTIONS.themeColor,
    supported: null,
    connections: DEFAULT_OPTIONS.connections,
    activeConnectionId: DEFAULT_OPTIONS.activeConnectionId,
    version: chrome.runtime.getManifest().version
  });

  useEffect(() => {
    let active = true;
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;

    async function loadState(includeSupport = false) {
      const options = getPublicOptions(await loadExtensionOptions());
      setUiLanguagePreference(options.uiLanguage);
      document.documentElement.lang = getUiLanguage();
      const supported = includeSupport
        ? await isSupportedTab((await chrome.tabs.query({ active: true, currentWindow: true }))[0])
        : undefined;
      if (!active) return;
      setState((current) => ({
        ...current,
        enabled: options.enabled,
        colorMode: options.colorMode,
        enableAnswerFormatInstruction: options.enableAnswerFormatInstruction,
        superMode: options.superMode,
        quickMode: options.quickMode,
        themeColor: options.themeColor,
        connections: options.connections,
        activeConnectionId: options.activeConnectionId,
        supported: supported ?? current.supported
      }));
      if (includeSupport) {
        // Storage hydration must settle before transitions are enabled. Two
        // frames guarantee React has painted the persisted switch positions.
        firstFrame = window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => {
            if (active) setMotionReady(true);
          });
        });
      }
    }

    loadState(true);
    const handleStorageChange = (_changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'sync') loadState();
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      active = false;
      if (firstFrame !== null) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  async function updatePreference(key: 'enabled' | 'colorMode' | 'enableAnswerFormatInstruction' | 'superMode' | 'quickMode' | 'themeColor', value: boolean | ColorMode | ThemeColor) {
    setState((current) => ({ ...current, [key]: value }));
    try {
      const response = await chrome.runtime.sendMessage({ type: 'ASK_CHAT_SET_PREFERENCE', key, value });
      if (!response?.ok) throw new Error(response?.errorCode || 'SETTINGS_SAVE_FAILED');
    } catch {
      // Keep a direct-storage fallback for browsers that are waking a newly updated service worker.
      await chrome.storage.sync.set({ [key]: value });
    }
  }

  async function selectModel(connectionId: string, model: string) {
    const connections = state.connections.map((connection) => connection.id === connectionId ? { ...connection, model } : connection);
    setState((current) => ({ ...current, connections, activeConnectionId: connectionId }));
    await chrome.storage.sync.set({
      connections: connections.map(({ apiKey: _apiKey, ...connection }) => connection),
      activeConnectionId: connectionId
    });
  }

  const activeConnection = getActiveConnection({ ...DEFAULT_OPTIONS, connections: state.connections, activeConnectionId: state.activeConnectionId });
  return { ...state, motionReady, activeConnection, updatePreference, selectModel };
}
