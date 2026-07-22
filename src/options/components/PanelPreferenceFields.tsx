import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import type { ExtensionOptions, TriggerPlacement } from '../../shared/options';
import { t } from '../../shared/i18n';
import './PanelPreferenceFields.css';

interface PanelPreferenceFieldsProps {
  options: ExtensionOptions;
  onChange: <Key extends keyof ExtensionOptions>(key: Key, value: ExtensionOptions[Key]) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const PLACEMENT_OPTIONS = [
  { value: 'top-left', labelKey: 'positionTopLeft', Icon: ArrowUpLeft },
  { value: 'top-right', labelKey: 'positionTopRight', Icon: ArrowUpRight },
  { value: 'bottom-left', labelKey: 'positionBottomLeft', Icon: ArrowDownLeft },
  { value: 'bottom-right', labelKey: 'positionBottomRight', Icon: ArrowDownRight }
] satisfies Array<{ value: TriggerPlacement; labelKey: string; Icon: typeof ArrowUpLeft }>;

export function PanelPreferenceFields({ options, onChange }: PanelPreferenceFieldsProps) {
  return (
    <div className="panel-preferences">
      <div className="toggle-row panel-mode-preference">
        <div>
          <label htmlFor="darkMode">{t('darkMode')}</label>
          <small>{t('darkModeDescription')}</small>
        </div>
        <input
          id="darkMode"
          type="checkbox"
          checked={options.colorMode === 'dark'}
          onChange={(event) => onChange('colorMode', event.target.checked ? 'dark' : 'light')}
        />
      </div>

      <div className="position-preference">
        <div className="preference-heading">
          <div>
            <label id="panel-position-label">{t('triggerPosition')}</label>
            <small>{t('triggerPositionHelp')}</small>
          </div>
        </div>

        <div className="placement-options" role="radiogroup" aria-labelledby="panel-position-label">
          {PLACEMENT_OPTIONS.map(({ value, labelKey, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={options.triggerPlacement === value}
              className={options.triggerPlacement === value ? 'placement-option active' : 'placement-option'}
              onClick={() => onChange('triggerPlacement', value)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dimension-preferences">
        <div className="dimension-intro">{t('answerPanelSize')}</div>
        <DimensionControl
          id="panel-width"
          label={t('panelWidth')}
          value={options.panelWidth}
          min={300}
          max={720}
          onChange={(value) => onChange('panelWidth', value)}
        />
        <DimensionControl
          id="panel-height"
          label={t('panelHeight')}
          value={options.panelHeight}
          min={220}
          max={720}
          onChange={(value) => onChange('panelHeight', value)}
        />
      </div>
    </div>
  );
}

interface DimensionControlProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function DimensionControl({ id, label, value, min, max, onChange }: DimensionControlProps) {
  return (
    <div className="dimension-control">
      <div className="dimension-heading">
        <label htmlFor={`${id}-range`}>{label}</label>
        <div className="dimension-number">
          <input
            id={`${id}-number`}
            type="number"
            min={min}
            max={max}
            step="10"
            value={value}
            aria-label={t('pixelsLabel', label)}
            onChange={(event) => onChange(Number(event.target.value))}
            onBlur={() => onChange(Math.round(clamp(value, min, max)))}
          />
          <span>{t('pixelsUnit')}</span>
        </div>
      </div>
      <input
        id={`${id}-range`}
        className="dimension-range"
        type="range"
        min={min}
        max={max}
        step="10"
        value={clamp(value, min, max)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="dimension-scale"><span>{min}</span><span>{max}</span></div>
    </div>
  );
}
