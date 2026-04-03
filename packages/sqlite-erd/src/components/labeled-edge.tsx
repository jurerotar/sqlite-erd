import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react';

export const LabeledEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: (labelStyle?.fontSize as number) ?? 10,
              fontFamily:
                (labelStyle?.fontFamily as string) ??
                "'JetBrains Mono', monospace",
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              style={{
                padding: '2px 4px',
                borderRadius: '4px',
                background: (labelBgStyle?.fill as string) ?? 'hsl(0, 0%, 12%)',
                color: (labelStyle?.fill as string) ?? 'hsl(0, 0%, 50%)',
                opacity: (labelBgStyle?.fillOpacity as number) ?? 0.8,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
