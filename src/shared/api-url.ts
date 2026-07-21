const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackApiUrl(value: string): boolean {
  try {
    const url = new URL(String(value || '').trim());
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getApiBaseUrlError(value: string): string {
  const text = String(value || '').trim();
  if (!text) return '';

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return 'invalid';
  }

  if (url.protocol === 'https:') return '';
  if (url.protocol === 'http:' && isLoopbackApiUrl(text)) return '';
  if (url.protocol === 'http:') return 'https-required';
  return 'unsupported-protocol';
}

export function normalizeChatCompletionsUrl(value: string, fallback: string): string {
  const text = String(value || '').trim().replace(/\/+$/, '') || fallback;
  const error = getApiBaseUrlError(text);
  if (error) throw new Error(error);
  return text.endsWith('/chat/completions') ? text : `${text}/chat/completions`;
}
