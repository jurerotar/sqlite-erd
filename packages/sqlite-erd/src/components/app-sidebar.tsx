import {
  LuDatabase as Database,
  LuGitFork as GitFork,
  LuPanelLeft as PanelLeft,
  LuPanelLeftClose as PanelLeftClose,
  LuRotateCcw as RotateCcw,
  LuScanSearch as ScanSearch,
  LuTrash2 as Trash2,
} from 'react-icons/lu';
import { FileUploader } from '@/components/file-uploader.tsx';
import { SchemaInput } from '@/components/schema-input.tsx';
import { Button } from '@/components/ui/button.tsx';
import type { SchemaSource } from '@/hooks/use-schema.ts';
import type { SourceView } from '@/hooks/use-source-views.ts';

interface AppSidebarProps {
  activeSourceId: string | null;
  error: string | null;
  loading: boolean;
  panelOpen: boolean;
  sourceViews: Record<string, SourceView>;
  sources: readonly SchemaSource[];
  onClear: () => void;
  onCollapsePanel: () => void;
  onExpandPanel: () => void;
  onFile: (file: File) => void;
  onParseSQL: (sql: string) => void;
  onSourceDelete: (sourceId: string) => void;
  onSourceSelect: (sourceId: string) => void;
  onSourceViewChange: (sourceId: string, view: SourceView) => void;
}

interface SourceRowProps {
  active: boolean;
  source: SchemaSource;
  view: SourceView;
  onDelete: (sourceId: string) => void;
  onSelect: (sourceId: string) => void;
  onViewChange: (sourceId: string, view: SourceView) => void;
}

const SourceRow = ({
  active,
  source,
  view,
  onDelete,
  onSelect,
  onViewChange,
}: SourceRowProps) => (
  <div
    className={`rounded-xl border p-3 transition-colors ${
      active
        ? 'border-primary/50 bg-primary/5'
        : 'border-border bg-background/60 hover:border-primary/30'
    }`}
  >
    <div className="flex items-start gap-2">
      <button
        type="button"
        onClick={() => onSelect(source.id)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-sm font-medium text-foreground">
          {source.name}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {source.schema.tables.length} tables ·{' '}
          {source.schema.relationships.length} relationships
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(source.id)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${source.name}`}
        title={`Delete ${source.name}`}
      >
        <Trash2 size={13} />
      </button>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1">
      <button
        type="button"
        onClick={() => onViewChange(source.id, 'erd')}
        className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors ${
          view === 'erd'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <GitFork size={13} />
        ERD
      </button>
      <button
        type="button"
        onClick={() => onViewChange(source.id, 'internals')}
        disabled={!source.databaseBuffer}
        className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          view === 'internals'
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

export const AppSidebar = ({
  activeSourceId,
  error,
  loading,
  panelOpen,
  sourceViews,
  sources,
  onClear,
  onCollapsePanel,
  onExpandPanel,
  onFile,
  onParseSQL,
  onSourceDelete,
  onSourceSelect,
  onSourceViewChange,
}: AppSidebarProps) => (
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
          <h1 className="font-semibold text-sm text-foreground">SQL → ERD</h1>
          <button
            type="button"
            onClick={onCollapsePanel}
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
                  onClick={onClear}
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
                {sources.map((source) => (
                  <SourceRow
                    key={source.id}
                    active={source.id === activeSourceId}
                    source={source}
                    view={sourceViews[source.id] ?? 'erd'}
                    onDelete={onSourceDelete}
                    onSelect={onSourceSelect}
                    onViewChange={onSourceViewChange}
                  />
                ))}
              </div>
            </div>
          )}

          <FileUploader
            onFile={onFile}
            loading={loading}
          />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            <span>or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <SchemaInput
            onParse={onParseSQL}
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
        onClick={onExpandPanel}
        className="mt-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Expand upload panel"
        title="Expand upload panel"
      >
        <PanelLeft size={16} />
      </button>
    )}
  </div>
);
