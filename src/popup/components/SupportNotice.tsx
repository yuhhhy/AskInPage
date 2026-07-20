interface SupportNoticeProps {
  supported: boolean | null;
  enabled: boolean;
}

export function SupportNotice({ supported, enabled }: SupportNoticeProps) {
  if (supported === null) return null;
  if (!supported) return <div className="notice notice-warning"><CircleAlert size={19} aria-hidden="true" /><strong>当前页面暂不支持</strong></div>;
  if (!enabled) return <div className="notice notice-paused"><CirclePause size={19} aria-hidden="true" /><strong>插件已暂停</strong></div>;
  return null;
}
import { CircleAlert, CirclePause } from 'lucide-react';
