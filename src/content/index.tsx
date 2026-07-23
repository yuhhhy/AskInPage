import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_OPTIONS } from '../shared/options';
import { getLocalizedError } from '../shared/errors';
import { setUiLanguagePreference, t } from '../shared/i18n';
import type { ColorMode, ThemeColor, TriggerPlacement } from '../shared/options';
import { matchesKeyboardShortcut, normalizeKeyboardShortcut } from '../shared/shortcuts';
import { AskChatApp, type AskChatActions } from './components/AskChatApp';
import { THINKING_STATUS_INTERVAL_MS, THINKING_STATUS_MESSAGE_KEYS } from './constants';
import type { Intent, PanelSize, PanelStatus, PopoverState, Position, SelectionContext, SelectionTarget, ViewportRect } from './types';

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
const suppressedShortcutKeyups = new Set<string>();
let extensionEnabled = DEFAULT_OPTIONS.enabled;
let colorMode: ColorMode = DEFAULT_OPTIONS.colorMode;
let superMode = DEFAULT_OPTIONS.superMode;
let quickMode = DEFAULT_OPTIONS.quickMode;
let themeColor: ThemeColor = DEFAULT_OPTIONS.themeColor;
let layoutPreferences = {
  triggerPlacement: DEFAULT_OPTIONS.triggerPlacement,
  width: DEFAULT_OPTIONS.panelWidth,
  height: DEFAULT_OPTIONS.panelHeight
};
let shortcutPreferences = {
  translate: DEFAULT_OPTIONS.translateShortcut,
  ask: DEFAULT_OPTIONS.askShortcut
};
const popovers = new Map<string, PopoverState>();
const observedShadowRoots = new Set<ShadowRoot>();
let lastPointerGesture: PointerGesture | null = null;
let nextPointerGestureId = 1;
let lastProcessedGestureId = 0;
let pendingSelectionTimer: number | null = null;
let pendingSelectionRequest: SelectionRequest | null = null;
let activeSuperModeSelection: {
  pointerId: number;
  control: Element;
  startX: number;
  startY: number;
  moved: boolean;
  restoreSelectableStyles: () => void;
} | null = null;

interface PointerGesture {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startedInsideAskChat: boolean;
}

interface SelectionRequest {
  eventTarget?: EventTarget | null;
  eventPath: EventTarget[];
  gesture: PointerGesture | null;
  retry: boolean;
  selectionOverride?: ActiveSelection;
}

interface ActiveSelection {
  selection: Selection;
  text: string;
  range: Range;
  rect?: ViewportRect;
  textControl?: HTMLInputElement | HTMLTextAreaElement;
}

function ensureRoot(): HTMLDivElement {
  if (root) {
    applyRootAppearance(root);
    return root;
  }
  root = document.createElement('div');
  root.id = ASK_CHAT_ROOT_ID;
  root.setAttribute('popover', 'manual');
  applyRootAppearance(root);
  document.documentElement.appendChild(root);
  openRootInTopLayer(root);
  return root;
}

function openRootInTopLayer(target: HTMLDivElement, bringToFront = false) {
  if (typeof target.showPopover !== 'function') return;
  try {
    if (bringToFront && target.matches(':popover-open')) target.hidePopover();
    if (!target.matches(':popover-open')) target.showPopover();
  } catch {
    // Older Chromium versions fall back to the root's maximum z-index.
  }
}

function bringRootToFront() {
  openRootInTopLayer(ensureRoot(), true);
}

function applyRootAppearance(target: HTMLDivElement) {
  target.dataset.mode = colorMode;
  target.dataset.theme = themeColor;
}

function syncSuperMode() {
  document.documentElement.classList.toggle('ask-chat-super-mode', extensionEnabled && superMode);
  if ((!extensionEnabled || !superMode) && activeSuperModeSelection) {
    activeSuperModeSelection.restoreSelectableStyles();
    activeSuperModeSelection = null;
  }
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

function getConfiguredPanelSize(): PanelSize {
  return {
    width: Math.min(layoutPreferences.width, Math.max(240, window.innerWidth - 16)),
    height: Math.min(layoutPreferences.height, Math.max(180, window.innerHeight - 16))
  };
}

function getPreferredTriggerPosition(selectionRect: ViewportRect): Position {
  const margin = 8;
  const gap = 8;
  const size = { width: 260, height: 42 };
  const maxLeft = Math.max(margin, window.innerWidth - size.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - size.height - margin);
  const isLeft = layoutPreferences.triggerPlacement.endsWith('left');
  const isTop = layoutPreferences.triggerPlacement.startsWith('top');
  return {
    left: Math.min(maxLeft, Math.max(margin, isLeft
      ? selectionRect.left - size.width - gap
      : selectionRect.right + gap)),
    top: Math.min(maxTop, Math.max(margin, isTop
      ? selectionRect.top - size.height - gap
      : selectionRect.bottom + gap))
  };
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getRootSelection(rootNode: Node | null): Selection | null {
  const selectableRoot = rootNode as { getSelection?: () => Selection | null } | null;
  try {
    return selectableRoot?.getSelection?.() || null;
  } catch {
    return null;
  }
}

function getSelectionText(selection: Selection, range: Range): string {
  return normalizeText(selection.toString() || range.toString() || range.cloneContents().textContent || '');
}

function getTextControlSelection(
  eventTarget?: EventTarget | null,
  eventPath: EventTarget[] = []
): ActiveSelection | null {
  if (!superMode) return null;
  const candidates = [eventTarget, ...eventPath];
  const control = candidates.find((item): item is HTMLInputElement | HTMLTextAreaElement => (
    item instanceof HTMLTextAreaElement
    || (item instanceof HTMLInputElement && item.type !== 'password')
  ));
  if (!control || isInsideAskChat(control)) return null;

  let start: number | null = null;
  let end: number | null = null;
  try {
    start = control.selectionStart;
    end = control.selectionEnd;
  } catch {
    return null;
  }
  if (start === null || end === null || start === end) return null;

  const text = normalizeText(control.value.slice(Math.min(start, end), Math.max(start, end)));
  if (!text) return null;

  try {
    const range = document.createRange();
    range.selectNode(control);
    const rect = control.getBoundingClientRect();
    return {
      selection: createSyntheticSelection(range, text),
      text,
      range,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height
      },
      textControl: control
    };
  } catch {
    return null;
  }
}

function getComposedSelection(selection: Selection | null): ActiveSelection | null {
  if (!selection || selection.isCollapsed) return null;
  const selectionWithComposedRanges = selection as Selection & {
    getComposedRanges?: (
      options?: { shadowRoots?: ShadowRoot[] } | ShadowRoot,
      ...legacyShadowRoots: ShadowRoot[]
    ) => StaticRange[];
  };
  if (!selectionWithComposedRanges.getComposedRanges) return null;

  let composedRanges: StaticRange[] = [];
  try {
    composedRanges = selectionWithComposedRanges.getComposedRanges({ shadowRoots: [...observedShadowRoots] });
  } catch {
    try {
      composedRanges = selectionWithComposedRanges.getComposedRanges(...observedShadowRoots);
    } catch {
      return null;
    }
  }

  for (const composedRange of composedRanges) {
    try {
      const range = document.createRange();
      range.setStart(composedRange.startContainer, composedRange.startOffset);
      range.setEnd(composedRange.endContainer, composedRange.endOffset);
      const text = normalizeText(range.toString() || range.cloneContents().textContent || selection.toString());
      if (text && !range.collapsed) {
        return { selection: createSyntheticSelection(range, text), text, range };
      }
    } catch {
      // The DOM may have changed after the StaticRange was captured.
    }
  }
  return null;
}

function getActiveSelection(eventTarget?: EventTarget | null, eventPath: EventTarget[] = []): ActiveSelection | null {
  const textControlSelection = getTextControlSelection(eventTarget, eventPath);
  if (textControlSelection) return textControlSelection;

  const eventRoots = eventPath
    .filter((item): item is Node => item instanceof Node)
    .map(node => node.getRootNode())
    .filter((item): item is ShadowRoot => item instanceof ShadowRoot);
  const targetNode = eventTarget instanceof Node ? eventTarget : null;
  const candidateRoots = [
    targetNode?.getRootNode(),
    ...eventRoots,
    ...observedShadowRoots
  ].filter(Boolean) as Node[];
  const candidates = [
    ...candidateRoots.map(getRootSelection),
    window.getSelection(),
    document.getSelection?.()
  ].filter(Boolean) as Selection[];
  const seen = new Set<Selection>();

  for (const selection of candidates) {
    if (seen.has(selection)) continue;
    seen.add(selection);
    if (selection.isCollapsed || selection.rangeCount === 0) continue;

    const range = selection.getRangeAt(0);
    const text = getSelectionText(selection, range);
    if (!text) continue;

    return {
      selection,
      text,
      range
    };
  }

  return getComposedSelection(window.getSelection()) || getComposedSelection(document.getSelection?.() || null);
}

function getCaretPosition(x: number, y: number): { offsetNode: Node; offset: number } | null {
  const documentWithShadowCaret = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
      options?: { shadowRoots?: ShadowRoot[] }
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  try {
    const position = documentWithShadowCaret.caretPositionFromPoint?.(
      x,
      y,
      { shadowRoots: [...observedShadowRoots] }
    );
    if (position) return position;
  } catch {
    // Older Chromium versions do not accept the shadowRoots option.
  }

  const range = documentWithShadowCaret.caretRangeFromPoint?.(x, y);
  return range ? { offsetNode: range.startContainer, offset: range.startOffset } : null;
}

function createSyntheticSelection(range: Range, text: string): Selection {
  return {
    anchorNode: range.startContainer,
    anchorOffset: range.startOffset,
    focusNode: range.endContainer,
    focusOffset: range.endOffset,
    isCollapsed: range.collapsed,
    rangeCount: 1,
    type: range.collapsed ? 'Caret' : 'Range',
    toString: () => text,
    getRangeAt: () => range
  } as unknown as Selection;
}

function getGestureSelection(gesture: PointerGesture | null): ActiveSelection | null {
  if (!gesture || gesture.startedInsideAskChat) return null;
  if (Math.hypot(gesture.endX - gesture.startX, gesture.endY - gesture.startY) < 3) return null;

  const start = getCaretPosition(gesture.startX, gesture.startY);
  const end = getCaretPosition(gesture.endX, gesture.endY);
  if (!start || !end || start.offsetNode.getRootNode() !== end.offsetNode.getRootNode()) return null;

  const buildRange = (from: typeof start, to: typeof end) => {
    const range = document.createRange();
    range.setStart(from.offsetNode, from.offset);
    range.setEnd(to.offsetNode, to.offset);
    return range;
  };

  try {
    let range = buildRange(start, end);
    let text = normalizeText(range.toString() || range.cloneContents().textContent || '');
    if (!text) {
      range = buildRange(end, start);
      text = normalizeText(range.toString() || range.cloneContents().textContent || '');
    }
    if (!text || range.collapsed) return null;
    return { selection: createSyntheticSelection(range, text), text, range };
  } catch {
    return null;
  }
}

function getRandomThinkingStatusIndex(excludedIndex = -1) {
  if (THINKING_STATUS_MESSAGE_KEYS.length <= 1) return 0;

  let nextIndex = excludedIndex;
  while (nextIndex === excludedIndex) {
    nextIndex = Math.floor(Math.random() * THINKING_STATUS_MESSAGE_KEYS.length);
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
    t('contextElementTag', block?.tagName?.toLowerCase() || 'unknown'),
    link && t('contextLinkUrl', link.href),
    button && t('contextInsideButton'),
    tableCell && t('contextInsideTableCell'),
    tableRow && t('contextInsideTableRow'),
    listItem && t('contextInsideListItem'),
    codeBlock && t('contextInsideCode')
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
    headers && t('contextTableHeaders', headers),
    rowText && t('contextCurrentRow', rowText)
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
    formatContextSection(t('contextSelectedStructure'), [
      t('contextHeadingPath', context.domPath.join(' > ') || t('contextNone')),
      context.selection.structureText,
      context.selection.tableContext
    ].filter(Boolean).join('\n')),
    formatContextSection(t('contextNearbyText'), [
      context.localContext.previousText && t('contextPreviousParagraph', context.localContext.previousText),
      context.localContext.currentText && t('contextCurrentBlock', context.localContext.currentText),
      context.localContext.nextText && t('contextNextParagraph', context.localContext.nextText)
    ].filter(Boolean).join('\n')),
    formatContextSection(t('contextPageExcerpt'), context.mainContext),
    formatContextSection(t('contextPageInfo'), [
      t('contextPageTitle', context.page.title || t('contextNone')),
      t('contextPageLanguage', context.page.language || t('contextUnknown')),
      context.page.description && t('contextPageDescription', context.page.description)
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
      structureText: t('contextElementTag', block?.tagName?.toLowerCase() || 'unknown'),
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

function buildTextControlSelectionContext(
  control: HTMLInputElement | HTMLTextAreaElement,
  selectedText: string
): SelectionContext {
  const block = getSemanticBlock(control) || control.parentElement || document.body;
  const nearbyText = getCleanElementText(block);
  const context: SelectionContext = {
    selectedText,
    page: {
      title: document.title || '',
      url: location.href,
      language: getPageLanguage() || '',
      description: getMetaDescription()
    },
    selection: {
      blockTag: control.tagName.toLowerCase(),
      structureText: t('contextElementTag', control.tagName.toLowerCase()),
      tableContext: ''
    },
    domPath: getHeadingChain(block),
    localContext: {
      previousText: getSiblingContext(block, 'previous'),
      currentText: windowAroundSelection(nearbyText, selectedText, MAX_LOCAL_CONTEXT_CHARS) || selectedText,
      nextText: getSiblingContext(block, 'next')
    },
    mainContext: windowAroundSelection(getMainText(selectedText), selectedText, MAX_PAGE_CONTEXT_CHARS),
    formattedText: ''
  };
  context.formattedText = formatSelectionContext(context);
  return context;
}

function syncUi() {
  if (!reactRoot) reactRoot = createRoot(ensureRoot());
  reactRoot.render(<AskChatApp states={[...popovers.values()]} actions={askChatActions} />);
}

function clearUi() {
  cancelPendingSelection();
  for (const state of popovers.values()) {
    stopWaitingRotation(state);
    cancelActiveRequest(state);
  }
  popovers.clear();
  reactRoot?.render(<AskChatApp states={[]} actions={askChatActions} />);
}

function cancelPendingSelection() {
  if (pendingSelectionTimer !== null) window.clearTimeout(pendingSelectionTimer);
  pendingSelectionTimer = null;
  pendingSelectionRequest = null;
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
  getTriggerPosition: (target) => getPreferredTriggerPosition(target.rect),
  getPanelPosition: (state) => state.panelPosition || getPreferredTriggerPosition(state.target.rect),
  getPanelSize: getConfiguredPanelSize
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
  bringRootToFront();
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
  state.panelPosition ||= getPreferredTriggerPosition(state.target.rect);
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
        currentParagraph: state.target.currentParagraph,
        pageTitle: state.target.pageTitle || document.title,
        pageUrl: state.target.pageUrl || location.href,
        userPrompt: state.userPrompt,
        intent
      }
    });
  } catch {
    if (popovers.has(id) && popovers.get(id).requestId === requestId) {
      stopWaitingRotation(popovers.get(id));
      renderPanel(id, { status: 'error', error: getLocalizedError('EXTENSION_RELOADED') });
    }
    return;
  }

  if (!popovers.has(id) || popovers.get(id).requestId !== requestId) return;
  if (!response?.ok) {
    stopWaitingRotation(state);
    renderPanel(id, { status: 'error', error: getLocalizedError(response?.errorCode, response?.errorDetails) });
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

function handlePageSelection(
  eventTarget?: EventTarget | null,
  eventPath: EventTarget[] = [],
  gesture: PointerGesture | null = lastPointerGesture,
  retry = true,
  selectionOverride?: ActiveSelection
) {
  if (!extensionEnabled) return;
  if (gesture && gesture.id === lastProcessedGestureId) return;

  const activeSelection = selectionOverride
    || getActiveSelection(eventTarget, eventPath)
    || getGestureSelection(gesture);
  if (!activeSelection) {
    if (retry) {
      schedulePageSelection({ eventTarget, eventPath, gesture, retry: false }, 80);
    }
    return;
  }

  const { selection, text, range, rect: selectionRect, textControl } = activeSelection;
  if (isInsideAskChat(selection.anchorNode) || isInsideAskChat(selection.focusNode)) return;
  if (gesture) lastProcessedGestureId = gesture.id;
  const rect = selectionRect || getSelectionRect(range);
  const fallbackContext = textControl
    ? buildTextControlSelectionContext(textControl, text)
    : buildFallbackSelectionContext(selection, text);
  fallbackContext.formattedText = formatSelectionContext(fallbackContext);
  const id = renderButton({
    rect,
    pageTitle: fallbackContext.page.title || document.title,
    pageUrl: fallbackContext.page.url || location.href,
    surroundingText: fallbackContext.formattedText,
    currentParagraph: fallbackContext.localContext.currentText,
    text
  });
  window.setTimeout(() => {
    const state = popovers.get(id);
    if (!state) return;
    if (quickMode) return;
    const context = textControl
      ? buildTextControlSelectionContext(textControl, text)
      : buildSafeSelectionContext(selection, text);
    state.target = {
      ...state.target,
      pageTitle: context.page.title || document.title,
      pageUrl: context.page.url || location.href,
      surroundingText: context.formattedText,
      currentParagraph: context.localContext.currentText
    };
  }, 0);
}

function schedulePageSelection(request: SelectionRequest, delay = 32) {
  pendingSelectionRequest = request;
  if (pendingSelectionTimer !== null) window.clearTimeout(pendingSelectionTimer);
  pendingSelectionTimer = window.setTimeout(() => {
    pendingSelectionTimer = null;
    const pendingRequest = pendingSelectionRequest;
    pendingSelectionRequest = null;
    if (!pendingRequest) return;
    handlePageSelection(
      pendingRequest.eventTarget,
      pendingRequest.eventPath,
      pendingRequest.gesture,
      pendingRequest.retry,
      pendingRequest.selectionOverride
    );
  }, delay);
}

function getEventPath(event: Event): EventTarget[] {
  return typeof event.composedPath === 'function' ? event.composedPath() : [event.target].filter(Boolean) as EventTarget[];
}

function eventIsInsideAskChat(event: Event): boolean {
  return getEventPath(event).some(item => item instanceof Node && isInsideAskChat(item));
}

function handleSelectionPointerUp(event: PointerEvent | MouseEvent) {
  const eventPath = getEventPath(event);
  eventPath.forEach(item => {
    if (item instanceof ShadowRoot) observedShadowRoots.add(item);
  });
  if (eventIsInsideAskChat(event) || lastPointerGesture?.startedInsideAskChat) return;

  const gesture = lastPointerGesture
    ? { ...lastPointerGesture, endX: event.clientX, endY: event.clientY }
    : null;
  schedulePageSelection({
    eventTarget: eventPath[0] || event.target,
    eventPath,
    gesture,
    retry: true
  });
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
    const block = getSemanticBlock(selection.anchorNode) || getBlockElement(selection.anchorNode);
    const currentParagraph = windowAroundSelection(getCleanElementText(block), text, MAX_LOCAL_CONTEXT_CHARS);
    renderButton({
      rect: getSelectionRect(range),
      pageTitle: t('parentAnswerTitle'),
      pageUrl: location.href,
      surroundingText: t('parentAnswerContext', answerText || t('contextNone')),
      currentParagraph,
      text
    });
  }, 0);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ASK_CHAT_PING') {
    sendResponse({ ok: true, enabled: extensionEnabled });
    return false;
  }
  if (message?.type === 'ASK_CHAT_PREFERENCES_CHANGED') {
    chrome.storage.sync.get(CONTENT_PREFERENCE_DEFAULTS).then(applyContentPreferences);
    sendResponse({ ok: true });
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

const CONTENT_PREFERENCE_DEFAULTS = {
  enabled: DEFAULT_OPTIONS.enabled,
  colorMode: DEFAULT_OPTIONS.colorMode,
  superMode: DEFAULT_OPTIONS.superMode,
  quickMode: DEFAULT_OPTIONS.quickMode,
  themeColor: DEFAULT_OPTIONS.themeColor,
  uiLanguage: DEFAULT_OPTIONS.uiLanguage,
  triggerPlacement: DEFAULT_OPTIONS.triggerPlacement,
  panelWidth: DEFAULT_OPTIONS.panelWidth,
  panelHeight: DEFAULT_OPTIONS.panelHeight,
  translateShortcut: DEFAULT_OPTIONS.translateShortcut,
  askShortcut: DEFAULT_OPTIONS.askShortcut
};

function clampStoredNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeTriggerPlacement(value: unknown): TriggerPlacement {
  const placement = String(value || '');
  return ['top-left', 'bottom-left', 'top-right', 'bottom-right'].includes(placement)
    ? placement as TriggerPlacement
    : DEFAULT_OPTIONS.triggerPlacement;
}

function applyContentPreferences(stored: Record<string, unknown>) {
  setUiLanguagePreference(String(stored.uiLanguage || DEFAULT_OPTIONS.uiLanguage) as typeof DEFAULT_OPTIONS.uiLanguage);
  const wasEnabled = extensionEnabled;
  extensionEnabled = stored.enabled === undefined ? DEFAULT_OPTIONS.enabled : Boolean(stored.enabled);
  colorMode = stored.colorMode === 'dark' ? 'dark' : DEFAULT_OPTIONS.colorMode;
  superMode = stored.superMode === undefined ? DEFAULT_OPTIONS.superMode : Boolean(stored.superMode);
  quickMode = stored.quickMode === undefined ? DEFAULT_OPTIONS.quickMode : Boolean(stored.quickMode);
  themeColor = ['purple', 'blue', 'green', 'orange', 'rose'].includes(String(stored.themeColor || ''))
    ? stored.themeColor as ThemeColor
    : DEFAULT_OPTIONS.themeColor;
  syncSuperMode();
  if (root) applyRootAppearance(root);
  const nextLayoutPreferences = {
    triggerPlacement: normalizeTriggerPlacement(stored.triggerPlacement),
    width: Math.round(clampStoredNumber(stored.panelWidth, DEFAULT_OPTIONS.panelWidth, 300, 720)),
    height: Math.round(clampStoredNumber(stored.panelHeight, DEFAULT_OPTIONS.panelHeight, 220, 720))
  };
  const panelSizeChanged = nextLayoutPreferences.width !== layoutPreferences.width
    || nextLayoutPreferences.height !== layoutPreferences.height;
  layoutPreferences = nextLayoutPreferences;
  shortcutPreferences = {
    translate: normalizeKeyboardShortcut(stored.translateShortcut, DEFAULT_OPTIONS.translateShortcut),
    ask: normalizeKeyboardShortcut(stored.askShortcut, DEFAULT_OPTIONS.askShortcut)
  };

  if (!extensionEnabled) {
    clearUi();
  } else if (popovers.size) {
    if (panelSizeChanged) {
      for (const state of popovers.values()) {
        if (state.mode === 'panel') state.panelPosition = null;
      }
    }
    syncUi();
  } else if (!wasEnabled && extensionEnabled) {
    syncUi();
  }
}

chrome.storage.sync.get(CONTENT_PREFERENCE_DEFAULTS).then(applyContentPreferences);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  const relevantKeys = ['enabled', 'colorMode', 'superMode', 'quickMode', 'themeColor', 'uiLanguage', 'triggerPlacement', 'panelWidth', 'panelHeight', 'translateShortcut', 'askShortcut'];
  if (!relevantKeys.some(key => changes[key])) return;
  chrome.storage.sync.get(CONTENT_PREFERENCE_DEFAULTS).then(applyContentPreferences);
});

const SUPER_MODE_SEMANTIC_CONTROL_SELECTOR = [
  'button',
  'a[href]',
  'summary',
  'label[for]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]'
].join(', ');

const SUPER_MODE_EVENT_HANDLER_ATTRIBUTES = [
  'onclick',
  'onmousedown',
  'onmouseup',
  'onpointerdown',
  'onpointerup'
];
const temporarilySelectableSuperModeControls = new WeakSet<Element>();

function isVisibleControl(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
}

function hasInlineInteraction(element: Element): boolean {
  if (SUPER_MODE_EVENT_HANDLER_ATTRIBUTES.some(attribute => element.hasAttribute(attribute))) return true;
  const interactiveElement = element as HTMLElement & Record<string, unknown>;
  return SUPER_MODE_EVENT_HANDLER_ATTRIBUTES.some(attribute => typeof interactiveElement[attribute] === 'function');
}

function hasKeyboardInteraction(element: Element): boolean {
  if (!(element instanceof HTMLElement) || !element.hasAttribute('tabindex')) return false;
  return element.tabIndex >= 0;
}

function isEditableSuperModeTarget(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    return !['button', 'submit', 'reset'].includes(element.type);
  }
  return element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
    || (element instanceof HTMLElement && element.isContentEditable)
    || element.matches('[role="textbox"], [role="searchbox"], [role="combobox"]');
}

function findPointerCursorControl(elements: Element[]): Element | null {
  let pointerControl: Element | null = null;
  let foundPointerCursor = false;

  for (const element of elements) {
    if (element === document.documentElement || element === document.body) break;
    const usesPointerCursor = window.getComputedStyle(element).cursor === 'pointer';
    if (!usesPointerCursor) {
      if (foundPointerCursor) break;
      continue;
    }
    foundPointerCursor = true;
    pointerControl = element;
  }
  return pointerControl;
}

function getSuperModeControl(event: Event): Element | null {
  if (!extensionEnabled || !superMode || !event.isTrusted || eventIsInsideAskChat(event)) return null;
  const elements = getEventPath(event).filter((item): item is Element => item instanceof Element);
  if (elements.some(isEditableSuperModeTarget)) return null;
  const control = elements.find(element => temporarilySelectableSuperModeControls.has(element))
    || elements.find(element => element.matches(SUPER_MODE_SEMANTIC_CONTROL_SELECTOR))
    || elements.find(hasInlineInteraction)
    || elements.find(hasKeyboardInteraction)
    || findPointerCursorControl(elements);
  return control && isVisibleControl(control) ? control : null;
}

function getSuperModeControlText(control: Element): string {
  const visibleText = normalizeText((control as HTMLElement).innerText || '');
  if (visibleText) return visibleText;
  if (control instanceof HTMLInputElement) return normalizeText(control.value);

  const labelledBy = control.getAttribute('aria-labelledby');
  const rootNode = control.getRootNode();
  const labelText = labelledBy
    ?.split(/\s+/)
    .map(id => {
      if (rootNode instanceof Document || rootNode instanceof ShadowRoot) {
        return getElementText(rootNode.getElementById(id));
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
  return normalizeText(
    labelText
    || control.getAttribute('aria-label')
    || control.getAttribute('title')
    || control.querySelector('img[alt]')?.getAttribute('alt')
    || control.textContent
    || ''
  );
}

function selectionIntersectsControl(range: Range, control: Element): boolean {
  try {
    return control.contains(range.commonAncestorContainer) || range.intersectsNode(control);
  } catch {
    return false;
  }
}

function getSelectionInsideControl(control: Element): ActiveSelection | null {
  const candidates = [
    getRootSelection(control.getRootNode()),
    window.getSelection(),
    document.getSelection?.()
  ].filter(Boolean) as Selection[];
  const seen = new Set<Selection>();

  for (const selection of candidates) {
    if (seen.has(selection)) continue;
    seen.add(selection);
    if (selection.isCollapsed || selection.rangeCount === 0) continue;
    const range = selection.getRangeAt(0);
    if (!selectionIntersectsControl(range, control)) continue;
    const text = getSelectionText(selection, range);
    if (text) return { selection, text, range };
  }
  return null;
}

function selectSuperModeControlText(control: Element): ActiveSelection | null {
  try {
    const range = document.createRange();
    range.selectNodeContents(control);
    const selection = getRootSelection(control.getRootNode()) || window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const selectedText = normalizeText(selection?.toString() || '');
    const text = selectedText || getSuperModeControlText(control);
    if (!text) return null;
    const rect = control.getBoundingClientRect();
    return {
      selection: selection && !selection.isCollapsed && selectedText
        ? selection
        : createSyntheticSelection(range, text),
      text,
      range,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    };
  } catch {
    return null;
  }
}

function makeSuperModeControlSelectable(control: Element): () => void {
  temporarilySelectableSuperModeControls.add(control);
  const elements = [control, ...Array.from(control.querySelectorAll('*')).slice(0, 250)];
  const properties = ['cursor', 'user-select', '-webkit-user-select', '-webkit-user-drag'];
  const snapshots = elements.map(element => {
    const htmlElement = element as HTMLElement;
    const values = properties.map(property => ({
      property,
      value: htmlElement.style.getPropertyValue(property),
      priority: htmlElement.style.getPropertyPriority(property)
    }));
    htmlElement.style.setProperty('cursor', 'text', 'important');
    htmlElement.style.setProperty('user-select', 'text', 'important');
    htmlElement.style.setProperty('-webkit-user-select', 'text', 'important');
    htmlElement.style.setProperty('-webkit-user-drag', 'none', 'important');
    return { htmlElement, values };
  });

  return () => {
    temporarilySelectableSuperModeControls.delete(control);
    for (const { htmlElement, values } of snapshots) {
      for (const { property, value, priority } of values) {
        if (value) htmlElement.style.setProperty(property, value, priority);
        else htmlElement.style.removeProperty(property);
      }
    }
  };
}

function scheduleSuperModeSelection(control: Element) {
  window.setTimeout(() => {
    const activeSelection = getSelectionInsideControl(control) || selectSuperModeControlText(control);
    if (!activeSelection) return;
    schedulePageSelection({
      eventTarget: control,
      eventPath: [control],
      gesture: null,
      retry: false,
      selectionOverride: activeSelection
    }, 0);
  }, 0);
}

document.documentElement.addEventListener('pointerdown', (event) => {
  const control = getSuperModeControl(event);
  if (!control) return;
  activeSuperModeSelection?.restoreSelectableStyles();
  activeSuperModeSelection = {
    pointerId: event.pointerId,
    control,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    restoreSelectableStyles: makeSuperModeControlSelectable(control)
  };
  // Keep the browser's default pointer behavior so button text can be selected.
  // Stopping propagation is enough to keep page frameworks from handling the
  // press; the final click is cancelled separately below.
  event.stopImmediatePropagation();
}, true);

document.documentElement.addEventListener('pointermove', (event) => {
  const active = activeSuperModeSelection;
  if (!active || active.pointerId !== event.pointerId) return;
  if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= 3) {
    active.moved = true;
  }
  event.stopImmediatePropagation();
}, true);

document.documentElement.addEventListener('pointerup', (event) => {
  const active = activeSuperModeSelection;
  if (!active || active.pointerId !== event.pointerId) return;
  active.moved ||= Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= 3;
  activeSuperModeSelection = null;
  event.stopImmediatePropagation();
  if (active.moved) scheduleSuperModeSelection(active.control);
  window.setTimeout(active.restoreSelectableStyles, 0);
}, true);

document.documentElement.addEventListener('pointercancel', (event) => {
  if (activeSuperModeSelection?.pointerId !== event.pointerId) return;
  activeSuperModeSelection.restoreSelectableStyles();
  activeSuperModeSelection = null;
}, true);

document.documentElement.addEventListener('mousedown', (event) => {
  const control = getSuperModeControl(event);
  if (!control) return;
  // Some browsers and automation/accessibility paths emit only mouse events.
  // Keep a mouse-only fallback without replacing an active PointerEvent gesture.
  activeSuperModeSelection ||= {
    pointerId: -1,
    control,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    restoreSelectableStyles: makeSuperModeControlSelectable(control)
  };
  event.stopImmediatePropagation();
}, true);

document.documentElement.addEventListener('mousemove', (event) => {
  const active = activeSuperModeSelection;
  if (!active || active.pointerId !== -1) return;
  if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= 3) {
    active.moved = true;
  }
  event.stopImmediatePropagation();
}, true);

document.documentElement.addEventListener('mouseup', (event) => {
  const active = activeSuperModeSelection;
  if (!active || active.pointerId !== -1) return;
  active.moved ||= Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= 3;
  activeSuperModeSelection = null;
  event.stopImmediatePropagation();
  if (active.moved) scheduleSuperModeSelection(active.control);
  window.setTimeout(active.restoreSelectableStyles, 0);
}, true);

document.documentElement.addEventListener('dblclick', (event) => {
  const control = getSuperModeControl(event);
  if (!control) return;
  event.stopImmediatePropagation();
  scheduleSuperModeSelection(control);
}, true);

document.documentElement.addEventListener('dragstart', (event) => {
  if (!getSuperModeControl(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

document.documentElement.addEventListener('click', (event) => {
  if (!getSuperModeControl(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

document.documentElement.addEventListener('keydown', (event) => {
  if (!getSuperModeControl(event) || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

document.addEventListener('pointerup', handleSelectionPointerUp, true);
document.addEventListener('mouseup', handleSelectionPointerUp, true);

function getShortcutKeyupToken(code: string): string {
  if (code.startsWith('Control')) return 'Control';
  if (code.startsWith('Alt')) return 'Alt';
  if (code.startsWith('Shift')) return 'Shift';
  if (code.startsWith('Meta')) return 'Meta';
  return code;
}

function rememberShortcutKeyups(event: KeyboardEvent) {
  suppressedShortcutKeyups.add(event.code);
  if (event.ctrlKey) suppressedShortcutKeyups.add('Control');
  if (event.altKey) suppressedShortcutKeyups.add('Alt');
  if (event.shiftKey) suppressedShortcutKeyups.add('Shift');
  if (event.metaKey) suppressedShortcutKeyups.add('Meta');
}

document.addEventListener('keyup', (event) => {
  const shortcutKeyupToken = getShortcutKeyupToken(event.code);
  if (suppressedShortcutKeyups.delete(shortcutKeyupToken)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  schedulePageSelection({
    eventTarget: event.target,
    eventPath: getEventPath(event),
    gesture: null,
    retry: true
  });
}, true);

document.addEventListener('keydown', (event) => {
  if (!extensionEnabled) return;
  if (event.isComposing) return;
  const intent: Intent | null = matchesKeyboardShortcut(event, shortcutPreferences.translate)
    ? 'translate'
    : matchesKeyboardShortcut(event, shortcutPreferences.ask) ? 'explain' : null;
  if (!intent) return;

  const buttonPopovers = [...popovers.entries()].filter(([, state]) => state.mode === 'button');
  if (!buttonPopovers.length) return;

  const isEditing = getEventPath(event).some(item => item instanceof HTMLElement && (
    item.tagName === 'INPUT' ||
    item.tagName === 'TEXTAREA' ||
    item.isContentEditable
  ));
  if (isEditing) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  rememberShortcutKeyups(event);
  for (const [id] of buttonPopovers) {
    startLookup(id, intent);
  }
}, true);

window.addEventListener('blur', () => {
  suppressedShortcutKeyups.clear();
  activeSuperModeSelection?.restoreSelectableStyles();
  activeSuperModeSelection = null;
});
document.addEventListener('pointerdown', (event) => {
  if (!extensionEnabled) return;
  cancelPendingSelection();
  const eventPath = getEventPath(event);
  lastPointerGesture = {
    id: nextPointerGestureId++,
    startX: event.clientX,
    startY: event.clientY,
    endX: event.clientX,
    endY: event.clientY,
    startedInsideAskChat: eventPath.some(item => item instanceof Node && isInsideAskChat(item))
  };
  const eventTarget = event.target as HTMLElement;
  const clickedAskChat = eventTarget.closest?.('[data-ask-chat-id]') as HTMLElement | null;
  const clickedAskChatId = clickedAskChat?.dataset?.askChatId || '';
  const clickedActionMenu = eventTarget.closest?.('[data-ask-chat-menu-id]');
  const clickedInsideAskChat = Boolean(clickedAskChat) || Boolean(clickedActionMenu);
  let closedPanelPopover = false;

  closeButtonPopovers(clickedAskChatId);

  if (clickedInsideAskChat) {
    if (!clickedActionMenu) {
      closeActionMenus();
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
  if (closedPanelPopover) {
    window.getSelection()?.removeAllRanges();
  }
}, true);
