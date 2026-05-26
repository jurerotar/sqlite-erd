const SQLITE_MAGIC = 'SQLite format 3\0';

export type SQLiteHeaderField = {
  offset: number;
  size: number;
  name: string;
  value: string | number;
  description: string;
};

export type SQLiteBtreeCell = {
  index: number;
  offset: number;
  size: number | null;
  fields: { name: string; value: string | number }[];
  record?: SQLiteRecordPreview;
};

export type SQLiteRecordPreview = {
  headerSize: number;
  serialTypes: number[];
  values: string[];
};

export type SQLitePageInfo = {
  number: number;
  offset: number;
  size: number;
  kind: string;
  typeByte?: number;
  headerOffset?: number;
  firstFreeblockOffset?: number;
  cellCount?: number;
  cellContentOffset?: number;
  fragmentedFreeBytes?: number;
  rightMostPointer?: number;
  cellPointers?: number[];
  cells?: SQLiteBtreeCell[];
  freelist?: {
    nextTrunkPage: number;
    leafPageCount: number;
    leafPages: number[];
  };
  warnings: string[];
};

export type SQLiteFileInternals = {
  databaseSize: number;
  pageSize: number;
  usablePageSize: number;
  pageCount: number;
  headerFields: SQLiteHeaderField[];
  pages: SQLitePageInfo[];
  warnings: string[];
};

type Varint = {
  value: number;
  bytes: number;
};

const textDecoder = new TextDecoder('utf-8', { fatal: false });

const readAscii = (bytes: Uint8Array, offset: number, length: number) =>
  Array.from(bytes.slice(offset, offset + length), (byte) =>
    String.fromCharCode(byte),
  ).join('');

const readUint16 = (view: DataView, offset: number) => view.getUint16(offset);
const readUint32 = (view: DataView, offset: number) => view.getUint32(offset);

const formatVersion = (value: number) => {
  if (value === 1) {
    return 'legacy rollback journal';
  }

  if (value === 2) {
    return 'WAL';
  }

  return `unknown (${value})`;
};

const formatEncoding = (value: number) => {
  if (value === 1) {
    return 'UTF-8';
  }

  if (value === 2) {
    return 'UTF-16le';
  }

  if (value === 3) {
    return 'UTF-16be';
  }

  return value === 0 ? 'unspecified' : `unknown (${value})`;
};

const btreePageKind = (typeByte: number) => {
  switch (typeByte) {
    case 0x02:
      return 'Index b-tree interior page';
    case 0x05:
      return 'Table b-tree interior page';
    case 0x0a:
      return 'Index b-tree leaf page';
    case 0x0d:
      return 'Table b-tree leaf page';
    default:
      return null;
  }
};

const readVarint = (
  bytes: Uint8Array,
  offset: number,
  limit: number,
): Varint | null => {
  let value = 0;

  for (let i = 0; i < 9 && offset + i < limit; i++) {
    const byte = bytes[offset + i];

    if (i === 8) {
      return { value: value * 256 + byte, bytes: 9 };
    }

    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      return { value, bytes: i + 1 };
    }
  }

  return null;
};

const serialTypeByteLength = (serialType: number) => {
  if (serialType === 0 || serialType === 8 || serialType === 9) {
    return 0;
  }

  if (serialType >= 12) {
    return Math.floor((serialType - 12) / 2);
  }

  switch (serialType) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 6;
    case 6:
    case 7:
      return 8;
    default:
      return null;
  }
};

const readSignedInt = (bytes: Uint8Array, offset: number, length: number) => {
  let value = 0;
  for (let i = 0; i < length; i++) {
    value = value * 256 + bytes[offset + i];
  }

  const signBit = 2 ** (length * 8 - 1);
  if (value >= signBit) {
    return value - 2 ** (length * 8);
  }

  return value;
};

const decodeSerialValue = (
  bytes: Uint8Array,
  offset: number,
  serialType: number,
): string => {
  if (serialType === 0) {
    return 'NULL';
  }

  if (serialType === 8) {
    return '0';
  }

  if (serialType === 9) {
    return '1';
  }

  const length = serialTypeByteLength(serialType);
  if (length === null || offset + length > bytes.length) {
    return 'unavailable';
  }

  if (serialType >= 12) {
    if (serialType % 2 === 0) {
      return `BLOB (${length} bytes)`;
    }

    return textDecoder.decode(bytes.slice(offset, offset + length));
  }

  if (serialType === 7) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, length);
    return String(view.getFloat64(0));
  }

  return String(readSignedInt(bytes, offset, length));
};

const parseRecordPreview = (
  bytes: Uint8Array,
  payloadOffset: number,
  payloadLength: number,
): SQLiteRecordPreview | undefined => {
  const payloadEnd = Math.min(payloadOffset + payloadLength, bytes.length);
  const headerSizeVarint = readVarint(bytes, payloadOffset, payloadEnd);
  if (!headerSizeVarint) {
    return undefined;
  }

  const headerEnd = Math.min(
    payloadOffset + headerSizeVarint.value,
    payloadEnd,
  );
  const serialTypes: number[] = [];
  let cursor = payloadOffset + headerSizeVarint.bytes;

  while (cursor < headerEnd) {
    const serialType = readVarint(bytes, cursor, headerEnd);
    if (!serialType) {
      break;
    }

    serialTypes.push(serialType.value);
    cursor += serialType.bytes;
  }

  const values: string[] = [];
  let bodyCursor = headerEnd;
  for (const serialType of serialTypes.slice(0, 12)) {
    values.push(decodeSerialValue(bytes, bodyCursor, serialType));
    bodyCursor += serialTypeByteLength(serialType) ?? 0;
  }

  return {
    headerSize: headerSizeVarint.value,
    serialTypes,
    values,
  };
};

const getLocalPayloadLength = (
  payloadLength: number,
  typeByte: number | undefined,
  usablePageSize: number,
) => {
  if (payloadLength <= 0) {
    return 0;
  }

  const isTableLeaf = typeByte === 0x0d;
  const maxLocal = isTableLeaf
    ? usablePageSize - 35
    : Math.floor(((usablePageSize - 12) * 64) / 255) - 23;

  if (payloadLength <= maxLocal) {
    return payloadLength;
  }

  const minLocal = Math.floor(((usablePageSize - 12) * 32) / 255) - 23;
  const local = minLocal + ((payloadLength - minLocal) % (usablePageSize - 4));

  return local <= maxLocal ? local : minLocal;
};

const parseCell = (
  bytes: Uint8Array,
  view: DataView,
  page: SQLitePageInfo,
  pageStart: number,
  pageEnd: number,
  usablePageSize: number,
  pointer: number,
  index: number,
): SQLiteBtreeCell => {
  const offset = pageStart + pointer;
  const fields: { name: string; value: string | number }[] = [];
  let cursor = offset;

  if (offset < pageStart || offset >= pageEnd) {
    fields.push({ name: 'Invalid cell pointer', value: pointer });
    return {
      index,
      offset,
      size: null,
      fields,
    };
  }

  const typeByte = page.typeByte;
  if (typeByte === 0x05 || typeByte === 0x02) {
    const leftChildPage = readUint32(view, cursor);
    fields.push({ name: 'Left child page', value: leftChildPage });
    cursor += 4;
  }

  if (typeByte === 0x05) {
    const rowid = readVarint(bytes, cursor, pageEnd);
    if (rowid) {
      fields.push({ name: 'Integer key rowid', value: rowid.value });
      cursor += rowid.bytes;
    }
  } else {
    const payloadLength = readVarint(bytes, cursor, pageEnd);
    if (payloadLength) {
      fields.push({ name: 'Payload bytes', value: payloadLength.value });
      cursor += payloadLength.bytes;
    }

    if (typeByte === 0x0d) {
      const rowid = readVarint(bytes, cursor, pageEnd);
      if (rowid) {
        fields.push({ name: 'Rowid', value: rowid.value });
        cursor += rowid.bytes;
      }
    }

    const payloadValue = payloadLength?.value ?? 0;
    const localPayloadLength = Math.min(
      getLocalPayloadLength(payloadValue, typeByte, usablePageSize),
      Math.max(pageEnd - cursor, 0),
    );
    const overflowPointerLength =
      payloadValue > localPayloadLength && cursor + localPayloadLength < pageEnd
        ? Math.min(4, pageEnd - cursor - localPayloadLength)
        : 0;

    if (payloadValue > 0 && typeByte === 0x0d) {
      const record = parseRecordPreview(bytes, cursor, localPayloadLength);
      return {
        index,
        offset,
        size: cursor + localPayloadLength + overflowPointerLength - offset,
        fields,
        record,
      };
    }

    if (payloadValue > 0) {
      return {
        index,
        offset,
        size: cursor + localPayloadLength + overflowPointerLength - offset,
        fields,
      };
    }
  }

  return {
    index,
    offset,
    size: cursor > offset ? cursor - offset : null,
    fields,
  };
};

const parseHeaderFields = (
  bytes: Uint8Array,
  view: DataView,
  pageSize: number,
): SQLiteHeaderField[] => [
  {
    offset: 0,
    size: 16,
    name: 'Header string',
    value: readAscii(bytes, 0, 16).replace('\0', '\\0'),
    description: 'Identifies this as a SQLite 3 database file.',
  },
  {
    offset: 16,
    size: 2,
    name: 'Database page size',
    value: pageSize,
    description: 'Page size in bytes. A stored value of 1 means 65536.',
  },
  {
    offset: 18,
    size: 1,
    name: 'File format write version',
    value: formatVersion(bytes[18]),
    description: 'Journal mode required for writing this file.',
  },
  {
    offset: 19,
    size: 1,
    name: 'File format read version',
    value: formatVersion(bytes[19]),
    description: 'Journal mode required for reading this file.',
  },
  {
    offset: 20,
    size: 1,
    name: 'Reserved bytes per page',
    value: bytes[20],
    description: 'Bytes reserved at the end of every page.',
  },
  {
    offset: 24,
    size: 4,
    name: 'File change counter',
    value: readUint32(view, 24),
    description: 'Incremented when the database file changes.',
  },
  {
    offset: 28,
    size: 4,
    name: 'Database size in pages',
    value: readUint32(view, 28),
    description: 'Number of pages recorded by the database header.',
  },
  {
    offset: 32,
    size: 4,
    name: 'First freelist trunk page',
    value: readUint32(view, 32),
    description: 'First page in the freelist trunk chain, or zero.',
  },
  {
    offset: 36,
    size: 4,
    name: 'Total freelist pages',
    value: readUint32(view, 36),
    description: 'Total number of pages on the freelist.',
  },
  {
    offset: 40,
    size: 4,
    name: 'Schema cookie',
    value: readUint32(view, 40),
    description: 'Changes whenever the database schema changes.',
  },
  {
    offset: 44,
    size: 4,
    name: 'Schema format number',
    value: readUint32(view, 44),
    description: 'Schema format, usually 4 for modern SQLite databases.',
  },
  {
    offset: 56,
    size: 4,
    name: 'Text encoding',
    value: formatEncoding(readUint32(view, 56)),
    description: 'Encoding used for text values in records.',
  },
  {
    offset: 92,
    size: 4,
    name: 'Version-valid-for number',
    value: readUint32(view, 92),
    description:
      'Change counter value for which the in-header page count is valid.',
  },
  {
    offset: 96,
    size: 4,
    name: 'SQLite version number',
    value: readUint32(view, 96),
    description: 'SQLite library version that last modified this file.',
  },
];

export const parseSQLiteFileInternals = (
  buffer: ArrayBuffer,
): SQLiteFileInternals => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const warnings: string[] = [];

  if (bytes.byteLength < 100) {
    throw new Error('SQLite database files must contain a 100-byte header.');
  }

  const magic = readAscii(bytes, 0, 16);
  if (magic !== SQLITE_MAGIC) {
    throw new Error('The file header is not "SQLite format 3".');
  }

  const rawPageSize = readUint16(view, 16);
  const pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
  if (pageSize < 512 || pageSize > 65536 || pageSize % 2 !== 0) {
    warnings.push(`Unexpected page size: ${pageSize}.`);
  }

  const usablePageSize = pageSize - bytes[20];
  const headerPageCount = readUint32(view, 28);
  const filePageCount = Math.ceil(bytes.byteLength / pageSize);
  const pageCount = headerPageCount > 0 ? headerPageCount : filePageCount;
  if (headerPageCount > 0 && headerPageCount !== filePageCount) {
    warnings.push(
      `Header reports ${headerPageCount} pages, file length contains ${filePageCount} pages.`,
    );
  }

  const firstFreelistTrunkPage = readUint32(view, 32);
  const freelistTrunkPages = new Set<number>();
  let trunkPage = firstFreelistTrunkPage;
  while (trunkPage > 0 && !freelistTrunkPages.has(trunkPage)) {
    freelistTrunkPages.add(trunkPage);
    const trunkOffset = (trunkPage - 1) * pageSize;
    if (trunkOffset + 8 > bytes.byteLength) {
      warnings.push(`Freelist trunk page ${trunkPage} is outside the file.`);
      break;
    }
    trunkPage = readUint32(view, trunkOffset);
  }

  const pages: SQLitePageInfo[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const pageStart = (pageNumber - 1) * pageSize;
    const pageEnd = Math.min(pageStart + pageSize, bytes.byteLength);
    const usablePageEnd = Math.min(
      pageStart + usablePageSize,
      bytes.byteLength,
    );
    const pageWarnings: string[] = [];

    if (pageStart >= bytes.byteLength) {
      pages.push({
        number: pageNumber,
        offset: pageStart,
        size: pageSize,
        kind: 'Missing page',
        warnings: ['The page is listed by the header but is outside the file.'],
      });
      continue;
    }

    if (freelistTrunkPages.has(pageNumber)) {
      const leafPageCount = readUint32(view, pageStart + 4);
      const leafPages: number[] = [];
      const maxLeafEntries = Math.max(
        Math.floor((pageEnd - pageStart - 8) / 4),
        0,
      );
      for (let i = 0; i < Math.min(leafPageCount, maxLeafEntries); i++) {
        leafPages.push(readUint32(view, pageStart + 8 + i * 4));
      }

      pages.push({
        number: pageNumber,
        offset: pageStart,
        size: pageEnd - pageStart,
        kind: 'Freelist trunk page',
        freelist: {
          nextTrunkPage: readUint32(view, pageStart),
          leafPageCount,
          leafPages,
        },
        warnings: pageWarnings,
      });
      continue;
    }

    const btreeHeaderOffset = pageStart + (pageNumber === 1 ? 100 : 0);
    const typeByte = bytes[btreeHeaderOffset];
    const kind = btreePageKind(typeByte);

    if (!kind) {
      pages.push({
        number: pageNumber,
        offset: pageStart,
        size: pageEnd - pageStart,
        kind: 'Unclassified page',
        typeByte,
        warnings: [
          `No SQLite b-tree page type found at byte ${btreeHeaderOffset}.`,
        ],
      });
      continue;
    }

    const isInterior = typeByte === 0x02 || typeByte === 0x05;
    const headerSize = isInterior ? 12 : 8;
    const firstFreeblockOffset = readUint16(view, btreeHeaderOffset + 1);
    const cellCount = readUint16(view, btreeHeaderOffset + 3);
    const rawCellContentOffset = readUint16(view, btreeHeaderOffset + 5);
    const cellContentOffset =
      rawCellContentOffset === 0 ? 65536 : rawCellContentOffset;
    const fragmentedFreeBytes = bytes[btreeHeaderOffset + 7];
    const rightMostPointer = isInterior
      ? readUint32(view, btreeHeaderOffset + 8)
      : undefined;

    const cellPointers: number[] = [];
    const pointerArrayStart = btreeHeaderOffset + headerSize;
    for (let i = 0; i < cellCount; i++) {
      const pointerOffset = pointerArrayStart + i * 2;
      if (pointerOffset + 2 > pageEnd) {
        pageWarnings.push('Cell pointer array runs past the end of the page.');
        break;
      }
      cellPointers.push(readUint16(view, pointerOffset));
    }

    const cells = cellPointers.map((pointer, index) =>
      parseCell(
        bytes,
        view,
        {
          number: pageNumber,
          offset: pageStart,
          size: pageEnd - pageStart,
          kind,
          typeByte,
          warnings: pageWarnings,
        },
        pageStart,
        usablePageEnd,
        usablePageSize,
        pointer,
        index,
      ),
    );

    pages.push({
      number: pageNumber,
      offset: pageStart,
      size: pageEnd - pageStart,
      kind,
      typeByte,
      headerOffset: btreeHeaderOffset,
      firstFreeblockOffset,
      cellCount,
      cellContentOffset,
      fragmentedFreeBytes,
      rightMostPointer,
      cellPointers,
      cells,
      warnings: pageWarnings,
    });
  }

  return {
    databaseSize: bytes.byteLength,
    pageSize,
    usablePageSize,
    pageCount,
    headerFields: parseHeaderFields(bytes, view, pageSize),
    pages,
    warnings,
  };
};

export const formatHexDump = (
  buffer: ArrayBuffer,
  offset: number,
  length: number,
) => {
  if (offset >= buffer.byteLength || length <= 0) {
    return [];
  }

  const bytes = new Uint8Array(
    buffer,
    offset,
    Math.min(length, buffer.byteLength - offset),
  );
  const rows: { offset: number; hex: string; ascii: string }[] = [];

  for (let rowOffset = 0; rowOffset < bytes.length; rowOffset += 16) {
    const rowBytes = bytes.slice(rowOffset, rowOffset + 16);
    rows.push({
      offset: offset + rowOffset,
      hex: Array.from(rowBytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(' '),
      ascii: Array.from(rowBytes, (byte) =>
        byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.',
      ).join(''),
    });
  }

  return rows;
};
