import { SlidersHorizontal } from 'lucide-react';

export function SettingsHeader() {
  return (
    <header className="settings-header">
      <div>
        <div className="settings-title"><SlidersHorizontal size={24} aria-hidden="true" /><h1>AskInPage 设置</h1></div>
        <p>更方便易用的的网页模型</p>
      </div>
    </header>
  );
}
