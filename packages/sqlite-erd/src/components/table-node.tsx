import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import {
  LuKey as Key,
  LuLink as Link,
  LuSearch as Search,
  LuTable as TableIcon,
} from 'react-icons/lu';
import type { Column, Index } from '@/lib/schema-types';

interface TableNodeData {
  label: string;
  columns: Column[];
  indexes: Index[];
  highlighted: boolean;
  dimmed: boolean;
  isTemporary?: boolean;
  [key: string]: unknown;
}

export const TableNode = memo(({ data }: NodeProps) => {
  const { label, columns, indexes, highlighted, dimmed, isTemporary } =
    data as TableNodeData;

  const classes = [
    'table-node',
    highlighted ? 'highlighted' : '',
    dimmed ? 'dimmed' : '',
    isTemporary ? 'temporary' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-primary !border-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-primary !border-none"
      />
      {/* Side handles for self-loops */}
      <Handle
        type="source"
        position={Position.Right}
        id="self-source"
        className="opacity-0"
        style={{ top: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="self-target"
        className="opacity-0"
        style={{ top: '70%' }}
      />
      <div className="table-node-header">
        <TableIcon
          size={14}
          className="text-primary shrink-0"
        />
        <span className="truncate">{label}</span>
        <span className="ml-auto text-muted-foreground text-[10px] font-normal">
          {columns.length}
        </span>
      </div>
      <div className="table-node-body">
        {columns.map((col) => (
          <div
            key={col.name}
            className="column-row"
          >
            {col.isPrimaryKey && (
              <Key
                size={10}
                className="text-pk shrink-0"
              />
            )}
            {col.isForeignKey && !col.isPrimaryKey && (
              <Link
                size={10}
                className="text-fk shrink-0"
              />
            )}
            {!col.isPrimaryKey && !col.isForeignKey && (
              <span className="w-[10px]" />
            )}
            <span className="column-name">{col.name}</span>
            {col.isPrimaryKey && <span className="badge-pk">PK</span>}
            {col.isForeignKey && <span className="badge-fk">FK</span>}
            {col.isUnique && !col.isPrimaryKey && (
              <span className="badge-uq">UQ</span>
            )}
            {col.isIndexed && !col.isPrimaryKey && !col.isUnique && (
              <span className="badge-ix">IX</span>
            )}
            {col.isNotNull && !col.isPrimaryKey && (
              <span className="badge-nn">NN</span>
            )}
            <span className="column-type">{col.type}</span>
          </div>
        ))}
      </div>
      {indexes && indexes.length > 0 && (
        <div className="table-node-indexes">
          {indexes.map((idx) => (
            <div
              key={idx.name}
              className="index-row"
            >
              <Search
                size={8}
                className="text-index shrink-0"
              />
              <span className="index-badge">{idx.isUnique ? 'UQ' : 'IX'}</span>
              <span className="truncate">
                {idx.name}({idx.columns.join(', ')})
              </span>
            </div>
          ))}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-primary !border-none"
      />
    </div>
  );
});
