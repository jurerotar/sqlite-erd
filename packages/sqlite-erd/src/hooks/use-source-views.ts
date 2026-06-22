import { useEffect, useState } from 'react';
import type { SchemaSource } from '@/hooks/use-schema.ts';

export type SourceView = 'erd' | 'internals';

export const useSourceViews = (
  sources: readonly SchemaSource[],
  activeSourceId: string | null,
) => {
  const [sourceViews, setSourceViews] = useState<Record<string, SourceView>>(
    {},
  );
  const activeView = activeSourceId
    ? (sourceViews[activeSourceId] ?? 'erd')
    : 'erd';

  useEffect(() => {
    const sourceIds = new Set(sources.map((source) => source.id));

    setSourceViews((current) => {
      const retainedViews = Object.fromEntries(
        Object.entries(current).filter(([sourceId]) => sourceIds.has(sourceId)),
      ) as Record<string, SourceView>;

      return Object.keys(retainedViews).length === Object.keys(current).length
        ? current
        : retainedViews;
    });
  }, [sources]);

  const setSourceView = (sourceId: string, view: SourceView) => {
    setSourceViews((current) => ({
      ...current,
      [sourceId]: view,
    }));
  };

  const resetSourceViews = () => {
    setSourceViews({});
  };

  return {
    sourceViews,
    activeView,
    setSourceView,
    resetSourceViews,
  };
};
