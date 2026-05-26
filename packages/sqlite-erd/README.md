# sqlite-erd

A React component library for generating Entity Relationship Diagrams (ERD) from SQLite schemas or database files.

## Features

- **Local First & Privacy Focused:** All SQLite parsing and diagram generation is done client-side. No sensitive schema data is ever sent to a server.
- **Schema Parsing:** Supports both standard SQL `CREATE TABLE` statements (via `.sql` files or text) and raw SQLite database files (`.db`, `.sqlite`, `.sqlite3`, `.s3db`, `.sl3`).
- **Interactive Canvas:** High-performance diagram canvas powered by [React Flow](https://reactflow.dev/).
- **Table Data Drawer:** Click tables from uploaded SQLite database files to browse rows in a paginated drawer.
- **SQLite Internals Explorer:** Inspect database headers, pages, b-tree structures, cells, record previews, and classified hex data.
- **Relationship Detection:** Visualizes explicit foreign keys and inferred table relationships.
- **Collapsible Workspace:** Collapse the upload panel and table data drawer to focus on the diagram.
- **Theming:** Full support for light and dark modes.
- **Customizable:** Show or hide the sidebar and provide initial SQL schemas or a database URL.

## Installation

```bash
npm install sqlite-erd
```

## Usage

Import the `SQLiteERD` component and its CSS:

```tsx
import { SQLiteERD } from 'sqlite-erd';
import 'sqlite-erd/sqlite-erd.css';

function MyDiagram() {
  const sql = `
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY,
      project_id INTEGER,
      title TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `;

  return (
    <div style={{ height: '500px' }}>
      <SQLiteERD sqlSchema={sql} showSidebar={true} />
    </div>
  );
}
```

You can also preload a SQLite database file by URL:

```tsx
<SQLiteERD databaseUrl="/sample-database.sqlite3" showSidebar={true} />
```

### Usage with Vite

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const viteConfig = defineConfig({
  resolve: {
    // Make sure to include this alias to prevent loading multiple versions of `react` and `react-dom`.
    // Update the path to match your repository structure.
    alias: {
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
    },
  },
});

export default viteConfig;

```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `databaseUrl` | `string` | `undefined` | Optional SQLite database file URL to load on startup. |
| `sqlSchema` | `string` | `undefined` | Optional initial SQL schema string to parse. |
| `showSidebar` | `boolean` | `true` | Whether to display the left-hand panel for uploading files and editing schemas. |

## Development

The package is built with `tsdown`.

To run tests:
```bash
turbo run test
```

To build:
```bash
turbo run build
```

To watch for changes:
```bash
turbo run dev
```

## License
MIT
