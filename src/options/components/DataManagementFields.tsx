import { Download, FileUp, ShieldAlert } from 'lucide-react';
import { useRef } from 'react';
import { t } from '../../shared/i18n';

interface DataManagementFieldsProps {
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
}

export function DataManagementFields({ onExport, onImport }: DataManagementFieldsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="data-management">
      <div className="data-copy">
        <h3>{t('configurationBackup')}</h3>
        <p>{t('configurationBackupDescription')}</p>
        <div className="security-note"><ShieldAlert size={16} aria-hidden="true" />{t('exportSecurityWarning')}</div>
      </div>
      <div className="data-actions">
        <button className="secondary-button" type="button" onClick={onExport}><Download size={17} aria-hidden="true" />{t('exportJson')}</button>
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}><FileUp size={17} aria-hidden="true" />{t('importJson')}</button>
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
