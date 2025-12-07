// 描述 API 返回的数据结构
export interface Repository {
  id: string;
  name: string;
}

export interface TreeItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
}

export interface SearchFragment {
  offset: number;
  length: number;
}

export interface ContentSearchResult {
  path: string;
  lineNum: number;
  lineText: string;
  fragments: SearchFragment[];
}

export interface IntelligenceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  lineBase: number;
  columnBase: number;
}

export type IntelligenceSource = 'scip' | 'search';

export interface IntelligenceItem {
  kind: 'definition' | 'reference';
  repoId: string;
  filePath: string;
  range: IntelligenceRange;
  source: IntelligenceSource;
}

// 应用内部状态
export interface Tab {
  id: string;
  repoId: string;
  repoName: string;
  state?: {
    activeFilePath?: string | null;
    fileContent?: string | null;
    goToLine?: string | null;
    searchQuery?: string;
    searchType?: 'content' | 'file';
    searchResults?: unknown;
    intelItems?: import('./types').IntelligenceItem[];
  };
}
