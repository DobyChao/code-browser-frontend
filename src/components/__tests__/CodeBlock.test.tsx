import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeBlock } from '../CodeBlock';

// Mock api module
vi.mock('../../api/index', () => ({
  api: {
    getBlob: vi.fn(),
  },
}));

// Mock Utils module
vi.mock('../../utils/index', () => ({
  Utils: {
    getLanguageFromPath: vi.fn(),
  },
}));

// Mock Prism
vi.mock('prismjs', () => ({
  default: {
    highlight: vi.fn(),
    languages: {
      javascript: {},
      typescript: {},
      python: {},
      plaintext: {},
    },
  },
}));

import { api } from '../../api/index';
import { Utils } from '../../utils/index';
import Prism from 'prismjs';

describe('CodeBlock', () => {
  const mockOnNavigate = vi.fn();
  const defaultProps = {
    src: 'src/test.ts',
    repoId: 'test-repo',
    onNavigate: mockOnNavigate,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('should render file path header with line range', async () => {
      vi.mocked(api.getBlob).mockResolvedValue('line 1\nline 2\nline 3');
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue('<span>line 1</span>\n<span>line 2</span>\n<span>line 3</span>');

      render(<CodeBlock {...defaultProps} startLine={1} endLine={3} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();
      expect(await screen.findByText(/\(Lines 1-3\)/)).toBeInTheDocument();
    });

    it('should render file path header without line range when not specified', async () => {
      vi.mocked(api.getBlob).mockResolvedValue('line 1\nline 2');
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue('<span>line 1</span>\n<span>line 2</span>');

      render(<CodeBlock {...defaultProps} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();
    });

    it('should render line numbers as clickable elements', async () => {
      const content = Array.from({ length: 5 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue(content);

      render(<CodeBlock {...defaultProps} startLine={1} endLine={5} />);

      // Wait for component to render
      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();

      // Check that line numbers are rendered
      const lineNumbers = screen.getAllByText(/^\d+$/);
      expect(lineNumbers.length).toBeGreaterThan(0);
    });

    it('should use Prism.highlight with correct language for syntax highlighting', async () => {
      vi.mocked(api.getBlob).mockResolvedValue('const x = 1;');
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue('<span>const x = 1;</span>');

      render(<CodeBlock {...defaultProps} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();
      expect(Prism.highlight).toHaveBeenCalledWith(
        'const x = 1;',
        expect.any(Object),
        'typescript'
      );
    });

    it('should detect language from file path using Utils.getLanguageFromPath', async () => {
      vi.mocked(api.getBlob).mockResolvedValue('code');
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('python');
      vi.mocked(Prism.highlight).mockReturnValue('<span>code</span>');

      render(<CodeBlock {...defaultProps} src="test.py" />);

      expect(await screen.findByText(/test\.py/)).toBeInTheDocument();
      expect(Utils.getLanguageFromPath).toHaveBeenCalledWith('test.py');
      expect(Prism.highlight).toHaveBeenCalledWith(
        'code',
        expect.any(Object),
        'python'
      );
    });
  });

  describe('Interaction', () => {
    it('should call onNavigate when line number is clicked', async () => {
      const content = 'line 1\nline 2\nline 3';
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue(content);

      render(<CodeBlock {...defaultProps} startLine={1} endLine={3} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();

      // Find and click the first line number
      const lineNumbers = screen.getAllByText(/^\d+$/);
      fireEvent.click(lineNumbers[0]);

      expect(mockOnNavigate).toHaveBeenCalledWith('src/test.ts', 1);
    });

    it('should pass correct line number to onNavigate for different lines', async () => {
      const content = 'line 1\nline 2\nline 3';
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue(content);

      render(<CodeBlock {...defaultProps} startLine={1} endLine={3} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();

      const lineNumbers = screen.getAllByText(/^\d+$/);
      fireEvent.click(lineNumbers[1]); // Click second line

      expect(mockOnNavigate).toHaveBeenCalledWith('src/test.ts', 2);
    });
  });

  describe('Line truncation', () => {
    it('should truncate at 50 lines when content exceeds limit', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockImplementation((code) => code);

      render(<CodeBlock {...defaultProps} startLine={1} endLine={100} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();

      // Should show "查看完整文件" button when truncated
      expect(await screen.findByText(/查看完整文件/)).toBeInTheDocument();
    });

    it('should show only first 50 lines when truncated', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockImplementation((code) => code);

      render(<CodeBlock {...defaultProps} startLine={1} endLine={100} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();

      // Check that we have line numbers (should be 50)
      const lineNumbers = screen.getAllByText(/^\d+$/);
      expect(lineNumbers.length).toBe(50);
    });

    it('should not truncate when content is within 50 lines', async () => {
      const content = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockImplementation((code) => code);

      render(<CodeBlock {...defaultProps} startLine={1} endLine={30} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();

      // Should not show "查看完整文件" button
      expect(screen.queryByText(/查看完整文件/)).not.toBeInTheDocument();
    });

    it('should call onNavigate with original file path when "查看完整文件" is clicked', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockImplementation((code) => code);

      render(<CodeBlock {...defaultProps} src="path/to/file.ts" />);

      const viewFullButton = await screen.findByText(/查看完整文件/);
      fireEvent.click(viewFullButton);

      expect(mockOnNavigate).toHaveBeenCalledWith('path/to/file.ts', 1);
    });
  });

  describe('Error handling', () => {
    it('should show "文件未找到" when API call fails', async () => {
      vi.mocked(api.getBlob).mockRejectedValue(new Error('Not found'));

      render(<CodeBlock {...defaultProps} />);

      expect(await screen.findByText(/文件未找到/)).toBeInTheDocument();
    });

    it('should show "行号超出范围" when startLine exceeds total lines', async () => {
      const content = 'line 1\nline 2\nline 3';
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');

      render(<CodeBlock {...defaultProps} startLine={10} endLine={20} />);

      expect(await screen.findByText(/行号超出范围/)).toBeInTheDocument();
    });

    it('should show "行号超出范围" when startLine is greater than endLine', async () => {
      const content = 'line 1\nline 2\nline 3';
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');

      render(<CodeBlock {...defaultProps} startLine={20} endLine={10} />);

      expect(await screen.findByText(/行号超出范围/)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle files with no startLine/endLine - show from line 1, max 50 lines', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.mocked(api.getBlob).mockResolvedValue(content);
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockImplementation((code) => code);

      render(<CodeBlock {...defaultProps} src="test.ts" />);

      expect(await screen.findByText(/test\.ts/)).toBeInTheDocument();

      // Should truncate to 50 lines
      expect(await screen.findByText(/查看完整文件/)).toBeInTheDocument();
      const lineNumbers = screen.getAllByText(/^\d+$/);
      expect(lineNumbers.length).toBe(50);
    });

    it('should handle empty file content', async () => {
      vi.mocked(api.getBlob).mockResolvedValue('');
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue('');

      render(<CodeBlock {...defaultProps} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();
    });

    it('should handle single line file', async () => {
      vi.mocked(api.getBlob).mockResolvedValue('single line');
      vi.mocked(Utils.getLanguageFromPath).mockReturnValue('typescript');
      vi.mocked(Prism.highlight).mockReturnValue('<span>single line</span>');

      render(<CodeBlock {...defaultProps} startLine={1} endLine={1} />);

      expect(await screen.findByText(/src\/test\.ts/)).toBeInTheDocument();
      expect(await screen.findByText(/\(Lines 1-1\)/)).toBeInTheDocument();
    });
  });
});