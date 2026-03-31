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
  useStore,
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
  filterMethod,
  onNodeClick,
}: {
  rawNodes: FlowNode[];
  rawEdges: FlowEdge[];
  filterEndpoint: string | null;
  filterMethod: string | null;
  onNodeClick: (node: FlowNode) => void;
}) {
  const { fitView } = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  // Apply filter & Responsive Layout
  const { visibleNodes, visibleEdges } = useMemo(() => {
    let edgesToKeep = rawEdges;
    let nodesToKeep = rawNodes;

    if (filterEndpoint || filterMethod) {
      let validEndpointIds = new Set<string>();
      rawNodes.forEach(n => {
        if (n.data.kind === 'endpoint') {
           const matchEndpoint = filterEndpoint ? n.id === filterEndpoint : true;
           const matchMethod = filterMethod ? n.data.method === filterMethod : true;
           if (matchEndpoint && matchMethod) {
             validEndpointIds.add(n.id);
           }
        }
      });

      edgesToKeep = rawEdges.filter(
        (e) => validEndpointIds.has(e.source) || validEndpointIds.has(e.target)
      );
      const relatedNodeIds = new Set<string>(validEndpointIds);
      edgesToKeep.forEach((e) => {
        relatedNodeIds.add(e.source);
        relatedNodeIds.add(e.target);
      });
      nodesToKeep = rawNodes.filter((n) => relatedNodeIds.has(n.id));
    }

    // Clone to ensure we don't mutate the raw state
    const laidOutNodes = nodesToKeep.map((n) => ({
      ...n,
      data: { ...n.data },
      position: { ...n.position }
    }));

    // Responsive grid math
    const cw = width || 800;
    const ch = height || 600;

    const nodeW = 160;
    const nodeH = 60;
    const marginX = 40;

    // Minimum spread to prevent overlapping on tiny windows
    const spreadX = Math.max(600, cw - marginX * 2 - nodeW);
    const colLeft = marginX;
    const colRight = colLeft + spreadX;
    const colCenter = colLeft + Math.floor(spreadX / 2);

    const layoutCol = (kind: string, baseX: number) => {
      const colNodes = laidOutNodes.filter((n) => n.data.kind === kind);
      const count = colNodes.length;
      if (!count) return;

      const maxGap = 80;
      const minGap = 20;
      const availableHeight = ch - 80; // keep padding top/bottom
      
      const idealGap = count > 1 ? (availableHeight - count * nodeH) / (count - 1) : 0;
      const gap = Math.min(maxGap, Math.max(minGap, idealGap));
      
      const blockHeight = count * nodeH + (count - 1) * gap;
      const startY = Math.max(40, (ch - blockHeight) / 2);

      colNodes.forEach((n, i) => {
        n.position = { x: baseX, y: startY + i * (nodeH + gap) };
      });
    };

    layoutCol('frontend', colLeft);
    layoutCol('endpoint', colCenter);
    layoutCol('backend', colRight);

    return { visibleNodes: laidOutNodes, visibleEdges: edgesToKeep };
  }, [rawNodes, rawEdges, filterEndpoint, width, height]);

  const [nodes, setNodes, onNodesChange] = useNodesState(visibleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  // Sync when visible set changes
  useEffect(() => {
    setNodes(visibleNodes);
    setEdges(visibleEdges);
    // Fit view cleanly to constraints
    const handle = window.setTimeout(() => fitView({ padding: 0.15 }), 50);
    return () => clearTimeout(handle);
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
  const [filterMethod, setFilterMethod] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);

  // All unique endpoint node IDs for the filter sidebar
  const endpointNodes = useMemo(() => {
    let endpoints = rawNodes.filter((n) => n.data.kind === 'endpoint');
    if (filterMethod) {
      endpoints = endpoints.filter((n) => n.data.method === filterMethod);
    }
    return endpoints;
  }, [rawNodes, filterMethod]);

  const availableMethods = useMemo(() => {
    const methods = new Set<string>();
    rawNodes.forEach(n => {
      if (n.data.kind === 'endpoint' && n.data.method) {
        methods.add(n.data.method);
      }
    });
    return Array.from(methods).sort();
  }, [rawNodes]);

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
    if (node.data.sourceFile) {
      // Open file in VS Code editor
      vscode.postMessage({ type: 'openFile', sourceFile: node.data.sourceFile });
    }
    if (node.data.kind === 'endpoint') {
      // Toggle filter on/off
      setFilterEndpoint((prev) => (prev === node.id ? null : node.id));
      // Optionally clear method filter to prevent zero-results confusion
      setFilterMethod(null);
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
            {availableMethods.length > 0 && (
              <>
                <div className="sidebar__section-title">Filter by Method</div>
                <div className="sidebar__filter-list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '4px', paddingBottom: '8px' }}>
                  <button
                    className={`sidebar__filter-item${filterMethod === null ? ' sidebar__filter-item--active' : ''}`}
                    style={{ width: 'auto', padding: '4px 8px' }}
                    onClick={() => setFilterMethod(null)}
                  >
                    All methods
                  </button>
                  {availableMethods.map((m) => (
                    <button
                      key={m}
                      className={`sidebar__filter-item${filterMethod === m ? ' sidebar__filter-item--active' : ''}`}
                      style={{ width: 'auto', padding: '4px 8px' }}
                      onClick={() => setFilterMethod(m === filterMethod ? null : m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}

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
              filterMethod={filterMethod}
              onNodeClick={handleNodeClick}
            />
          </ReactFlowProvider>
        )}
      </main>
    </div>
  );
}
