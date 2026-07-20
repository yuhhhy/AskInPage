export interface ViewportRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export type Intent = 'explain' | 'translate';
export type PanelStatus = 'loading' | 'error' | 'done';

export interface Position {
  left: number;
  top: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface SelectionTarget {
  rect: ViewportRect;
  pageTitle: string;
  pageUrl: string;
  surroundingText: string;
  text: string;
  intent?: Intent;
}

export interface PopoverState {
  id: string;
  target: SelectionTarget;
  mode: 'button' | 'panel';
  status: PanelStatus;
  error: string;
  requestId: string;
  content: string;
  intent: Intent;
  userPrompt: string;
  waitingIndex: number;
  waitingTimer: number | null;
  actionMenuPosition: Position | null;
  pinned: boolean;
  panelPosition: Position | null;
  scrollTop: number;
  wasNearBottom: boolean;
}

export interface SelectionContext {
  selectedText: string;
  page: { title: string; url: string; language: string; description: string };
  selection: { blockTag: string; structureText: string; tableContext: string };
  domPath: string[];
  localContext: { previousText: string; currentText: string; nextText: string };
  mainContext: string;
  formattedText: string;
}
