import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import type { ExtensionOptions, TriggerPlacement } from '../../shared/options';
import './PanelPreferenceFields.css';

interface PanelPreferenceFieldsProps {
  options: ExtensionOptions;
  onChange: <Key extends keyof ExtensionOptions>(key: Key, value: ExtensionOptions[Key]) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const PLACEMENT_OPTIONS = [
  { value: 'top-left', label: '左上', Icon: ArrowUpLeft },
  { value: 'top-right', label: '右上', Icon: ArrowUpRight },
  { value: 'bottom-left', label: '左下', Icon: ArrowDownLeft },
  { value: 'bottom-right', label: '右下', Icon: ArrowDownRight }
] satisfies Array<{ value: TriggerPlacement; label: string; Icon: typeof ArrowUpLeft }>;

export function PanelPreferenceFields({ options, onChange }: PanelPreferenceFieldsProps) {
  return (
    <div className="panel-preferences">
      <div className="position-preference">
        <div className="preference-heading">
          <div>
            <label id="panel-position-label">AskChat 操作框位置</label>
            <small>选择操作框相对选中文字出现的方向，四个方向使用相同间距。</small>
          </div>
        </div>

        <div className="placement-options" role="radiogroup" aria-labelledby="panel-position-label">
          {PLACEMENT_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={options.triggerPlacement === value}
              className={options.triggerPlacement === value ? 'placement-option active' : 'placement-option'}
              onClick={() => onChange('triggerPlacement', value)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dimension-preferences">
        <div className="dimension-intro">回答弹窗大小</div>
        <DimensionControl
          id="panel-width"
          label="弹窗宽度"
          value={options.panelWidth}
          min={300}
          max={720}
          onChange={(value) => onChange('panelWidth', value)}
        />
        <DimensionControl
          id="panel-height"
          label="弹窗高度"
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
            aria-label={`${label}，像素`}
            onChange={(event) => onChange(Number(event.target.value))}
            onBlur={() => onChange(Math.round(clamp(value, min, max)))}
          />
          <span>px</span>
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
