import { DEFAULT_CONNECTION, DEFAULT_OPTIONS, STORAGE_DEFAULTS, getActiveConnection, normalizeExtensionOptions } from '../shared/options';
import { buildPromptMessages } from './prompts';

const REQUEST_TOTAL_TIMEOUT_MS = 180000;
const REQUEST_IDLE_TIMEOUT_MS = 45000;
const activeRequests = new Map();
const POPUP_PREFERENCE_KEYS = new Set(['enabled', 'colorMode', 'superMode', 'themeColor']);

async function saveAndBroadcastPreference(key, value) {
  if (!POPUP_PREFERENCE_KEYS.has(key)) throw new Error('不支持的设置项');
  await chrome.storage.sync.set({ [key]: value });
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs
    .filter((tab) => typeof tab.id === 'number')
    .map((tab) => chrome.tabs.sendMessage(tab.id, {
      type: 'ASK_CHAT_PREFERENCES_CHANGED',
      preference: { key, value }
    })));
}

function normalizeBaseUrl(url) {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_CONNECTION.apiBaseUrl;
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

async function getOptions() {
  const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  return normalizeExtensionOptions(stored);
}

async function readOpenAiStream(response, onChunk, onActivity) {
  if (!response.body) {
    throw new Error('模型没有返回可读取的流式内容');
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
  const connection = getActiveConnection(options);
  if (!connection.apiKey) {
    throw new Error('请先在扩展设置中填写 API Key');
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
      abortWithMessage('模型长时间没有返回新内容，请稍后重试或切换模型');
    }, REQUEST_IDLE_TIMEOUT_MS);
  };

  totalTimer = setTimeout(() => {
    abortWithMessage('模型生成超时，请稍后重试或缩短选中文本');
  }, REQUEST_TOTAL_TIMEOUT_MS);
  resetIdleTimer();
  activeRequests.set(payload.requestId, { controller, clearTimers });

  try {
    const res = await fetch(normalizeBaseUrl(connection.apiBaseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.apiKey}`
      },
      body: JSON.stringify({
        model: connection.model,
        temperature: Number(options.temperature) || DEFAULT_OPTIONS.temperature,
        stream: true,
        messages: buildPromptMessages({
          ...payload,
          answerFormatInstruction: options.answerFormatInstruction,
          enableAnswerFormatInstruction: options.enableAnswerFormatInstruction
        })
      })
    });

    if (!res.ok) {
      let message = `模型请求失败：HTTP ${res.status}`;
      try {
        const data = await res.json();
        message = data?.error?.message || data?.error || message;
      } catch {
        // Keep status fallback.
      }
      throw new Error(message);
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
      throw new Error('模型没有返回内容，请稍后重试或切换模型');
    }

    return { content };
  } catch (error) {
    if (abortMessage && error.name === 'AbortError') {
      throw new Error(abortMessage);
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
      .catch((error) => sendResponse({ ok: false, error: error.message || '设置保存失败' }));
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
      sendResponse({ ok: false, error: error.message || '解释失败' });
    });

  return true;
});
