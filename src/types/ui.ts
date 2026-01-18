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
};

