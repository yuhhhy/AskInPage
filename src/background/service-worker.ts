import { getApiBaseUrlError, isLoopbackApiUrl, normalizeChatCompletionsUrl } from '../shared/api-url';
import type { ErrorCode, ErrorResponse } from '../shared/errors';
import { setUiLanguagePreference } from '../shared/i18n';
import { DEFAULT_CONNECTION, DEFAULT_OPTIONS, getActiveConnection } from '../shared/options';
import { getInterfaceResponseLanguage, getTranslationResponseLanguage } from '../shared/prompts/language';
import { buildPromptMessages } from '../shared/prompts';
import { loadExtensionOptions } from '../shared/storage';

const REQUEST_TOTAL_TIMEOUT_MS = 180000;
const REQUEST_IDLE_TIMEOUT_MS = 45000;
const activeRequests = new Map();
const POPUP_PREFERENCE_KEYS = new Set(['enabled', 'colorMode', 'superMode', 'quickMode', 'themeColor']);

class ExtensionRequestError extends Error {
  constructor(public readonly code: ErrorCode, public readonly details = '') {
    super(code);
    this.name = 'ExtensionRequestError';
  }
}

function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ExtensionRequestError) {
    return { ok: false, errorCode: error.code, ...(error.details ? { errorDetails: error.details } : {}) };
  }
  if (error instanceof TypeError) return { ok: false, errorCode: 'NETWORK_ERROR' };
  return { ok: false, errorCode: 'MODEL_REQUEST_FAILED' };
}

function toPreferenceErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ExtensionRequestError) return toErrorResponse(error);
  return { ok: false, errorCode: 'SETTINGS_SAVE_FAILED' };
}

async function saveAndBroadcastPreference(key, value) {
  if (!POPUP_PREFERENCE_KEYS.has(key)) throw new ExtensionRequestError('UNSUPPORTED_PREFERENCE');
  await chrome.storage.sync.set({ [key]: value });
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs
    .filter((tab) => typeof tab.id === 'number')
    .map((tab) => chrome.tabs.sendMessage(tab.id, {
      type: 'ASK_CHAT_PREFERENCES_CHANGED',
      preference: { key, value }
    })));
}

async function getOptions() {
  return loadExtensionOptions();
}

async function readOpenAiStream(response, onChunk, onActivity) {
  if (!response.body) {
    throw new ExtensionRequestError('STREAM_UNAVAILABLE');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onActivity?.();

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') return;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) onChunk(delta);
      }
    }
  }
}

async function explainSelection(payload, sender) {
  const options = await getOptions();
  setUiLanguagePreference(options.uiLanguage);
  const connection = getActiveConnection(options);
  if (!connection.apiKey && !isLoopbackApiUrl(connection.apiBaseUrl)) {
    throw new ExtensionRequestError('API_KEY_MISSING');
  }
  if (!connection.model.trim() || getApiBaseUrlError(connection.apiBaseUrl)) {
    throw new ExtensionRequestError('INVALID_MODEL_CONFIG');
  }

  const controller = new AbortController();
  let abortMessage = '';
  let totalTimer = null;
  let idleTimer = null;

  const abortWithMessage = (message) => {
    if (controller.signal.aborted) return;
    abortMessage = message;
    controller.abort();
  };

  const clearTimers = () => {
    if (totalTimer) clearTimeout(totalTimer);
    if (idleTimer) clearTimeout(idleTimer);
    totalTimer = null;
    idleTimer = null;
  };

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      abortWithMessage('REQUEST_IDLE_TIMEOUT');
    }, REQUEST_IDLE_TIMEOUT_MS);
  };

  totalTimer = setTimeout(() => {
    abortWithMessage('REQUEST_TIMEOUT');
  }, REQUEST_TOTAL_TIMEOUT_MS);
  resetIdleTimer();
  activeRequests.set(payload.requestId, { controller, clearTimers });

  try {
    const res = await fetch(normalizeChatCompletionsUrl(connection.apiBaseUrl, DEFAULT_CONNECTION.apiBaseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: connection.model,
        temperature: Number(options.temperature) || DEFAULT_OPTIONS.temperature,
        stream: true,
        messages: buildPromptMessages({
          ...payload,
          quickMode: options.quickMode,
          answerFormatInstruction: options.answerFormatInstruction,
          enableAnswerFormatInstruction: options.enableAnswerFormatInstruction,
          responseLanguage: payload.intent === 'translate'
            ? getTranslationResponseLanguage(options.translationTarget)
            : getInterfaceResponseLanguage()
        })
      })
    });

    if (!res.ok) {
      throw new ExtensionRequestError('MODEL_REQUEST_FAILED', `HTTP ${res.status}`);
    }

    let content = '';
    resetIdleTimer();
    await readOpenAiStream(res, (chunk) => {
      content += chunk;
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'ASK_CHAT_DELTA',
        requestId: payload.requestId,
        chunk
      }).catch(() => {});
    }, resetIdleTimer);

    if (!content.trim()) {
      throw new ExtensionRequestError('EMPTY_MODEL_RESPONSE');
    }

    return { content };
  } catch (error) {
    if (abortMessage && error.name === 'AbortError') {
      throw new ExtensionRequestError(abortMessage as ErrorCode);
    }
    throw error;
  } finally {
    clearTimers();
    activeRequests.delete(payload.requestId);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ASK_CHAT_SET_PREFERENCE') {
    saveAndBroadcastPreference(message.key, message.value)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse(toPreferenceErrorResponse(error)));
    return true;
  }

  if (message?.type === 'ASK_CHAT_CANCEL') {
    const activeRequest = activeRequests.get(message.requestId);
    activeRequest?.clearTimers?.();
    activeRequest?.controller?.abort();
    activeRequests.delete(message.requestId);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type !== 'ASK_CHAT_EXPLAIN') return false;

  explainSelection(message.payload, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      if (error.name === 'AbortError') {
        sendResponse({ ok: false, cancelled: true });
        return;
      }
      sendResponse(toErrorResponse(error));
    });

  return true;
});
