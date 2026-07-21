export type PromptIntent = 'explain' | 'translate';

export interface PromptInput {
  selectedText: string;
  pageTitle?: string;
  pageUrl?: string;
  surroundingText?: string;
  userPrompt?: string;
  intent?: PromptIntent;
  answerFormatInstruction?: string;
  enableAnswerFormatInstruction?: boolean;
}

export interface PromptMessage {
  role: 'system' | 'user';
  content: string;
}
