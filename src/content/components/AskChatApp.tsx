import type { PopoverState } from '../types';
import { ActionMenu } from './ActionMenu';
import { AskChatPanel } from './AskChatPanel';
import { AskChatTrigger } from './AskChatTrigger';
import type { AskChatActions } from './types';

export type { AskChatActions } from './types';

interface AskChatAppProps {
  states: PopoverState[];
  actions: AskChatActions;
}

export function AskChatApp({ states, actions }: AskChatAppProps) {
  return (
    <>
      {states.map((state) => state.mode === 'button'
        ? <AskChatTrigger key={state.id} state={state} actions={actions} />
        : <AskChatPanel key={state.id} state={state} actions={actions} />)}
      {states.map((state) => <ActionMenu key={`menu-${state.id}`} state={state} actions={actions} />)}
    </>
  );
}
