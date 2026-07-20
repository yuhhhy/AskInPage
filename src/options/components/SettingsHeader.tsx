import { SlidersHorizontal } from 'lucide-react';

export function SettingsHeader() {
  return (
    <header className="settings-header">
      <div>
        <div className="settings-title"><SlidersHorizontal size={24} aria-hidden="true" /><h1>AskInPage 设置</h1></div>
        <p>让划词提问更贴近当前语境</p>
      </div>
    </header>
  );
}
