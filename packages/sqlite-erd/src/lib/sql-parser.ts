import type { Column, Relationship, Table } from './schema-types';

export const parseSQLStatements = (
  sql: string,
): {
  tables: Table[];
  relationships: Relationship[];
} => {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];

  // Remove comments
  const cleaned = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // 1. Find CREATE TABLE statements with balanced parenthesis matching
  const createTableRegex =
    /CREATE\s+(TEMP|TEMPORARY)?\s*TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(/gi;
  let match: RegExpExecArray | null;

  while (true) {
    match = createTableRegex.exec(cleaned);
    if (match === null) {
      break;
    }
    const isTemporary = !!match[1];
    const tableName = match[2].replace(/[`"']/g, '');
    const bodyStart = match.index + match[0].length;
    const body = extractBalancedParens(cleaned, bodyStart);
    if (body === null) {
      continue;
    }

    const { columns, tableRelationships } = parseTableBody(tableName, body);
    tables.push({ name: tableName, columns, indexes: [], isTemporary });
    relationships.push(...tableRelationships);
  }

  // 2. Find CREATE INDEX statements
  const createIndexRegex =
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s+ON\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/gi;

  while (true) {
    match = createIndexRegex.exec(cleaned);
    if (match === null) {
      break;
    }
    const isUnique = !!match[1];
    const indexName = match[2].replace(/[`"']/g, '');
    const tableName = match[3].replace(/[`"']/g, '');
    const columnsText = match[4];

    const columns = columnsText.split(',').map((c) => {
      // Handle optional ASC/DESC and quotes
      return c.trim().split(/\s+/)[0].replace(/[`"']/g, '');
    });

    const table = tables.find(
      (t) => t.name.toLowerCase() === tableName.toLowerCase(),
    );
    if (table) {
      table.indexes.push({ name: indexName, columns, isUnique });
      // Mark columns as indexed
      for (const colName of columns) {
        const col = table.columns.find(
          (c) => c.name.toLowerCase() === colName.toLowerCase(),
        );
        if (col) {
          col.isIndexed = true;
        }
      }
    }
  }

  // Normalize targetTable names, ensure isForeignKey is set, and de-duplicate
  const normalizedRelationships: Relationship[] = [];
  const seenRels = new Set<string>();

  for (const rel of relationships) {
    const actualTarget = tables.find(
      (t) => t.name.toLowerCase() === rel.targetTable.toLowerCase(),
    );
    if (actualTarget) {
      rel.targetTable = actualTarget.name;
    }

    // Normalize ID for de-duplication
    rel.id = `${rel.sourceTable}.${rel.sourceColumn}->${rel.targetTable}.${rel.targetColumn}`;

    if (!seenRels.has(rel.id)) {
      normalizedRelationships.push(rel);
      seenRels.add(rel.id);

      // Ensure isForeignKey is set for the source column
      const sourceTable = tables.find((t) => t.name === rel.sourceTable);
      const sourceCol = sourceTable?.columns.find(
        (c) => c.name === rel.sourceColumn,
      );
      if (sourceCol) {
        sourceCol.isForeignKey = true;
      }
    }
  }

  return { tables, relationships: normalizedRelationships };
};

const parseTableBody = (
  tableName: string,
  body: string,
): { columns: Column[]; tableRelationships: Relationship[] } => {
  const columns: Column[] = [];
  const tableRelationships: Relationship[] = [];
  const pkColumns = new Set<string>();
  const uniqueColumns = new Set<string>();

  // Split by commas, but respect parentheses
  const parts = splitByComma(body);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const upper = trimmed.toUpperCase();

    // Table-level PRIMARY KEY
    if (upper.startsWith('PRIMARY KEY')) {
      const colMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (colMatch) {
        for (const c of colMatch[1].split(',')) {
          pkColumns.add(c.trim().replace(/[`"']/g, ''));
        }
      }
      continue;
    }

    // Table-level FOREIGN KEY
    if (upper.startsWith('FOREIGN KEY')) {
      const fkMatch = trimmed.match(
        /FOREIGN\s+KEY\s*\([`"']?(\w+)[`"']?\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\([`"']?(\w+)[`"']?\)/i,
      );
      if (fkMatch) {
        tableRelationships.push({
          id: `${tableName}.${fkMatch[1]}->${fkMatch[2]}.${fkMatch[3]}`,
          sourceTable: tableName,
          sourceColumn: fkMatch[1],
          targetTable: fkMatch[2],
          targetColumn: fkMatch[3],
          type: 'explicit',
        });
      }
      continue;
    }

    // Table-level UNIQUE
    if (upper.startsWith('UNIQUE')) {
      const uMatch = trimmed.match(/UNIQUE\s*\(([^)]+)\)/i);
      if (uMatch) {
        for (const c of uMatch[1].split(',')) {
          uniqueColumns.add(c.trim().replace(/[`"']/g, ''));
        }
      }
      continue;
    }

    // Table-level CONSTRAINT
    if (upper.startsWith('CONSTRAINT')) {
      // Handle CONSTRAINT name PRIMARY KEY / FOREIGN KEY / UNIQUE
      if (upper.includes('PRIMARY KEY')) {
        const colMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (colMatch) {
          for (const c of colMatch[1].split(',')) {
            pkColumns.add(c.trim().replace(/[`"']/g, ''));
          }
        }
      } else if (upper.includes('FOREIGN KEY')) {
        const fkMatch = trimmed.match(
          /FOREIGN\s+KEY\s*\([`"']?(\w+)[`"']?\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\([`"']?(\w+)[`"']?\)/i,
        );
        if (fkMatch) {
          tableRelationships.push({
            id: `${tableName}.${fkMatch[1]}->${fkMatch[2]}.${fkMatch[3]}`,
            sourceTable: tableName,
            sourceColumn: fkMatch[1],
            targetTable: fkMatch[2],
            targetColumn: fkMatch[3],
            type: 'explicit',
          });
        }
      } else if (upper.includes('UNIQUE')) {
        const uMatch = trimmed.match(/UNIQUE\s*\(([^)]+)\)/i);
        if (uMatch) {
          for (const c of uMatch[1].split(',')) {
            uniqueColumns.add(c.trim().replace(/[`"']/g, ''));
          }
        }
      }
      continue;
    }

    // CHECK constraint at table level
    if (upper.startsWith('CHECK')) {
      continue;
    }

    // Skip GENERATED columns or lines starting with reserved words
    if (upper.startsWith('GENERATED')) {
      continue;
    }

    // Column definition
    const col = parseColumnDef(trimmed, tableName, tableRelationships);
    if (col) {
      columns.push(col);
    }
  }

  // Apply table-level PK/UNIQUE
  for (const col of columns) {
    if (pkColumns.has(col.name)) {
      col.isPrimaryKey = true;
    }
    if (uniqueColumns.has(col.name)) {
      col.isUnique = true;
    }
  }

  return { columns, tableRelationships };
};

const parseColumnDef = (
  def: string,
  tableName: string,
  relationships: Relationship[],
): Column | null => {
  // Strip GENERATED ALWAYS AS (...) STORED/VIRTUAL
  const cleanedDef = def.replace(
    /GENERATED\s+ALWAYS\s+AS\s*\([^)]*\)\s*(STORED|VIRTUAL)?/gi,
    '',
  );

  // Match: column_name TYPE [constraints...]
  const colMatch = cleanedDef.match(
    /^[`"']?(\w+)[`"']?\s+(\w+(?:\s*\([^)]*\))?)\s*(.*)?$/i,
  );
  if (!colMatch) {
    return null;
  }

  const name = colMatch[1];
  const type = colMatch[2];
  const constraints = (colMatch[3] || '').toUpperCase();

  const isPrimaryKey = constraints.includes('PRIMARY KEY');
  const isNotNull = constraints.includes('NOT NULL') || isPrimaryKey;
  const isUnique = constraints.includes('UNIQUE') || isPrimaryKey;

  // Inline REFERENCES
  const refMatch = (colMatch[3] || '').match(
    /REFERENCES\s+[`"']?(\w+)[`"']?\s*\([`"']?(\w+)[`"']?\)/i,
  );
  let references: Column['references'];
  let isForeignKey = false;

  if (refMatch) {
    references = { table: refMatch[1], column: refMatch[2] };
    isForeignKey = true;
    relationships.push({
      id: `${tableName}.${name}->${refMatch[1]}.${refMatch[2]}`,
      sourceTable: tableName,
      sourceColumn: name,
      targetTable: refMatch[1],
      targetColumn: refMatch[2],
      type: 'explicit',
    });
  }

  return {
    name,
    type,
    isPrimaryKey,
    isForeignKey,
    isNotNull,
    isUnique,
    isIndexed: false,
    references,
  };
};

const splitByComma = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of text) {
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current);
  }
  return parts;
};

/** Extract content inside balanced parentheses starting at `start` (just after the opening paren). */
const extractBalancedParens = (text: string, start: number): string | null => {
  let depth = 1;
  let i = start;
  while (i < text.length && depth > 0) {
    if (text[i] === '(') {
      depth++;
    } else if (text[i] === ')') {
      depth--;
    }
    i++;
  }
  if (depth !== 0) {
    return null;
  }
  return text.slice(start, i - 1);
};
