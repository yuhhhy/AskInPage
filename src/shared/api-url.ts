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
    return '模型服务地址格式不正确';
  }

  if (url.protocol === 'https:') return '';
  if (url.protocol === 'http:' && isLoopbackApiUrl(text)) return '';
  if (url.protocol === 'http:') return '远程模型服务必须使用 HTTPS；只有本机回环地址可以使用 HTTP';
  return '模型服务地址仅支持 HTTPS，或本机回环地址的 HTTP';
}

export function normalizeChatCompletionsUrl(value: string, fallback: string): string {
  const text = String(value || '').trim().replace(/\/+$/, '') || fallback;
  const error = getApiBaseUrlError(text);
  if (error) throw new Error(error);
  return text.endsWith('/chat/completions') ? text : `${text}/chat/completions`;
}
