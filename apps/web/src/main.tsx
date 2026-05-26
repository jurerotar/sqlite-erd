import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { SQLiteERD } from 'sqlite-erd';
import sampleDatabaseUrl from '@/sql/sample-database.sqlite3?url';
import 'sqlite-erd/sqlite-erd.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SQLiteERD
      databaseUrl={sampleDatabaseUrl}
      showSidebar
    />
  </StrictMode>,
);
