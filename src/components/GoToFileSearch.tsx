import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Search, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useFileSearch } from '../hooks/useFileSearch';

interface GoToFileSearchProps {
  repoId: string;
  onFileSelect: (path: string) => void;
}

interface TooltipState {
  path: string;
  x: number;
  y: number;
}

export default function GoToFileSearch({ repoId, onFileSelect }: GoToFileSearchProps) {
  const search = useFileSearch(repoId, onFileSelect);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        search.setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [search.setDropdownOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
          {search.isLoading ? (
            <Loader2 size={16} className="animate-spin text-text-dim" />
          ) : (
            <Search size={16} className="text-text-dim" />
          )}
        </div>
        <input
          type="text"
          placeholder="Go to file..."
          className="w-full pl-8 pr-2 py-1 text-sm bg-bg-input border border-border-input rounded-sm"
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTooltip(null);
            search.handleKeyDown(e);
          }}
          onFocus={() => search.setDropdownOpen(search.query.length > 0)}
        />
      </div>
      {search.isDropdownOpen && search.query.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-bg-default border border-border-default rounded-md shadow-lg max-h-60 overflow-y-auto no-scrollbar">
          {search.results.length > 0 ? (
            <ul className="py-1">
              {search.results.map((path, index) => (
                <li
                  key={path}
                  className={`flex items-center space-x-2 px-3 py-1.5 text-sm cursor-pointer ${
                    index === search.activeIndex ? 'bg-bg-selected text-text-selected' : 'hover:bg-bg-hover'
                  }`}
                  onMouseEnter={(e) => {
                    search.setActiveIndex(index);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ path, x: rect.right + 6, y: rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => {
                    setTooltip(null);
                    search.selectFile(path);
                  }}
                >
                  <FileText size={16} className="flex-shrink-0 text-text-dim" />
                  <span className="truncate">{path}</span>
                </li>
              ))}
            </ul>
          ) : !search.isLoading ? (
            <div className="px-3 py-2 text-sm text-text-dim">No files found</div>
          ) : null}
        </div>
      )}
      {tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="px-2 py-1 text-xs rounded bg-bg-default text-text-default border border-border-default shadow-lg whitespace-nowrap"
        >
          {tooltip.path}
        </div>,
        document.body
      )}
    </div>
  );
}
