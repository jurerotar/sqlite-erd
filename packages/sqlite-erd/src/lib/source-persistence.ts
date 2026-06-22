import type { Schema } from '@/lib/schema-types';

const DIRECTORY_NAME = 'sqlite-erd';
const MANIFEST_FILE_NAME = 'sources.json';
const DATABASE_FILE_EXTENSION = '.sqlite3';

export interface PersistedSchemaSource {
  id: string;
  name: string;
  schema: Schema;
  databaseFileName: string | null;
  sourceKey?: string;
}

export interface PersistedSchemaSourceState {
  sources: PersistedSchemaSource[];
  activeSourceId: string | null;
}

export interface RestoredSchemaSource {
  id: string;
  name: string;
  schema: Schema;
  databaseBuffer: ArrayBuffer | null;
  sourceKey?: string;
}

export interface RestoredSchemaSourceState {
  sources: RestoredSchemaSource[];
  activeSourceId: string | null;
}

const isOpfsAvailable = () =>
  typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;

const getAppDirectory = async (create = true) => {
  if (!isOpfsAvailable()) {
    return null;
  }

  const root = await navigator.storage.getDirectory();

  try {
    return await root.getDirectoryHandle(DIRECTORY_NAME, { create });
  } catch {
    return null;
  }
};

const readTextFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
) => {
  try {
    const fileHandle = await directory.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    return file.text();
  } catch {
    return null;
  }
};

const writeTextFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  text: string,
) => {
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(text);
  await writable.close();
};

const readBinaryFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
) => {
  try {
    const fileHandle = await directory.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    return file.arrayBuffer();
  } catch {
    return null;
  }
};

const writeBinaryFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  buffer: ArrayBuffer,
) => {
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(buffer);
  await writable.close();
};

const createDatabaseFileName = (sourceId: string) =>
  `${sourceId}${DATABASE_FILE_EXTENSION}`;

const removeEntry = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
) => {
  try {
    await directory.removeEntry(fileName);
  } catch {
    // Missing files are harmless; OPFS cleanup is best effort.
  }
};

export const loadPersistedSourceState =
  async (): Promise<RestoredSchemaSourceState | null> => {
    const directory = await getAppDirectory(false);

    if (!directory) {
      return null;
    }

    const manifestText = await readTextFile(directory, MANIFEST_FILE_NAME);

    if (!manifestText) {
      return null;
    }

    const manifest = JSON.parse(manifestText) as PersistedSchemaSourceState;
    const sources = await Promise.all(
      manifest.sources.map(async (source) => ({
        id: source.id,
        name: source.name,
        schema: source.schema,
        databaseBuffer: source.databaseFileName
          ? await readBinaryFile(directory, source.databaseFileName)
          : null,
        sourceKey: source.sourceKey,
      })),
    );

    return {
      sources,
      activeSourceId: sources.some(
        (source) => source.id === manifest.activeSourceId,
      )
        ? manifest.activeSourceId
        : (sources.at(0)?.id ?? null),
    };
  };

export const savePersistedSourceState = async (
  state: RestoredSchemaSourceState,
) => {
  const directory = await getAppDirectory();

  if (!directory) {
    return;
  }

  const manifest: PersistedSchemaSourceState = {
    activeSourceId: state.activeSourceId,
    sources: await Promise.all(
      state.sources.map(async (source) => {
        const databaseFileName = source.databaseBuffer
          ? createDatabaseFileName(source.id)
          : null;

        if (source.databaseBuffer && databaseFileName) {
          await writeBinaryFile(
            directory,
            databaseFileName,
            source.databaseBuffer,
          );
        }

        return {
          id: source.id,
          name: source.name,
          schema: source.schema,
          databaseFileName,
          sourceKey: source.sourceKey,
        };
      }),
    ),
  };

  await writeTextFile(directory, MANIFEST_FILE_NAME, JSON.stringify(manifest));
};

export const removePersistedSource = async (sourceId: string) => {
  const directory = await getAppDirectory(false);

  if (!directory) {
    return;
  }

  await removeEntry(directory, createDatabaseFileName(sourceId));
};

export const clearPersistedSourceState = async () => {
  const directory = await getAppDirectory(false);

  if (!directory) {
    return;
  }

  await removeEntry(directory, MANIFEST_FILE_NAME);
};
