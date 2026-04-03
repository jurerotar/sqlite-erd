import type { Relationship, Table } from './schema-types';

/**
 * Detect inferred relationships from naming conventions:
 * - user_id -> users.id
 * - userId -> users.id  (camelCase)
 * - author_id -> authors.id
 */
export const detectInferredRelationships = (
  tables: Table[],
  explicitRelationships: Relationship[],
): Relationship[] => {
  const inferred: Relationship[] = [];
  const tableNames = new Set(tables.map((t) => t.name.toLowerCase()));
  const existingKeys = new Set(explicitRelationships.map((r) => r.id));

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.isPrimaryKey || column.isForeignKey) {
        continue;
      }

      const targets = guessTarget(column.name, tableNames);
      for (const target of targets) {
        // Skip self-references
        if (target.toLowerCase() === table.name.toLowerCase()) {
          continue;
        }

        // Verify target table exists and has an 'id' column
        const targetTable = tables.find(
          (t) => t.name.toLowerCase() === target.toLowerCase(),
        );
        if (!targetTable) {
          continue;
        }

        const id = `${table.name}.${column.name}->${targetTable.name}.id`;
        if (existingKeys.has(id)) {
          continue;
        }

        const targetCol = targetTable.columns.find(
          (c) => c.name.toLowerCase() === 'id',
        );
        if (!targetCol) {
          continue;
        }

        inferred.push({
          id,
          sourceTable: table.name,
          sourceColumn: column.name,
          targetTable: targetTable.name,
          targetColumn: 'id',
          type: 'inferred',
        });
        existingKeys.add(id);
        break; // Only one match per column
      }
    }
  }

  return inferred;
};

const guessTarget = (columnName: string, tableNames: Set<string>): string[] => {
  const candidates: string[] = [];

  // snake_case: user_id -> users, user
  if (columnName.endsWith('_id')) {
    const base = columnName.slice(0, -3);
    candidates.push(`${base}s`, base);
  }

  // camelCase: userId -> users, user
  const camelMatch = columnName.match(/^(.+?)Id$/);
  if (camelMatch) {
    const base = camelMatch[1].toLowerCase();
    candidates.push(`${base}s`, base);
  }

  return candidates.filter((c) => tableNames.has(c.toLowerCase()));
};
