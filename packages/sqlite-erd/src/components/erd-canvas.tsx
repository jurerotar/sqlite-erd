import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { type MouseEvent, useCallback, useEffect, useMemo } from 'react';
import '@xyflow/react/dist/style.css';
import { LabeledEdge } from './labeled-edge';
import { Legend } from './legend';
import { TableNode } from './table-node';
import { useHighlight } from '@/hooks/use-highlight';
import { layoutNodes } from '@/lib/layout-engine';
import type { Schema } from '@/lib/schema-types';

const nodeTypes = { table: TableNode };
const edgeTypes = { labeled: LabeledEdge };

interface ERDCanvasProps {
  schema: Schema;
}

const schemaToFlow = (schema: Schema) => {
  const nodes: Node[] = schema.tables.map((table) => ({
    id: table.name,
    type: 'table',
    position: { x: 0, y: 0 },
    data: {
      label: table.name,
      columns: table.columns,
      indexes: table.indexes,
      highlighted: false,
      dimmed: false,
      isTemporary: table.isTemporary,
    },
  }));

  const edges: Edge[] = schema.relationships.map((rel) => {
    const isSelf = rel.sourceTable === rel.targetTable;
    return {
      id: rel.id,
      source: rel.sourceTable,
      target: rel.targetTable,
      sourceHandle: isSelf ? 'self-source' : undefined,
      targetHandle: isSelf ? 'self-target' : undefined,
      type: 'labeled',
      animated: false,
      style: {
        stroke: 'hsl(0, 0%, 45%)',
        strokeWidth: 1.5,
        strokeDasharray: rel.type === 'inferred' ? '5 3' : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: 'hsl(0, 0%, 45%)',
      },
      label: `${rel.sourceColumn}`,
      labelStyle: {
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fill: 'hsl(0, 0%, 50%)',
      },
      labelBgStyle: {
        fill: 'hsl(0, 0%, 12%)',
        fillOpacity: 0.8,
      },
    };
  });
  const laid = layoutNodes(nodes, edges);
  return { nodes: laid, edges };
};

export const ERDCanvas = ({ schema }: ERDCanvasProps) => {
  const initial = useMemo(() => schemaToFlow(schema), [schema]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const {
    selectedTable,
    connectedNodes,
    connectedEdgeIds,
    toggleSelect,
    clearSelection,
  } = useHighlight(edges);

  // Update nodes when schema changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = schemaToFlow(schema);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [schema, setNodes, setEdges]);

  // Apply highlighting to nodes and edges
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlighted: selectedTable ? connectedNodes.has(n.id) : false,
          dimmed: selectedTable ? !connectedNodes.has(n.id) : false,
        },
      })),
    );
  }, [selectedTable, connectedNodes, setNodes]);

  const styledEdges = useMemo(() => {
    return edges.map((e) => {
      const isConnected = connectedEdgeIds.has(e.id);
      const isDimmed = selectedTable && !isConnected;
      return {
        ...e,
        style: {
          ...e.style,
          stroke: isConnected
            ? 'hsl(0, 0%, 80%)'
            : (e.style?.stroke ?? 'hsl(0, 0%, 45%)'),
          strokeWidth: isConnected ? 2.5 : isDimmed ? 1 : 1.5,
          opacity: isDimmed ? 0.15 : 1,
        },
        markerEnd:
          isConnected && typeof e.markerEnd === 'object'
            ? { ...e.markerEnd, color: 'hsl(0, 0%, 80%)' }
            : e.markerEnd,
        animated: isConnected,
      };
    });
  }, [edges, selectedTable, connectedEdgeIds]);

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      toggleSelect(node.id);
    },
    [toggleSelect],
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="bg-background!"
        />
        <Controls showInteractive />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="bg-card!"
        />
      </ReactFlow>
      <Legend />
    </div>
  );
};
