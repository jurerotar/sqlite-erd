import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  parseDBFile,
  readTableDataPage,
  type TableDataFilter,
} from '@/lib/db-parser';
import { detectInferredRelationships } from '@/lib/relationship-detector';
import type { Relationship, Schema, Table } from '@/lib/schema-types';
import { parseSQLStatements } from '@/lib/sql-parser';
import {
  parseSQLiteFileInternals,
  type SQLiteFileInternals,
} from '@/lib/sqlite-file-format';

type InitialSchemaSource = {
  databaseUrl?: string;
  sqlSchema?: string;
};

export type SchemaSource = {
  id: string;
  name: string;
  schema: Schema;
  databaseBuffer: ArrayBuffer | null;
  databaseInternals: SQLiteFileInternals | null;
  sourceKey?: string;
};

const databaseExtensions = ['db', 'sqlite', 'sqlite3', 's3db', 'sl3'];

const dedupeTables = (tables: Table[]) =>
  Array.from(
    new Map(tables.map((table) => [table.name.toLowerCase(), table])).values(),
  );

const dedupeRelationships = (relationships: Relationship[]) =>
  Array.from(new Map(relationships.map((rel) => [rel.id, rel])).values());

const createSourceId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getUrlSourceName = (databaseUrl: string) => {
  try {
    const url = new URL(databaseUrl, window.location.href);
    const fileName = url.pathname.split('/').filter(Boolean).at(-1);

    return fileName || 'Remote database';
  } catch {
    return 'Remote database';
  }
};

export const useSchema = ({ databaseUrl, sqlSchema }: InitialSchemaSource) => {
  const [sources, setSources] = useState<SchemaSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const sourceSequence = useRef(1);

  const activeSource = useMemo(
    () => sources.find((source) => source.id === activeSourceId) ?? null,
    [sources, activeSourceId],
  );

  const createPastedSqlName = useCallback(() => {
    const name = `Pasted SQL ${sourceSequence.current}`;
    sourceSequence.current += 1;

    return name;
  }, []);

  const addParsedSource = useCallback(
    (
      tables: Table[],
      relationships: Relationship[],
      uploadedDatabaseBuffer: ArrayBuffer | null,
      name: string,
      sourceKey?: string,
    ) => {
      if (tables.length === 0) {
        setError('No tables found.');
        return false;
      }

      const uniqueTables = dedupeTables(tables);
      const uniqueRelationships = dedupeRelationships(relationships);
      const inferred = detectInferredRelationships(
        uniqueTables,
        uniqueRelationships,
      );
      for (const rel of inferred) {
        const table = uniqueTables.find((t) => t.name === rel.sourceTable);
        const col = table?.columns.find((c) => c.name === rel.sourceColumn);
        if (col) {
          col.isForeignKey = true;
        }
      }

      const source: SchemaSource = {
        id: createSourceId(),
        name,
        schema: {
          tables: uniqueTables,
          relationships: dedupeRelationships([
            ...uniqueRelationships,
            ...inferred,
          ]),
        },
        databaseBuffer: uploadedDatabaseBuffer,
        databaseInternals: uploadedDatabaseBuffer
          ? parseSQLiteFileInternals(uploadedDatabaseBuffer)
          : null,
        sourceKey,
      };

      setSources((current) => {
        if (sourceKey) {
          const existing = current.find((item) => item.sourceKey === sourceKey);

          if (existing) {
            setActiveSourceId(existing.id);
            return current;
          }
        }

        setActiveSourceId(source.id);
        return [...current, source];
      });

      return true;
    },
    [],
  );

  const loadFromSQL = useCallback(
    (sql: string) => {
      try {
        setLoading(true);
        setError(null);
        const { tables, relationships } = parseSQLStatements(sql);
        if (tables.length === 0) {
          setError('No CREATE TABLE statements found.');
          return;
        }

        addParsedSource(tables, relationships, null, createPastedSqlName());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse SQL');
      } finally {
        setLoading(false);
      }
    },
    [addParsedSource, createPastedSqlName],
  );

  useEffect(() => {
    if (databaseUrl) {
      const abortController = new AbortController();

      const loadInitialDatabase = async () => {
        try {
          setLoading(true);
          setError(null);

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
          addParsedSource(
            tables,
            relationships,
            uploadedDatabaseBuffer,
            getUrlSourceName(databaseUrl),
            `url:${databaseUrl}`,
          );
        } catch (e) {
          if (abortController.signal.aborted) {
            return;
          }

          setError(e instanceof Error ? e.message : 'Failed to load database');
        } finally {
          if (!abortController.signal.aborted) {
            setLoading(false);
          }
        }
      };

      loadInitialDatabase();

      return () => abortController.abort();
    }

    if (sqlSchema) {
      try {
        setLoading(true);
        setError(null);
        const { tables, relationships } = parseSQLStatements(sqlSchema);

        if (tables.length === 0) {
          setError('No CREATE TABLE statements found.');
          return undefined;
        }

        addParsedSource(
          tables,
          relationships,
          null,
          'Initial SQL schema',
          `sql:${sqlSchema}`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse SQL');
      } finally {
        setLoading(false);
      }
    }

    return undefined;
  }, [databaseUrl, sqlSchema, addParsedSource]);

  const loadFromFile = useCallback(
    async (file: File) => {
      try {
        setLoading(true);
        setError(null);

        const ext = file.name.split('.').pop()?.toLowerCase();
        let tables: Table[];
        let relationships: Relationship[];
        let uploadedDatabaseBuffer: ArrayBuffer | null = null;

        if (ext === 'sql') {
          const text = await file.text();
          ({ tables, relationships } = parseSQLStatements(text));
        } else if (databaseExtensions.includes(ext || '')) {
          uploadedDatabaseBuffer = await file.arrayBuffer();
          ({ tables, relationships } = await parseDBFile(
            uploadedDatabaseBuffer,
          ));
        } else {
          setError(`Unsupported file type: .${ext}`);
          return;
        }

        if (tables.length === 0) {
          setError('No tables found in the file.');
          return;
        }

        addParsedSource(
          tables,
          relationships,
          uploadedDatabaseBuffer,
          file.name,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse file');
      } finally {
        setLoading(false);
      }
    },
    [addParsedSource],
  );

  const clear = useCallback(() => {
    setSources([]);
    setActiveSourceId(null);
    setError(null);
  }, []);

  const selectSource = useCallback((sourceId: string) => {
    setActiveSourceId(sourceId);
    setError(null);
  }, []);

  const loadTableData = useCallback(
    (
      tableName: string,
      page: number,
      pageSize = 100,
      filters: readonly TableDataFilter[] = [],
    ) => {
      if (!activeSource?.databaseBuffer) {
        return Promise.reject(new Error('No database file is loaded.'));
      }

      return readTableDataPage(
        activeSource.databaseBuffer,
        tableName,
        page,
        pageSize,
        filters,
      );
    },
    [activeSource?.databaseBuffer],
  );

  return {
    sources,
    activeSourceId,
    activeSource,
    schema: activeSource?.schema ?? null,
    loading,
    error,
    hasDatabaseData: !!activeSource?.databaseBuffer,
    databaseBuffer: activeSource?.databaseBuffer ?? null,
    databaseInternals: activeSource?.databaseInternals ?? null,
    loadTableData,
    loadFromSQL,
    loadFromFile,
    selectSource,
    clear,
  };
};
