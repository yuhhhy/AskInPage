import type { Intent, PopoverState, Position, SelectionTarget } from '../types';

export interface AskChatActions {
  startLookup: (id: string, intent: Intent) => void;
  closePopover: (id: string) => void;
  togglePinned: (id: string) => void;
  showActionMenu: (id: string, clientX: number, clientY: number) => void;
  closeActionMenus: () => void;
  updatePrompt: (id: string, prompt: string) => void;
  updatePanelPosition: (id: string, position: Position) => void;
  updateScroll: (id: string, scrollTop: number, wasNearBottom: boolean) => void;
  handlePanelSelection: (id: string) => void;
  getTriggerPosition: (target: SelectionTarget) => Position;
  getPanelPosition: (state: PopoverState) => Position;
}
