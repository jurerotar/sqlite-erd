import { useEffect, useMemo, useState } from 'react';
import {
  LuDatabase as Database,
  LuMoon as Moon,
  LuSun as Sun,
} from 'react-icons/lu';
import { AppSidebar } from '@/components/app-sidebar.tsx';
import { DataDrawer } from '@/components/data-drawer.tsx';
import { ERDCanvas } from '@/components/erd-canvas.tsx';
import { SQLiteInternalsExplorer } from '@/components/sqlite-internals-explorer.tsx';
import { useSchema } from '@/hooks/use-schema.ts';
import { type SourceView, useSourceViews } from '@/hooks/use-source-views.ts';
import { useTheme } from '@/hooks/use-theme.ts';
import './styles/app.css';

type AppProps = {
  databaseUrl?: string;
  sqlSchema?: string;
  showSidebar?: boolean;
};

export const App = ({
  databaseUrl,
  sqlSchema,
  showSidebar = true,
}: AppProps) => {
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    sources,
    activeSourceId,
    schema,
    loading,
    error,
    hasDatabaseData,
    databaseBuffer,
    databaseInternals,
    loadTableData,
    loadFromSQL,
    loadFromFile,
    selectSource,
    removeSource,
    clear,
  } = useSchema({ databaseUrl, sqlSchema });

  const [panelOpen, setPanelOpen] = useState<boolean>(showSidebar);
  const [dataTableName, setDataTableName] = useState<string | null>(null);
  const [dataDrawerCollapsed, setDataDrawerCollapsed] = useState(false);
  const { activeView, sourceViews, resetSourceViews, setSourceView } =
    useSourceViews(sources, activeSourceId);

  const selectedDataTable = useMemo(
    () => schema?.tables.find((table) => table.name === dataTableName) ?? null,
    [schema, dataTableName],
  );

  useEffect(() => {
    if (!activeSourceId) {
      return;
    }

    setDataTableName(null);
    setDataDrawerCollapsed(false);
  }, [activeSourceId]);

  const handleClear = () => {
    setDataTableName(null);
    setDataDrawerCollapsed(false);
    resetSourceViews();
    clear();
  };

  const handleDataDrawerClose = () => {
    setDataTableName(null);
    setDataDrawerCollapsed(false);
  };

  const handleTableClick = (tableName: string) => {
    if (!dataDrawerCollapsed) {
      setDataTableName(tableName);
    }
  };

  const handleSourceViewChange = (sourceId: string, view: SourceView) => {
    setSourceView(sourceId, view);
    selectSource(sourceId);

    if (view === 'internals') {
      handleDataDrawerClose();
    }
  };

  const handleSourceDelete = (sourceId: string) => {
    if (sourceId === activeSourceId) {
      handleDataDrawerClose();
    }

    removeSource(sourceId);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {showSidebar && (
        <AppSidebar
          activeSourceId={activeSourceId}
          error={error}
          loading={loading}
          panelOpen={panelOpen}
          sources={sources}
          sourceViews={sourceViews}
          onClear={handleClear}
          onCollapsePanel={() => setPanelOpen(false)}
          onExpandPanel={() => setPanelOpen(true)}
          onFile={loadFromFile}
          onParseSQL={loadFromSQL}
          onSourceDelete={handleSourceDelete}
          onSourceSelect={selectSource}
          onSourceViewChange={handleSourceViewChange}
        />
      )}

      <div className="flex-1 relative">
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute top-4 right-4 z-10 bg-card border border-border rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
          title={
            theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {schema ? (
          <>
            {activeView === 'internals' &&
            databaseBuffer &&
            databaseInternals ? (
              <SQLiteInternalsExplorer
                buffer={databaseBuffer}
                internals={databaseInternals}
              />
            ) : (
              <ERDCanvas
                key={activeSourceId ?? 'schema'}
                schema={schema}
                onTableClick={hasDatabaseData ? handleTableClick : undefined}
              />
            )}
            {hasDatabaseData && activeView === 'erd' && (
              <DataDrawer
                collapsed={dataDrawerCollapsed}
                table={selectedDataTable}
                loadTableData={loadTableData}
                onCollapse={() => setDataDrawerCollapsed(true)}
                onClose={handleDataDrawerClose}
                onExpand={() => setDataDrawerCollapsed(false)}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Database
                size={48}
                className="mx-auto text-muted-foreground/30"
              />
              <p className="text-muted-foreground text-sm">
                Upload a schema or paste SQL to generate an ERD
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
