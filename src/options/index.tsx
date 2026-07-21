import { createRoot } from 'react-dom/client';
import { getUiLanguage, setUiLanguagePreference, t } from '../shared/i18n';
import { OptionsPage } from './pages/OptionsPage';

const container = document.getElementById('root');
if (!container) throw new Error('Options root is missing');

chrome.storage.sync.get({ uiLanguage: 'auto' }).then(({ uiLanguage }) => {
  setUiLanguagePreference(uiLanguage);
  document.documentElement.lang = getUiLanguage();
  document.title = t('optionsPageTitle');
  createRoot(container).render(<OptionsPage />);
});
