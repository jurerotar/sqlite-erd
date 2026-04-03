import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  LuDatabase as Database,
  LuFileText as FileText,
  LuUpload as Upload,
} from 'react-icons/lu';

interface FileUploaderProps {
  onFile: (file: File) => void;
  loading: boolean;
}

export const FileUploader = ({ onFile, loading }: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<boolean>(false);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        onFile(file);
      }
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFile(file);
      }
    },
    [onFile],
  );

  return (
    <button
      type="button"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
        ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }
        ${loading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".sql,.db,.sqlite,.sqlite3,.s3db,.sl3"
        onChange={handleChange}
        className="hidden"
      />
      <Upload
        size={24}
        className="mx-auto mb-2 text-muted-foreground"
      />
      <p className="text-sm text-foreground font-medium">
        Drop a file or click to upload
      </p>
      <div className="flex items-center justify-center flex-col gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText size={12} />
          .sql
        </span>
        <span className="flex items-center gap-1">
          <Database size={12} />
          .db / .sqlite / .sqlite3
        </span>
      </div>
    </button>
  );
};
