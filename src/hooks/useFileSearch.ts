import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../api';

export interface UseFileSearchReturn {
  query: string;
  results: string[];
  isLoading: boolean;
  isDropdownOpen: boolean;
  activeIndex: number;
  setQuery: (query: string) => void;
  selectFile: (path: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  setDropdownOpen: (open: boolean) => void;
  setActiveIndex: (index: number) => void;
}

export function useFileSearch(
  repoId: string,
  onFileSelect: (path: string) => void
): UseFileSearchReturn {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef('');

  // Refs for accessing latest state in handleKeyDown
  const resultsRef = useRef<string[]>([]);
  const activeIndexRef = useRef(-1);

  resultsRef.current = results;
  activeIndexRef.current = activeIndex;

  const setQuery = useCallback((newQuery: string) => {
    queryRef.current = newQuery;
    setQueryState(newQuery);

    if (!newQuery) {
      setResults([]);
      setIsLoading(false);
      setIsDropdownOpen(false);
      return;
    }
    setIsLoading(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const files = await api.searchFiles(repoId, queryRef.current, 'zoekt', {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setResults(files.slice(0, 15));
        setIsLoading(false);
        setIsDropdownOpen(true);
        setActiveIndex(0);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('File search failed:', error);
        setIsLoading(false);
        setIsDropdownOpen(false);
      }
    }, 300);
  }, [repoId]);

  const selectFile = useCallback((path: string) => {
    onFileSelect(path);
    setQueryState('');
    queryRef.current = '';
    setResults([]);
    setIsLoading(false);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [onFileSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIdx = resultsRef.current.length - 1;
      setActiveIndex((prev) => Math.min(prev + 1, maxIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = activeIndexRef.current;
      const r = resultsRef.current;
      if (idx >= 0 && r[idx]) {
        selectFile(r[idx]);
      }
    } else if (e.key === 'Escape') {
      setQueryState('');
      queryRef.current = '';
      setResults([]);
      setIsLoading(false);
      setIsDropdownOpen(false);
      setActiveIndex(-1);
      abortRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [selectFile]);

  // Cancel on repoId change
  useEffect(() => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setQueryState('');
    queryRef.current = '';
    setResults([]);
    setIsDropdownOpen(false);
    setIsLoading(false);
    setActiveIndex(-1);
  }, [repoId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    query,
    results,
    isLoading,
    isDropdownOpen,
    activeIndex,
    setQuery,
    selectFile,
    handleKeyDown,
    setDropdownOpen: setIsDropdownOpen,
    setActiveIndex,
  };
}
