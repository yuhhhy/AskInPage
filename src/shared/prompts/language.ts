import type { TranslationTarget } from '../options';
import { getUiLanguage } from '../i18n';

const LANGUAGE_NAMES = {
  en: 'English',
  'zh-CN': 'Simplified Chinese'
} as const;

export function getInterfaceResponseLanguage(): string {
  return LANGUAGE_NAMES[getUiLanguage()];
}

export function getTranslationResponseLanguage(target: TranslationTarget): string {
  if (target === 'ui') return getInterfaceResponseLanguage();
  return LANGUAGE_NAMES[target];
}

export function buildLanguageRule(responseLanguage: string): string {
  return `Write the final answer in ${responseLanguage}. Treat this language requirement as higher priority than the language of the page, selection, or user question.`;
}
