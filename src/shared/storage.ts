import {
  STORAGE_DEFAULTS,
  normalizeExtensionOptions,
  type ApiConnection,
  type ExtensionOptions
} from './options';
import { setUiLanguagePreference } from './i18n';

const LOCAL_API_KEYS_KEY = 'connectionApiKeys';

type ConnectionApiKeys = Record<string, string>;

function withoutApiKeys(connections: ApiConnection[]): ApiConnection[] {
  return connections.map((connection) => ({ ...connection, apiKey: '' }));
}

function getConnectionApiKeys(connections: ApiConnection[]): ConnectionApiKeys {
  return Object.fromEntries(connections.map((connection) => [connection.id, connection.apiKey.trim()]));
}

async function restrictLocalStorageAccess() {
  try {
    await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch {
    // Chrome 102+ and current Edge support this. Older browsers keep their default access level.
  }
}

async function removeLegacySyncedApiKeys(stored: Record<string, unknown>) {
  const storedConnections = Array.isArray(stored.connections) ? stored.connections : [];
  const containsNestedKeys = storedConnections.some((connection) => (
    connection && typeof connection === 'object' && Object.hasOwn(connection, 'apiKey')
  ));

  const updates: Promise<unknown>[] = [];
  if (containsNestedKeys) {
    updates.push(chrome.storage.sync.set({
      connections: storedConnections.map((connection) => {
        if (!connection || typeof connection !== 'object') return connection;
        const { apiKey: _apiKey, ...safeConnection } = connection as Record<string, unknown>;
        return safeConnection;
      })
    }));
  }
  if (Object.hasOwn(stored, 'apiKey')) updates.push(chrome.storage.sync.remove('apiKey'));
  await Promise.all(updates);
}

export async function loadExtensionOptions(): Promise<ExtensionOptions> {
  await restrictLocalStorageAccess();
  const [stored, legacyApiKey, local] = await Promise.all([
    chrome.storage.sync.get(STORAGE_DEFAULTS),
    chrome.storage.sync.get('apiKey'),
    chrome.storage.local.get({ [LOCAL_API_KEYS_KEY]: {} })
  ]);
  const storedWithLegacyKey = { ...stored, ...legacyApiKey };
  setUiLanguagePreference(storedWithLegacyKey.uiLanguage);
  const normalized = normalizeExtensionOptions(storedWithLegacyKey);
  const localApiKeys = local[LOCAL_API_KEYS_KEY] && typeof local[LOCAL_API_KEYS_KEY] === 'object'
    ? local[LOCAL_API_KEYS_KEY] as ConnectionApiKeys
    : {};
  const mergedApiKeys: ConnectionApiKeys = { ...localApiKeys };

  for (const connection of normalized.connections) {
    if (!Object.hasOwn(mergedApiKeys, connection.id)) mergedApiKeys[connection.id] = connection.apiKey.trim();
  }

  await chrome.storage.local.set({ [LOCAL_API_KEYS_KEY]: mergedApiKeys });
  await removeLegacySyncedApiKeys(storedWithLegacyKey);

  return {
    ...normalized,
    connections: normalized.connections.map((connection) => ({
      ...connection,
      apiKey: String(mergedApiKeys[connection.id] || '').trim()
    }))
  };
}

export async function saveExtensionOptions(options: ExtensionOptions): Promise<ExtensionOptions> {
  await restrictLocalStorageAccess();
  setUiLanguagePreference(options.uiLanguage);
  const normalized = normalizeExtensionOptions(options as unknown as Record<string, unknown>);
  const connectionApiKeys = getConnectionApiKeys(normalized.connections);
  const syncedOptions = {
    ...normalized,
    connections: withoutApiKeys(normalized.connections).map(({ apiKey: _apiKey, ...connection }) => connection)
  };

  await chrome.storage.local.set({ [LOCAL_API_KEYS_KEY]: connectionApiKeys });
  await Promise.all([
    chrome.storage.sync.set(syncedOptions),
    chrome.storage.sync.remove('apiKey')
  ]);

  return normalized;
}

export function getPublicOptions(options: ExtensionOptions): ExtensionOptions {
  return { ...options, connections: withoutApiKeys(options.connections) };
}
