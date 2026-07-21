import enMessages from '../_locales/en/messages.json';
import zhCnMessages from '../_locales/zh_CN/messages.json';

export type SupportedUiLanguage = 'en' | 'zh-CN';
export type UiLanguagePreference = 'auto' | SupportedUiLanguage;

type LocaleMessages = Record<string, { message: string }>;

const catalogs: Record<SupportedUiLanguage, LocaleMessages> = {
  en: enMessages,
  'zh-CN': zhCnMessages
};

let activeLanguagePreference: UiLanguagePreference = 'auto';

export function normalizeUiLanguagePreference(preference: unknown): UiLanguagePreference {
  return ['auto', 'en', 'zh-CN'].includes(String(preference || ''))
    ? preference as UiLanguagePreference
    : 'auto';
}

export function setUiLanguagePreference(preference: unknown): void {
  activeLanguagePreference = normalizeUiLanguagePreference(preference);
}

function applySubstitutions(message: string, substitutions?: string | string[]): string {
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return values.reduce((result, value, index) => (
    value === undefined ? result : result.replaceAll(`$${index + 1}`, value)
  ), message);
}

export function t(key: string, substitutions?: string | string[]): string {
  if (activeLanguagePreference === 'auto') {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }
  const message = catalogs[activeLanguagePreference][key]?.message;
  return message ? applySubstitutions(message, substitutions) : key;
}

export function getUiLanguage(): SupportedUiLanguage {
  if (activeLanguagePreference !== 'auto') return activeLanguagePreference;
  return chrome.i18n.getUILanguage().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
