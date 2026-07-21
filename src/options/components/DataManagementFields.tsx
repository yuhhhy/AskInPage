import { Download, FileUp, ShieldAlert } from 'lucide-react';
import { useRef } from 'react';

interface DataManagementFieldsProps {
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
}

export function DataManagementFields({ onExport, onImport }: DataManagementFieldsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="data-management">
      <div className="data-copy">
        <h3>配置备份</h3>
        <p>将模型服务、界面偏好和插件设置保存为 JSON 文件，也可以在其他设备恢复。本机保存的 API Key 只会在你主动导出时写入文件。</p>
        <div className="security-note"><ShieldAlert size={16} aria-hidden="true" />导出文件包含 API Key，请妥善保管并避免分享。</div>
      </div>
      <div className="data-actions">
        <button className="secondary-button" type="button" onClick={onExport}><Download size={17} aria-hidden="true" />导出 JSON</button>
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}><FileUp size={17} aria-hidden="true" />导入 JSON</button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) await onImport(file);
          }}
        />
      </div>
    </div>
  );
}
