import type { PopoverState } from '../types';
import type { AskChatActions } from './types';

interface AskChatTriggerProps {
  state: PopoverState;
  actions: AskChatActions;
}

export function AskChatTrigger({ state, actions }: AskChatTriggerProps) {
  return (
    <div className="ask-chat-popover ask-chat-trigger" data-ask-chat-id={state.id} style={actions.getTriggerPosition(state.target)}>
      <button type="button" onClick={() => actions.startLookup(state.id, 'explain')}>Ask Chat</button>
      <input
        type="text"
        value={state.userPrompt}
        onChange={(event) => actions.updatePrompt(state.id, event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          actions.startLookup(state.id, 'explain');
        }}
        placeholder="Ask more..."
        aria-label="Ask Chat custom prompt"
      />
    </div>
  );
}
