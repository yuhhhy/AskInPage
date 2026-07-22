import { Activity, Hash } from 'lucide-react';
import { t } from '../../shared/i18n';
import type { UsageStats as UsageStatsData } from '../../shared/usage-stats';

interface UsageStatsProps {
  stats: UsageStatsData;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function UsageStats({ stats }: UsageStatsProps) {
  const unreportedCount = Math.max(0, stats.requestCount - stats.usageReportedRequestCount);
  const isComplete = unreportedCount === 0;

  return (
    <section className="usage-stats" aria-labelledby="usage-stats-title">
      <div className="section-title usage-stats-heading">
        <h2 id="usage-stats-title">{t('usageStats')}</h2>
        {!isComplete && <span className="usage-quality">{t('usagePartial')}</span>}
      </div>
      <div className="usage-metrics">
        <div className="usage-metric">
          <Hash size={16} aria-hidden="true" />
          <div><strong>{formatNumber(stats.requestCount)}</strong><small>{t('totalRequests')}</small></div>
        </div>
        <div className="usage-metric">
          <Activity size={16} aria-hidden="true" />
          <div><strong>{formatNumber(stats.totalTokens)}</strong><small>{t('reportedTokens')}</small></div>
        </div>
      </div>
      {!isComplete && <p className="usage-note">{t('usagePartialDescription', String(unreportedCount))}</p>}
    </section>
  );
}
