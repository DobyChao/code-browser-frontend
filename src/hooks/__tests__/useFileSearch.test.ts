import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileSearch } from '../useFileSearch';

vi.mock('../../api/index', () => ({
  api: { searchFiles: vi.fn() },
}));

import { api } from '../../api/index';

describe('useFileSearch', () => {
  const mockOnFileSelect = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnFileSelect.mockClear();
    vi.mocked(api.searchFiles).mockResolvedValue([]);
  });

  describe('Initial state', () => {
    it('should return correct defaults', () => {
      const { result } = renderHook(() => useFileSearch('repo1', mockOnFileSelect));

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isDropdownOpen).toBe(false);
      expect(result.current.activeIndex).toBe(-1);
    });
  });

  describe('Search flow', () => {
    it('should search and return results', async () => {
      vi.useFakeTimers();
      vi.mocked(api.searchFiles).mockResolvedValue(['a.ts', 'b.ts']);

      const { result } = renderHook(() => useFileSearch('repo1', mockOnFileSelect));

      act(() => { result.current.setQuery('a'); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { vi.advanceTimersByTime(300); });

      expect(result.current.results).toEqual(['a.ts', 'b.ts']);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isDropdownOpen).toBe(true);
      expect(result.current.activeIndex).toBe(0);

      vi.useRealTimers();
    });

    it('should handle empty results with dropdown open', async () => {
      vi.useFakeTimers();
      vi.mocked(api.searchFiles).mockResolvedValue([]);

      const { result } = renderHook(() => useFileSearch('repo1', mockOnFileSelect));

      act(() => { result.current.setQuery('xyz'); });

      await act(async () => { vi.advanceTimersByTime(300); });

      expect(result.current.results).toEqual([]);
      expect(result.current.isDropdownOpen).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Abort behavior', () => {
    it('should abort on rapid input', async () => {
      vi.useFakeTimers();
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      vi.mocked(api.searchFiles).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useFileSearch('repo1', mockOnFileSelect));

      act(() => { result.current.setQuery('a'); });
      await act(async () => { vi.advanceTimersByTime(300); });

      act(() => { result.current.setQuery('ab'); });
      await act(async () => { vi.advanceTimersByTime(300); });

      expect(abortSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle repoId change by aborting and resetting', async () => {
      vi.useFakeTimers();
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      vi.mocked(api.searchFiles).mockImplementation(() => new Promise(() => {}));

      const { result, rerender } = renderHook(
        ({ repoId }) => useFileSearch(repoId, mockOnFileSelect),
        { initialProps: { repoId: 'repo1' } }
      );

      act(() => { result.current.setQuery('test'); });
      await act(async () => { vi.advanceTimersByTime(300); });

      // Change repoId
      rerender({ repoId: 'repo2' });

      expect(abortSpy).toHaveBeenCalled();
      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isDropdownOpen).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('selectFile', () => {
    it('should reset all state and call onFileSelect', async () => {
      vi.useFakeTimers();
      vi.mocked(api.searchFiles).mockResolvedValue(['a.ts']);

      const { result } = renderHook(() => useFileSearch('repo1', mockOnFileSelect));

      act(() => { result.current.setQuery('a'); });
      await act(async () => { vi.advanceTimersByTime(300); });

      expect(result.current.results).toEqual(['a.ts']);

      act(() => { result.current.selectFile('a.ts'); });

      expect(mockOnFileSelect).toHaveBeenCalledWith('a.ts');
      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isDropdownOpen).toBe(false);
      expect(result.current.activeIndex).toBe(-1);

      vi.useRealTimers();
    });
  });

  describe('Error handling', () => {
    it('should handle API error and close dropdown', async () => {
      vi.useFakeTimers();
      vi.mocked(api.searchFiles).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFileSearch('repo1', mockOnFileSelect));

      act(() => { result.current.setQuery('x'); });
      await act(async () => { vi.advanceTimersByTime(300); });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isDropdownOpen).toBe(false);
      expect(result.current.results).toEqual([]);

      vi.useRealTimers();
    });
  });
});
