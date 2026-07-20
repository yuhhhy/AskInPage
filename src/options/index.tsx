import { createRoot } from 'react-dom/client';
import { OptionsPage } from './pages/OptionsPage';

const container = document.getElementById('root');
if (!container) throw new Error('Options root is missing');

createRoot(container).render(<OptionsPage />);
