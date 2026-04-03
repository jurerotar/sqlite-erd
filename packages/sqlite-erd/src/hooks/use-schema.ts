import { useCallback, useEffect, useState } from 'react';
import { parseDBFile } from '@/lib/db-parser';
import { detectInferredRelationships } from '@/lib/relationship-detector';
import type { Relationship, Schema, Table } from '@/lib/schema-types';
import { parseSQLStatements } from '@/lib/sql-parser';

export const useSchema = (sqlSchema?: string) => {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadFromSQL = useCallback((sql: string) => {
    try {
      setLoading(true);
      setError(null);
      const { tables, relationships } = parseSQLStatements(sql);
      if (tables.length === 0) {
        setError('No CREATE TABLE statements found.');
        setLoading(false);
        return;
      }
      const inferred = detectInferredRelationships(tables, relationships);
      // Mark FK columns for inferred relationships
      for (const rel of inferred) {
        const table = tables.find((t) => t.name === rel.sourceTable);
        const col = table?.columns.find((c) => c.name === rel.sourceColumn);
        if (col) {
          col.isForeignKey = true;
        }
      }
      setSchema({ tables, relationships: [...relationships, ...inferred] });
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse SQL');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sqlSchema) {
      loadFromSQL(sqlSchema);
    }
  }, [sqlSchema, loadFromSQL]);

  const loadFromFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setError(null);

      const ext = file.name.split('.').pop()?.toLowerCase();
      let tables: Table[];
      let relationships: Relationship[];

      if (ext === 'sql') {
        const text = await file.text();
        ({ tables, relationships } = parseSQLStatements(text));
      } else if (
        ['db', 'sqlite', 'sqlite3', 's3db', 'sl3'].includes(ext || '')
      ) {
        const buffer = await file.arrayBuffer();
        ({ tables, relationships } = await parseDBFile(buffer));
      } else {
        setError(`Unsupported file type: .${ext}`);
        setLoading(false);
        return;
      }

      if (tables.length === 0) {
        setError('No tables found in the file.');
        setLoading(false);
        return;
      }

      const inferred = detectInferredRelationships(tables, relationships);
      for (const rel of inferred) {
        const table = tables.find((t) => t.name === rel.sourceTable);
        const col = table?.columns.find((c) => c.name === rel.sourceColumn);
        if (col) {
          col.isForeignKey = true;
        }
      }
      setSchema({ tables, relationships: [...relationships, ...inferred] });
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file');
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSchema(null);
    setError(null);
  }, []);

  return { schema, loading, error, loadFromSQL, loadFromFile, clear };
};
