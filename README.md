# SQLite ERD

A React-based Entity Relationship Diagram (ERD) generator for SQLite databases. Transform your SQL schemas or database files into interactive, visual diagrams.

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
  <img src=".github/assets/2026-05-26%2013.36.13%20localhost%20db7cf264ff76.jpg" alt="SQLite ERD diagram view" />
  <img src=".github/assets/2026-05-26%2013.36.37%20localhost%20157e881256cc.jpg" alt="SQLite ERD schema editor" />
  <img src=".github/assets/2026-05-26%2013.36.49%20localhost%203162660f8f79.jpg" alt="SQLite ERD table data drawer" />
</div>

## Features

- **SQL schema parsing:** Paste SQL or upload `.sql` files with `CREATE TABLE` statements to generate an ERD.
- **SQLite database inspection:** Upload SQLite database files (`.db`, `.sqlite`, `.sqlite3`, `.s3db`, `.sl3`) and inspect the schema directly in the browser.
- **Interactive ERD canvas:** Pan, zoom, and explore table relationships on a React Flow-powered diagram.
- **Table data drawer:** Click tables from uploaded database files to browse rows in a paginated drawer.
- **SQLite internals explorer:** Inspect database headers, pages, b-tree structures, cells, record previews, and a classified hex view.
- **Relationship detection:** Visualize explicit foreign keys and inferred table relationships.
- **Collapsible workspace:** Collapse the upload panel and table data drawer to keep focus on the diagram.
- **Light and dark modes:** Switch themes from the canvas toolbar.
- **Local first:** Parsing, inspection, and rendering happen in the browser.

## Use Case

Visualizing complex database schemas can be challenging. `sqlite-erd` helps developers:
- Understand existing database structures quickly.
- Document schemas for team collaboration.
- Debug relationship issues by visualizing foreign key constraints.
- Explore SQLite database files without needing a full-blown database manager.
- Inspect table rows and SQLite file internals while keeping data local.

## Local First & Privacy Focused

`sqlite-erd` is designed with privacy in mind:
- **Local First:** All SQL parsing and diagram generation happen directly in your browser.
- **Privacy Focused:** Your database schemas and files are never uploaded to any server.
- **No Data Leaves the Browser:** All processing is done client-side, ensuring your sensitive data stays on your machine.

## How to Use

### Web Application (Demo)
You can use the built-in web application to visualize your schemas:
1. Upload a `.sql` file with `CREATE TABLE` statements or a SQLite database file (e.g., `.db`, `.sqlite`, `.sqlite3`, `.s3db`, `.sl3`).
2. Or paste your SQL `CREATE TABLE` statements directly into the editor.
3. For SQLite database files, click a table in the ERD to browse its rows or switch to the internals view to inspect pages and hex data.

### As a Library
You can also integrate the `SQLiteERD` component into your own React projects.

```bash
npm install sqlite-erd
```

```tsx
import { SQLiteERD } from 'sqlite-erd';
import 'sqlite-erd/sqlite-erd.css';

const mySqlSchema = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL
  );
`;

const App = () => {
  return (
    <SQLiteERD sqlSchema={mySqlSchema} showSidebar />
  );
};
```

You can also preload a SQLite database file by URL:

```tsx
<SQLiteERD databaseUrl="/sample-database.sqlite3" showSidebar />
```

## Project Structure

This is a monorepo managed by [Turbo](https://turbo.build/):
- `apps/web`: A demo web application built with Vite and React.
- `packages/sqlite-erd`: The core React component library.

## Getting Started

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development environment:
   ```bash
   turbo run dev
   ```

## License
MIT
