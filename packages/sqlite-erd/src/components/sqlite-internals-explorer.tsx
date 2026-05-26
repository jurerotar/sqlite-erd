import { useMemo, useState } from 'react';
import {
  LuBinary as Binary,
  LuDatabase as Database,
  LuFileCode as FileCode,
  LuTableProperties as TableProperties,
} from 'react-icons/lu';
import type {
  SQLiteFileInternals,
  SQLitePageInfo,
} from '@/lib/sqlite-file-format';

interface SQLiteInternalsExplorerProps {
  buffer: ArrayBuffer;
  internals: SQLiteFileInternals;
}

const formatBytes = (value: number) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value);

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) => (
  <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-border/60 px-3 py-2 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words font-mono text-foreground">
      {value ?? 'n/a'}
    </span>
  </div>
);

type HexByteKind = 'filled' | 'empty' | 'structure';

type HexByte = {
  offset: number;
  hex: string;
  ascii: string;
  kind: HexByteKind;
};

type HexRow = {
  offset: number;
  bytes: HexByte[];
};

const getBtreeStructureEnd = (page: SQLitePageInfo) => {
  if (page.freelist) {
    return 8 + page.freelist.leafPages.length * 4;
  }

  if (page.headerOffset === undefined || page.cellPointers === undefined) {
    return null;
  }

  const btreeHeaderSize =
    page.typeByte === 0x02 || page.typeByte === 0x05 ? 12 : 8;

  return (
    page.headerOffset +
    btreeHeaderSize +
    page.cellPointers.length * 2 -
    page.offset
  );
};

const getHexByteKind = (
  page: SQLitePageInfo,
  cellRanges: { start: number; end: number }[],
  pageRelativeOffset: number,
): HexByteKind => {
  if (
    cellRanges.some(
      (range) =>
        pageRelativeOffset >= range.start && pageRelativeOffset < range.end,
    )
  ) {
    return 'filled';
  }

  const structureEnd = getBtreeStructureEnd(page);
  if (structureEnd !== null && pageRelativeOffset < structureEnd) {
    return 'structure';
  }

  return 'empty';
};

const formatClassifiedHexRows = (
  buffer: ArrayBuffer,
  page: SQLitePageInfo,
): HexRow[] => {
  if (page.offset >= buffer.byteLength || page.size <= 0) {
    return [];
  }

  const bytes = new Uint8Array(
    buffer,
    page.offset,
    Math.min(page.size, buffer.byteLength - page.offset),
  );
  const cellRanges =
    page.cells?.flatMap((cell) =>
      cell.size === null
        ? []
        : [
            {
              start: cell.offset - page.offset,
              end: cell.offset - page.offset + cell.size,
            },
          ],
    ) ?? [];
  const rows: HexRow[] = [];

  for (let rowOffset = 0; rowOffset < bytes.length; rowOffset += 16) {
    const rowBytes = bytes.slice(rowOffset, rowOffset + 16);
    rows.push({
      offset: page.offset + rowOffset,
      bytes: Array.from(rowBytes, (byte, index) => ({
        offset: page.offset + rowOffset + index,
        hex: byte.toString(16).padStart(2, '0'),
        ascii: byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.',
        kind: getHexByteKind(page, cellRanges, rowOffset + index),
      })),
    });
  }

  return rows;
};

const hexByteClassName = (kind: HexByteKind) => {
  if (kind === 'filled') {
    return 'bg-red-200 text-red-950 ring-1 ring-red-700/25 dark:bg-red-500/35 dark:text-red-50 dark:ring-red-200/25';
  }

  if (kind === 'empty') {
    return 'bg-emerald-200 text-emerald-950 ring-1 ring-emerald-700/25 dark:bg-emerald-500/35 dark:text-emerald-50 dark:ring-emerald-200/25';
  }

  return 'bg-sky-400/50 text-sky-950 ring-1 ring-sky-700/25 dark:bg-sky-400/32 dark:text-sky-50 dark:ring-sky-200/25';
};

const hexLegendClassName = (kind: HexByteKind) =>
  `${hexByteClassName(kind)} inline-block h-2.5 w-2.5 rounded-sm`;

const hexCellClassName = (kind: HexByteKind, type: 'hex' | 'ascii') =>
  `${hexByteClassName(kind)} mr-0.5 inline-block rounded-sm text-center ${
    type === 'hex' ? 'min-w-[2.4ch]' : 'min-w-[1.25ch]'
  }`;

const PageDetails = ({ page }: { page: SQLitePageInfo }) => (
  <div className="min-h-0 overflow-auto">
    <div className="border-b border-border">
      <DetailRow
        label="Page"
        value={page.number}
      />
      <DetailRow
        label="Kind"
        value={page.kind}
      />
      <DetailRow
        label="File offset"
        value={page.offset}
      />
      <DetailRow
        label="Page type byte"
        value={
          page.typeByte === undefined
            ? undefined
            : `0x${page.typeByte.toString(16).padStart(2, '0')}`
        }
      />
      <DetailRow
        label="B-tree header offset"
        value={page.headerOffset}
      />
      <DetailRow
        label="First freeblock"
        value={page.firstFreeblockOffset}
      />
      <DetailRow
        label="Cells"
        value={page.cellCount}
      />
      <DetailRow
        label="Cell content area"
        value={page.cellContentOffset}
      />
      <DetailRow
        label="Fragmented bytes"
        value={page.fragmentedFreeBytes}
      />
      <DetailRow
        label="Right-most pointer"
        value={page.rightMostPointer}
      />
    </div>

    {page.freelist && (
      <div className="border-b border-border p-3">
        <h3 className="mb-2 text-xs font-semibold text-foreground">
          Freelist trunk
        </h3>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">
            Next trunk page:{' '}
            <span className="font-mono text-foreground">
              {page.freelist.nextTrunkPage || 'none'}
            </span>
          </p>
          <p className="text-muted-foreground">
            Leaf pages:{' '}
            <span className="font-mono text-foreground">
              {page.freelist.leafPageCount}
            </span>
          </p>
          {page.freelist.leafPages.length > 0 && (
            <p className="font-mono text-foreground">
              {page.freelist.leafPages.join(', ')}
            </p>
          )}
        </div>
      </div>
    )}

    {page.cellPointers && page.cellPointers.length > 0 && (
      <div className="border-b border-border p-3">
        <h3 className="mb-2 text-xs font-semibold text-foreground">
          Cell pointer array
        </h3>
        <div className="flex flex-wrap gap-1">
          {page.cellPointers.slice(0, 120).map((pointer, index) => (
            <span
              key={`${page.number}-${pointer}`}
              className="rounded border border-border bg-muted/40 px-1.5 py-1 font-mono text-[10px] text-muted-foreground"
            >
              {index}: {pointer}
            </span>
          ))}
        </div>
      </div>
    )}

    {page.cells && page.cells.length > 0 && (
      <div className="p-3">
        <h3 className="mb-2 text-xs font-semibold text-foreground">
          Cell preview
        </h3>
        <div className="space-y-2">
          {page.cells.slice(0, 50).map((cell) => (
            <div
              key={`${cell.index}-${cell.offset}`}
              className="rounded-lg border border-border bg-background"
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
                <span className="font-semibold text-foreground">
                  Cell {cell.index}
                </span>
                <span className="font-mono text-muted-foreground">
                  @{cell.offset}
                </span>
                {cell.size !== null && (
                  <span className="ml-auto font-mono text-muted-foreground">
                    {cell.size} bytes parsed
                  </span>
                )}
              </div>
              <div className="px-3 py-2">
                <div className="grid gap-1 text-xs">
                  {cell.fields.map((field) => (
                    <div
                      key={field.name}
                      className="grid grid-cols-[130px_1fr] gap-2"
                    >
                      <span className="text-muted-foreground">
                        {field.name}
                      </span>
                      <span className="font-mono text-foreground">
                        {field.value}
                      </span>
                    </div>
                  ))}
                </div>
                {cell.record && (
                  <div className="mt-2 border-t border-border pt-2">
                    <p className="mb-1 text-xs text-muted-foreground">
                      Record header {cell.record.headerSize} bytes; serial types{' '}
                      {cell.record.serialTypes.join(', ') || 'none'}
                    </p>
                    <div className="grid gap-1 font-mono text-[11px] text-foreground">
                      {cell.record.values.map((value, index) => (
                        <span key={`${cell.offset}-${value}`}>
                          c{index}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {page.cells.length > 50 && (
            <p className="text-xs text-muted-foreground">
              Showing 50 of {page.cells.length} decoded cells.
            </p>
          )}
        </div>
      </div>
    )}

    {page.warnings.length > 0 && (
      <div className="m-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
        {page.warnings.join(' ')}
      </div>
    )}
  </div>
);

const DatabaseHeaderDetails = ({
  internals,
}: {
  internals: SQLiteFileInternals;
}) => (
  <div className="border-b border-border">
    <div className="border-b border-border bg-muted/30 px-3 py-2">
      <h3 className="text-xs font-semibold text-foreground">Database header</h3>
      <p className="text-[11px] text-muted-foreground">
        100 bytes at the start of page 1
      </p>
    </div>
    {internals.headerFields.map((field) => (
      <div
        key={`${field.offset}-${field.name}`}
        className="border-b border-border/60 px-3 py-2"
        title={field.description}
      >
        <div className="flex items-center gap-3 text-xs">
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {field.name}
          </span>
          <span className="font-mono text-foreground">{field.value}</span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          offset {field.offset}, size {field.size}
        </p>
      </div>
    ))}
    {internals.warnings.length > 0 && (
      <div className="m-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
        {internals.warnings.join(' ')}
      </div>
    )}
  </div>
);

export const SQLiteInternalsExplorer = ({
  buffer,
  internals,
}: SQLiteInternalsExplorerProps) => {
  const [selectedPageNumber, setSelectedPageNumber] = useState(1);
  const selectedPage =
    internals.pages.find((page) => page.number === selectedPageNumber) ??
    internals.pages[0];
  const hexRows = useMemo(
    () => (selectedPage ? formatClassifiedHexRows(buffer, selectedPage) : []),
    [buffer, selectedPage],
  );

  return (
    <div className="flex h-full min-w-0 bg-background">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Database
              size={16}
              className="text-primary"
            />
            <h2 className="text-sm font-semibold text-foreground">
              SQLite internals
            </h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-background p-2">
              <p className="text-muted-foreground">Page size</p>
              <p className="font-mono text-foreground">
                {formatBytes(internals.pageSize)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-2">
              <p className="text-muted-foreground">Pages</p>
              <p className="font-mono text-foreground">
                {formatBytes(internals.pageCount)}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {internals.pages.map((page) => (
            <button
              key={page.number}
              type="button"
              onClick={() => setSelectedPageNumber(page.number)}
              className={`flex w-full items-start gap-3 border-b border-border/60 px-3 py-2 text-left transition-colors ${
                page.number === selectedPage?.number
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted/50'
              }`}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-background font-mono text-[11px] text-muted-foreground">
                {page.number}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-foreground">
                  {page.kind}
                </span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  offset {page.offset}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="grid min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <FileCode
            size={16}
            className="text-primary"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              Page {selectedPage?.number}: {selectedPage?.kind}
            </h2>
            <p className="text-xs text-muted-foreground">
              Based on the SQLite database file format: header, pages, b-tree
              headers, cells, and records.
            </p>
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[minmax(360px,0.92fr)_minmax(360px,1.08fr)]">
          <section className="flex min-h-0 flex-col border-r border-border">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <TableProperties
                size={14}
                className="text-muted-foreground"
              />
              <h3 className="text-xs font-semibold text-foreground">
                Structure
              </h3>
            </div>
            <div className="min-h-0 overflow-auto">
              <DatabaseHeaderDetails internals={internals} />
              {selectedPage && <PageDetails page={selectedPage} />}
            </div>
          </section>

          <section className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Binary
                size={14}
                className="text-muted-foreground"
              />
              <h3 className="text-xs font-semibold text-foreground">Hex</h3>
              <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className={hexLegendClassName('filled')} />
                  filled
                </span>
                <span className="flex items-center gap-1">
                  <span className={hexLegendClassName('empty')} />
                  empty
                </span>
                <span className="flex items-center gap-1">
                  <span className={hexLegendClassName('structure')} />
                  structure
                </span>
              </div>
            </div>
            <div className="min-h-0 overflow-auto p-3">
              <table className="w-full border-collapse font-mono text-[11px]">
                <tbody>
                  {hexRows.map((row) => (
                    <tr
                      key={row.offset}
                      className="border-b border-border/40"
                    >
                      <td className="whitespace-nowrap py-1 pr-3 text-muted-foreground">
                        {row.offset.toString(16).padStart(8, '0')}
                      </td>
                      <td className="whitespace-pre py-1 pr-3">
                        {row.bytes.map((byte) => (
                          <span
                            key={byte.offset}
                            className={hexCellClassName(byte.kind, 'hex')}
                            title={`${byte.kind} byte @ ${byte.offset}`}
                          >
                            {byte.hex}
                          </span>
                        ))}
                      </td>
                      <td className="whitespace-pre py-1">
                        {row.bytes.map((byte) => (
                          <span
                            key={byte.offset}
                            className={hexCellClassName(byte.kind, 'ascii')}
                            title={`${byte.kind} byte @ ${byte.offset}`}
                          >
                            {byte.ascii}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
