# SQLite ERD

A React-based Entity Relationship Diagram (ERD) generator for SQLite databases. Transform your SQL schemas or database files into interactive, visual diagrams.

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
  <img src=".github/assets/2026-05-26%2013.36.37%20localhost%20157e881256cc.jpg" alt="SQLite ERD schema editor" />
  <img src=".github/assets/2026-05-26%2013.36.13%20localhost%20db7cf264ff76.jpg" alt="SQLite ERD diagram view" />
  <img src=".github/assets/2026-05-26%2013.36.49%20localhost%203162660f8f79.jpg" alt="SQLite ERD table data drawer" />
</div>

## Use Case

Visualizing complex database schemas can be challenging. `sqlite-erd` helps developers:
- Understand existing database structures quickly.
- Document schemas for team collaboration.
- Debug relationship issues by visualizing foreign key constraints.
- Explore SQLite database files without needing a full-blown database manager.

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
