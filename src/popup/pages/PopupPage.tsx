import { Settings } from 'lucide-react';
import { BasicSettings } from '../components/BasicSettings';
import { ModelSelector } from '../components/ModelSelector';
import { SupportNotice } from '../components/SupportNotice';
import { usePopupState } from '../hooks/usePopupState';

const GITHUB_URL = 'https://github.com/yuhhhy/AskInPage';

export function PopupPage() {
  const { enabled, supported, connections, activeConnectionId, version, colorMode, superMode, themeColor, motionReady, updatePreference, selectModel } = usePopupState();

  return (
    <main className={`popup-shell${motionReady ? ' motion-ready' : ''}`} data-mode={colorMode} data-theme={themeColor}>
      <header className="popup-header">
        <div className="brand">
          <h1>AskInPage</h1>
        </div>
        <div className="header-actions">
          <button className="icon-button settings-button" type="button" aria-label="打开设置" title="设置" onClick={() => chrome.runtime.openOptionsPage()}><Settings size={21} /></button>
        </div>
      </header>

      <div className="popup-content">
        <SupportNotice supported={supported} enabled={enabled} />
        <BasicSettings
          enabled={enabled}
          colorMode={colorMode}
          superMode={superMode}
          themeColor={themeColor}
          onEnabledChange={(value) => updatePreference('enabled', value)}
          onColorModeChange={(value) => updatePreference('colorMode', value)}
          onSuperModeChange={(value) => updatePreference('superMode', value)}
          onThemeColorChange={(value) => updatePreference('themeColor', value)}
        />
        <ModelSelector connections={connections} activeConnectionId={activeConnectionId} disabled={!enabled} onChange={selectModel} />
      </div>

      <footer className="popup-footer">
        <span>v{version}</span>
        <button type="button" onClick={() => chrome.tabs.create({ url: GITHUB_URL })}><img src="./github-mark.svg" alt="" />GitHub</button>
      </footer>
    </main>
  );
}
