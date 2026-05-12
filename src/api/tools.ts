import { api } from './index';
import type { ToolDefinition } from './llm-client';
import type { EditorContext } from '../types/ui';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the content of a file in the repository. Optionally specify a line range to read only a portion of the file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path relative to the repository root',
          },
          startLine: {
            type: 'number',
            description: 'Starting line number (1-based). If omitted, reads from the beginning.',
          },
          endLine: {
            type: 'number',
            description: 'Ending line number (1-based, inclusive). If omitted, reads to the end of the file.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'Search code content in the repository using Zoekt query syntax. Supports:\n- Content search: "function foo" or content:"exact phrase"\n- Symbol search: sym:"MyClass" to find definitions\n- File filter: file:"main.go" to restrict to specific files\n- Language filter: lang:"python" to search only Python files\n- Regex: /pattern/ for regex matching\n- Combine: sym:"MyFunction" file:"test" to narrow results\n- Case sensitivity: case:"yes" for exact case matching',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Zoekt search query. Supports content, sym:, file:, lang:, case:, regex: filters and logical operators (or for OR, space for AND).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_context',
      description: 'Get the file path and cursor position that the user is currently viewing in the editor. Use this when you need to understand what the user is looking at. This tool takes no parameters.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and directories at the specified path in the repository. Returns a directory listing with file names and types.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to repository root. Defaults to root if not specified.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for files by name pattern in the repository. Supports Zoekt file: syntax for filename matching.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'File name search query. Supports patterns like "main.go", file:/.*\.test\.ts/, or plain text.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_repositories',
      description: 'List all available repositories that can be browsed. Returns repository names and identifiers.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

export class ToolExecutor {
  constructor(
    private repoId: string,
    private getEditorContext?: () => EditorContext | null
  ) {}

  async execute(name: string, args: Record<string, string>): Promise<string> {
    try {
      switch (name) {
        case 'get_current_context': {
          const ctx = this.getEditorContext?.();
          if (!ctx) return 'No file is currently open in the editor.';
          const parts = [`File: ${ctx.filePath}`];
          if (ctx.line) parts.push(`Line: ${ctx.line}`);
          if (ctx.col) parts.push(`Column: ${ctx.col}`);
          return parts.join(', ');
        }
        case 'read_file': {
          const content = await api.getBlob(this.repoId, args.path);
          const lines = content.split('\n');
          const start = args.startLine ? Math.max(1, parseInt(args.startLine as any, 10)) : 1;
          const end = args.endLine ? Math.min(lines.length, parseInt(args.endLine as any, 10)) : lines.length;
          const sliced = lines.slice(start - 1, end);
          if (sliced.length > 200) {
            return sliced.slice(0, 200).join('\n') + `\n\n... (truncated, ${sliced.length} lines total in range)`;
          }
          return sliced.join('\n');
        }
        case 'search_code': {
          const resp = await api.searchContent(this.repoId, args.query, { pageSize: 30 });
          if (!resp?.results?.length) return 'No results found.';
          const limited = resp.results.slice(0, 15);
          const summary: Record<string, unknown> = {
            total: resp.total,
            showing: limited.length,
            results: limited,
          };
          if (resp.truncated) summary.truncated = true;
          return JSON.stringify(summary, null, 2);
        }
        case 'list_directory': {
          const tree = await api.getTree(this.repoId, args.path || '');
          if (!tree || tree.length === 0) return 'Empty directory or path not found.';
          return JSON.stringify(tree, null, 2);
        }
        case 'search_files': {
          const resp = await api.searchFiles(this.repoId, args.query, { pageSize: 30 });
          if (!resp?.files?.length) return 'No files found.';
          const limited = resp.files.slice(0, 15);
          const summary: Record<string, unknown> = {
            total: resp.total,
            showing: limited.length,
            files: limited,
          };
          if (resp.truncated) summary.truncated = true;
          return JSON.stringify(summary, null, 2);
        }
        case 'list_repositories': {
          const repos = await api.getRepositories();
          if (!repos || repos.length === 0) return 'No repositories available.';
          return JSON.stringify(repos, null, 2);
        }
        default:
          return `Unknown tool: ${name}`;
      }
    } catch (e) {
      return `Error executing ${name}: ${(e as Error).message}`;
    }
  }
}
