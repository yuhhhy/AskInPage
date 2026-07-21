import { useLayoutEffect, useRef } from 'react';
import type { PopoverState } from '../types';
import type { AskChatActions } from './types';
import { t } from '../../shared/i18n';

interface AskChatTriggerProps {
  state: PopoverState;
  actions: AskChatActions;
}

export function AskChatTrigger({ state, actions }: AskChatTriggerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const position = actions.getTriggerPosition(state.target);
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const maxWidth = Math.max(0, viewportWidth - position.left - 16);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.width = '150px';
    input.style.width = `${Math.max(150, input.scrollWidth)}px`;
  }, [state.userPrompt]);

  return (
    <div
      className="ask-chat-popover ask-chat-trigger"
      data-ask-chat-id={state.id}
      style={{ ...position, maxWidth }}
    >
      <button type="button" onClick={() => actions.startLookup(state.id, 'explain')}>{t('askChat')}</button>
      <input
        ref={inputRef}
        type="text"
        value={state.userPrompt}
        onChange={(event) => actions.updatePrompt(state.id, event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          actions.startLookup(state.id, 'explain');
        }}
        placeholder={t('askMorePlaceholder')}
        aria-label={t('askMoreAriaLabel')}
      />
    </div>
  );
}
