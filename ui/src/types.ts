/* Shared types between extension host and webview UI */

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

export interface WebviewMessage {
  type: 'update';
  graph: GraphData;
}
