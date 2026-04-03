import type { Edge } from '@xyflow/react';
import { useCallback, useMemo, useState } from 'react';

export const useHighlight = (edges: Edge[]) => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { connectedNodes, connectedEdgeIds } = useMemo(() => {
    if (!selectedTable) {
      return {
        connectedNodes: new Set<string>(),
        connectedEdgeIds: new Set<string>(),
      };
    }
    const connected = edges.filter(
      (e) => e.source === selectedTable || e.target === selectedTable,
    );
    const nodeSet = new Set<string>([selectedTable]);
    const edgeSet = new Set<string>();
    for (const e of connected) {
      nodeSet.add(e.source);
      nodeSet.add(e.target);
      edgeSet.add(e.id);
    }
    return { connectedNodes: nodeSet, connectedEdgeIds: edgeSet };
  }, [selectedTable, edges]);

  const toggleSelect = useCallback((tableId: string) => {
    setSelectedTable((prev) => (prev === tableId ? null : tableId));
  }, []);

  const clearSelection = useCallback(() => setSelectedTable(null), []);

  return {
    selectedTable,
    connectedNodes,
    connectedEdgeIds,
    toggleSelect,
    clearSelection,
  };
};
