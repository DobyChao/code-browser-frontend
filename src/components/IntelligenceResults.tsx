import React, { useMemo } from 'react';
import type { IntelligenceItem } from '../api/types';

interface IntelligenceResultsProps {
  items: IntelligenceItem[];
  onItemClick: (filePath: string, range: IntelligenceItem['range']) => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function IntelligenceResults({ items, onItemClick, className = '', isExpanded, onToggleExpand }: IntelligenceResultsProps) {
  const defItems = items.filter(it => it.kind === 'definition');
  const refItems = items.filter(it => it.kind === 'reference');
  const [activeCategory, setActiveCategory] = React.useState<'definitions' | 'references'>('definitions');
  React.useEffect(() => {
    if (defItems.length > 0) {
      setActiveCategory('definitions');
    } else if (refItems.length > 0) {
      setActiveCategory('references');
    } else {
      setActiveCategory('definitions');
    }
  }, [defItems.length, refItems.length]);
  const grouped = useMemo(() => {
    const map = new Map<string, IntelligenceItem[]>();
    for (const it of items) {
      const arr = map.get(it.filePath) || [];
      arr.push(it);
      map.set(it.filePath, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className={`h-full w-full bg-bg-sidebar border-t border-border-default ${className}`}>
      <div className="px-3 h-8 flex items-center justify-between bg-bg-sidebar select-none" onClick={() => { if (!isExpanded) onToggleExpand?.(); }}>
        <h2 className="text-xs font-semibold uppercase">Explore</h2>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-text-dim">{items.length} 项</span>
          {isExpanded && (
            <button className="text-xs px-2 py-0.5 bg-bg-hover rounded-md" onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }} title="Hide">Hide</button>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="h-[calc(100%-2rem)] grid grid-cols-12">
          <div className="col-span-3 border-r border-border-default p-2">
            <ul className="space-y-1">
              <li
                className={`p-1 rounded-md cursor-pointer ${activeCategory === 'definitions' ? 'bg-bg-selected text-text-selected' : 'hover:bg-bg-hover'}`}
                onClick={() => setActiveCategory('definitions')}
              >
                Definitions <span className="text-xs text-text-dim">{defItems.length}</span>
              </li>
              <li
                className={`p-1 rounded-md cursor-pointer ${activeCategory === 'references' ? 'bg-bg-selected text-text-selected' : 'hover:bg-bg-hover'}`}
                onClick={() => setActiveCategory('references')}
              >
                References <span className="text-xs text-text-dim">{refItems.length}</span>
              </li>
            </ul>
          </div>
          <div className="col-span-9 p-2 overflow-y-auto no-scrollbar">
            <ul className="space-y-1">
              {(activeCategory === 'definitions' ? defItems : refItems).map((it) => (
                <li
                  key={`${it.filePath}-${it.kind}-${it.range.startLine}-${it.range.startColumn}-${it.source}`}
                  className="p-1 rounded-md hover:bg-bg-hover cursor-pointer flex items-center justify-between"
                  onClick={() => onItemClick(it.filePath, it.range)}
                  title={it.filePath}
                >
                  <span className="text-xs truncate">{it.filePath} · {(it.range.startLine + (1 - (it.range.lineBase ?? 1)))}:{(it.range.startColumn + (1 - (it.range.columnBase ?? 1)))}</span>
                  <span className={`text-[10px] ${it.source === 'scip' ? 'text-green-600' : 'text-text-dim'}`}>{it.source}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!isExpanded && (
        <div className="h-[calc(100%-2.5rem)] overflow-y-auto no-scrollbar p-2">
          {items.length === 0 && (
            <div className="text-sm text-text-dim">暂无结果</div>
          )}
          {items.length > 0 && (
            <ul className="space-y-3">
              {grouped.map(([filePath, list]) => (
                <li key={filePath} className="">
                  <div className="text-xs font-medium text-button truncate" title={filePath}>{filePath}</div>
                  <ul className="mt-1 space-y-1">
                    {list.map((it) => (
                      <li
                        key={`${filePath}-${it.kind}-${it.range.startLine}-${it.range.startColumn}-${it.source}`}
                        className="text-xs p-1 rounded-md hover:bg-bg-hover cursor-pointer flex items-center justify-between"
                        onClick={() => onItemClick(filePath, it.range)}
                      >
                        <span>
                          [{it.kind}] 行 {(it.range.startLine + (1 - (it.range.lineBase ?? 1)))}:{(it.range.startColumn + (1 - (it.range.columnBase ?? 1)))} → {(it.range.endLine + (1 - (it.range.lineBase ?? 1)))}:{(it.range.endColumn + (1 - (it.range.columnBase ?? 1)))}
                        </span>
                        <span className={`text-[10px] ${it.source === 'scip' ? 'text-green-600' : 'text-text-dim'}`}>{it.source}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
