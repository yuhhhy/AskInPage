export const USAGE_STATS_STORAGE_KEY = 'usageStats';

export interface UsageStats {
  requestCount: number;
  usageReportedRequestCount: number;
  totalTokens: number;
}

export const DEFAULT_USAGE_STATS: UsageStats = Object.freeze({
  requestCount: 0,
  usageReportedRequestCount: 0,
  totalTokens: 0
});

function normalizeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function normalizeUsageStats(value: unknown): UsageStats {
  const stored = value && typeof value === 'object' ? value as Partial<UsageStats> : {};
  const requestCount = normalizeCount(stored.requestCount);
  return {
    requestCount,
    usageReportedRequestCount: Math.min(requestCount, normalizeCount(stored.usageReportedRequestCount)),
    totalTokens: normalizeCount(stored.totalTokens)
  };
}

export async function loadUsageStats(): Promise<UsageStats> {
  const stored = await chrome.storage.local.get({ [USAGE_STATS_STORAGE_KEY]: DEFAULT_USAGE_STATS });
  return normalizeUsageStats(stored[USAGE_STATS_STORAGE_KEY]);
}
