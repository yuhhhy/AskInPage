import { Power, Settings } from 'lucide-react';
import { ModelSelector } from '../components/ModelSelector';
import { SupportNotice } from '../components/SupportNotice';
import { usePopupState } from '../hooks/usePopupState';

const GITHUB_URL = 'https://github.com/yuhhhy/AskInPage';

export function PopupPage() {
  const { enabled, supported, connections, activeConnectionId, version, toggleEnabled, selectModel } = usePopupState();

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="brand">
          <h1>AskInPage</h1>
        </div>
        <div className="header-actions">
          <button className="icon-button settings-button" type="button" aria-label="打开设置" title="设置" onClick={() => chrome.runtime.openOptionsPage()}><Settings size={21} /></button>
          <button className={`icon-button power-button${enabled ? ' is-on' : ''}`} type="button" aria-label={enabled ? '暂停 AskInPage' : '启用 AskInPage'} title={enabled ? '暂停' : '启用'} aria-pressed={enabled} onClick={toggleEnabled}><Power size={21} /></button>
        </div>
      </header>

      <div className="popup-content">
        <SupportNotice supported={supported} enabled={enabled} />
        <ModelSelector connections={connections} activeConnectionId={activeConnectionId} disabled={!enabled} onChange={selectModel} />
      </div>

      <footer className="popup-footer">
        <span>v{version}</span>
        <button type="button" onClick={() => chrome.tabs.create({ url: GITHUB_URL })}><img src="./github-mark.svg" alt="" />GitHub</button>
      </footer>
    </main>
  );
}
