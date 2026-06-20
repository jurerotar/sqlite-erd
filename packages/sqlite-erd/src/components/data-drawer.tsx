import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuDatabase as Database,
  LuPanelRightClose as PanelRightClose,
  LuPanelRightOpen as PanelRightOpen,
  LuX as X,
} from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import {
  type TableDataFilter,
  type TableDataPage,
  tableDataRowKey,
} from '@/lib/db-parser';
import type { Table as SchemaTable } from '@/lib/schema-types';

interface DataDrawerProps {
  collapsed: boolean;
  table: SchemaTable | null;
  onCollapse: () => void;
  onClose: () => void;
  onExpand: () => void;
  loadTableData: (
    tableName: string,
    page: number,
    pageSize?: number,
    filters?: readonly TableDataFilter[],
  ) => Promise<TableDataPage>;
}

const PAGE_SIZE = 100;

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (value instanceof Uint8Array) {
    return `BLOB (${value.byteLength} bytes)`;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const clampPage = (page: number, totalPages: number) =>
  Math.min(Math.max(page, 1), totalPages);

export const DataDrawer = ({
  collapsed,
  table: selectedTable,
  onCollapse,
  onClose,
  onExpand,
  loadTableData,
}: DataDrawerProps) => {
  const drawerRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );
  const [data, setData] = useState<TableDataPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableName = selectedTable?.name;

  const activeFilters = useMemo(
    () =>
      Object.entries(columnFilters)
        .map(([column, value]) => ({
          column,
          value: value.trim(),
        }))
        .filter((filter) => filter.value.length > 0),
    [columnFilters],
  );

  useEffect(() => {
    if (!tableName) {
      return;
    }

    setPage(1);
    setColumnFilters({});
  }, [tableName]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    let cancelled = false;

    if (!tableName) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    loadTableData(tableName, page, PAGE_SIZE, activeFilters)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Failed to load table data',
          );
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tableName, page, activeFilters, loadTableData]);

  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }

    return Math.max(Math.ceil(data.totalRows / data.pageSize), 1);
  }, [data]);

  useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!selectedTable) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const drawer = drawerRef.current;

      if (
        drawer &&
        event.target instanceof Node &&
        !drawer.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [onClose, selectedTable]);

  if (!selectedTable) {
    return null;
  }

  const firstRow = data?.totalRows ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = data ? Math.min(page * PAGE_SIZE, data.totalRows) : 0;
  const hasFilters = activeFilters.length > 0;
  const rows = data?.rows ?? [];

  const goToPage = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const requestedPage = Number(pageInput);

    if (!Number.isFinite(requestedPage)) {
      setPageInput(String(page));
      return;
    }

    const nextPage = clampPage(Math.trunc(requestedPage), totalPages);
    setPageInput(String(nextPage));
    setPage(nextPage);
  };

  if (collapsed) {
    return (
      <aside
        ref={drawerRef}
        className="absolute inset-y-0 right-0 z-20 flex w-12 flex-col items-center border-l border-border bg-card shadow-xl"
      >
        <button
          type="button"
          onClick={onExpand}
          className="mt-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Expand data drawer"
          title="Expand data drawer"
        >
          <PanelRightOpen size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      ref={drawerRef}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[min(560px,calc(100vw-2rem))] flex-col border-l border-border bg-card shadow-xl"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Database
          size={16}
          className="text-primary"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-sm text-foreground">
            {selectedTable.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {selectedTable.columns.length} columns
          </p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Collapse data drawer"
          title="Collapse data drawer"
        >
          <PanelRightClose size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close data drawer"
          title="Close data drawer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {error && (
          <div className="m-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {!error && loading && (
          <div className="p-4 text-sm text-muted-foreground">
            Loading data...
          </div>
        )}

        {!error && !loading && data && data.totalRows === 0 && (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            {hasFilters
              ? 'No rows match current filters.'
              : 'No rows in this table.'}
          </div>
        )}

        {!error && data && data.totalRows > 0 && (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  {selectedTable.columns.map((column) => (
                    <th
                      key={column.name}
                      className="border-b border-border px-3 py-2 align-top font-mono font-semibold text-muted-foreground"
                    >
                      <div className="flex min-w-36 flex-col gap-2">
                        <span className="truncate">{column.name}</span>
                        <input
                          type="search"
                          value={columnFilters[column.name] ?? ''}
                          onChange={(event) => {
                            const { value } = event.target;
                            setPage(1);
                            setColumnFilters((current) => {
                              if (!value) {
                                const { [column.name]: _, ...next } = current;
                                return next;
                              }

                              return {
                                ...current,
                                [column.name]: value,
                              };
                            });
                          }}
                          placeholder={`Filter ${column.name}`}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 font-normal font-sans text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          aria-label={`Filter ${column.name}`}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={String(row[tableDataRowKey])}
                    className="border-b border-border/60 hover:bg-muted/40"
                  >
                    {selectedTable.columns.map((column) => {
                      const cellValue = formatCellValue(row[column.name]);

                      return (
                        <td
                          key={column.name}
                          className="max-w-56 truncate px-3 py-2 font-mono text-foreground"
                          title={cellValue}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {data ? `${firstRow}-${lastRow} of ${data.totalRows}` : '0 rows'}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((current) => Math.max(current - 1, 1))}
          disabled={loading || page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </Button>
        <form
          className="flex items-center gap-1 text-xs text-muted-foreground"
          onSubmit={goToPage}
        >
          <label
            className="sr-only"
            htmlFor="data-drawer-page"
          >
            Page
          </label>
          <input
            id="data-drawer-page"
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={() => goToPage()}
            disabled={loading}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center text-foreground text-xs outline-none transition-colors focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Current page"
          />
          <span>/ {totalPages}</span>
        </form>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((current) => current + 1)}
          disabled={loading || page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </aside>
  );
};
