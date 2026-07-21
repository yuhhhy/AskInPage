import { Keyboard, RotateCcw } from 'lucide-react';
import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ExtensionOptions } from '../../shared/options';
import { t } from '../../shared/i18n';
import {
  DEFAULT_ASK_SHORTCUT,
  DEFAULT_TRANSLATE_SHORTCUT,
  formatKeyboardShortcut,
  keyboardShortcutFromEvent
} from '../../shared/shortcuts';

interface ShortcutPreferenceFieldsProps {
  options: ExtensionOptions;
  onChange: <Key extends keyof ExtensionOptions>(key: Key, value: ExtensionOptions[Key]) => void;
}

interface ShortcutRecorderProps {
  id: string;
  label: string;
  description: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
}

function ShortcutRecorder({ id, label, description, value, defaultValue, onChange }: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);
  const keys = formatKeyboardShortcut(value);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') {
      setRecording(false);
      return;
    }
    const shortcut = keyboardShortcutFromEvent(event.nativeEvent);
    if (!shortcut) return;
    onChange(shortcut);
    setRecording(false);
  }

  return (
    <div className="shortcut-row">
      <div className="shortcut-copy">
        <label id={`${id}-label`} htmlFor={id}>{label}</label>
        <small>{description}</small>
      </div>
      <div className="shortcut-control">
        <button
          id={id}
          className={`shortcut-recorder${recording ? ' is-recording' : ''}`}
          type="button"
          aria-labelledby={`${id}-label`}
          aria-pressed={recording}
          onClick={() => setRecording(true)}
          onBlur={() => setRecording(false)}
          onKeyDown={handleKeyDown}
        >
          <Keyboard size={16} aria-hidden="true" />
          {recording
            ? <span className="shortcut-recording-text">{t('pressShortcut')}</span>
            : <span className="shortcut-keys">{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span>}
        </button>
        <button
          className="shortcut-reset"
          type="button"
          disabled={value === defaultValue}
          aria-label={t('restoreShortcutDefault', label)}
          title={t('restoreDefault')}
          onClick={() => onChange(defaultValue)}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function ShortcutPreferenceFields({ options, onChange }: ShortcutPreferenceFieldsProps) {
  const hasConflict = options.translateShortcut === options.askShortcut;

  return (
    <div className="shortcut-preferences">
      <p className="shortcut-intro">{t('shortcutIntro')}</p>
      <ShortcutRecorder
        id="translate-shortcut"
        label={t('translateShortcut')}
        description={t('translateShortcutDescription')}
        value={options.translateShortcut}
        defaultValue={DEFAULT_TRANSLATE_SHORTCUT}
        onChange={(value) => onChange('translateShortcut', value)}
      />
      <ShortcutRecorder
        id="ask-shortcut"
        label={t('askShortcut')}
        description={t('askShortcutDescription')}
        value={options.askShortcut}
        defaultValue={DEFAULT_ASK_SHORTCUT}
        onChange={(value) => onChange('askShortcut', value)}
      />
      {hasConflict && (
        <p className="shortcut-note is-error" role="alert">
          {t('shortcutConflict')}
        </p>
      )}
    </div>
  );
}
