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

// 应用内部状态
export interface Tab {
  id: string;
  repoId: string;
  repoName: string;
}