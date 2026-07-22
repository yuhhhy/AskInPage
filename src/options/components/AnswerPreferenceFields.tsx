import type { ExtensionOptions } from '../../shared/options';
import { t } from '../../shared/i18n';

interface AnswerPreferenceFieldsProps {
  options: ExtensionOptions;
  onChange: <Key extends keyof ExtensionOptions>(key: Key, value: ExtensionOptions[Key]) => void;
}

export function AnswerPreferenceFields({ options, onChange }: AnswerPreferenceFieldsProps) {
  return (
    <>
      <div className="field-with-help">
        <label htmlFor="uiLanguage">{t('uiLanguage')}</label>
        <select id="uiLanguage" value={options.uiLanguage} onChange={(event) => onChange('uiLanguage', event.target.value as ExtensionOptions['uiLanguage'])}>
          <option value="auto">{t('uiLanguageAuto')}</option>
          <option value="en">{t('uiLanguageEnglish')}</option>
          <option value="zh-CN">{t('uiLanguageChinese')}</option>
        </select>
        <small>{t('uiLanguageHelp')}</small>
      </div>

      <div className="field-with-help">
        <label htmlFor="translationTarget">{t('translationTarget')}</label>
        <select id="translationTarget" value={options.translationTarget} onChange={(event) => onChange('translationTarget', event.target.value as ExtensionOptions['translationTarget'])}>
          <option value="ui">{t('translationTargetUi')}</option>
          <option value="en">{t('translationTargetEnglish')}</option>
          <option value="zh-CN">{t('translationTargetChinese')}</option>
        </select>
        <small>{t('translationTargetHelp')}</small>
      </div>

      <label htmlFor="temperature">{t('temperatureLabel')}</label>
      <input id="temperature" type="number" min="0" max="2" step="0.1" value={options.temperature} onChange={(event) => onChange('temperature', Number(event.target.value))} />

      <label htmlFor="answerFormatInstruction">{t('customInstructions')}</label>
      <textarea
        id="answerFormatInstruction"
        value={options.answerFormatInstruction}
        onChange={(event) => onChange('answerFormatInstruction', event.target.value)}
        disabled={!options.enableAnswerFormatInstruction}
        placeholder={t('customInstructionsPlaceholder')}
      />
    </>
  );
}
