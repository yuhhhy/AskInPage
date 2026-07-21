import type { PromptInput } from './types';

function normalizeText(value: unknown, fallback = ''): string {
  return String(value || '').trim() || fallback;
}

export function buildPageContext(input: PromptInput): string {
  if (input.quickMode) {
    return JSON.stringify({
      currentParagraph: normalizeText(input.currentParagraph, '无'),
      selectedText: normalizeText(input.selectedText)
    }, null, 2);
  }

  return JSON.stringify({
    pageTitle: normalizeText(input.pageTitle, '无'),
    pageUrl: normalizeText(input.pageUrl, '无'),
    surroundingText: normalizeText(input.surroundingText, '无'),
    selectedText: normalizeText(input.selectedText)
  }, null, 2);
}

export function getUserPrompt(input: PromptInput): string {
  return normalizeText(input.userPrompt);
}

export function getCustomInstruction(input: PromptInput): string {
  if (input.enableAnswerFormatInstruction === false) return '';
  const instruction = normalizeText(input.answerFormatInstruction);
  return instruction ? `\n\n用户配置的回答要求：\n${instruction}` : '';
}
