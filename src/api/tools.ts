import { api } from './index';
import type { ToolDefinition } from './llm-client';
import type { EditorContext } from '../types/ui';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the content of a file in the repository. Returns the file content as a string.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path relative to the repository root',
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
      description: 'Search code content in the repository using Zoekt syntax. Supports patterns like "const", "function foo", regex, and file filters.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Zoekt search query (supports exact match, regex, file: filters)',
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
      description: '获取用户当前在编辑器中查看的文件路径和光标位置。当需要了解用户正在关注哪些代码时调用此工具。此工具无需参数。',
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
          if (!ctx) return '用户当前没有打开任何文件。';
          const parts = [`文件: ${ctx.filePath}`];
          if (ctx.line) parts.push(`行: ${ctx.line}`);
          if (ctx.col) parts.push(`列: ${ctx.col}`);
          return parts.join(', ');
        }
        case 'read_file': {
          const content = await api.getBlob(this.repoId, args.path);
          // Truncate very long files to keep context manageable
          const lines = content.split('\n');
          if (lines.length > 200) {
            return lines.slice(0, 200).join('\n') + `\n\n... (truncated, ${lines.length} lines total)`;
          }
          return content;
        }
        case 'search_code': {
          const results = await api.searchContent(this.repoId, args.query, 'zoekt');
          if (!results || results.length === 0) return 'No results found.';
          // Limit results to keep context manageable
          const limited = results.slice(0, 15);
          return JSON.stringify(limited, null, 2);
        }
        default:
          return `Unknown tool: ${name}`;
      }
    } catch (e) {
      return `Error executing ${name}: ${(e as Error).message}`;
    }
  }
}
