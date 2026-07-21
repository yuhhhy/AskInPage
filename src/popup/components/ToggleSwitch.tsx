interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ id, checked, label, description, onChange }: ToggleSwitchProps) {
  return (
    <div className="preference-row">
      <label htmlFor={id}>
        <strong>{label}</strong>
        <small>{description}</small>
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
