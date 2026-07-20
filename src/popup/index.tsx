import { createRoot } from 'react-dom/client';
import { PopupPage } from './pages/PopupPage';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root is missing');

createRoot(container).render(<PopupPage />);
