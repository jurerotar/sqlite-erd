import { describe, expect, it } from 'vitest';
import { parseSQLStatements } from '../sql-parser';

describe('sql-parser', () => {
  it('should parse basic CREATE TABLE statements', () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;
    const { tables, relationships } = parseSQLStatements(sql);

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('users');
    expect(tables[0].columns).toHaveLength(2);
    expect(tables[0].columns[0].name).toBe('id');
    expect(tables[0].columns[0].isPrimaryKey).toBe(true);
    expect(tables[0].columns[1].name).toBe('name');
    expect(tables[0].columns[1].isNotNull).toBe(true);
    expect(relationships).toHaveLength(0);
  });

  it('should parse table-level PRIMARY KEY', () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER,
        name TEXT,
        PRIMARY KEY (id)
      );
    `;
    const { tables } = parseSQLStatements(sql);
    expect(tables[0].columns.find((c) => c.name === 'id')?.isPrimaryKey).toBe(
      true,
    );
  });

  it('should parse inline REFERENCES', () => {
    const sql = `
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER REFERENCES users(id)
      );
      CREATE TABLE users (
        id INTEGER PRIMARY KEY
      );
    `;
    const { tables, relationships } = parseSQLStatements(sql);

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      sourceTable: 'posts',
      sourceColumn: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
      type: 'explicit',
    });

    const postsTable = tables.find((t) => t.name === 'posts');
    const userIdCol = postsTable?.columns.find((c) => c.name === 'user_id');
    expect(userIdCol?.isForeignKey).toBe(true);
    expect(userIdCol?.references).toEqual({ table: 'users', column: 'id' });
  });

  it('should parse table-level FOREIGN KEY', () => {
    const sql = `
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        u_id INTEGER,
        FOREIGN KEY (u_id) REFERENCES users (id)
      );
      CREATE TABLE users (id INTEGER PRIMARY KEY);
    `;
    const { relationships } = parseSQLStatements(sql);
    expect(relationships).toHaveLength(1);
    expect(relationships[0].sourceColumn).toBe('u_id');
    expect(relationships[0].targetTable).toBe('users');
  });

  it('should handle comments', () => {
    const sql = `
      -- This is a comment
      CREATE TABLE users (
        id INTEGER PRIMARY KEY /* another comment */
      );
    `;
    const { tables } = parseSQLStatements(sql);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('users');
  });

  it('should handle balanced parentheses in column types', () => {
    const sql = `
      CREATE TABLE test (
        val DECIMAL(10, 2)
      );
    `;
    const { tables } = parseSQLStatements(sql);
    expect(tables[0].columns[0].type).toBe('DECIMAL(10, 2)');
  });

  it('should handle CONSTRAINT keyword', () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER,
        CONSTRAINT pk_users PRIMARY KEY (id)
      );
    `;
    const { tables } = parseSQLStatements(sql);
    expect(tables[0].columns[0].isPrimaryKey).toBe(true);
  });

  it('should handle multiple table-level constraints', () => {
    const sql = `
      CREATE TABLE roles (
        id INTEGER,
        name TEXT,
        PRIMARY KEY (id),
        UNIQUE (name)
      );
    `;
    const { tables } = parseSQLStatements(sql);
    expect(tables[0].columns.find((c) => c.name === 'id')?.isPrimaryKey).toBe(
      true,
    );
    expect(tables[0].columns.find((c) => c.name === 'name')?.isUnique).toBe(
      true,
    );
  });

  it('should parse real-world schema features', () => {
    const sql = `
      CREATE TABLE bookmarks
      (
        village_id INTEGER NOT NULL,
        building_id INTEGER NOT NULL,
        tab_name TEXT NOT NULL,
        PRIMARY KEY (village_id, building_id),
        FOREIGN KEY (village_id) REFERENCES villages (id),
        FOREIGN KEY (building_id) REFERENCES building_ids (id)
      ) STRICT, WITHOUT ROWID;

      CREATE TABLE events
      (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        starts_at INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        resolves_at INTEGER GENERATED ALWAYS AS (starts_at + duration) STORED,
        village_id INTEGER DEFAULT NULL,
        meta TEXT DEFAULT NULL
      ) STRICT;

      CREATE TABLE villages (id INTEGER PRIMARY KEY);
      CREATE TABLE building_ids (id INTEGER PRIMARY KEY);
    `;
    const { tables, relationships } = parseSQLStatements(sql);

    const bookmarks = tables.find((t) => t.name === 'bookmarks');
    expect(bookmarks).toBeDefined();
    expect(
      bookmarks?.columns.find((c) => c.name === 'village_id')?.isPrimaryKey,
    ).toBe(true);
    expect(
      bookmarks?.columns.find((c) => c.name === 'building_id')?.isPrimaryKey,
    ).toBe(true);

    expect(relationships).toContainEqual(
      expect.objectContaining({
        sourceTable: 'bookmarks',
        sourceColumn: 'village_id',
        targetTable: 'villages',
        targetColumn: 'id',
      }),
    );

    const events = tables.find((t) => t.name === 'events');
    expect(events?.columns.find((c) => c.name === 'resolves_at')).toBeDefined();
    // resolves_at should be parsed even if it has GENERATED ALWAYS AS
    // Note: our current parser might need adjustment if it doesn't handle GENERATED ALWAYS AS correctly
  });

  it('should not mark columns as FK based on name alone if no constraint exists', () => {
    const sql = `
      CREATE TABLE quests
      (
        id INTEGER PRIMARY KEY,
        quest_id TEXT NOT NULL,
        village_id INTEGER,
        CONSTRAINT fk_quests_village FOREIGN KEY (village_id)
          REFERENCES villages (id) ON DELETE SET NULL
      ) STRICT;

      CREATE TABLE villages (id INTEGER PRIMARY KEY);
    `;
    const { tables } = parseSQLStatements(sql);
    const quests = tables.find((t) => t.name === 'quests');
    const questIdCol = quests?.columns.find((c) => c.name === 'quest_id');
    const villageIdCol = quests?.columns.find((c) => c.name === 'village_id');

    expect(questIdCol?.isForeignKey).toBe(false);
    expect(villageIdCol?.isForeignKey).toBe(true);
  });

  it('should parse temporary tables', () => {
    const sql = `
      CREATE TEMP TABLE temp_users (id INTEGER);
      CREATE TEMPORARY TABLE temp_posts (id INTEGER);
    `;
    const { tables } = parseSQLStatements(sql);

    expect(tables).toHaveLength(2);
    expect(tables[0].name).toBe('temp_users');
    expect(tables[0].isTemporary).toBe(true);
    expect(tables[1].name).toBe('temp_posts');
    expect(tables[1].isTemporary).toBe(true);
  });

  it('should not mark regular tables as temporary', () => {
    const sql = `
      CREATE TABLE regular_users (id INTEGER);
    `;
    const { tables } = parseSQLStatements(sql);

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('regular_users');
    expect(tables[0].isTemporary).toBe(false);
  });

  it('should parse CREATE INDEX statements', () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL,
        username TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT
      );
      CREATE UNIQUE INDEX idx_users_email ON users (email);
      CREATE INDEX idx_users_name ON users (last_name, first_name);
    `;
    const { tables } = parseSQLStatements(sql);
    const users = tables.find((t) => t.name === 'users');

    expect(users?.indexes).toHaveLength(2);
    expect(users?.indexes[0]).toMatchObject({
      name: 'idx_users_email',
      columns: ['email'],
      isUnique: true,
    });
    expect(users?.indexes[1]).toMatchObject({
      name: 'idx_users_name',
      columns: ['last_name', 'first_name'],
      isUnique: false,
    });

    const emailCol = users?.columns.find((c) => c.name === 'email');
    const firstNameCol = users?.columns.find((c) => c.name === 'first_name');
    const lastNameCol = users?.columns.find((c) => c.name === 'last_name');

    expect(emailCol?.isIndexed).toBe(true);
    expect(firstNameCol?.isIndexed).toBe(true);
    expect(lastNameCol?.isIndexed).toBe(true);
  });
});
