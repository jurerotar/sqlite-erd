export const Legend = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-card border border-border rounded-lg p-3 text-xs font-mono space-y-1.5 shadow-lg z-10">
      <div className="text-muted-foreground font-sans font-medium text-[11px] mb-2">
        Legend
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5 bg-muted-foreground" />
        <span className="text-foreground">Explicit FK</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5 border-t-2 border-dashed border-muted-foreground/60" />
        <span className="text-foreground">Inferred FK</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="badge-pk">PK</span>
        <span className="text-foreground">Primary Key</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="badge-fk">FK</span>
        <span className="text-foreground">Foreign Key</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="badge-uq">UQ</span>
        <span className="text-foreground">Unique</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="badge-ix">IX</span>
        <span className="text-foreground">Index</span>
      </div>
    </div>
  );
};
