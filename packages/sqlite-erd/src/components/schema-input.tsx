import { useState } from 'react';
import { LuCode as Code, LuPlay as Play } from 'react-icons/lu';
import { Button } from '@/components/ui/button';

interface SchemaInputProps {
  onParse: (sql: string) => void;
  loading: boolean;
}

export const SchemaInput = ({ onParse, loading }: SchemaInputProps) => {
  const [sql, setSql] = useState<string>('');

  return (
    <div className="space-y-2">
      <label
        htmlFor="sql-input"
        className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"
      >
        <Code size={12} />
        Paste CREATE TABLE statements
      </label>
      <textarea
        id="sql-input"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        placeholder={
          'CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(100) NOT NULL\n);'
        }
        className="w-full h-32 bg-muted/50 border border-border rounded-lg p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <Button
        onClick={() => onParse(sql)}
        disabled={!sql.trim() || loading}
        size="sm"
        className="w-full"
      >
        <Play
          size={14}
          className="mr-1.5"
        />
        Generate ERD
      </Button>
    </div>
  );
};
