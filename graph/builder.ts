import type { ApiConnection } from '../core/parser';

export interface FlowNode {
  id: string;
  type?: string;
  data: { label: string };
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface GraphData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * Convert a list of ApiConnections into React Flow nodes and edges.
 *
 * Node IDs:
 *   - Frontend files  → "file::<relPath>"
 *   - API endpoints   → "endpoint::<method>::<path>"
 *   - Backend routes  → "route::<relPath>"
 */
export function buildGraph(connections: ApiConnection[]): GraphData {
  const nodeMap = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  let xFrontend = 0;
  let xBackend = 600;
  let yEndpoint = 0;
  const SPACING = 100;

  function getOrCreateNode(
    id: string,
    label: string,
    column: 'left' | 'center' | 'right'
  ): FlowNode {
    if (!nodeMap.has(id)) {
      const x = column === 'left' ? 0 : column === 'center' ? 300 : 600;
      const y =
        column === 'left'
          ? xFrontend++ * SPACING
          : column === 'right'
          ? xBackend++ * SPACING
          : yEndpoint++ * SPACING;

      nodeMap.set(id, {
        id,
        data: { label },
        position: { x, y },
      });
    }
    return nodeMap.get(id)!;
  }

  for (const conn of connections) {
    if (conn.type === 'frontend') {
      // Frontend file → API endpoint
      const fileNodeId = `file::${conn.from}`;
      const endpointNodeId = `endpoint::${conn.method}::${conn.to}`;

      getOrCreateNode(fileNodeId, conn.from, 'left');
      getOrCreateNode(
        endpointNodeId,
        `${conn.method !== 'unknown' ? `[${conn.method}] ` : ''}${conn.to}`,
        'center'
      );

      edges.push({
        id: `edge::${fileNodeId}::${endpointNodeId}`,
        source: fileNodeId,
        target: endpointNodeId,
        animated: true,
        label: conn.method !== 'unknown' ? conn.method : undefined,
      });
    } else {
      // Backend route file → API endpoint
      const routeNodeId = `route::${conn.from}`;
      const endpointNodeId = `endpoint::${conn.method}::${conn.to}`;

      getOrCreateNode(routeNodeId, conn.from, 'right');
      getOrCreateNode(
        endpointNodeId,
        `${conn.method !== 'unknown' ? `[${conn.method}] ` : ''}${conn.to}`,
        'center'
      );

      edges.push({
        id: `edge::${routeNodeId}::${endpointNodeId}`,
        source: endpointNodeId,
        target: routeNodeId,
        animated: false,
        label: conn.method,
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
