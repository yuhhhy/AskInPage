import { buildExplainMessages } from './explain';
import { buildTranslateMessages } from './translate';
import type { PromptInput, PromptMessage } from './types';

export type { PromptInput, PromptIntent, PromptMessage } from './types';

export function buildPromptMessages(input: PromptInput): PromptMessage[] {
  return input.intent === 'translate'
    ? buildTranslateMessages(input)
    : buildExplainMessages(input);
}
