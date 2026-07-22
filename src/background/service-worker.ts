import { getApiBaseUrlError, isLoopbackApiUrl, normalizeChatCompletionsUrl } from '../shared/api-url';
import type { ErrorCode, ErrorResponse } from '../shared/errors';
import { setUiLanguagePreference } from '../shared/i18n';
import { DEFAULT_CONNECTION, DEFAULT_OPTIONS, getActiveConnection } from '../shared/options';
import { getInterfaceResponseLanguage, getTranslationResponseLanguage } from '../shared/prompts/language';
import { buildPromptMessages } from '../shared/prompts';
import { loadExtensionOptions } from '../shared/storage';
import { loadUsageStats, USAGE_STATS_STORAGE_KEY, type UsageStats } from '../shared/usage-stats';

const REQUEST_TOTAL_TIMEOUT_MS = 180000;
const REQUEST_IDLE_TIMEOUT_MS = 45000;
const activeRequests = new Map();
const POPUP_PREFERENCE_KEYS = new Set(['enabled', 'colorMode', 'enableAnswerFormatInstruction', 'superMode', 'quickMode', 'themeColor']);
let usageStatsWriteQueue: Promise<void> = Promise.resolve();

function updateUsageStats(update: (current: UsageStats) => UsageStats): Promise<void> {
  usageStatsWriteQueue = usageStatsWriteQueue
    .catch(() => {})
    .then(async () => {
      const current = await loadUsageStats();
      await chrome.storage.local.set({ [USAGE_STATS_STORAGE_KEY]: update(current) });
    })
    .catch(() => {});
  return usageStatsWriteQueue;
}

function recordStartedRequest(): Promise<void> {
  return updateUsageStats((current) => ({ ...current, requestCount: current.requestCount + 1 }));
}

function recordReportedUsage(totalTokens: number): Promise<void> {
  return updateUsageStats((current) => ({
    ...current,
    usageReportedRequestCount: current.usageReportedRequestCount + 1,
    totalTokens: current.totalTokens + totalTokens
  }));
}

function getReportedTotalTokens(usage: unknown): number | null {
  if (!usage || typeof usage !== 'object') return null;
  const source = usage as Record<string, unknown>;
  const total = Number(source.total_tokens);
  if (Number.isFinite(total) && total >= 0) return Math.floor(total);

  const prompt = Number(source.prompt_tokens ?? source.input_tokens);
  const completion = Number(source.completion_tokens ?? source.output_tokens);
  return Number.isFinite(prompt) && prompt >= 0 && Number.isFinite(completion) && completion >= 0
    ? Math.floor(prompt) + Math.floor(completion)
    : null;
}

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
  let reportedTotalTokens: number | null = null;

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
        if (data === '[DONE]') return reportedTotalTokens;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) onChunk(delta);
        const usageTotal = getReportedTotalTokens(parsed.usage);
        if (usageTotal !== null) reportedTotalTokens = usageTotal;
      }
    }
  }

  return reportedTotalTokens;
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
    await recordStartedRequest();
    const requestUrl = normalizeChatCompletionsUrl(connection.apiBaseUrl, DEFAULT_CONNECTION.apiBaseUrl);
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {})
    };
    const requestBody = {
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
    };
    const sendRequest = (includeUsage: boolean) => fetch(requestUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: requestHeaders,
      body: JSON.stringify({
        ...requestBody,
        ...(includeUsage ? { stream_options: { include_usage: true } } : {})
      })
    });

    let res = await sendRequest(true);
    if (res.status >= 400 && res.status < 500) {
      const errorDetails = await res.text();
      if (/stream_options|include_usage/i.test(errorDetails)) res = await sendRequest(false);
    }

    if (!res.ok) {
      throw new ExtensionRequestError('MODEL_REQUEST_FAILED', `HTTP ${res.status}`);
    }

    let content = '';
    resetIdleTimer();
    const reportedTotalTokens = await readOpenAiStream(res, (chunk) => {
      content += chunk;
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'ASK_CHAT_DELTA',
        requestId: payload.requestId,
        chunk
      }).catch(() => {});
    }, resetIdleTimer);

    if (reportedTotalTokens !== null) await recordReportedUsage(reportedTotalTokens);

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
