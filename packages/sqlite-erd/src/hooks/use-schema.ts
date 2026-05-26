import { useCallback, useEffect, useState } from 'react';
import { parseDBFile, readTableDataPage } from '@/lib/db-parser';
import { detectInferredRelationships } from '@/lib/relationship-detector';
import type { Relationship, Schema, Table } from '@/lib/schema-types';
import { parseSQLStatements } from '@/lib/sql-parser';

type InitialSchemaSource = {
  databaseUrl?: string;
  sqlSchema?: string;
};

export const useSchema = ({ databaseUrl, sqlSchema }: InitialSchemaSource) => {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [databaseBuffer, setDatabaseBuffer] = useState<ArrayBuffer | null>(
    null,
  );

  const setParsedSchema = useCallback(
    (
      tables: Table[],
      relationships: Relationship[],
      uploadedDatabaseBuffer: ArrayBuffer | null,
    ) => {
      if (tables.length === 0) {
        setError('No tables found.');
        return false;
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
      setDatabaseBuffer(uploadedDatabaseBuffer);
      return true;
    },
    [],
  );

  const loadFromSQL = useCallback(
    (sql: string) => {
      try {
        setLoading(true);
        setError(null);
        setDatabaseBuffer(null);
        const { tables, relationships } = parseSQLStatements(sql);
        if (tables.length === 0) {
          setError('No CREATE TABLE statements found.');
          setLoading(false);
          return;
        }
        setParsedSchema(tables, relationships, null);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse SQL');
        setLoading(false);
      }
    },
    [setParsedSchema],
  );

  useEffect(() => {
    if (databaseUrl) {
      const abortController = new AbortController();

      const loadInitialDatabase = async () => {
        try {
          setLoading(true);
          setError(null);
          setDatabaseBuffer(null);

          const response = await fetch(databaseUrl, {
            signal: abortController.signal,
          });
          if (!response.ok) {
            throw new Error(`Failed to load database: ${response.status}`);
          }

          const uploadedDatabaseBuffer = await response.arrayBuffer();
          const { tables, relationships } = await parseDBFile(
            uploadedDatabaseBuffer,
          );
          setParsedSchema(tables, relationships, uploadedDatabaseBuffer);
          setLoading(false);
        } catch (e) {
          if (abortController.signal.aborted) {
            return;
          }

          setError(e instanceof Error ? e.message : 'Failed to load database');
          setLoading(false);
        }
      };

      loadInitialDatabase();

      return () => abortController.abort();
    }

    if (sqlSchema) {
      loadFromSQL(sqlSchema);
    }

    return undefined;
  }, [databaseUrl, sqlSchema, loadFromSQL, setParsedSchema]);

  const loadFromFile = useCallback(
    async (file: File) => {
      try {
        setLoading(true);
        setError(null);
        setDatabaseBuffer(null);

        const ext = file.name.split('.').pop()?.toLowerCase();
        let tables: Table[];
        let relationships: Relationship[];
        let uploadedDatabaseBuffer: ArrayBuffer | null = null;

        if (ext === 'sql') {
          const text = await file.text();
          ({ tables, relationships } = parseSQLStatements(text));
        } else if (
          ['db', 'sqlite', 'sqlite3', 's3db', 'sl3'].includes(ext || '')
        ) {
          uploadedDatabaseBuffer = await file.arrayBuffer();
          ({ tables, relationships } = await parseDBFile(
            uploadedDatabaseBuffer,
          ));
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

        setParsedSchema(tables, relationships, uploadedDatabaseBuffer);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse file');
        setLoading(false);
      }
    },
    [setParsedSchema],
  );

  const clear = useCallback(() => {
    setSchema(null);
    setError(null);
    setDatabaseBuffer(null);
  }, []);

  const loadTableData = useCallback(
    (tableName: string, page: number, pageSize = 100) => {
      if (!databaseBuffer) {
        return Promise.reject(new Error('No database file is loaded.'));
      }

      return readTableDataPage(databaseBuffer, tableName, page, pageSize);
    },
    [databaseBuffer],
  );

  return {
    schema,
    loading,
    error,
    hasDatabaseData: !!databaseBuffer,
    loadTableData,
    loadFromSQL,
    loadFromFile,
    clear,
  };
};
