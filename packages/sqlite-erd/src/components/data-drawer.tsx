import { useEffect, useMemo, useState } from 'react';
import {
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuDatabase as Database,
  LuX as X,
} from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { type TableDataPage, tableDataRowKey } from '@/lib/db-parser';
import type { Table } from '@/lib/schema-types';

interface DataDrawerProps {
  table: Table | null;
  onClose: () => void;
  loadTableData: (
    tableName: string,
    page: number,
    pageSize?: number,
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

export const DataDrawer = ({
  table,
  onClose,
  loadTableData,
}: DataDrawerProps) => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TableDataPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableName = table?.name;

  useEffect(() => {
    if (!tableName) {
      return;
    }

    setPage(1);
  }, [tableName]);

  useEffect(() => {
    let cancelled = false;

    if (!table) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    loadTableData(table.name, page, PAGE_SIZE)
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
  }, [table, page, loadTableData]);

  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }

    return Math.max(Math.ceil(data.totalRows / data.pageSize), 1);
  }, [data]);

  if (!table) {
    return null;
  }

  const firstRow = data?.totalRows ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = data ? Math.min(page * PAGE_SIZE, data.totalRows) : 0;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[min(560px,calc(100vw-2rem))] flex-col border-l border-border bg-card shadow-xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Database
          size={16}
          className="text-primary"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-sm text-foreground">
            {table.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {table.columns.length} columns
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close data drawer"
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
            No rows in this table.
          </div>
        )}

        {!error && data && data.totalRows > 0 && (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  {table.columns.map((column) => (
                    <th
                      key={column.name}
                      className="border-b border-border px-3 py-2 font-mono font-semibold text-muted-foreground"
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={String(row[tableDataRowKey])}
                    className="border-b border-border/60 hover:bg-muted/40"
                  >
                    {table.columns.map((column) => (
                      <td
                        key={column.name}
                        className="max-w-56 truncate px-3 py-2 font-mono text-foreground"
                        title={formatCellValue(row[column.name])}
                      >
                        {formatCellValue(row[column.name])}
                      </td>
                    ))}
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
        <span className="text-xs text-muted-foreground">
          {page} / {totalPages}
        </span>
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
