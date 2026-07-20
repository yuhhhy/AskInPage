import { Check, Eye, EyeOff, Plus, Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ApiConnection } from '../../shared/options';

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
          <span>服务列表</span>
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
        <button className="add-connection-button" type="button" onClick={onAdd}><Plus size={17} aria-hidden="true" />添加服务</button>
      </aside>

      <div className="connection-editor">
        <div className="connection-editor-heading">
          <div><h3>连接详情</h3><p>保存后用于下一次提问</p></div>
          <button className="delete-connection-button" type="button" disabled={connections.length === 1} onClick={() => onRemove(activeConnection.id)}><Trash2 size={17} aria-hidden="true" />删除</button>
        </div>

        <div className="field-grid">
          <div>
            <label htmlFor={fieldId('connection-name')}>服务名称</label>
            <input id={fieldId('connection-name')} value={activeConnection.name} onChange={(event) => onChange(activeConnection.id, { name: event.target.value })} placeholder="例如：OpenAI" />
          </div>
          <div>
            <label htmlFor={fieldId('model')}>当前模型</label>
            <select id={fieldId('model')} value={activeConnection.model} onChange={(event) => onChange(activeConnection.id, { model: event.target.value })}>
              {selectableModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </div>
        </div>

        <label htmlFor={fieldId('base-url')}>OpenAI-compatible Base URL</label>
        <input id={fieldId('base-url')} value={activeConnection.apiBaseUrl} onChange={(event) => onChange(activeConnection.id, { apiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1" inputMode="url" />

        <label htmlFor={fieldId('api-key')}>API Key</label>
        <div className="password-field">
          <input id={fieldId('api-key')} type={showApiKey ? 'text' : 'password'} value={activeConnection.apiKey} onChange={(event) => onChange(activeConnection.id, { apiKey: event.target.value })} placeholder="sk-..." autoComplete="off" />
          <button type="button" aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'} title={showApiKey ? '隐藏 API Key' : '显示 API Key'} onClick={() => setShowApiKey((current) => !current)}>
            {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <label htmlFor={fieldId('models')}>可选模型</label>
        <textarea
          id={fieldId('models')}
          value={activeConnection.models.join('\n')}
          onChange={(event) => {
            onChange(activeConnection.id, { models: event.target.value.split(/\r?\n/) });
          }}
          placeholder={'gpt-4o-mini\ngpt-4.1-mini\n其他模型 ID'}
        />
        <p className="field-help">每行填写一个模型 ID；不同服务可以使用各自的模型列表。</p>
      </div>
    </div>
  );
}
