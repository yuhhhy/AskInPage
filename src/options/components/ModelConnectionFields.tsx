import { Check, Eye, EyeOff, Plus, Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ApiConnection } from '../../shared/options';
import { t } from '../../shared/i18n';

interface ModelConnectionFieldsProps {
  connections: ApiConnection[];
  activeConnectionId: string;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<ApiConnection>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function ModelConnectionFields({ connections, activeConnectionId, onSelect, onChange, onAdd, onRemove }: ModelConnectionFieldsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const activeConnection = connections.find((connection) => connection.id === activeConnectionId) || connections[0];
  if (!activeConnection) return null;

  const fieldId = (name: string) => `${name}-${activeConnection.id}`;
  const selectableModels = [...new Set([
    ...activeConnection.models.map((model) => model.trim()).filter(Boolean),
    activeConnection.model
  ])];

  return (
    <div className="connection-manager">
      <aside className="connection-sidebar">
        <div className="connection-sidebar-heading">
          <span>{t('serviceList')}</span>
        </div>
        <div className="connection-list" role="list">
          {connections.map((connection) => {
            const active = connection.id === activeConnectionId;
            return (
              <button key={connection.id} className={`connection-item${active ? ' is-active' : ''}`} type="button" onClick={() => { onSelect(connection.id); setShowApiKey(false); }}>
                <Server size={18} aria-hidden="true" />
                <span><strong>{connection.name}</strong><small>{connection.model}</small></span>
                {active && <Check size={17} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <button className="add-connection-button" type="button" onClick={onAdd}><Plus size={17} aria-hidden="true" />{t('addService')}</button>
      </aside>

      <div className="connection-editor">
        <div className="connection-editor-heading">
          <div><h3>{t('connectionDetails')}</h3></div>
          <button className="delete-connection-button" type="button" disabled={connections.length === 1} onClick={() => onRemove(activeConnection.id)}><Trash2 size={17} aria-hidden="true" />{t('delete')}</button>
        </div>

        <div className="field-grid">
          <div>
            <label htmlFor={fieldId('connection-name')}>{t('serviceName')}</label>
            <input id={fieldId('connection-name')} value={activeConnection.name} onChange={(event) => onChange(activeConnection.id, { name: event.target.value })} placeholder={t('serviceNamePlaceholder')} />
          </div>
          <div>
            <label htmlFor={fieldId('model')}>{t('currentModel')}</label>
            <select id={fieldId('model')} value={activeConnection.model} onChange={(event) => onChange(activeConnection.id, { model: event.target.value })}>
              {selectableModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </div>
        </div>

        <label htmlFor={fieldId('base-url')}>{t('baseUrlLabel')}</label>
        <input id={fieldId('base-url')} value={activeConnection.apiBaseUrl} onChange={(event) => onChange(activeConnection.id, { apiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1" inputMode="url" />
        <p className="field-help">{t('remoteUrlHelp')}</p>

        <label htmlFor={fieldId('api-key')}>{t('apiKeyLabel')}</label>
        <div className="password-field">
          <input id={fieldId('api-key')} type={showApiKey ? 'text' : 'password'} value={activeConnection.apiKey} onChange={(event) => onChange(activeConnection.id, { apiKey: event.target.value })} placeholder="sk-..." autoComplete="off" />
          <button type="button" aria-label={showApiKey ? t('hideApiKey') : t('showApiKey')} title={showApiKey ? t('hideApiKey') : t('showApiKey')} onClick={() => setShowApiKey((current) => !current)}>
            {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="field-help">{t('apiKeyHelp')}</p>

        <label htmlFor={fieldId('models')}>{t('availableModels')}</label>
        <textarea
          id={fieldId('models')}
          value={activeConnection.models.join('\n')}
          onChange={(event) => {
            onChange(activeConnection.id, { models: event.target.value.split(/\r?\n/) });
          }}
          placeholder={t('modelsPlaceholder')}
        />
        <p className="field-help">{t('modelsHelp')}</p>
      </div>
    </div>
  );
}
