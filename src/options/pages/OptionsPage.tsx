import type { FormEvent } from 'react';
import { AnswerPreferenceFields } from '../components/AnswerPreferenceFields';
import { DataManagementFields } from '../components/DataManagementFields';
import { ModelConnectionFields } from '../components/ModelConnectionFields';
import { PanelPreferenceFields } from '../components/PanelPreferenceFields';
import { PrivacyDisclosure } from '../components/PrivacyDisclosure';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsSection } from '../components/SettingsSection';
import { ShortcutPreferenceFields } from '../components/ShortcutPreferenceFields';
import { useExtensionOptions } from '../hooks/useExtensionOptions';
import { t } from '../../shared/i18n';

export function OptionsPage() {
  const { options, status, updateOption, selectConnection, updateConnection, addConnection, removeConnection, saveOptions, exportOptions, importOptions } = useExtensionOptions();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveOptions();
  }

  return (
    <main className="settings-shell" data-mode={options.colorMode} data-theme={options.themeColor}>
      <SettingsHeader />
      <form onSubmit={handleSubmit}>
        <SettingsSection index="01" title={t('sectionModelService')} titleId="connection-title">
          <ModelConnectionFields
            connections={options.connections}
            activeConnectionId={options.activeConnectionId}
            onSelect={selectConnection}
            onChange={updateConnection}
            onAdd={addConnection}
            onRemove={removeConnection}
          />
          <PrivacyDisclosure />
        </SettingsSection>

        <SettingsSection index="02" title={t('sectionAnswerPreferences')} titleId="answer-title">
          <AnswerPreferenceFields options={options} onChange={updateOption} />
        </SettingsSection>

        <SettingsSection index="03" title={t('sectionPanelLayout')} titleId="panel-title">
          <PanelPreferenceFields options={options} onChange={updateOption} />
        </SettingsSection>

        <SettingsSection index="04" title={t('sectionShortcuts')} titleId="shortcut-title">
          <ShortcutPreferenceFields options={options} onChange={updateOption} />
        </SettingsSection>

        <SettingsSection index="05" title={t('sectionDataManagement')} titleId="data-title">
          <DataManagementFields onExport={exportOptions} onImport={importOptions} />
        </SettingsSection>

        <button className="save-button" type="submit">{t('saveSettings')}</button>
        <div className="status" role="status" aria-live="polite">{status}</div>
      </form>
    </main>
  );
}
