import type { Edge, Node } from '@xyflow/react';
import dagre from 'dagre';

export const layoutNodes = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Node[] => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: 250, height: estimateNodeHeight(node) });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 125, y: pos.y - pos.height / 2 },
    };
  });
};

const estimateNodeHeight = (node: Node): number => {
  const data = node.data as { columns?: unknown[] };
  const columnCount = data.columns ? data.columns.length : 3;
  return 40 + columnCount * 24;
};
