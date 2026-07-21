export type PromptIntent = 'explain' | 'translate';

export interface PromptInput {
  selectedText: string;
  pageTitle?: string;
  pageUrl?: string;
  surroundingText?: string;
  currentParagraph?: string;
  userPrompt?: string;
  intent?: PromptIntent;
  quickMode?: boolean;
  answerFormatInstruction?: string;
  enableAnswerFormatInstruction?: boolean;
  responseLanguage: string;
}

export interface PromptMessage {
  role: 'system' | 'user';
  content: string;
}
