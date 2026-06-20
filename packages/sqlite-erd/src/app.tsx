import { useEffect, useMemo, useState } from 'react';
import {
  LuDatabase as Database,
  LuGitFork as GitFork,
  LuMoon as Moon,
  LuPanelLeft as PanelLeft,
  LuPanelLeftClose as PanelLeftClose,
  LuRotateCcw as RotateCcw,
  LuScanSearch as ScanSearch,
  LuSun as Sun,
} from 'react-icons/lu';
import { DataDrawer } from '@/components/data-drawer.tsx';
import { ERDCanvas } from '@/components/erd-canvas.tsx';
import { FileUploader } from '@/components/file-uploader.tsx';
import { SchemaInput } from '@/components/schema-input.tsx';
import { SQLiteInternalsExplorer } from '@/components/sqlite-internals-explorer.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useSchema } from '@/hooks/use-schema.ts';
import { useTheme } from '@/hooks/use-theme.ts';
import './styles/app.css';

type AppProps = {
  databaseUrl?: string;
  sqlSchema?: string;
  showSidebar?: boolean;
};

type SourceView = 'erd' | 'internals';

export const App = ({
  databaseUrl,
  sqlSchema,
  showSidebar = true,
}: AppProps) => {
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    sources,
    activeSourceId,
    activeSource,
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
    clear,
  } = useSchema({ databaseUrl, sqlSchema });

  const [panelOpen, setPanelOpen] = useState<boolean>(showSidebar);
  const [dataTableName, setDataTableName] = useState<string | null>(null);
  const [dataDrawerCollapsed, setDataDrawerCollapsed] = useState(false);
  const [sourceViews, setSourceViews] = useState<Record<string, SourceView>>(
    {},
  );

  const activeView = activeSource
    ? (sourceViews[activeSource.id] ?? 'erd')
    : 'erd';

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

  useEffect(() => {
    const sourceIds = new Set(sources.map((source) => source.id));

    setSourceViews((current) => {
      const retainedViews = Object.fromEntries(
        Object.entries(current).filter(([sourceId]) => sourceIds.has(sourceId)),
      ) as Record<string, SourceView>;

      return Object.keys(retainedViews).length === Object.keys(current).length
        ? current
        : retainedViews;
    });
  }, [sources]);

  const handleClear = () => {
    setDataTableName(null);
    setDataDrawerCollapsed(false);
    setSourceViews({});
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

  const handleSourceSelect = (sourceId: string) => {
    selectSource(sourceId);
  };

  const handleSourceViewChange = (sourceId: string, view: SourceView) => {
    setSourceViews((current) => ({
      ...current,
      [sourceId]: view,
    }));
    selectSource(sourceId);

    if (view === 'internals') {
      handleDataDrawerClose();
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Side Panel */}
      {showSidebar && (
        <div
          className={`shrink-0 border-r border-border bg-card flex flex-col h-full ${
            panelOpen ? 'w-80' : 'w-12 items-center shadow-xl'
          }`}
        >
          {panelOpen ? (
            <>
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Database
                  size={18}
                  className="text-primary"
                />
                <h1 className="font-semibold text-sm text-foreground">
                  SQL → ERD
                </h1>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Collapse upload panel"
                  title="Collapse upload panel"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {sources.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Databases
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-7 px-2 text-xs"
                      >
                        <RotateCcw
                          size={12}
                          className="mr-1"
                        />
                        Clear
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {sources.map((source) => {
                        const sourceView = sourceViews[source.id] ?? 'erd';
                        const isActive = source.id === activeSourceId;

                        return (
                          <div
                            key={source.id}
                            className={`rounded-xl border p-3 transition-colors ${
                              isActive
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border bg-background/60 hover:border-primary/30'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSourceSelect(source.id)}
                              className="w-full text-left"
                            >
                              <span className="block truncate text-sm font-medium text-foreground">
                                {source.name}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {source.schema.tables.length} tables ·{' '}
                                {source.schema.relationships.length}{' '}
                                relationships
                              </span>
                            </button>

                            <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSourceViewChange(source.id, 'erd')
                                }
                                className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors ${
                                  sourceView === 'erd'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <GitFork size={13} />
                                ERD
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSourceViewChange(source.id, 'internals')
                                }
                                disabled={!source.databaseBuffer}
                                className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                  sourceView === 'internals'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title={
                                  source.databaseBuffer
                                    ? 'Show SQLite internals'
                                    : 'Internals are available for SQLite database files'
                                }
                              >
                                <ScanSearch size={13} />
                                Internals
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <FileUploader
                  onFile={loadFromFile}
                  loading={loading}
                />

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 h-px bg-border" />
                  <span>or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <SchemaInput
                  onParse={loadFromSQL}
                  loading={loading}
                />

                {error && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-xs">
                    {error}
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="mt-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Expand upload panel"
              title="Expand upload panel"
            >
              <PanelLeft size={16} />
            </button>
          )}
        </div>
      )}

      {/* Main Canvas */}
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
