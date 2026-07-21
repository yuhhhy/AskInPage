import type { ColorMode, ThemeColor } from '../../shared/options';
import { ToggleSwitch } from './ToggleSwitch';

interface BasicSettingsProps {
  enabled: boolean;
  colorMode: ColorMode;
  superMode: boolean;
  quickMode: boolean;
  themeColor: ThemeColor;
  onEnabledChange: (value: boolean) => void;
  onColorModeChange: (value: ColorMode) => void;
  onSuperModeChange: (value: boolean) => void;
  onQuickModeChange: (value: boolean) => void;
  onThemeColorChange: (value: ThemeColor) => void;
}

const THEMES: Array<{ value: ThemeColor; label: string }> = [
  { value: 'purple', label: '经典紫' },
  { value: 'blue', label: '湖水蓝' },
  { value: 'green', label: '松柏绿' },
  { value: 'orange', label: '暖橙' },
  { value: 'rose', label: '莓果红' }
];

export function BasicSettings(props: BasicSettingsProps) {
  return (
    <section className="basic-settings" aria-labelledby="basic-settings-title">
      <div className="section-title">
        <h2 id="basic-settings-title">基础设置</h2>
      </div>
      <div className="preference-list">
        <ToggleSwitch id="extension-enabled" checked={props.enabled} label="插件开关" description="控制网页划词功能" onChange={props.onEnabledChange} />
        <ToggleSwitch id="dark-mode" checked={props.colorMode === 'dark'} label="夜间阅读" description="回答弹窗使用深色外观" onChange={(checked) => props.onColorModeChange(checked ? 'dark' : 'light')} />
        <ToggleSwitch id="super-mode" checked={props.superMode} label="超级模式" description="禁用网页按钮和链接，允许选择其中的文字" onChange={props.onSuperModeChange} />
        <ToggleSwitch id="quick-mode" checked={props.quickMode} label="快速模式" description="仅提供当前段落和选中文字，会削弱回答效果和准确性" onChange={props.onQuickModeChange} />
      </div>
      <div className="theme-picker">
        <div>
          <strong>主题颜色</strong>
          <small>选择界面的强调色</small>
        </div>
        <div className="theme-swatches" role="radiogroup" aria-label="主题颜色">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              className={`theme-swatch theme-${theme.value}${props.themeColor === theme.value ? ' is-active' : ''}`}
              type="button"
              role="radio"
              aria-checked={props.themeColor === theme.value}
              aria-label={theme.label}
              title={theme.label}
              onClick={() => props.onThemeColorChange(theme.value)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
