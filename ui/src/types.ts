/* Shared types between extension host and webview UI */
export type NodeKind = 'frontend' | 'endpoint' | 'backend';

export interface FlowNodeData {
  label: string;
  filePath?: string;   // relative path — for open-file + tooltip
  endpoint?: string;   // /api/... — for tooltip
  method?: string;     // GET | POST | ...
  kind: NodeKind;
}

export interface FlowNode {
  id: string;
  type: string;
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

export type WebviewMessage =
  | { type: 'update'; graph: GraphData }

export type ExtensionMessage =
  | { type: 'ready' }
  | { type: 'openFile'; filePath: string }
  | { type: 'rescan' };
