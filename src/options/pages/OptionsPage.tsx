import type { FormEvent } from 'react';
import { AnswerPreferenceFields } from '../components/AnswerPreferenceFields';
import { ModelConnectionFields } from '../components/ModelConnectionFields';
import { PanelPreferenceFields } from '../components/PanelPreferenceFields';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsSection } from '../components/SettingsSection';
import { useExtensionOptions } from '../hooks/useExtensionOptions';

export function OptionsPage() {
  const { options, status, updateOption, selectConnection, updateConnection, addConnection, removeConnection, saveOptions } = useExtensionOptions();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveOptions();
  }

  return (
    <main className="settings-shell">
      <SettingsHeader />
      <form onSubmit={handleSubmit}>
        <SettingsSection index="01" title="模型服务" titleId="connection-title">
          <ModelConnectionFields
            connections={options.connections}
            activeConnectionId={options.activeConnectionId}
            onSelect={selectConnection}
            onChange={updateConnection}
            onAdd={addConnection}
            onRemove={removeConnection}
          />
        </SettingsSection>

        <SettingsSection index="02" title="回答偏好" titleId="answer-title">
          <AnswerPreferenceFields options={options} onChange={updateOption} />
        </SettingsSection>

        <SettingsSection index="03" title="弹窗布局" titleId="panel-title">
          <PanelPreferenceFields options={options} onChange={updateOption} />
        </SettingsSection>

        <button className="save-button" type="submit">保存设置</button>
        <div className="status" role="status" aria-live="polite">{status}</div>
      </form>
    </main>
  );
}
