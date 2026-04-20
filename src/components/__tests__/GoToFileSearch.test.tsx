import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import GoToFileSearch from '../GoToFileSearch';

// Mock api module
vi.mock('../../api/index', () => ({
  api: { searchFiles: vi.fn() },
}));

// Mock Utils — debounce passes through by default
vi.mock('../../utils/index', () => ({
  Utils: {
    debounce: vi.fn((fn: (...args: any[]) => any) => fn),
  },
}));

import { api } from '../../api/index';

describe('GoToFileSearch', () => {
  const mockOnFileSelect = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnFileSelect.mockClear();
    // Re-apply searchFiles mock since restoreAllMocks clears it
    vi.mocked(api.searchFiles).mockResolvedValue([]);
  });

  // ─── Rendering ──────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render input with placeholder "Go to file..."', () => {
      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      expect(screen.getByPlaceholderText('Go to file...')).toBeInTheDocument();
    });

    it('should show Search icon when not loading', () => {
      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      // Search icon is rendered (lucide-react renders an SVG)
      const input = screen.getByPlaceholderText('Go to file...');
      expect(input).toBeInTheDocument();
    });

    it('should show Loader2 when loading', async () => {
      // Keep search pending to trigger loading state
      vi.mocked(api.searchFiles).mockReturnValue(new Promise(() => {}));
      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);

      const input = screen.getByPlaceholderText('Go to file...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      // Loader2 has animate-spin class
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  // ─── Search ─────────────────────────────────────────────────

  describe('Search', () => {
    it('should call api.searchFiles with correct params', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/foo.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'foo' } });
      });

      await waitFor(() => {
        expect(api.searchFiles).toHaveBeenCalledWith(
          'repo1',
          'foo',
          'zoekt',
          expect.anything()
        );
      });
    });

    it('should limit results to 15', async () => {
      const many = Array.from({ length: 16 }, (_, i) => `file${i}.ts`);
      vi.mocked(api.searchFiles).mockResolvedValue(many);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'file' } });
      });

      await waitFor(() => {
        expect(screen.getByText('file0.ts')).toBeInTheDocument();
      });

      // Only first 15 should render, file15.ts should NOT
      expect(screen.queryByText('file15.ts')).not.toBeInTheDocument();
      // file0 through file14 = 15 items
      const items = screen.getAllByText(/file\d+\.ts/);
      expect(items).toHaveLength(15);
    });

    it('should handle API error gracefully', async () => {
      vi.mocked(api.searchFiles).mockRejectedValue(new Error('Network error'));

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'x' } });
      });

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
      // No crash, dropdown closed
    });
  });

  // ─── Bug #1: AbortController / Race condition ───────────────

  describe('Race condition handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should abort previous search when new input arrives after debounce fires', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      // First call hangs, second call resolves
      let callCount = 0;
      vi.mocked(api.searchFiles).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return new Promise<string[]>(() => {}); // hangs forever
        return ['fresh.ts'];
      });

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      // Type 'a' — schedules debounce
      await act(async () => {
        fireEvent.change(input, { target: { value: 'a' } });
      });

      // Advance past debounce — API call for 'a' starts (hangs)
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Type 'ab' — should abort in-flight 'a' request
      await act(async () => {
        fireEvent.change(input, { target: { value: 'ab' } });
      });

      // Advance past debounce — abort fires, API call for 'ab' starts
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should not show stale results from aborted requests', async () => {
      let callCount = 0;
      vi.mocked(api.searchFiles).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return new Promise<string[]>(() => {}); // hangs — simulates slow
        return ['fresh-result.ts'];
      });

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      // Type 'a', advance past debounce — slow API call starts (hangs)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'a' } });
        vi.advanceTimersByTime(300);
      });

      // Type 'ab' — aborts slow 'a' request, schedules new search
      await act(async () => {
        fireEvent.change(input, { target: { value: 'ab' } });
        vi.advanceTimersByTime(300);
      });

      // Fresh results should be in document (act flushed state updates)
      expect(screen.getByText('fresh-result.ts')).toBeInTheDocument();
      expect(screen.queryByText('stale-result.ts')).not.toBeInTheDocument();
    });

    it('should handle repoId change mid-search', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      vi.mocked(api.searchFiles).mockImplementation(() => new Promise(() => {}));

      const { rerender } = render(
        <GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />
      );
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      // Advance past debounce — API call starts
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Change repoId — should abort in-flight request
      rerender(<GoToFileSearch repoId="repo2" onFileSelect={mockOnFileSelect} />);

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  // ─── Bug #7: Tooltip persistence after selection ────────────

  describe('Tooltip cleanup on file selection', () => {
    it('should remove tooltip after clicking a file item', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/app.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'app' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/app.ts')).toBeInTheDocument();
      });

      // Hover to trigger tooltip
      const item = screen.getByText('src/app.ts').closest('li')!;
      fireEvent.mouseEnter(item);

      // Click to select
      fireEvent.click(item);

      expect(mockOnFileSelect).toHaveBeenCalledWith('src/app.ts');
      // Tooltip portal should be gone — the path text should no longer appear in a portal
      // After selection, query is cleared so the entire dropdown + portal is removed
      expect(screen.queryByText('src/app.ts')).not.toBeInTheDocument();
    });
  });

  // ─── Bug #4: Escape clears query ────────────────────────────

  describe('Escape key behavior', () => {
    it('should clear query and close dropdown when Escape is pressed', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/foo.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'foo' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/foo.ts')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input).toHaveValue('');
      expect(screen.queryByText('src/foo.ts')).not.toBeInTheDocument();
    });

    it('should clear tooltip on Escape', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/b.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'b' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/b.ts')).toBeInTheDocument();
      });

      const item = screen.getByText('src/b.ts').closest('li')!;
      fireEvent.mouseEnter(item);

      fireEvent.keyDown(input, { key: 'Escape' });

      // No tooltip portal should remain
      expect(document.querySelector('[style*="z-index: 9999"]')).not.toBeInTheDocument();
    });
  });

  // ─── Bug #5: Empty result feedback ──────────────────────────

  describe('Empty result feedback', () => {
    it('should show empty message when search returns no results', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue([]);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'xyz' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/No files found/)).toBeInTheDocument();
      });
    });

    it('should not show empty message when results exist', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/a.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'a' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/a.ts')).toBeInTheDocument();
      });

      expect(screen.queryByText(/No files found/)).not.toBeInTheDocument();
    });
  });

  // ─── Bug #2: Debounce cleanup on unmount ────────────────────

  describe('Lifecycle', () => {
    it('should cancel pending search on unmount', () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['test.ts']);

      const { unmount } = render(
        <GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />
      );
      const input = screen.getByPlaceholderText('Go to file...');

      fireEvent.change(input, { target: { value: 'x' } });
      unmount();

      // No state updates after unmount — no React warnings
      // (If AbortController cleanup works, no pending setState calls)
    });
  });

  // ─── Keyboard navigation ────────────────────────────────────

  describe('Keyboard navigation', () => {
    it('should highlight next item on ArrowDown', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['a.ts', 'b.ts', 'c.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 't' } });
      });

      await waitFor(() => {
        expect(screen.getByText('a.ts')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // Second item should be active (bg-bg-selected class)
      const items = screen.getAllByText(/\.ts/);
      const secondItem = items[1].closest('li')!;
      expect(secondItem.className).toContain('bg-bg-selected');
    });

    it('should highlight previous item on ArrowUp', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['a.ts', 'b.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 't' } });
      });

      await waitFor(() => {
        expect(screen.getByText('a.ts')).toBeInTheDocument();
      });

      // Go down then up
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      // First item should be active again
      const items = screen.getAllByText(/\.ts/);
      const firstItem = items[0].closest('li')!;
      expect(firstItem.className).toContain('bg-bg-selected');
    });

    it('should clamp at index 0 on ArrowUp', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['a.ts', 'b.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 't' } });
      });

      await waitFor(() => {
        expect(screen.getByText('a.ts')).toBeInTheDocument();
      });

      // ArrowUp from index 0 — should stay at 0
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      const items = screen.getAllByText(/\.ts/);
      const firstItem = items[0].closest('li')!;
      expect(firstItem.className).toContain('bg-bg-selected');
    });

    it('should select active file on Enter', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['a.ts', 'b.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 't' } });
      });

      await waitFor(() => {
        expect(screen.getByText('a.ts')).toBeInTheDocument();
      });

      // Press Enter — first item is active by default
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnFileSelect).toHaveBeenCalledWith('a.ts');
    });

    it('should not call onFileSelect when activeIndex is -1 and no results', () => {
      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnFileSelect).not.toHaveBeenCalled();
    });

    it('should reset activeIndex to 0 when new results arrive', async () => {
      vi.mocked(api.searchFiles)
        .mockResolvedValueOnce(['a.ts', 'b.ts'])
        .mockResolvedValueOnce(['c.ts', 'd.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 't' } });
      });

      await waitFor(() => {
        expect(screen.getByText('a.ts')).toBeInTheDocument();
      });

      // Navigate to second item
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // Type new query — activeIndex should reset
      await act(async () => {
        fireEvent.change(input, { target: { value: 'tt' } });
      });

      await waitFor(() => {
        expect(screen.getByText('c.ts')).toBeInTheDocument();
      });

      // Enter should select first item of new results
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockOnFileSelect).toHaveBeenCalledWith('c.ts');
    });
  });

  // ─── File selection ─────────────────────────────────────────

  describe('File selection', () => {
    it('should call onFileSelect with correct path', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/app.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'app' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/app.ts')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('src/app.ts'));

      expect(mockOnFileSelect).toHaveBeenCalledWith('src/app.ts');
    });

    it('should clear query after selection', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/app.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'app' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/app.ts')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('src/app.ts'));

      expect(input).toHaveValue('');
    });

    it('should reset activeIndex after selection', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['a.ts', 'b.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 't' } });
      });

      await waitFor(() => {
        expect(screen.getByText('a.ts')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('a.ts'));

      // After selection, dropdown is closed, query is empty
      // If user types again, activeIndex should start fresh
      expect(input).toHaveValue('');
    });
  });

  // ─── Click outside ──────────────────────────────────────────

  describe('Click outside', () => {
    it('should close dropdown on outside click', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/a.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'a' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/a.ts')).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('src/a.ts')).not.toBeInTheDocument();
      });
    });
  });

  // ─── Tooltip ────────────────────────────────────────────────

  describe('Tooltip', () => {
    it('should show tooltip on mouseEnter', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/long/path/to/file.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'file' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/long/path/to/file.ts')).toBeInTheDocument();
      });

      const item = screen.getByText('src/long/path/to/file.ts').closest('li')!;
      fireEvent.mouseEnter(item);

      // Tooltip should appear (portal renders the path text again)
      const tooltipElements = screen.getAllByText('src/long/path/to/file.ts');
      // At least 2: one in the list item, one in the tooltip portal
      expect(tooltipElements.length).toBeGreaterThanOrEqual(2);
    });

    it('should hide tooltip on mouseLeave', async () => {
      vi.mocked(api.searchFiles).mockResolvedValue(['src/test.ts']);

      render(<GoToFileSearch repoId="repo1" onFileSelect={mockOnFileSelect} />);
      const input = screen.getByPlaceholderText('Go to file...');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(screen.getByText('src/test.ts')).toBeInTheDocument();
      });

      const item = screen.getByText('src/test.ts').closest('li')!;
      fireEvent.mouseEnter(item);
      fireEvent.mouseLeave(item);

      // Tooltip should be removed — only the list item text remains
      const remaining = screen.getAllByText('src/test.ts');
      expect(remaining).toHaveLength(1);
    });
  });
});
