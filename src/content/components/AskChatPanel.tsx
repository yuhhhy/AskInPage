import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Pin, X } from 'lucide-react';
import { THINKING_STATUS_MESSAGE_KEYS } from '../constants';
import type { PopoverState, Position } from '../types';
import { MarkdownContent } from './MarkdownContent';
import type { AskChatActions } from './types';
import { t } from '../../shared/i18n';

interface AskChatPanelProps {
  state: PopoverState;
  actions: AskChatActions;
}

function getStatusText(state: PopoverState): string {
  if (state.status === 'loading') return state.intent === 'translate' ? t('translating') : t('askingModel');
  if (state.status === 'error') return state.intent === 'translate' ? t('translationFailed') : t('explanationFailed');
  return state.intent === 'translate' ? t('translationComplete') : t('askChat');
}

function clampPanelPosition(left: number, top: number, panel: HTMLElement): Position {
  const margin = 8;
  const rect = panel.getBoundingClientRect();
  return {
    left: Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - rect.width - margin)),
    top: Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - rect.height - margin))
  };
}

export function AskChatPanel({ state, actions }: AskChatPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = state.wasNearBottom ? body.scrollHeight : state.scrollTop;
  }, [state.content, state.scrollTop, state.wasNearBottom]);

  const position = actions.getPanelPosition(state);
  const size = actions.getPanelSize();
  const style: CSSProperties = { left: position.left, top: position.top, width: size.width, height: size.height };

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button') || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    panelRef.current.classList.add('dragging');
    event.preventDefault();
  }

  function movePanel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panelRef.current) return;
    actions.updatePanelPosition(state.id, clampPanelPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY, panelRef.current));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    panelRef.current?.classList.remove('dragging');
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  }

  return (
    <section
      ref={panelRef}
      className={`ask-chat-popover ask-chat-panel${state.pinned ? ' pinned' : ''}`}
      data-ask-chat-id={state.id}
      style={style}
      onContextMenu={(event) => { event.preventDefault(); actions.showActionMenu(state.id, event.clientX, event.clientY); }}
    >
      <div className="ask-chat-header" onPointerDown={beginDrag} onPointerMove={movePanel} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <button type="button" className="ask-chat-pin" aria-label={state.pinned ? t('unpinPanel') : t('pinPanel')} aria-pressed={state.pinned} title={state.pinned ? t('unpin') : t('pin')} onClick={() => actions.togglePinned(state.id)}>
          <Pin size={17} aria-hidden="true" />
        </button>
        {state.userPrompt ? (
          <div className="ask-chat-header-text"><span title={state.target.text}>「{state.target.text}」</span><span className="ask-chat-user-prompt" title={state.userPrompt}>{state.userPrompt}</span></div>
        ) : <span title={state.target.text}>「{state.target.text}」</span>}
        <button type="button" aria-label={t('close')} onClick={() => actions.closePopover(state.id)}><X size={18} aria-hidden="true" /></button>
      </div>

      <div className="ask-chat-meta">{getStatusText(state)}</div>
      <div
        ref={bodyRef}
        className="ask-chat-body"
        data-content={state.content}
        onMouseUp={() => actions.handlePanelSelection(state.id)}
        onKeyUp={() => actions.handlePanelSelection(state.id)}
        onScroll={(event) => {
          const body = event.currentTarget;
          actions.updateScroll(state.id, body.scrollTop, body.scrollHeight - body.scrollTop - body.clientHeight < 24);
        }}
      >
        {state.content ? <MarkdownContent content={state.content} streaming={state.status === 'loading'} />
          : state.status === 'error' ? <span className="ask-chat-error">{state.error}</span>
            : <span className="ask-chat-muted ask-chat-waiting"><span className="ask-chat-waiting-spinner" aria-hidden="true" /><span>{t(THINKING_STATUS_MESSAGE_KEYS[state.waitingIndex])}</span></span>}
      </div>
    </section>
  );
}
