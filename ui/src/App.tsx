import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type NodeMouseHandler,
} from 'reactflow';
import FlowmapNode from './FlowmapNode';
import type { FlowNode, FlowEdge, GraphData, WebviewMessage, NodeKind } from './types';

/** VS Code API — injected by the extension host into the Webview context */
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};
const vscode = acquireVsCodeApi();

// Register our custom node type once — outside component to avoid recreation
const NODE_TYPES = { flowmapNode: FlowmapNode };

// ──────────────────────────────────────────────
// Inner graph component (needs ReactFlowProvider)
// ──────────────────────────────────────────────
function GraphCanvas({
  rawNodes,
  rawEdges,
  filterEndpoint,
  onNodeClick,
}: {
  rawNodes: FlowNode[];
  rawEdges: FlowEdge[];
  filterEndpoint: string | null;
  onNodeClick: (node: FlowNode) => void;
}) {
  const { fitView } = useReactFlow();

  // Apply filter: show only connections through the selected endpoint
  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (!filterEndpoint) {
      return { visibleNodes: rawNodes, visibleEdges: rawEdges };
    }

    const relatedEdges = rawEdges.filter(
      (e) => e.source === filterEndpoint || e.target === filterEndpoint
    );
    const relatedNodeIds = new Set<string>([filterEndpoint]);
    relatedEdges.forEach((e) => {
      relatedNodeIds.add(e.source);
      relatedNodeIds.add(e.target);
    });
    const visibleNodes = rawNodes
      .filter((n) => relatedNodeIds.has(n.id))
      .map((n) => ({
        ...n,
        data: { ...n.data },
        // dim unrelated nodes (none in filtered view but keep for type compat)
      }));
    return { visibleNodes, visibleEdges: relatedEdges };
  }, [rawNodes, rawEdges, filterEndpoint]);

  const [nodes, setNodes, onNodesChange] = useNodesState(visibleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  // Sync when visible set changes
  useEffect(() => {
    setNodes(visibleNodes);
    setEdges(visibleEdges);
    // Fit view after data settles
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [visibleNodes, visibleEdges, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => onNodeClick(node as FlowNode),
    [onNodeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      attributionPosition="bottom-right"
    >
      <Background color="#2a2a3e" gap={24} />
      <MiniMap
        nodeColor={(n) => {
          const kind = (n.data as FlowNode['data']).kind;
          if (kind === 'frontend') { return '#7c3aed'; }
          if (kind === 'endpoint') { return '#0ea5e9'; }
          return '#10b981';
        }}
        maskColor="rgba(0,0,0,0.65)"
        style={{ background: '#1e1e2e', border: '1px solid #313244' }}
      />
      <Controls />
    </ReactFlow>
  );
}

// ──────────────────────────────────────────────
// Root App
// ──────────────────────────────────────────────
export default function App() {
  const [rawNodes, setRawNodes] = useState<FlowNode[]>([]);
  const [rawEdges, setRawEdges] = useState<FlowEdge[]>([]);
  const [status, setStatus] = useState<'waiting' | 'loaded' | 'empty'>('waiting');
  const [filterEndpoint, setFilterEndpoint] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);

  // All unique endpoint node IDs for the filter sidebar
  const endpointNodes = useMemo(
    () => rawNodes.filter((n) => n.data.kind === 'endpoint'),
    [rawNodes]
  );

  // Receive graph data from extension host
  useEffect(() => {
    // Signal readiness — extension host responds with the initial graph
    vscode.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent<WebviewMessage>) => {
      const msg = event.data;
      if (msg.type === 'update') {
        const { nodes: newNodes, edges: newEdges } = msg.graph;
        setRawNodes(newNodes as FlowNode[]);
        setRawEdges(newEdges as FlowEdge[]);
        setStatus(newNodes.length === 0 ? 'empty' : 'loaded');
        setRescanning(false);
        setFilterEndpoint(null); // reset filter on new scan
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleNodeClick = useCallback((node: FlowNode) => {
    if (node.data.filePath) {
      // Open file in VS Code editor
      vscode.postMessage({ type: 'openFile', filePath: node.data.filePath });
    }
    if (node.data.kind === 'endpoint') {
      // Toggle filter on/off
      setFilterEndpoint((prev) => (prev === node.id ? null : node.id));
    }
  }, []);

  const handleRescan = useCallback(() => {
    setRescanning(true);
    vscode.postMessage({ type: 'rescan' });
  }, []);

  return (
    <div className="app-root">
      {/* ── Sidebar ──────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <span className="sidebar__logo">⚡ FlowMap</span>
          <button
            className={`sidebar__rescan-btn${rescanning ? ' sidebar__rescan-btn--loading' : ''}`}
            onClick={handleRescan}
            disabled={rescanning}
            title="Re-scan project"
          >
            {rescanning ? '⟳' : '↺'} Rescan
          </button>
        </div>

        {status === 'loaded' && (
          <>
            <div className="sidebar__section-title">Filter by Endpoint</div>
            <div className="sidebar__filter-list">
              <button
                className={`sidebar__filter-item${filterEndpoint === null ? ' sidebar__filter-item--active' : ''}`}
                onClick={() => setFilterEndpoint(null)}
              >
                All connections
              </button>
              {endpointNodes.map((n) => (
                <button
                  key={n.id}
                  className={`sidebar__filter-item${filterEndpoint === n.id ? ' sidebar__filter-item--active' : ''}`}
                  onClick={() =>
                    setFilterEndpoint((prev) => (prev === n.id ? null : n.id))
                  }
                  title={n.data.endpoint}
                >
                  <span className="sidebar__method-badge">{n.data.method}</span>
                  {n.data.endpoint}
                </button>
              ))}
            </div>

            <div className="sidebar__legend">
              <div className="sidebar__legend-item">
                <span className="sidebar__dot" style={{ background: '#7c3aed' }} />
                Frontend
              </div>
              <div className="sidebar__legend-item">
                <span className="sidebar__dot" style={{ background: '#0ea5e9' }} />
                API Endpoint
              </div>
              <div className="sidebar__legend-item">
                <span className="sidebar__dot" style={{ background: '#10b981' }} />
                Backend
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── Canvas ──────────────────────────────── */}
      <main className="canvas-area">
        {status === 'waiting' && (
          <div className="overlay">
            <div className="spinner" />
            <p>Scanning project…</p>
          </div>
        )}

        {status === 'empty' && (
          <div className="overlay">
            <span className="empty-icon">🗺️</span>
            <p>No API connections detected.</p>
            <small>
              Make sure your project contains Next.js fetch/axios calls or Express routes.
            </small>
            <button className="overlay__rescan-btn" onClick={handleRescan}>
              ↺ Rescan
            </button>
          </div>
        )}

        {status === 'loaded' && (
          <ReactFlowProvider>
            <GraphCanvas
              rawNodes={rawNodes}
              rawEdges={rawEdges}
              filterEndpoint={filterEndpoint}
              onNodeClick={handleNodeClick}
            />
          </ReactFlowProvider>
        )}
      </main>
    </div>
  );
}
