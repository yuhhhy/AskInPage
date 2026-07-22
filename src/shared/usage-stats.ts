export const USAGE_STATS_STORAGE_KEY = 'usageStats';

export interface UsageStats {
  requestCount: number;
  totalTokens: number;
}

export const DEFAULT_USAGE_STATS: UsageStats = Object.freeze({
  requestCount: 0,
  totalTokens: 0
});

function normalizeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function normalizeUsageStats(value: unknown): UsageStats {
  const stored = value && typeof value === 'object'
    ? value as Partial<UsageStats> & { usageReportedRequestCount?: unknown }
    : {};
  // Older builds tracked attempted requests separately. Migrate only the
  // requests for which the provider actually returned usage data.
  const requestCount = normalizeCount(stored.usageReportedRequestCount ?? stored.requestCount);
  return {
    requestCount,
    totalTokens: normalizeCount(stored.totalTokens)
  };
}

export async function loadUsageStats(): Promise<UsageStats> {
  const stored = await chrome.storage.local.get({ [USAGE_STATS_STORAGE_KEY]: DEFAULT_USAGE_STATS });
  return normalizeUsageStats(stored[USAGE_STATS_STORAGE_KEY]);
}
