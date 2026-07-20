import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_OPTIONS } from '../shared/options';
import { AskChatApp, type AskChatActions } from './components/AskChatApp';
import { THINKING_STATUS_INTERVAL_MS, THINKING_STATUS_MESSAGES } from './constants';
import type { Intent, PanelStatus, PopoverState, Position, SelectionContext, SelectionTarget, ViewportRect } from './types';

const ASK_CHAT_ROOT_ID = 'ask-chat-selection-root';
const MAX_CONTEXT_CHARS = 5000;
const MAX_LOCAL_CONTEXT_CHARS = 1800;
const MAX_PAGE_CONTEXT_CHARS = 1600;
const LOW_VALUE_SELECTOR = [
  'nav',
  'header',
  'footer',
  'aside',
  'script',
  'style',
  'noscript',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]'
].join(',');
let root: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
let nextPopoverId = 1;
let suppressNextSelection = false;
let extensionEnabled = DEFAULT_OPTIONS.enabled;
const popovers = new Map<string, PopoverState>();

function ensureRoot(): HTMLDivElement {
  if (root) return root;
  root = document.createElement('div');
  root.id = ASK_CHAT_ROOT_ID;
  document.documentElement.appendChild(root);
  return root;
}

function isInsideAskChat(node) {
  return Boolean(node && ensureRoot().contains(node));
}

function getSelectionRect(range: Range): ViewportRect {
  const rects = Array.from(range.getClientRects()) as DOMRect[];
  const visibleRects = rects.filter(rect => rect.width > 0 && rect.height > 0);
  const rect = visibleRects[visibleRects.length - 1] || range.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}

function clampPosition(rect, mode) {
  const margin = 12;
  const width = mode === 'panel' ? 360 : 260;
  const height = mode === 'panel' ? 220 : 42;
  const preferredLeft = rect.right + 8;
  const preferredTop = rect.bottom + 8;
  const left = preferredLeft + width > window.innerWidth - margin
    ? Math.max(margin, rect.right - width)
    : Math.max(margin, preferredLeft);
  const top = preferredTop + height > window.innerHeight - margin
    ? Math.max(margin, rect.bottom - height)
    : Math.max(margin, preferredTop);
  return { left, top };
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getRandomThinkingStatusIndex(excludedIndex = -1) {
  if (THINKING_STATUS_MESSAGES.length <= 1) return 0;

  let nextIndex = excludedIndex;
  while (nextIndex === excludedIndex) {
    nextIndex = Math.floor(Math.random() * THINKING_STATUS_MESSAGES.length);
  }

  return nextIndex;
}

function getMetaDescription(): string {
  return (document.querySelector('meta[name="description"], meta[property="og:description"]') as HTMLMetaElement | null)?.content || '';
}

function getElementText(element) {
  return normalizeText(element?.innerText || element?.textContent || '');
}

function getCleanElementText(element) {
  if (!element) return '';
  const clone = element.cloneNode(true);
  clone.querySelectorAll(LOW_VALUE_SELECTOR).forEach(node => node.remove());
  return getElementText(clone);
}

function getPageLanguage(): string {
  return document.documentElement.lang || (document.querySelector('meta[http-equiv="content-language"]') as HTMLMetaElement | null)?.content || '';
}

function isLowValueElement(element) {
  return Boolean(element?.closest?.(LOW_VALUE_SELECTOR));
}

function getBlockElement(node) {
  return node?.parentElement?.closest('p, li, blockquote, td, th, pre, tr, article, section, main, div') || document.body;
}

function getSemanticBlock(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  if (!element) return document.body;
  return element.closest('td, th, tr, li, p, blockquote, pre, article, section, main, [role="article"], [role="main"], div') || document.body;
}

function getHeadingText(element) {
  const text = getElementText(element);
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function getHeadingChain(element) {
  const headings = [];
  let current = element;
  while (current && current !== document.body) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        headings.unshift(getHeadingText(sibling));
        break;
      }
      const heading = sibling.querySelector?.('h1, h2, h3, h4, h5, h6');
      if (heading) {
        headings.unshift(getHeadingText(heading));
        break;
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  const pageTitle = getHeadingText(document.querySelector('h1')) || document.title;
  return [pageTitle, ...headings]
    .filter(Boolean);
}

function getLinkDensity(element) {
  const textLength = getCleanElementText(element).length || 1;
  const links = Array.from(element?.querySelectorAll?.('a') || []) as HTMLAnchorElement[];
  const linkLength = links.reduce<number>((sum, link) => sum + getElementText(link).length, 0);
  return linkLength / textLength;
}

function scoreMainCandidate(element, selectedText) {
  if (!element || isLowValueElement(element)) return -Infinity;
  const text = getCleanElementText(element);
  if (text.length < 40) return -Infinity;
  const linkDensity = getLinkDensity(element);
  let score = Math.min(text.length, 3500);
  if (text.includes(selectedText)) score += 2400;
  if (element.matches?.('article, main, [role="main"], [role="article"]')) score += 800;
  if (element.querySelector?.('h1, h2, h3')) score += 250;
  score -= linkDensity * 1800;
  return score;
}

function getMainText(selectedText) {
  const candidates = [
    document.querySelector('article'),
    document.querySelector('main'),
    document.querySelector('[role="main"]'),
    document.querySelector('[role="article"]'),
    ...Array.from(document.querySelectorAll('section, article, main, [role="main"], [role="article"]')).slice(0, 80),
    document.body
  ].filter(Boolean);

  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreMainCandidate(candidate, selectedText);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return getCleanElementText(best || document.body);
}

function windowAroundSelection(text, selectedText, maxChars) {
  if (text.length <= maxChars) return text;

  const index = text.indexOf(selectedText);
  if (index === -1) return text.slice(0, maxChars);

  const half = Math.floor((maxChars - selectedText.length) / 2);
  const start = Math.max(0, index - half);
  return text.slice(start, start + maxChars);
}

function getSiblingContext(block, direction) {
  let sibling = direction === 'previous' ? block?.previousElementSibling : block?.nextElementSibling;
  while (sibling) {
    if (!isLowValueElement(sibling)) {
      const text = getCleanElementText(sibling);
      if (text) return text.slice(0, 900);
    }
    sibling = direction === 'previous' ? sibling.previousElementSibling : sibling.nextElementSibling;
  }
  return '';
}

function getSelectionStructure(selection, block) {
  const element = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const link = element?.closest?.('a[href]');
  const button = element?.closest?.('button, [role="button"]');
  const tableCell = element?.closest?.('td, th');
  const tableRow = element?.closest?.('tr');
  const listItem = element?.closest?.('li');
  const codeBlock = element?.closest?.('pre, code');

  return [
    `所在标签：${block?.tagName?.toLowerCase() || 'unknown'}`,
    link && `链接地址：${link.href}`,
    button && '位于按钮/可点击控件中',
    tableCell && '位于表格单元格中',
    tableRow && '位于表格行中',
    listItem && '位于列表项中',
    codeBlock && '位于代码/预格式文本中'
  ].filter(Boolean).join('\n');
}

function getTableContext(selection) {
  const element = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const row = element?.closest?.('tr');
  const table = element?.closest?.('table');
  if (!row || !table) return '';

  const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
  const headers = Array.from(headerRow?.children || [])
    .map(cell => getElementText(cell))
    .filter(Boolean)
    .join(' | ');
  const rowText = Array.from(row.children || [])
    .map(cell => getElementText(cell))
    .filter(Boolean)
    .join(' | ');

  return [
    headers && `表头：${headers}`,
    rowText && `当前行：${rowText}`
  ].filter(Boolean).join('\n');
}

function formatContextSection(title, content) {
  const text = String(content || '').trim();
  return text ? `【${title}】\n${text}` : '';
}

function buildSelectionContext(selection: Selection): SelectionContext {
  const selectedText = normalizeText(selection.toString());
  const block = getSemanticBlock(selection.anchorNode) || getBlockElement(selection.anchorNode);
  const localText = windowAroundSelection(getCleanElementText(block), selectedText, MAX_LOCAL_CONTEXT_CHARS);
  const previousText = getSiblingContext(block, 'previous');
  const nextText = getSiblingContext(block, 'next');
  const tableContext = getTableContext(selection);
  const mainText = windowAroundSelection(getMainText(selectedText), selectedText, MAX_PAGE_CONTEXT_CHARS);
  const context: SelectionContext = {
    selectedText,
    page: {
      title: document.title || '',
      url: location.href,
      language: getPageLanguage() || '',
      description: getMetaDescription()
    },
    selection: {
      blockTag: block?.tagName?.toLowerCase() || 'unknown',
      structureText: getSelectionStructure(selection, block),
      tableContext
    },
    domPath: getHeadingChain(block),
    localContext: {
      previousText,
      currentText: localText,
      nextText
    },
    mainContext: mainText,
    formattedText: ''
  };

  context.formattedText = formatSelectionContext(context);
  return context;
}

function formatSelectionContext(context) {
  const contextParts = [
    formatContextSection('选区结构', [
      `标题链路：${context.domPath.join(' > ') || '无'}`,
      context.selection.structureText,
      context.selection.tableContext
    ].filter(Boolean).join('\n')),
    formatContextSection('附近正文', [
      context.localContext.previousText && `前一段：${context.localContext.previousText}`,
      context.localContext.currentText && `当前语义块：${context.localContext.currentText}`,
      context.localContext.nextText && `后一段：${context.localContext.nextText}`
    ].filter(Boolean).join('\n')),
    formatContextSection('页面正文片段', context.mainContext),
    formatContextSection('页面信息', [
      `标题：${context.page.title || '无'}`,
      `语言：${context.page.language || '未知'}`,
      context.page.description && `摘要：${context.page.description}`
    ].filter(Boolean).join('\n'))
  ].filter(Boolean);

  return contextParts.join('\n\n').slice(0, MAX_CONTEXT_CHARS);
}

function buildFallbackSelectionContext(selection: Selection, selectedText: string): SelectionContext {
  const block = getBlockElement(selection.anchorNode);
  const currentText = windowAroundSelection(getElementText(block), selectedText, MAX_LOCAL_CONTEXT_CHARS);
  return {
    selectedText,
    page: {
      title: document.title || '',
      url: location.href,
      language: getPageLanguage() || '',
      description: getMetaDescription()
    },
    selection: {
      blockTag: block?.tagName?.toLowerCase() || 'unknown',
      structureText: `所在标签：${block?.tagName?.toLowerCase() || 'unknown'}`,
      tableContext: ''
    },
    domPath: getHeadingChain(block),
    localContext: {
      previousText: '',
      currentText,
      nextText: ''
    },
    mainContext: '',
    formattedText: ''
  };
}

function buildSafeSelectionContext(selection: Selection, selectedText: string): SelectionContext {
  try {
    return buildSelectionContext(selection);
  } catch (error) {
    console.warn('[Ask Chat] failed to build structured selection context', error);
    const context = buildFallbackSelectionContext(selection, selectedText);
    context.formattedText = formatSelectionContext(context);
    return context;
  }
}

function syncUi() {
  if (!reactRoot) reactRoot = createRoot(ensureRoot());
  reactRoot.render(<AskChatApp states={[...popovers.values()]} actions={askChatActions} />);
}

function clearUi() {
  for (const state of popovers.values()) {
    stopWaitingRotation(state);
    cancelActiveRequest(state);
  }
  popovers.clear();
  reactRoot?.render(<AskChatApp states={[]} actions={askChatActions} />);
}

const askChatActions: AskChatActions = {
  startLookup,
  closePopover,
  togglePinned,
  showActionMenu: renderActionMenu,
  closeActionMenus: () => closeActionMenus(),
  updatePrompt: (id, prompt) => {
    const state = popovers.get(id);
    if (!state) return;
    state.userPrompt = prompt;
    syncUi();
  },
  updatePanelPosition: (id, position) => {
    const state = popovers.get(id);
    if (!state) return;
    state.panelPosition = position;
    syncUi();
  },
  updateScroll: (id, scrollTop, wasNearBottom) => {
    const state = popovers.get(id);
    if (!state) return;
    state.scrollTop = scrollTop;
    state.wasNearBottom = wasNearBottom;
  },
  handlePanelSelection,
  getTriggerPosition: (target) => clampPosition(target.rect, 'button'),
  getPanelPosition: (state) => state.panelPosition || clampPosition(state.target.rect, 'panel')
};

function createPopover(target: SelectionTarget): string {
  const id = `ask-chat-${nextPopoverId++}`;
  popovers.set(id, {
    id,
    target,
    mode: 'button',
    status: 'loading',
    error: '',
    requestId: '',
    content: '',
    intent: target.intent || 'explain',
    userPrompt: '',
    waitingIndex: getRandomThinkingStatusIndex(),
    waitingTimer: null,
    actionMenuPosition: null,
    pinned: false,
    panelPosition: null,
    scrollTop: 0,
    wasNearBottom: true
  });
  return id;
}

function closePopover(id: string) {
  const state = popovers.get(id);
  stopWaitingRotation(state);
  cancelActiveRequest(state);
  popovers.delete(id);
  syncUi();
}

function cancelActiveRequest(state?: PopoverState) {
  if (!state?.requestId) return;
  chrome.runtime.sendMessage({ type: 'ASK_CHAT_CANCEL', requestId: state.requestId }).catch(() => {});
  state.requestId = '';
}

function stopWaitingRotation(state?: PopoverState) {
  if (!state?.waitingTimer) return;
  window.clearInterval(state.waitingTimer);
  state.waitingTimer = null;
}

function startWaitingRotation(id: string) {
  const state = popovers.get(id);
  if (!state) return;
  stopWaitingRotation(state);
  state.waitingIndex = getRandomThinkingStatusIndex(state.waitingIndex);
  state.waitingTimer = window.setInterval(() => {
    const current = popovers.get(id);
    if (!current || current.content) {
      stopWaitingRotation(current);
      return;
    }
    current.waitingIndex = getRandomThinkingStatusIndex(current.waitingIndex);
    syncUi();
  }, THINKING_STATUS_INTERVAL_MS);
}

function renderButton(target: SelectionTarget): string {
  closeButtonPopovers();
  const id = createPopover(target);
  syncUi();
  return id;
}

function closeButtonPopovers(exceptId = ''): boolean {
  let closed = false;
  for (const [id, state] of [...popovers]) {
    if (state.mode === 'button' && id !== exceptId) {
      stopWaitingRotation(state);
      cancelActiveRequest(state);
      popovers.delete(id);
      closed = true;
    }
  }
  if (closed) syncUi();
  return closed;
}

function closeActionMenus(exceptId = '') {
  let changed = false;
  for (const [id, state] of popovers) {
    if (id !== exceptId && state.actionMenuPosition) {
      state.actionMenuPosition = null;
      changed = true;
    }
  }
  if (changed) syncUi();
}

function clampActionMenuPosition(left: number, top: number): Position {
  const margin = 8;
  return {
    left: Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - 132 - margin)),
    top: Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - 42 - margin))
  };
}

function renderActionMenu(id: string, clientX: number, clientY: number) {
  const state = popovers.get(id);
  if (!state) return;
  closeActionMenus(id);
  state.actionMenuPosition = clampActionMenuPosition(clientX, clientY);
  syncUi();
}

function renderPanel(id: string, { status = 'loading', content = '', error = '' }: { status?: PanelStatus; content?: string; error?: string } = {}) {
  const state = popovers.get(id);
  if (!state) return;
  state.mode = 'panel';
  state.status = status;
  state.error = error;
  state.panelPosition ||= clampPosition(state.target.rect, 'panel');
  if (content) state.content = content;
  syncUi();
}

function updatePanelMeta(id: string, status: PanelStatus) {
  const state = popovers.get(id);
  if (!state) return;
  state.status = status;
  syncUi();
}

function updatePanelBodyContent(id: string, content: string) {
  const state = popovers.get(id);
  if (!state) return;
  state.content = content;
  syncUi();
}

function togglePinned(id: string) {
  const state = popovers.get(id);
  if (!state) return;
  state.pinned = !state.pinned;
  syncUi();
}

async function startLookup(id: string, intent: Intent = 'explain') {
  const state = popovers.get(id);
  if (!state) return;

  const requestId = crypto.randomUUID();
  stopWaitingRotation(state);
  cancelActiveRequest(state);
  closeActionMenus();
  state.requestId = requestId;
  state.content = '';
  state.intent = intent;
  state.userPrompt = intent === 'translate' ? '' : state.userPrompt.trim();
  renderPanel(id, { status: 'loading' });
  startWaitingRotation(id);

  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: 'ASK_CHAT_EXPLAIN',
      payload: {
        requestId,
        selectedText: state.target.text,
        surroundingText: state.target.surroundingText,
        pageTitle: state.target.pageTitle || document.title,
        pageUrl: state.target.pageUrl || location.href,
        userPrompt: state.userPrompt,
        intent
      }
    });
  } catch {
    if (popovers.has(id) && popovers.get(id).requestId === requestId) {
      stopWaitingRotation(popovers.get(id));
      renderPanel(id, { status: 'error', error: '扩展已重载，请刷新页面后重试' });
    }
    return;
  }

  if (!popovers.has(id) || popovers.get(id).requestId !== requestId) return;
  if (!response?.ok) {
    stopWaitingRotation(state);
    renderPanel(id, { status: 'error', error: response?.error || '解释失败' });
    return;
  }
  stopWaitingRotation(state);
  state.content = response.data?.content || state.content;
  if (ensureRoot().querySelector(`[data-ask-chat-id="${id}"]`)) {
    updatePanelMeta(id, 'done');
    updatePanelBodyContent(id, state.content);
  } else {
    renderPanel(id, { status: 'done', content: state.content });
  }
}

function handlePageSelection() {
  if (!extensionEnabled) return;
  window.setTimeout(() => {
    if (!extensionEnabled) return;
    if (suppressNextSelection) {
      suppressNextSelection = false;
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    if (isInsideAskChat(selection.anchorNode) || isInsideAskChat(selection.focusNode)) return;

    const text = normalizeText(selection.toString());
    if (!text) return;

    const range = selection.getRangeAt(0);
    const fallbackContext = buildFallbackSelectionContext(selection, text);
    fallbackContext.formattedText = formatSelectionContext(fallbackContext);
    const id = renderButton({
      rect: getSelectionRect(range),
      pageTitle: fallbackContext.page.title || document.title,
      pageUrl: fallbackContext.page.url || location.href,
      surroundingText: fallbackContext.formattedText,
      text
    });
    window.setTimeout(() => {
      const state = popovers.get(id);
      if (!state) return;
      const context = buildSafeSelectionContext(selection, text);
      state.target = {
        ...state.target,
        pageTitle: context.page.title || document.title,
        pageUrl: context.page.url || location.href,
        surroundingText: context.formattedText
      };
    }, 0);
  }, 0);
}

function handlePanelSelection(id) {
  if (!extensionEnabled) return;
  window.setTimeout(() => {
    const state = popovers.get(id);
    const selection = window.getSelection();
    const body = ensureRoot().querySelector(`[data-ask-chat-id="${id}"] .ask-chat-body`) as HTMLElement | null;
    if (!state || !body || !selection || selection.isCollapsed || selection.rangeCount === 0) return;
    if (!body.contains(selection.anchorNode) || !body.contains(selection.focusNode)) return;

    const text = normalizeText(selection.toString());
    if (!text) return;

    const range = selection.getRangeAt(0);
    const answerText = normalizeText(body.dataset.content || body.innerText || body.textContent);
    renderButton({
      rect: getSelectionRect(range),
      pageTitle: 'Ask Chat 上一层回答',
      pageUrl: location.href,
      surroundingText: `上一层 Ask Chat 回答：${answerText || '无'}`,
      text
    });
  }, 0);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ASK_CHAT_PING') {
    sendResponse({ ok: true, enabled: extensionEnabled });
    return false;
  }
  if (message?.type !== 'ASK_CHAT_DELTA') return false;

  const state = Array.from(popovers.values()).find(item => item.requestId === message.requestId);
  if (!state) return;

  stopWaitingRotation(state);
  state.content += message.chunk || '';
  updatePanelBodyContent(state.id, state.content);
  return false;
});

chrome.storage.sync.get({ enabled: DEFAULT_OPTIONS.enabled }).then((stored) => {
  extensionEnabled = Boolean(stored.enabled);
  if (!extensionEnabled) clearUi();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.enabled) return;
  extensionEnabled = Boolean(changes.enabled.newValue);
  if (!extensionEnabled) clearUi();
});

document.addEventListener('mouseup', (event) => {
  if (isInsideAskChat(event.target)) return;
  handlePageSelection();
});

document.addEventListener('keyup', handlePageSelection);

document.addEventListener('keydown', (event) => {
  if (!extensionEnabled) return;
  if (event.isComposing) return;
  const key = event.key.toLowerCase();
  if (event.key !== 'Enter' && key !== 't') return;

  const buttonPopovers = [...popovers.entries()].filter(([, state]) => state.mode === 'button');
  if (!buttonPopovers.length) return;

  const target = event.target as HTMLElement;
  const isOtherInteractive = !isInsideAskChat(target) && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.contentEditable === 'true'
  );
  if (isOtherInteractive || (key === 't' && isInsideAskChat(target))) return;

  event.preventDefault();
  suppressNextSelection = true;
  for (const [id] of buttonPopovers) {
    startLookup(id, key === 't' ? 'translate' : 'explain');
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!extensionEnabled) return;
  const eventTarget = event.target as HTMLElement;
  const clickedAskChat = eventTarget.closest?.('[data-ask-chat-id]') as HTMLElement | null;
  const clickedAskChatId = clickedAskChat?.dataset?.askChatId || '';
  const clickedActionMenu = eventTarget.closest?.('[data-ask-chat-menu-id]');
  const clickedInsideAskChat = Boolean(clickedAskChat) || Boolean(clickedActionMenu);
  let closedButtonPopover = false;
  let closedPanelPopover = false;

  if (closeButtonPopovers(clickedAskChatId)) {
    closedButtonPopover = true;
  }

  if (clickedInsideAskChat) {
    if (!clickedActionMenu) {
      closeActionMenus();
    }
    if (closedButtonPopover) {
      suppressNextSelection = true;
    }
    return;
  }

  for (const [id, state] of popovers) {
    if (state.mode === 'panel' && !state.pinned) {
      closePopover(id);
      closedPanelPopover = true;
    }
  }
  closeActionMenus();
  if (closedButtonPopover || closedPanelPopover) {
    suppressNextSelection = true;
  }
  if (closedPanelPopover) {
    window.getSelection()?.removeAllRanges();
  }
}, true);
