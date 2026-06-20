import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Column, Index, Relationship, Table } from './schema-types';

let sqlite3Promise: Promise<Sqlite3Static> | null = null;

const getSqlite3 = () => {
  if (!sqlite3Promise) {
    sqlite3Promise = sqlite3InitModule();
  }
  return sqlite3Promise;
};

const createInputDb = (sqlite3: Sqlite3Static, buffer: ArrayBuffer) => {
  const filename = `/input_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite3`;

  try {
    sqlite3.capi.sqlite3_js_posix_create_file(filename, new Uint8Array(buffer));
  } catch (e) {
    throw new Error(
      `Could not create virtual file in SQLite WASM: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return new sqlite3.oo1.DB(filename, 'r');
};

const quoteIdentifier = (identifier: string) =>
  `"${identifier.replaceAll('"', '""')}"`;

const escapeLikePattern = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');

const dataFilterExpression = (columnName: string) => {
  const columnIdentifier = quoteIdentifier(columnName);

  return [
    'CASE',
    `WHEN ${columnIdentifier} IS NULL THEN 'NULL'`,
    `WHEN typeof(${columnIdentifier}) = 'blob' THEN 'BLOB (' || length(${columnIdentifier}) || ' bytes)'`,
    `ELSE CAST(${columnIdentifier} AS TEXT)`,
    'END',
  ].join(' ');
};

export const tableDataRowKey = '\0sqliteErdRowKey';

export const parseDBFile = async (
  buffer: ArrayBuffer,
): Promise<{ tables: Table[]; relationships: Relationship[] }> => {
  const sqlite3 = await getSqlite3();
  const inputDb = createInputDb(sqlite3, buffer);

  try {
    const tables: Table[] = [];
    const relationships: Relationship[] = [];

    // 1. Get all tables
    const tableRows = inputDb.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      { returnValue: 'resultRows' },
    );

    for (const row of tableRows) {
      const tableName = row[0] as string;
      const columns: Column[] = [];
      const indexes: Index[] = [];
      const tableIdentifier = quoteIdentifier(tableName);

      // 2. Get columns for each table
      const tableInfo = inputDb.exec(`PRAGMA table_info(${tableIdentifier})`, {
        returnValue: 'resultRows',
        rowMode: 'object',
      });

      for (const col of tableInfo) {
        columns.push({
          name: String(col.name),
          type: col.type ? String(col.type).toUpperCase() : 'ANY',
          isPrimaryKey: !!col.pk,
          isNotNull: !!col.notnull,
          isUnique: false, // Will be updated by index check
          isIndexed: false, // Will be updated by index check
          isForeignKey: false, // Will be updated by foreign key check
        });
      }

      // 3. Get foreign keys
      const fkList = inputDb.exec(
        `PRAGMA foreign_key_list(${tableIdentifier})`,
        {
          returnValue: 'resultRows',
          rowMode: 'object',
        },
      );

      for (const fk of fkList) {
        const fromCol = String(fk.from);
        const toCol = String(fk.to);
        const targetTable = String(fk.table);

        const col = columns.find((c) => c.name === fromCol);
        if (col) {
          col.isForeignKey = true;
          col.references = {
            table: targetTable,
            column: toCol,
          };
        }

        relationships.push({
          id: `${tableName}.${fromCol}->${targetTable}.${toCol}`,
          sourceTable: tableName,
          sourceColumn: fromCol,
          targetTable: targetTable,
          targetColumn: toCol,
          type: 'explicit',
        });
      }

      // 4. Get indexes
      const indexList = inputDb.exec(`PRAGMA index_list(${tableIdentifier})`, {
        returnValue: 'resultRows',
        rowMode: 'object',
      });

      for (const idx of indexList) {
        const indexName = String(idx.name);
        const indexInfo = inputDb.exec(
          `PRAGMA index_info(${quoteIdentifier(indexName)})`,
          {
            returnValue: 'resultRows',
            rowMode: 'object',
          },
        );

        const indexCols = indexInfo.map((row) => String(row.name));
        indexes.push({
          name: indexName,
          columns: indexCols,
          isUnique: !!idx.unique,
        });

        // Update column flags
        for (const colName of indexCols) {
          const col = columns.find((c) => c.name === colName);
          if (col) {
            col.isIndexed = true;
            if (idx.unique && indexCols.length === 1) {
              col.isUnique = true;
            }
          }
        }
      }

      tables.push({
        name: tableName as string,
        columns,
        indexes,
      });
    }

    return { tables, relationships };
  } finally {
    inputDb.close();
  }
};

export interface TableDataPage {
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
}

export interface TableDataFilter {
  column: string;
  value: string;
}

export const readTableDataPage = async (
  buffer: ArrayBuffer,
  tableName: string,
  page: number,
  pageSize = 100,
  filters: readonly TableDataFilter[] = [],
): Promise<TableDataPage> => {
  const sqlite3 = await getSqlite3();
  const inputDb = createInputDb(sqlite3, buffer);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const safePage = Math.max(page, 1);
  const offset = (safePage - 1) * safePageSize;
  const tableIdentifier = quoteIdentifier(tableName);
  const activeFilters = filters
    .map((filter) => ({
      column: filter.column,
      value: filter.value.trim(),
    }))
    .filter((filter) => filter.value.length > 0);
  const whereClause =
    activeFilters.length > 0
      ? ` WHERE ${activeFilters
          .map(
            (filter) =>
              `lower(${dataFilterExpression(filter.column)}) LIKE lower(?) ESCAPE '\\'`,
          )
          .join(' AND ')}`
      : '';
  const filterBindings = activeFilters.map(
    (filter) => `%${escapeLikePattern(filter.value)}%`,
  );

  try {
    const countRows = inputDb.exec({
      sql: `SELECT COUNT(*) AS count FROM ${tableIdentifier}${whereClause}`,
      bind: filterBindings,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const totalRows = Number(countRows[0]?.count ?? 0);
    const resultRows = inputDb.exec({
      sql: `SELECT * FROM ${tableIdentifier}${whereClause} LIMIT ? OFFSET ?`,
      bind: [...filterBindings, safePageSize, offset],
      returnValue: 'resultRows',
      rowMode: 'object',
    }) as Record<string, unknown>[];
    const rows = resultRows.map((row, index) => ({
      ...row,
      [tableDataRowKey]: offset + index,
    }));

    return {
      rows,
      totalRows,
      page: safePage,
      pageSize: safePageSize,
    };
  } finally {
    inputDb.close();
  }
};
