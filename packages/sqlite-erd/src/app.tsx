import { useState } from 'react';
import {
  LuDatabase as Database,
  LuMoon as Moon,
  LuPanelLeft as PanelLeft,
  LuPanelLeftClose as PanelLeftClose,
  LuRotateCcw as RotateCcw,
  LuSun as Sun,
} from 'react-icons/lu';
import { ERDCanvas } from '@/components/erd-canvas.tsx';
import { FileUploader } from '@/components/file-uploader.tsx';
import { SchemaInput } from '@/components/schema-input.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useSchema } from '@/hooks/use-schema.ts';
import { useTheme } from '@/hooks/use-theme.ts';
import './styles/app.css';

type AppProps = {
  sqlSchema?: string;
  showSidebar?: boolean;
};

export const App = ({ sqlSchema, showSidebar = true }: AppProps) => {
  const { theme, toggle: toggleTheme } = useTheme();
  const { schema, loading, error, loadFromSQL, loadFromFile, clear } =
    useSchema(sqlSchema);

  const [panelOpen, setPanelOpen] = useState<boolean>(showSidebar);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Side Panel */}
      {showSidebar && panelOpen && (
        <div className="w-80 shrink-0 border-r border-border bg-card flex flex-col h-full">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Database
              size={18}
              className="text-primary"
            />
            <h1 className="font-semibold text-sm text-foreground">SQL → ERD</h1>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
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
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {schema.tables.length} tables ·{' '}
                    {schema.relationships.length} relationships
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clear}
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

        {showSidebar && !panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="absolute top-4 left-4 z-10 bg-card border border-border rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
          >
            <PanelLeft size={16} />
          </button>
        )}

        {schema ? (
          <ERDCanvas schema={schema} />
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
