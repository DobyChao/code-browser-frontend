import React, { useState } from 'react';
import { Search, FileText, Loader2, CaseSensitive, WholeWord, Regex, CodeXml } from 'lucide-react';
import { api } from '../api';
import { Utils } from '../utils';
import { buildZoektQuery } from '../utils/queryBuilder'; // 导入新工具
import type { ContentSearchResult } from '../api/types';

interface SearchPanelProps {
  repoId: string;
  onSearchResultClick: (path: string, lineNum?: string) => void;
}

export default function SearchPanel({ repoId, onSearchResultClick }: SearchPanelProps) {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'content' | 'file'>('content');
    const [results, setResults] = useState<ContentSearchResult[] | string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 新增：搜索选项状态
    const [useZoektSyntax, setUseZoektSyntax] = useState(false); // 是否使用原生 Zoekt 语法
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [wholeWord, setWholeWord] = useState(false);
    const [isRegex, setIsRegex] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setIsLoading(true);
        setError(null);
        setResults([]);

        try {
            // 构建最终查询字符串
            let finalQuery = query;
            if (!useZoektSyntax && searchType === 'content') {
                // 只有在内容搜索且不使用原生语法时，才使用构建器
                finalQuery = buildZoektQuery(query, {
                    caseSensitive,
                    wholeWord,
                    regex: isRegex,
                });
                console.log('Built Zoekt Query:', finalQuery); // 方便调试
            }

            let searchResults;
            const engine = 'zoekt';
            if (searchType === 'content') {
                searchResults = await api.searchContent(repoId, finalQuery, engine);
            } else {
                // 文件名搜索通常比较简单，可能不需要复杂的构建器，或者只需要部分功能
                // 这里暂时保持原样，直接传 query。如果需要也可以应用 buildZoektQuery，
                // 但需要调整 buildZoektQuery 以支持 file: 前缀
                searchResults = await api.searchFiles(repoId, query, engine);
            }
            setResults(searchResults || []);
        } catch (err) {
            setError((err as Error).message);
        }
        setIsLoading(false);
    };

    // 修复：切换搜索类型时清空结果，防止白屏
    const switchSearchType = (type: 'content' | 'file') => {
      if (searchType !== type) {
        setResults([]); // 清空结果
        setQuery('');     // 清空输入
        setError(null);
      }
      setSearchType(type);
    };

    return (
        <div className="w-80 bg-bg-sidebar h-full flex flex-col border-l border-border-default text-text-default">
            <div className="p-2 h-10 flex items-center justify-between border-b border-border-default">
                <h2 className="text-sm font-semibold uppercase">搜索面板</h2>
                {/* 原生语法切换按钮 */}
                {searchType === 'content' && (
                    <button
                        title="使用 Zoekt 原生语法"
                        className={`p-1 rounded-md ${useZoektSyntax ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
                        onClick={() => setUseZoektSyntax(!useZoektSyntax)}
                    >
                        <CodeXml size={16} />
                    </button>
                )}
            </div>
            
            {/* 搜索表单 */}
            <form className="p-2 space-y-2 border-b border-border-default" onSubmit={handleSearch}>
                <div className="flex space-x-1">
                    <button
                        type="button"
                        className={`flex-1 p-1 text-sm rounded-l-md border border-border-input ${
                          searchType === 'content' ? 'bg-bg-selected text-text-selected' : 'bg-bg-default hover:bg-bg-hover'
                        }`}
                        onClick={() => switchSearchType('content')}
                    >
                        内容搜索
                    </button>
                    <button
                        type="button"
                        className={`flex-1 p-1 text-sm rounded-r-md border border-border-input ${
                          searchType === 'file' ? 'bg-bg-selected text-text-selected' : 'bg-bg-default hover:bg-bg-hover'
                        }`}
                        onClick={() => switchSearchType('file')}
                    >
                        文件名搜索
                    </button>
                </div>

                <div className="relative flex items-center">
                    <input
                        type="text"
                        placeholder={useZoektSyntax ? "输入 Zoekt 查询..." : "搜索..."}
                        className="w-full px-2 py-1 pr-24 text-sm bg-bg-input border border-border-input rounded-md" // 增加右侧 padding 给按钮留位置
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    
                    {/* 搜索选项按钮组 (仅在不使用原生语法且为内容搜索时显示) */}
                    {!useZoektSyntax && searchType === 'content' && (
                        <div className="absolute right-8 flex items-center space-x-0.5">
                            <button
                                type="button"
                                title="区分大小写 (Case Sensitive)"
                                className={`p-0.5 rounded-sm ${caseSensitive ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
                                onClick={() => setCaseSensitive(!caseSensitive)}
                            >
                                <CaseSensitive size={14} />
                            </button>
                            <button
                                type="button"
                                title="全词匹配 (Match Whole Word)"
                                className={`p-0.5 rounded-sm ${wholeWord ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
                                onClick={() => setWholeWord(!wholeWord)}
                            >
                                <WholeWord size={14} />
                            </button>
                            <button
                                type="button"
                                title="使用正则表达式 (Use Regular Expression)"
                                className={`p-0.5 rounded-sm ${isRegex ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
                                onClick={() => setIsRegex(!isRegex)}
                            >
                                <Regex size={14} />
                            </button>
                        </div>
                    )}

                    <button 
                      type="submit" 
                      className="absolute right-0 p-1.5 text-text-dim hover:text-text-default" 
                      disabled={isLoading}
                    >
                        <Search size={16} />
                    </button>
                </div>
            </form>
            
            {/* 搜索结果 */}
            <div className="flex-1 overflow-y-auto p-2">
                {isLoading && (
                    <div className="flex items-center justify-center p-4 text-text-dim">
                        <Loader2 size={24} className="animate-spin" />
                    </div>
                )}
                {error && <div className="p-2 text-red-600 text-sm">{error}</div>}
                {!isLoading && !error && results.length === 0 && query && (
                    <div className="p-2 text-text-dim text-sm">未找到结果。</div>
                )}
                
                {/* 内容搜索结果 */}
                {searchType === 'content' && (
                    <ul className="space-y-2">
                        {(results as ContentSearchResult[]).map((result, index) => (
                            <li key={index} 
                                className="p-2 rounded-md hover:bg-bg-hover cursor-pointer"
                                onClick={() => onSearchResultClick(result.path, result.lineNum.toString())}
                            >
                                <div className="text-sm font-medium text-button truncate">{result.path}</div>
                                <div className="text-xs text-text-dim">行号: {result.lineNum}</div>
                                <pre className="mt-1 w-full whitespace-pre-wrap text-xs text-text-default">
                                    <code
                                        dangerouslySetInnerHTML={{ __html: Utils.highlightFragments(result.lineText, result.fragments) }}
                                    />
                                </pre>
                            </li>
                        ))}
                    </ul>
                )}
                
                {/* 文件名搜索结果 */}
                {searchType === 'file' && (
                    <ul className="space-y-1">
                        {(results as string[]).map((path, index) => (
                            <li key={index} 
                                className="flex items-center space-x-2 p-1 cursor-pointer rounded-md hover:bg-bg-hover"
                                onClick={() => onSearchResultClick(path)}
                            >
                                <FileText size={16} className="flex-shrink-0 text-text-dim" />
                                <span className="truncate text-sm text-text-default">{path}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}