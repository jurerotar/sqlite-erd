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

export const App = ({
  databaseUrl,
  sqlSchema,
  showSidebar = true,
}: AppProps) => {
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    schema,
    loading,
    error,
    hasDatabaseData,
    databaseBuffer,
    databaseInternals,
    loadTableData,
    loadFromSQL,
    loadFromFile,
    clear,
  } = useSchema({ databaseUrl, sqlSchema });

  const [panelOpen, setPanelOpen] = useState<boolean>(showSidebar);
  const [dataTableName, setDataTableName] = useState<string | null>(null);
  const [dataDrawerCollapsed, setDataDrawerCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'erd' | 'internals'>('erd');

  const selectedDataTable = useMemo(
    () => schema?.tables.find((table) => table.name === dataTableName) ?? null,
    [schema, dataTableName],
  );

  useEffect(() => {
    if (!hasDatabaseData) {
      setDataTableName(null);
      setDataDrawerCollapsed(false);
      setActiveView('erd');
    }
  }, [hasDatabaseData]);

  const handleClear = () => {
    setDataTableName(null);
    setDataDrawerCollapsed(false);
    setActiveView('erd');
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

                {schema && (
                  <div className="space-y-2">
                    {hasDatabaseData && (
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1">
                        <button
                          type="button"
                          onClick={() => setActiveView('erd')}
                          className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors ${
                            activeView === 'erd'
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <GitFork size={13} />
                          ERD
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDataTableName(null);
                            setActiveView('internals');
                          }}
                          className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors ${
                            activeView === 'internals'
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <ScanSearch size={13} />
                          Internals
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {schema.tables.length} tables ·{' '}
                        {schema.relationships.length} relationships
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
