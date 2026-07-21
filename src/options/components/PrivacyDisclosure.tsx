import { ShieldCheck } from 'lucide-react';
import { t } from '../../shared/i18n';

const PRIVACY_POLICY_URL = 'https://github.com/yuhhhy/AskInPage/blob/main/PRIVACY.md';

export function PrivacyDisclosure() {
  return (
    <aside className="privacy-disclosure" aria-labelledby="privacy-disclosure-title">
      <ShieldCheck size={19} aria-hidden="true" />
      <div>
        <strong id="privacy-disclosure-title">{t('privacyHeading')}</strong>
        <p>{t('privacyDescription')}</p>
        <p>{t('privacyApiKey')} <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">{t('viewPrivacyPolicy')}</a></p>
      </div>
    </aside>
  );
}
