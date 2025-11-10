import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Loader2, Search, FileText } from 'lucide-react';
import { api } from '../api';
import { Utils } from '../utils';

interface GoToFileSearchProps {
  repoId: string;
  onFileSelect: (path: string) => void;
}

export default function GoToFileSearch({ repoId, onFileSelect }: GoToFileSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useMemo(
    () =>
      Utils.debounce(async (searchQuery: string) => {
        if (!searchQuery) {
          setResults([]);
          setIsLoading(false);
          setIsDropdownOpen(false);
          return;
        }
        try {
          const files = await api.searchFiles(repoId, searchQuery, 'zoekt');
          setResults(files.slice(0, 15)); // 限制最多15个结果
          setIsLoading(false);
          setIsDropdownOpen(files.length > 0);
          setActiveIndex(0); // 默认选中第一个
        } catch (error) {
          console.error('File search failed:', error);
          setIsLoading(false);
          setIsDropdownOpen(false);
        }
      }, 300),
    [repoId]
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsLoading(true);
    debouncedSearch(newQuery);
  };

  const handleSelectFile = (path: string) => {
    onFileSelect(path);
    setQuery('');
    setResults([]);
    setIsDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelectFile(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-text-dim" />
          ) : (
            <Search size={16} className="text-text-dim" />
          )}
        </div>
        <input
          type="text"
          placeholder="Go to file..."
          className="w-full pl-8 pr-2 py-1 text-sm bg-bg-input border border-border-input rounded-sm"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsDropdownOpen(results.length > 0)}
        />
      </div>
      {isDropdownOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-bg-default border border-border-default rounded-md shadow-lg max-h-60 overflow-y-auto no-scrollbar">
          <ul className="py-1">
            {results.map((path, index) => (
              <li
                key={path}
                className={`flex items-center space-x-2 px-3 py-1.5 text-sm cursor-pointer ${
                  index === activeIndex ? 'bg-bg-selected text-text-selected' : 'hover:bg-bg-hover'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelectFile(path)}
              >
                <FileText size={16} className="flex-shrink-0 text-text-dim" />
                <span className="truncate">{path}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}