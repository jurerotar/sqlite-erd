import { describe, expect, it } from 'vitest';
import { detectInferredRelationships } from '../relationship-detector';
import type { Relationship, Table } from '../schema-types';

describe('detectInferredRelationships', () => {
  const usersTable: Table = {
    name: 'users',
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        isPrimaryKey: true,
        isForeignKey: false,
        isNotNull: true,
        isUnique: true,
        isIndexed: false,
      },
      {
        name: 'name',
        type: 'TEXT',
        isPrimaryKey: false,
        isForeignKey: false,
        isNotNull: true,
        isUnique: false,
        isIndexed: false,
      },
    ],
    indexes: [],
  };

  it('should infer snake_case relationships (user_id -> users.id)', () => {
    const postsTable: Table = {
      name: 'posts',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          isPrimaryKey: true,
          isForeignKey: false,
          isNotNull: true,
          isUnique: true,
          isIndexed: false,
        },
        {
          name: 'user_id',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };

    const inferred = detectInferredRelationships([usersTable, postsTable], []);
    expect(inferred).toHaveLength(1);
    expect(inferred[0]).toEqual({
      id: 'posts.user_id->users.id',
      sourceTable: 'posts',
      sourceColumn: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
      type: 'inferred',
    });
  });

  it('should infer camelCase relationships (userId -> users.id)', () => {
    const postsTable: Table = {
      name: 'posts',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          isPrimaryKey: true,
          isForeignKey: false,
          isNotNull: true,
          isUnique: true,
          isIndexed: false,
        },
        {
          name: 'userId',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };

    const inferred = detectInferredRelationships([usersTable, postsTable], []);
    expect(inferred).toHaveLength(1);
    expect(inferred[0].targetTable).toBe('users');
  });

  it('should infer singular table names (user_id -> user.id)', () => {
    const userTable: Table = {
      name: 'user',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          isPrimaryKey: true,
          isForeignKey: false,
          isNotNull: true,
          isUnique: true,
          isIndexed: false,
        },
      ],
      indexes: [],
    };
    const postsTable: Table = {
      name: 'posts',
      columns: [
        {
          name: 'user_id',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };

    const inferred = detectInferredRelationships([userTable, postsTable], []);
    expect(inferred).toHaveLength(1);
    expect(inferred[0].targetTable).toBe('user');
  });

  it('should not infer if column is already a PK or FK', () => {
    const postsTable: Table = {
      name: 'posts',
      columns: [
        {
          name: 'user_id',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: true,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };

    const inferred = detectInferredRelationships([usersTable, postsTable], []);
    expect(inferred).toHaveLength(0);
  });

  it('should not infer if target table does not exist', () => {
    const postsTable: Table = {
      name: 'posts',
      columns: [
        {
          name: 'author_id',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };

    const inferred = detectInferredRelationships([usersTable, postsTable], []);
    expect(inferred).toHaveLength(0);
  });

  it('should not infer if target table has no id column', () => {
    const authorsTable: Table = {
      name: 'authors',
      columns: [
        {
          name: 'uuid',
          type: 'TEXT',
          isPrimaryKey: true,
          isForeignKey: false,
          isNotNull: true,
          isUnique: true,
          isIndexed: false,
        },
      ],
      indexes: [],
    };
    const postsTable: Table = {
      name: 'posts',
      columns: [
        {
          name: 'author_id',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };

    const inferred = detectInferredRelationships(
      [authorsTable, postsTable],
      [],
    );
    expect(inferred).toHaveLength(0);
  });

  it('should not infer if relationship already exists explicitly', () => {
    const postsTable: Table = {
      name: 'posts',
      columns: [
        {
          name: 'user_id',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };
    const explicit: Relationship[] = [
      {
        id: 'posts.user_id->users.id',
        sourceTable: 'posts',
        sourceColumn: 'user_id',
        targetTable: 'users',
        targetColumn: 'id',
        type: 'explicit',
      },
    ];

    const inferred = detectInferredRelationships(
      [usersTable, postsTable],
      explicit,
    );
    expect(inferred).toHaveLength(0);
  });

  it('should not infer relationship if target table is the same table (unless it is explicitly allowed)', () => {
    const categoriesTable: Table = {
      name: 'categories',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          isPrimaryKey: true,
          isForeignKey: false,
          isNotNull: true,
          isUnique: true,
          isIndexed: false,
        },
        {
          name: 'parent_id',
          type: 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: false,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };
    // Current implementation of guessTarget('parent_id') would look for 'parents' or 'parent'.
    // It wouldn't find 'categories'.
    const inferred = detectInferredRelationships([categoriesTable], []);
    expect(inferred).toHaveLength(0);
  });

  it('should not infer relationship if it does not match a table', () => {
    const questsTable: Table = {
      name: 'quests',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          isPrimaryKey: true,
          isForeignKey: false,
          isNotNull: true,
          isUnique: true,
          isIndexed: false,
        },
        {
          name: 'quest_id',
          type: 'TEXT',
          isPrimaryKey: false,
          isForeignKey: false,
          isNotNull: true,
          isUnique: false,
          isIndexed: false,
        },
      ],
      indexes: [],
    };
    // guessTarget('quest_id') will look for 'quests' or 'quest'.
    // 'quests' exists.
    // However, it's the SAME table.
    // Wait, let's see if guessTarget returns 'quests' and if detectInferredRelationships handles self-reference.
    const inferred = detectInferredRelationships([questsTable], []);
    expect(inferred).toHaveLength(0); // Should be 0 because quest_id -> quests.id is a self-reference and we might want to avoid inferring those or it might already be avoided.
  });
});
