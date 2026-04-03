import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { SQLiteERD } from 'sqlite-erd';
import sampleSchema from '@/sql/sample-schema.sql?raw';
import 'sqlite-erd/sqlite-erd.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SQLiteERD
      sqlSchema={sampleSchema}
      showSidebar
    />
  </StrictMode>,
);
