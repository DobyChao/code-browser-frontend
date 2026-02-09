import React, { useMemo } from 'react';
import type { IntelligenceItem } from '../api/types';
import { Pin, PinOff, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface IntelligenceResultsProps {
  items: IntelligenceItem[];
  onItemClick: (filePath: string, range: IntelligenceItem['range']) => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onHide?: () => void;
  onClear?: () => void;
  intentCategory?: 'definitions' | 'references';
  intentSignal?: number;
}

export default function IntelligenceResults({ items, onItemClick, className = '', isExpanded, onToggleExpand, isPinned, onTogglePin, onHide, onClear, intentCategory, intentSignal }: IntelligenceResultsProps) {
  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    const out: IntelligenceItem[] = [];
    for (const it of items) {
      const k = `${it.kind}|${it.filePath}|${it.range.startLine}|${it.range.startColumn}|${it.source}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(it);
      }
    }
    return out;
  }, [items]);
  const defItems = uniqueItems.filter(it => it.kind === 'definition');
  const refItems = uniqueItems.filter(it => it.kind === 'reference');
  const [activeCategory, setActiveCategory] = React.useState<'definitions' | 'references'>('definitions');

  // 当 intentSignal 更新时，切换到指定的分类
  React.useEffect(() => {
    if (intentCategory) {
      setActiveCategory(intentCategory);
    }
  }, [intentSignal, intentCategory]);

  // 如果当前分类为空，且另一个分类有数据，自动切换（作为兜底，但优先级低于 intent）
  React.useEffect(() => {
    if (activeCategory === 'definitions' && defItems.length === 0 && refItems.length > 0) {
       // 只有在非 intent 驱动的情况下才自动切换？
       // 这里保留一个简单的自动切换逻辑，防止用户看到空白页
       // 但要注意不要跟 intent 冲突。
       // 由于 intentSignal 是事件驱动的，这里是状态驱动的。
       // 如果 intent 刚切过来是 definitions (0) 但 refs 有数据，这里会马上切到 references。
       // 这符合逻辑：如果我点了 definition 但没有定义只有引用，那显示引用也是合理的。
       setActiveCategory('references');
    } else if (activeCategory === 'references' && refItems.length === 0 && defItems.length > 0) {
       setActiveCategory('definitions');
    }
  }, [defItems.length, refItems.length, activeCategory]);

  const defsCount = defItems.length;
  const refsCount = refItems.length;

  return (
    <div className={`h-full w-full bg-bg-sidebar border-t border-border-default ${className}`}>
      <div
        className="px-2 h-8 flex items-center justify-between bg-bg-sidebar select-none"
        onClick={() => {
          if (isExpanded) onHide?.();
          else onToggleExpand?.();
        }}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <h2 className="text-xs font-semibold uppercase flex-shrink-0">Explore</h2>
          <div className="flex items-center space-x-1 min-w-0">
            <button
              type="button"
              className={`text-[11px] px-2 py-0.5 rounded-md border ${activeCategory === 'definitions' ? 'bg-bg-hover border-button text-text-default' : 'bg-bg-default/0 border-border-default text-text-dim hover:bg-bg-hover'}`}
              onClick={(e) => { e.stopPropagation(); setActiveCategory('definitions'); if (!isExpanded) onToggleExpand?.(); }}
              title="Definitions"
            >
              Definitions <span className="text-[10px] text-text-dim">{defsCount}</span>
            </button>
            <button
              type="button"
              className={`text-[11px] px-2 py-0.5 rounded-md border ${activeCategory === 'references' ? 'bg-bg-hover border-button text-text-default' : 'bg-bg-default/0 border-border-default text-text-dim hover:bg-bg-hover'}`}
              onClick={(e) => { e.stopPropagation(); setActiveCategory('references'); if (!isExpanded) onToggleExpand?.(); }}
              title="References"
            >
              References <span className="text-[10px] text-text-dim">{refsCount}</span>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            className={`p-1 rounded-md border ${isPinned ? 'bg-bg-hover border-button text-button' : 'bg-bg-default/0 border-border-default text-text-dim hover:bg-bg-hover'}`}
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
            title={isPinned ? '取消固定' : '固定'}
            type="button"
          >
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          <button
            className="p-1 rounded-md border border-border-default text-text-dim hover:bg-bg-hover disabled:opacity-50"
            onClick={(e) => { e.stopPropagation(); onClear?.(); }}
            title="清空"
            type="button"
            disabled={uniqueItems.length === 0}
          >
            <Trash2 size={14} />
          </button>
          <button
            className="p-1 rounded-md border border-border-default text-text-dim hover:bg-bg-hover"
            onClick={(e) => { e.stopPropagation(); if (isExpanded) onHide?.(); else onToggleExpand?.(); }}
            title={isExpanded ? '收起' : '展开'}
            type="button"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="h-[calc(100%-2rem)] p-2 overflow-y-auto no-scrollbar">
          {(activeCategory === 'definitions' ? defItems : refItems).length === 0 && (
            <div className="text-sm text-text-dim px-1 py-2">暂无结果</div>
          )}
          {(activeCategory === 'definitions' ? defItems : refItems).length > 0 && (
            <ul className="space-y-1">
              {(activeCategory === 'definitions' ? defItems : refItems).map((it) => (
                <li
                  key={`${it.filePath}-${it.kind}-${it.range.startLine}-${it.range.startColumn}-${it.source}`}
                  className="px-2 py-1 rounded-md hover:bg-bg-hover cursor-pointer flex items-center justify-between"
                  onClick={() => onItemClick(it.filePath, it.range)}
                  title={it.filePath}
                >
                  <span
                    className="text-xs truncate tooltip"
                    data-tooltip={`${it.filePath} · ${(it.range.startLine + (1 - (it.range.lineBase ?? 1)))}:${(it.range.startColumn + (1 - (it.range.columnBase ?? 1)))}`}
                  >
                    {it.filePath} · {(it.range.startLine + (1 - (it.range.lineBase ?? 1)))}:{(it.range.startColumn + (1 - (it.range.columnBase ?? 1)))}
                  </span>
                  <span className={`text-[10px] ${it.source === 'scip' ? 'text-green-600' : 'text-text-dim'}`}>{it.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!isExpanded && <div className="h-[calc(100%-2.5rem)]" />}
    </div>
  );
}
