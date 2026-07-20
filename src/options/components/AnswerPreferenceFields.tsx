import type { ExtensionOptions } from '../../shared/options';

interface AnswerPreferenceFieldsProps {
  options: ExtensionOptions;
  onChange: <Key extends keyof ExtensionOptions>(key: Key, value: ExtensionOptions[Key]) => void;
}

export function AnswerPreferenceFields({ options, onChange }: AnswerPreferenceFieldsProps) {
  return (
    <>
      <label htmlFor="temperature">Temperature</label>
      <input id="temperature" type="number" min="0" max="2" step="0.1" value={options.temperature} onChange={(event) => onChange('temperature', Number(event.target.value))} />

      <div className="toggle-row">
        <div>
          <label htmlFor="enableAnswerFormatInstruction">启用自定义回答要求</label>
          <small>附加到每次解释和翻译请求</small>
        </div>
        <input id="enableAnswerFormatInstruction" type="checkbox" checked={options.enableAnswerFormatInstruction} onChange={(event) => onChange('enableAnswerFormatInstruction', event.target.checked)} />
      </div>

      <label htmlFor="answerFormatInstruction">自定义回答要求</label>
      <textarea
        id="answerFormatInstruction"
        value={options.answerFormatInstruction}
        onChange={(event) => onChange('answerFormatInstruction', event.target.value)}
        disabled={!options.enableAnswerFormatInstruction}
        placeholder="例如：用三条 bullet 回答；中英双语；先给结论再解释。"
      />
    </>
  );
}
