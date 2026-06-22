import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  parseDBFile,
  readTableDataPage,
  type TableDataFilter,
} from '@/lib/db-parser';
import { detectInferredRelationships } from '@/lib/relationship-detector';
import type { Relationship, Schema, Table } from '@/lib/schema-types';
import {
  clearPersistedSourceState,
  loadPersistedSourceState,
  removePersistedSource,
  savePersistedSourceState,
} from '@/lib/source-persistence';
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

type SchemaSourceState = {
  sources: SchemaSource[];
  activeSourceId: string | null;
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
  const [sourceState, setSourceState] = useState<SchemaSourceState>({
    sources: [],
    activeSourceId: null,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const sourceSequence = useRef(1);

  const activeSource = useMemo(
    () =>
      sourceState.sources.find(
        (source) => source.id === sourceState.activeSourceId,
      ) ?? null,
    [sourceState],
  );

  const createPastedSqlName = useCallback(() => {
    const name = `Pasted SQL ${sourceSequence.current}`;
    sourceSequence.current += 1;

    return name;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSources = async () => {
      try {
        const restoredState = await loadPersistedSourceState();

        if (cancelled || !restoredState) {
          return;
        }

        setSourceState({
          activeSourceId: restoredState.activeSourceId,
          sources: restoredState.sources.map((source) => ({
            ...source,
            databaseInternals: source.databaseBuffer
              ? parseSQLiteFileInternals(source.databaseBuffer)
              : null,
          })),
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? `Failed to restore persisted databases: ${e.message}`
              : 'Failed to restore persisted databases',
          );
        }
      } finally {
        if (!cancelled) {
          setPersistenceReady(true);
        }
      }
    };

    void restoreSources();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistenceReady) {
      return;
    }

    void savePersistedSourceState(sourceState).catch((e) => {
      setError(
        e instanceof Error
          ? `Failed to persist databases: ${e.message}`
          : 'Failed to persist databases',
      );
    });
  }, [persistenceReady, sourceState]);

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

      setSourceState((current) => {
        if (sourceKey) {
          const existing = current.sources.find(
            (item) => item.sourceKey === sourceKey,
          );

          if (existing) {
            return {
              ...current,
              activeSourceId: existing.id,
            };
          }
        }

        return {
          sources: [...current.sources, source],
          activeSourceId: source.id,
        };
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
    if (!persistenceReady) {
      return undefined;
    }

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
            setError(`Failed to load database: ${response.status}`);
            return;
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

      void loadInitialDatabase();

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
  }, [databaseUrl, sqlSchema, addParsedSource, persistenceReady]);

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
    for (const source of sourceState.sources) {
      void removePersistedSource(source.id);
    }
    void clearPersistedSourceState();

    setSourceState({
      sources: [],
      activeSourceId: null,
    });
    setError(null);
  }, [sourceState.sources]);

  const removeSource = useCallback((sourceId: string) => {
    void removePersistedSource(sourceId);

    setSourceState((current) => {
      const sourceIndex = current.sources.findIndex(
        (source) => source.id === sourceId,
      );

      if (sourceIndex === -1) {
        return current;
      }

      const sources = current.sources.filter(
        (source) => source.id !== sourceId,
      );
      const activeSourceId =
        current.activeSourceId === sourceId
          ? (sources[sourceIndex]?.id ?? sources[sourceIndex - 1]?.id ?? null)
          : current.activeSourceId;

      return {
        sources,
        activeSourceId,
      };
    });
    setError(null);
  }, []);

  const selectSource = useCallback((sourceId: string) => {
    setSourceState((current) => {
      if (current.activeSourceId === sourceId) {
        return current;
      }

      return {
        ...current,
        activeSourceId: sourceId,
      };
    });
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
    sources: sourceState.sources,
    activeSourceId: sourceState.activeSourceId,
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
    removeSource,
    clear,
  };
};
