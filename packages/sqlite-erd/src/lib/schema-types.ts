export interface Column {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface Index {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface Table {
  name: string;
  columns: Column[];
  indexes: Index[];
  isTemporary?: boolean;
}

export interface Relationship {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: 'explicit' | 'inferred';
}

export interface Schema {
  tables: Table[];
  relationships: Relationship[];
}
