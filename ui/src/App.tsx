import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
} from 'reactflow';
import type { GraphData, WebviewMessage } from './types';

const INITIAL_NODES: GraphData['nodes'] = [];
const INITIAL_EDGES: GraphData['edges'] = [];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [status, setStatus] = useState<'waiting' | 'loaded' | 'empty'>('waiting');

  // Receive graph data posted from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent<WebviewMessage>) => {
      const message = event.data;
      if (message.type === 'update') {
        const { nodes: newNodes, edges: newEdges } = message.graph;
        setNodes(newNodes);
        setEdges(newEdges);
        setStatus(newNodes.length === 0 ? 'empty' : 'loaded');
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1e1e2e' }}>
      {status === 'waiting' && (
        <div className="overlay">
          <div className="spinner" />
          <p>Waiting for scan results…</p>
        </div>
      )}

      {status === 'empty' && (
        <div className="overlay">
          <span className="empty-icon">🗺️</span>
          <p>No API connections detected.</p>
          <small>Make sure your project contains Next.js fetch/axios calls or Express routes.</small>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#444" gap={20} />
        <MiniMap nodeColor={() => '#7c3aed'} maskColor="rgba(0,0,0,0.6)" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
