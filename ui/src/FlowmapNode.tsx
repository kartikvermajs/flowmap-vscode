import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeData } from './types';

const KIND_COLORS: Record<string, string> = {
  frontend: '#7c3aed',   // purple
  endpoint: '#0ea5e9',   // sky blue
  backend:  '#10b981',   // emerald
};

const KIND_LABELS: Record<string, string> = {
  frontend: 'Frontend',
  endpoint: 'API',
  backend:  'Backend',
};

const FlowmapNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  const color = KIND_COLORS[data.kind] ?? '#6c7086';
  const kindLabel = KIND_LABELS[data.kind] ?? data.kind;

  const tooltip =
    data.kind === 'endpoint'
      ? `Endpoint: ${data.endpoint}\nMethod: ${data.method}`
      : `File: ${data.filePath}`;

  return (
    <div
      className={`fmap-node fmap-node--${data.kind}${selected ? ' fmap-node--selected' : ''}`}
      title={tooltip}
      style={{ borderColor: color }}
    >
      {/* Source handle (left) */}
      {data.kind !== 'backend' && (
        <Handle type="source" position={Position.Right} style={{ background: color }} />
      )}

      {/* Target handle (right) */}
      {data.kind !== 'frontend' && (
        <Handle type="target" position={Position.Left} style={{ background: color }} />
      )}

      <div className="fmap-node__badge" style={{ background: color }}>
        {kindLabel}
      </div>

      <div className="fmap-node__label">{data.label}</div>

      {data.method && data.kind === 'endpoint' && (
        <div className="fmap-node__method" style={{ color }}>
          {data.method}
        </div>
      )}
    </div>
  );
});

FlowmapNode.displayName = 'FlowmapNode';
export default FlowmapNode;
