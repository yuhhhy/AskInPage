import type { ThemeColor } from '../../shared/options';
import { t } from '../../shared/i18n';
import { ToggleSwitch } from './ToggleSwitch';

interface BasicSettingsProps {
  enabled: boolean;
  enableAnswerFormatInstruction: boolean;
  superMode: boolean;
  quickMode: boolean;
  themeColor: ThemeColor;
  onEnabledChange: (value: boolean) => void;
  onEnableAnswerFormatInstructionChange: (value: boolean) => void;
  onSuperModeChange: (value: boolean) => void;
  onQuickModeChange: (value: boolean) => void;
  onThemeColorChange: (value: ThemeColor) => void;
}

const THEMES: Array<{ value: ThemeColor; labelKey: string }> = [
  { value: 'purple', labelKey: 'themePurple' },
  { value: 'blue', labelKey: 'themeBlue' },
  { value: 'green', labelKey: 'themeGreen' },
  { value: 'orange', labelKey: 'themeOrange' },
  { value: 'rose', labelKey: 'themeRose' }
];

export function BasicSettings(props: BasicSettingsProps) {
  return (
    <section className="basic-settings" aria-labelledby="basic-settings-title">
      <div className="section-title">
        <h2 id="basic-settings-title">{t('basicSettings')}</h2>
      </div>
      <div className="preference-list">
        <ToggleSwitch id="extension-enabled" checked={props.enabled} label={t('extensionToggle')} onChange={props.onEnabledChange} />
        <ToggleSwitch id="custom-instructions" checked={props.enableAnswerFormatInstruction} label={t('enableCustomInstructions')} onChange={props.onEnableAnswerFormatInstructionChange} />
        <ToggleSwitch id="super-mode" checked={props.superMode} label={t('superMode')} info={t('superModeDescription')} onChange={props.onSuperModeChange} />
        <ToggleSwitch id="quick-mode" checked={props.quickMode} label={t('quickMode')} info={t('quickModeDescription')} onChange={props.onQuickModeChange} />
      </div>
      <div className="theme-picker is-compact">
        <div>
          <strong>{t('themeColor')}</strong>
        </div>
        <div className="theme-swatches" role="radiogroup" aria-label={t('themeColor')}>
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              className={`theme-swatch theme-${theme.value}${props.themeColor === theme.value ? ' is-active' : ''}`}
              type="button"
              role="radio"
              aria-checked={props.themeColor === theme.value}
              aria-label={t(theme.labelKey)}
              title={t(theme.labelKey)}
              onClick={() => props.onThemeColorChange(theme.value)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
