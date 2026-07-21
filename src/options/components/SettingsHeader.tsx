import { SlidersHorizontal } from 'lucide-react';
import { t } from '../../shared/i18n';

export function SettingsHeader() {
  return (
    <header className="settings-header">
      <div>
        <div className="settings-title"><SlidersHorizontal size={24} aria-hidden="true" /><h1>{t('settingsHeading')}</h1></div>
        <p>{t('settingsTagline')}</p>
      </div>
    </header>
  );
}
