import { Bot, ChevronDown } from 'lucide-react';
import type { ApiConnection } from '../../shared/options';

interface ModelSelectorProps {
  connections: ApiConnection[];
  activeConnectionId: string;
  disabled: boolean;
  onChange: (connectionId: string, model: string) => void;
}

function encodeValue(connectionId: string, model: string) {
  return JSON.stringify([connectionId, model]);
}

export function ModelSelector({ connections, activeConnectionId, disabled, onChange }: ModelSelectorProps) {
  const activeConnection = connections.find((connection) => connection.id === activeConnectionId) || connections[0];
  const value = encodeValue(activeConnection.id, activeConnection.model);
  const modelCount = connections.reduce((total, connection) => total + connection.models.length, 0);

  return (
    <section className="model-panel" aria-labelledby="model-title">
      <div className="section-title">
        <div>
          <h2 id="model-title">当前模型</h2>
          <p>{activeConnection.name} · 用于下一次提问</p>
        </div>
        <span>{modelCount} 个可选</span>
      </div>

      <label className="model-select" htmlFor="active-model">
        <Bot className="model-icon" size={21} aria-hidden="true" />
        <select
          id="active-model"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const [connectionId, model] = JSON.parse(event.target.value) as [string, string];
            onChange(connectionId, model);
          }}
        >
          {connections.map((connection) => (
            <optgroup key={connection.id} label={connection.name}>
              {connection.models.map((model) => <option key={model} value={encodeValue(connection.id, model)}>{model}</option>)}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="select-arrow" size={18} aria-hidden="true" />
      </label>
    </section>
  );
}
