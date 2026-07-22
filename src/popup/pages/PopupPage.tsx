import { Settings } from 'lucide-react';
import { BasicSettings } from '../components/BasicSettings';
import { ModelSelector } from '../components/ModelSelector';
import { SupportNotice } from '../components/SupportNotice';
import { UsageStats } from '../components/UsageStats';
import { usePopupState } from '../hooks/usePopupState';
import { t } from '../../shared/i18n';

const GITHUB_URL = 'https://github.com/yuhhhy/AskInPage';

export function PopupPage() {
  const { enabled, supported, connections, activeConnectionId, version, colorMode, enableAnswerFormatInstruction, superMode, quickMode, themeColor, usageStats, motionReady, updatePreference, selectModel } = usePopupState();

  return (
    <main className={`popup-shell${motionReady ? ' motion-ready' : ''}`} data-mode={colorMode} data-theme={themeColor}>
      <header className="popup-header">
        <div className="brand">
          <h1>AskInPage</h1>
        </div>
        <div className="header-actions">
          <button className="icon-button settings-button" type="button" aria-label={t('openSettings')} title={t('settings')} onClick={() => chrome.runtime.openOptionsPage()}><Settings size={21} /></button>
        </div>
      </header>

      <div className="popup-content">
        <SupportNotice supported={supported} enabled={enabled} />
        <BasicSettings
          enabled={enabled}
          enableAnswerFormatInstruction={enableAnswerFormatInstruction}
          superMode={superMode}
          quickMode={quickMode}
          themeColor={themeColor}
          onEnabledChange={(value) => updatePreference('enabled', value)}
          onEnableAnswerFormatInstructionChange={(value) => updatePreference('enableAnswerFormatInstruction', value)}
          onSuperModeChange={(value) => updatePreference('superMode', value)}
          onQuickModeChange={(value) => updatePreference('quickMode', value)}
          onThemeColorChange={(value) => updatePreference('themeColor', value)}
        />
        <UsageStats stats={usageStats} />
        <ModelSelector connections={connections} activeConnectionId={activeConnectionId} disabled={!enabled} onChange={selectModel} />
      </div>

      <footer className="popup-footer">
        <span>v{version}</span>
        <button type="button" onClick={() => chrome.tabs.create({ url: GITHUB_URL })}><img src="./github-mark.svg" alt="" />GitHub</button>
      </footer>
    </main>
  );
}
