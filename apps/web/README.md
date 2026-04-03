# web

A demo web application for visualizing SQLite schemas using the `sqlite-erd` component.

## Features

- **Local First & Privacy Focused:** Your SQL files and database schemas are processed entirely in the browser. No data ever leaves your computer.
- **File Upload:** Load a `.sql` with `CREATE TABLE` statements or a SQLite database file (`.db`, `.sqlite`, `.sqlite3`, `.s3db`, `.sl3`) directly into the browser.
- **SQL Editor:** Paste `CREATE TABLE` statements to generate diagrams on the fly.
- **Interactive Canvas:** Zoom, pan, and move tables to organize your diagram.
- **Dark Mode:** Built-in support for both light and dark themes.

## Getting Started

### Installation

Ensure you have installed dependencies at the root of the monorepo:

```bash
npm install
```

### Development

Run the web application in development mode:

```bash
turbo run dev
```

### Building

Build the application for production:

```bash
npm run build
```

## Technologies Used

- [Vite](https://vitejs.dev/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [SQLite WASM](https://sqlite.org/wasm)
- [@xyflow/react](https://reactflow.dev/) (React Flow)
