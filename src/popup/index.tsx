import { createRoot } from 'react-dom/client';
import { getUiLanguage, setUiLanguagePreference } from '../shared/i18n';
import { PopupPage } from './pages/PopupPage';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root is missing');

chrome.storage.sync.get({ uiLanguage: 'auto' }).then(({ uiLanguage }) => {
  setUiLanguagePreference(uiLanguage);
  document.documentElement.lang = getUiLanguage();
  createRoot(container).render(<PopupPage />);
});
