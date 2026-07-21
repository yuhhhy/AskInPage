import { CircleAlert, CirclePause } from 'lucide-react';
import { t } from '../../shared/i18n';

interface SupportNoticeProps {
  supported: boolean | null;
  enabled: boolean;
}

export function SupportNotice({ supported, enabled }: SupportNoticeProps) {
  if (supported === null) return null;
  if (!supported) return <div className="notice notice-warning"><CircleAlert size={19} aria-hidden="true" /><strong>{t('pageUnsupported')}</strong></div>;
  if (!enabled) return <div className="notice notice-paused"><CirclePause size={19} aria-hidden="true" /><strong>{t('extensionPaused')}</strong></div>;
  return null;
}
