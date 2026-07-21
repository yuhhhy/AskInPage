import { Copy, RefreshCw } from 'lucide-react';
import type { PopoverState } from '../types';
import type { AskChatActions } from './types';

interface ActionMenuProps {
  state: PopoverState;
  actions: AskChatActions;
}

export function ActionMenu({ state, actions }: ActionMenuProps) {
  if (!state.actionMenuPosition) return null;
  const hasContent = Boolean(state.content.trim());

  return (
    <div className="ask-chat-action-menu" data-ask-chat-menu-id={state.id} style={state.actionMenuPosition}>
      <button type="button" disabled={!hasContent} onClick={async () => {
        if (!hasContent) return;
        try { await navigator.clipboard.writeText(state.content); } catch { /* unavailable on restricted pages */ }
        actions.closeActionMenus();
      }}>
        <Copy aria-hidden="true" />
        <span>复制</span>
      </button>
      <button type="button" onClick={() => { actions.closeActionMenus(); actions.startLookup(state.id, state.intent); }}>
        <RefreshCw aria-hidden="true" />
        <span>重新生成</span>
      </button>
    </div>
  );
}
