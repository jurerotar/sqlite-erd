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

export const parseDBFile = async (
  buffer: ArrayBuffer,
): Promise<{ tables: Table[]; relationships: Relationship[] }> => {
  const sqlite3 = await getSqlite3();
  const oo = sqlite3.oo1;
  const p = sqlite3.wasm.allocFromTypedArray(buffer);

  try {
    const filename = `/input_${Date.now()}.sqlite3`;

    // Write to virtual filesystem
    try {
      sqlite3.capi.sqlite3_js_posix_create_file(
        filename,
        new Uint8Array(buffer),
      );
    } catch (e) {
      throw new Error(
        `Could not create virtual file in SQLite WASM: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const inputDb = new oo.DB(filename, 'r');

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

        // 2. Get columns for each table
        const tableInfo = inputDb.exec(`PRAGMA table_info("${tableName}")`, {
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
        const fkList = inputDb.exec(`PRAGMA foreign_key_list("${tableName}")`, {
          returnValue: 'resultRows',
          rowMode: 'object',
        });

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
        const indexList = inputDb.exec(`PRAGMA index_list("${tableName}")`, {
          returnValue: 'resultRows',
          rowMode: 'object',
        });

        for (const idx of indexList) {
          const indexName = String(idx.name);
          const indexInfo = inputDb.exec(`PRAGMA index_info("${indexName}")`, {
            returnValue: 'resultRows',
            rowMode: 'object',
          });

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
  } finally {
    sqlite3.wasm.dealloc(p);
  }
};
