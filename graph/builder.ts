import type { ApiCall } from '../core/parser';
import * as path from 'path';

export type NodeKind = 'frontend' | 'endpoint' | 'backend';

export interface FlowNodeData {
  label: string;         // short display name
  filePath?: string;     // full relative path (for tooltip + open-file)
  endpoint?: string;     // e.g. /api/users
  method?: string;       // GET | POST | ...
  confidence?: number;   // passed through for future UI use
  kind: NodeKind;
}

export interface FlowNode {
  id: string;
  type: string;          // 'flowmapNode' — our custom React Flow node type
  data: FlowNodeData;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
}

export interface GraphData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Return just the filename (or last two path segments for context) */
function shortLabel(relPath: string): string {
  const parts = relPath.split('/');
  if (parts.length <= 2) { return relPath; }
  return parts.slice(-2).join('/');
}

/**
 * Column X positions for the 3-column layout:
 *   Frontend files (left) → API endpoints (center) → Backend files (right)
 */
const COL = { left: 50, center: 350, right: 650 } as const;
const ROW_SPACING = 90;

/**
 * Convert a list of normalized ApiCalls into React Flow nodes and edges.
 *
 * Node IDs:
 *   - Frontend files  → "file::<sourceFile>"
 *   - API endpoints   → "endpoint::<method>::<normalizedPath>"
 *   - Backend routes  → "route::<sourceFile>"
 */
export function buildGraph(connections: ApiCall[]): GraphData {
  const nodeMap = new Map<string, FlowNode>();
  const edgeSet = new Set<string>();
  const edges: FlowEdge[] = [];

  // Track row counters per column independently
  let frontendRow = 0;
  let endpointRow = 0;
  let backendRow = 0;

  function addNode(
    id: string,
    data: FlowNodeData,
    col: 'left' | 'center' | 'right'
  ): void {
    if (nodeMap.has(id)) { return; }
    let y: number;
    if (col === 'left')   { y = frontendRow++  * ROW_SPACING; }
    else if (col === 'right') { y = backendRow++   * ROW_SPACING; }
    else                  { y = endpointRow++  * ROW_SPACING; }

    nodeMap.set(id, {
      id,
      type: 'flowmapNode',
      data,
      position: { x: COL[col], y },
    });
  }

  function addEdge(
    id: string,
    source: string,
    target: string,
    label: string | undefined,
    animated: boolean
  ): void {
    if (edgeSet.has(id)) { return; }
    edgeSet.add(id);
    edges.push({
      id,
      source,
      target,
      label,
      animated,
      style: { stroke: animated ? '#7c3aed' : '#45475a', strokeWidth: 2 },
    });
  }

  for (const conn of connections) {
    // Endpoint node is shared — keyed by method + normalized path
    const endpointId = `endpoint::${conn.method}::${conn.normalizedPath}`;

    if (conn.type === 'frontend') {
      const fileId = `file::${conn.sourceFile}`;

      addNode(fileId, {
        label:    shortLabel(conn.sourceFile),
        filePath: conn.sourceFile,
        kind:     'frontend',
      }, 'left');

      addNode(endpointId, {
        label:      `${conn.method} ${conn.normalizedPath}`,
        endpoint:   conn.normalizedPath,
        method:     conn.method,
        confidence: conn.confidence,
        kind:       'endpoint',
      }, 'center');

      addEdge(
        `fedge::${fileId}::${endpointId}`,
        fileId,
        endpointId,
        conn.method !== 'unknown' ? conn.method : undefined,
        true
      );
    } else {
      const routeId = `route::${conn.sourceFile}`;

      addNode(routeId, {
        label:    shortLabel(conn.sourceFile),
        filePath: conn.sourceFile,
        kind:     'backend',
      }, 'right');

      addNode(endpointId, {
        label:      `${conn.method} ${conn.normalizedPath}`,
        endpoint:   conn.normalizedPath,
        method:     conn.method,
        confidence: conn.confidence,
        kind:       'endpoint',
      }, 'center');

      addEdge(
        `bedge::${endpointId}::${routeId}`,
        endpointId,
        routeId,
        conn.method,
        false
      );
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
