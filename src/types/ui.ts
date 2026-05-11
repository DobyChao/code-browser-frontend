import type { ContentSearchResult } from '../api/types';

export type SearchPanelState = {
  query: string;
  searchType: 'content' | 'file';
  viewMode: 'tree' | 'list';
  results: ContentSearchResult[] | string[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  useZoektSyntax: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  isRegex: boolean;
  includePattern: string;
  excludePattern: string;
  showAdvanced: boolean;
};

export type ToolCallInfo = {
  id: string;
  name: string;
  arguments: string;
};

export type ToolResultInfo = {
  callId: string;
  name: string;
  result: string;
  isLoading: boolean;
  isExpanded: boolean;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  reasoningContent?: string;
  reasoningExpanded?: boolean;
  toolCalls?: ToolCallInfo[];
  toolResults?: ToolResultInfo[];
  isStreaming?: boolean;
  iterationIndex?: number;
};

export type LLMConfig = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
};

export type EditorContext = {
  filePath: string;
  line: string | null;
  col: string | null;
};

export type ChatPanelState = {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  config: LLMConfig | null;
  showConfig: boolean;
  toolIterationCount?: number;
  maxToolIterations?: number;
};
