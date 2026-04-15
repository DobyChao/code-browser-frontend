import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TOOL_DEFINITIONS, ToolExecutor } from '../tools';

// Mock api module
vi.mock('../index', () => ({
  api: {
    getTree: vi.fn(),
    searchFiles: vi.fn(),
    getRepositories: vi.fn(),
    getBlob: vi.fn(),
    searchContent: vi.fn(),
  },
}));

import { api } from '../index';

function findToolDef(name: string) {
  return TOOL_DEFINITIONS.find(t => t.function.name === name);
}

describe('New Tools: list_directory, search_files, list_repositories', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.restoreAllMocks();
    executor = new ToolExecutor('test-repo');
  });

  // --- list_directory ---
  describe('list_directory', () => {
    it('should have correct tool definition', () => {
      const def = findToolDef('list_directory');
      expect(def).toBeDefined();
      expect(def!.type).toBe('function');
      expect(def!.function.name).toBe('list_directory');
      expect(def!.function.parameters!.required).toEqual([]);
    });

    it('should have path parameter that is optional', () => {
      const def = findToolDef('list_directory');
      const props = def!.function.parameters!.properties as any;
      expect(props.path).toBeDefined();
      expect(props.path.type).toBe('string');
    });

    it('should call api.getTree and return JSON result', async () => {
      const mockTree = [
        { name: 'src', type: 'dir' },
        { name: 'main.ts', type: 'file' },
      ];
      vi.spyOn(api, 'getTree').mockResolvedValue(mockTree as any);

      const result = await executor.execute('list_directory', { path: 'src' });
      expect(api.getTree).toHaveBeenCalledWith('test-repo', 'src');
      expect(result).toBe(JSON.stringify(mockTree, null, 2));
    });

    it('should default to empty path when no path provided', async () => {
      vi.spyOn(api, 'getTree').mockResolvedValue([]);
      await executor.execute('list_directory', {});
      expect(api.getTree).toHaveBeenCalledWith('test-repo', '');
    });

    it('should return message for empty directory', async () => {
      vi.spyOn(api, 'getTree').mockResolvedValue([]);
      const result = await executor.execute('list_directory', { path: 'empty-dir' });
      expect(result).toContain('Empty');
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(api, 'getTree').mockRejectedValue(new Error('Not found'));
      const result = await executor.execute('list_directory', { path: 'bad' });
      expect(result).toContain('Error');
    });
  });

  // --- search_files ---
  describe('search_files', () => {
    it('should have correct tool definition', () => {
      const def = findToolDef('search_files');
      expect(def).toBeDefined();
      expect(def!.function.name).toBe('search_files');
      expect(def!.function.parameters!.required).toEqual(['query']);
    });

    it('should call api.searchFiles with zoekt engine', async () => {
      const mockResults = [{ filename: 'test.ts', repo: 'test' }];
      vi.spyOn(api, 'searchFiles').mockResolvedValue(mockResults as any);

      const result = await executor.execute('search_files', { query: '*.test.ts' });
      expect(api.searchFiles).toHaveBeenCalledWith('test-repo', '*.test.ts', 'zoekt');
      expect(result).toBe(JSON.stringify(mockResults, null, 2));
    });

    it('should limit results to 15', async () => {
      const many = Array.from({ length: 20 }, (_, i) => ({ filename: `file${i}.ts` }));
      vi.spyOn(api, 'searchFiles').mockResolvedValue(many as any);

      const result = await executor.execute('search_files', { query: '*.ts' });
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(15);
    });

    it('should return message for no results', async () => {
      vi.spyOn(api, 'searchFiles').mockResolvedValue([]);
      const result = await executor.execute('search_files', { query: 'nonexistent' });
      expect(result).toContain('No files found');
    });
  });

  // --- list_repositories ---
  describe('list_repositories', () => {
    it('should have correct tool definition', () => {
      const def = findToolDef('list_repositories');
      expect(def).toBeDefined();
      expect(def!.function.name).toBe('list_repositories');
      expect(def!.function.parameters!.required).toEqual([]);
    });

    it('should call api.getRepositories', async () => {
      const mockRepos = [{ id: 'repo1', name: 'My Repo' }];
      vi.spyOn(api, 'getRepositories').mockResolvedValue(mockRepos as any);

      const result = await executor.execute('list_repositories', {});
      expect(api.getRepositories).toHaveBeenCalled();
      expect(result).toBe(JSON.stringify(mockRepos, null, 2));
    });

    it('should return message when no repositories', async () => {
      vi.spyOn(api, 'getRepositories').mockResolvedValue([]);
      const result = await executor.execute('list_repositories', {});
      expect(result).toContain('No repositories');
    });
  });
});

describe('Enhanced Tools: search_code, read_file, descriptions', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.restoreAllMocks();
    executor = new ToolExecutor('test-repo');
  });

  // --- search_code enhancement ---
  describe('search_code (enhanced)', () => {
    it('should have description mentioning Zoekt syntax hints', () => {
      const def = findToolDef('search_code');
      expect(def).toBeDefined();
      const desc = def!.function.description;
      expect(desc).toContain('sym:');
      expect(desc).toContain('file:');
      expect(desc).toContain('lang:');
    });

    it('should still work with basic content search', async () => {
      const mockResults = [{ filename: 'a.ts', line: 1, content: 'hello' }];
      vi.spyOn(api, 'searchContent').mockResolvedValue(mockResults as any);

      const result = await executor.execute('search_code', { query: 'hello' });
      expect(api.searchContent).toHaveBeenCalledWith('test-repo', 'hello', 'zoekt');
      expect(JSON.parse(result)).toHaveLength(1);
    });
  });

  // --- read_file enhancement ---
  describe('read_file (enhanced with line range)', () => {
    it('should have optional startLine and endLine parameters', () => {
      const def = findToolDef('read_file');
      const props = def!.function.parameters!.properties as any;
      expect(props.startLine).toBeDefined();
      expect(props.startLine.type).toBe('number');
      expect(props.endLine).toBeDefined();
      expect(props.endLine.type).toBe('number');
    });

    it('should return full file when no line range specified', async () => {
      const content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.spyOn(api, 'getBlob').mockResolvedValue(content);

      const result = await executor.execute('read_file', { path: 'test.ts' });
      expect(result.split('\n')).toHaveLength(50);
    });

    it('should return only specified line range', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.spyOn(api, 'getBlob').mockResolvedValue(content);

      const result = await executor.execute('read_file', { path: 'test.ts', startLine: '10', endLine: '20' });
      const lines = result.split('\n');
      expect(lines).toHaveLength(11); // lines 10 through 20 inclusive
      expect(lines[0]).toBe('line 10');
      expect(lines[lines.length - 1]).toBe('line 20');
    });

    it('should return from startLine to end of file when no endLine', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
      vi.spyOn(api, 'getBlob').mockResolvedValue(content);

      const result = await executor.execute('read_file', { path: 'test.ts', startLine: '95' });
      const lines = result.split('\n');
      expect(lines).toHaveLength(6); // lines 95 through 100
      expect(lines[0]).toBe('line 95');
    });

    it('should handle startLine=1 correctly (1-based)', async () => {
      const content = 'first line\nsecond line\nthird line';
      vi.spyOn(api, 'getBlob').mockResolvedValue(content);

      const result = await executor.execute('read_file', { path: 'test.ts', startLine: '1', endLine: '2' });
      const lines = result.split('\n');
      expect(lines).toEqual(['first line', 'second line']);
    });
  });

  // --- Description language ---
  describe('Tool descriptions', () => {
    it('should have get_current_context description in English', () => {
      const def = findToolDef('get_current_context');
      const desc = def!.function.description;
      // Should not contain Chinese characters
      expect(desc).not.toMatch(/[\u4e00-\u9fff]/);
      expect(desc).toContain('file');
      expect(desc).toContain('cursor');
    });

    it('should have all tool descriptions in English', () => {
      for (const def of TOOL_DEFINITIONS) {
        const desc = def.function.description;
        expect(desc).not.toMatch(/[\u4e00-\u9fff]/);
      }
    });
  });
});