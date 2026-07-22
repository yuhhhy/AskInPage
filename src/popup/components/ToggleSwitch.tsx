import { InfoHint } from './InfoHint';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  label: string;
  info?: string;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ id, checked, label, info, onChange }: ToggleSwitchProps) {
  return (
    <div className="preference-row is-compact">
      <label htmlFor={id}>
        <span className="preference-title">
          <strong>{label}</strong>
          {info && <InfoHint text={info} />}
        </span>
      </label>
      <button
        id={id}
        className={`switch${checked ? ' is-on' : ''}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}
