import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, FileText, CaseSensitive, WholeWord, Regex, CodeXml, ChevronDown, ChevronRight, List, ListTree } from 'lucide-react';
import { api } from '../api';
import { Utils } from '../utils';
import { buildZoektQuery } from '../utils/queryBuilder'; // 导入新工具
import type { ContentSearchResult } from '../api/types';
import type { SearchPanelState } from '../types/ui';
import Loading from './common/Loading';
import ErrorMessage from './common/ErrorMessage';

export type { SearchPanelState };

interface SearchPanelProps {
    repoId: string;
    onSearchResultClick: (path: string, lineNum?: string) => void;
    className?: string; // 新增：接收 className
    state?: SearchPanelState;
    onStateChange?: React.Dispatch<React.SetStateAction<SearchPanelState>>;
}

export default function SearchPanel(props: SearchPanelProps) {
    const { repoId, onSearchResultClick, className = '' } = props;
    const isControlled = props.state !== undefined && props.onStateChange !== undefined;
    const [internalState, setInternalState] = useState<SearchPanelState>({
        query: '',
        searchType: 'content',
        viewMode: 'tree',
        results: [],
        isLoading: false,
        error: null,
        hasSearched: false,
        useZoektSyntax: false,
        caseSensitive: false,
        wholeWord: false,
        isRegex: false,
    });
    const state = (isControlled ? props.state : internalState) as SearchPanelState;
    const setState = (isControlled ? props.onStateChange : setInternalState) as React.Dispatch<React.SetStateAction<SearchPanelState>>;
    const abortRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const resultsRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const query = state.query;
    const searchType = state.searchType;
    const viewMode = state.viewMode;
    const results = state.results;
    const isLoading = state.isLoading;
    const error = state.error;
    const hasSearched = state.hasSearched;
    const useZoektSyntax = state.useZoektSyntax;
    const caseSensitive = state.caseSensitive;
    const wholeWord = state.wholeWord;
    const isRegex = state.isRegex;

    const contentResults = (searchType === 'content' ? (results as ContentSearchResult[]) : []) ?? [];
    const fileResults = (searchType === 'file' ? (results as string[]) : []) ?? [];

    const groupedContent = useMemo(() => {
        const map = new Map<string, ContentSearchResult[]>();
        for (const r of contentResults) {
            const arr = map.get(r.path) || [];
            arr.push(r);
            map.set(r.path, arr);
        }
        return Array.from(map.entries()).map(([path, list]) => ({ path, list }));
    }, [contentResults]);

    const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
    useEffect(() => {
        if (searchType !== 'content') return;
        if (!hasSearched) return;
        setCollapsedNodes(prev => {
            const next = { ...prev };
            for (const { path } of groupedContent) {
                const parts = path.split('/').filter(Boolean);
                let prefix = '';
                for (let i = 0; i < parts.length - 1; i++) {
                    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
                    const dirId = `dir:${prefix}`;
                    if (next[dirId] === undefined) next[dirId] = false;
                }
                const fileId = `file:${path}`;
                if (next[fileId] === undefined) next[fileId] = false;
            }
            return next;
        });
    }, [groupedContent, hasSearched, searchType]);

    type DirNode = { kind: 'dir'; id: string; name: string; path: string; children: Array<DirNode | FileNode> };
    type FileNode = { kind: 'file'; id: string; name: string; path: string; matches: ContentSearchResult[] };

    const treeRoot = useMemo<DirNode>(() => {
        const root: { kind: 'dir'; id: string; name: string; path: string; childrenMap: Map<string, any> } = {
            kind: 'dir',
            id: 'dir:',
            name: '',
            path: '',
            childrenMap: new Map(),
        };
        for (const { path, list } of groupedContent) {
            const parts = path.split('/').filter(Boolean);
            let cur = root;
            let prefix = '';
            for (let i = 0; i < parts.length - 1; i++) {
                const seg = parts[i];
                prefix = prefix ? `${prefix}/${seg}` : seg;
                const id = `dir:${prefix}`;
                let child = cur.childrenMap.get(id);
                if (!child) {
                    child = { kind: 'dir', id, name: seg, path: prefix, childrenMap: new Map() };
                    cur.childrenMap.set(id, child);
                }
                cur = child;
            }
            const fileName = parts[parts.length - 1] || path;
            const fileId = `file:${path}`;
            cur.childrenMap.set(fileId, { kind: 'file', id: fileId, name: fileName, path, matches: list } as FileNode);
        }
        const sortNode = (node: any): DirNode => {
            const children = Array.from(node.childrenMap.values()).map((c: any) => {
                if (c.kind === 'dir') return sortNode(c);
                return c as FileNode;
            });
            children.sort((a: any, b: any) => {
                if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            return { kind: 'dir', id: node.id, name: node.name, path: node.path, children };
        };
        return sortNode(root);
    }, [groupedContent]);

    const treeRootCompressed = useMemo<DirNode>(() => {
        const compressDir = (node: DirNode): DirNode => {
            let id = node.id;
            let path = node.path;
            let children = node.children;
            const parts: string[] = node.name ? [node.name] : [];

            while (children.length === 1 && children[0].kind === 'dir') {
                const child = children[0] as DirNode;
                id = child.id;
                path = child.path;
                if (child.name) parts.push(child.name);
                children = child.children;
            }

            return {
                kind: 'dir',
                id,
                name: parts.join('/'),
                path,
                children: children.map((c) => (c.kind === 'dir' ? compressDir(c) : c)),
            };
        };

        return {
            ...treeRoot,
            children: treeRoot.children.map((c) => (c.kind === 'dir' ? compressDir(c) : c)),
        };
    }, [treeRoot]);

    const visibleMatches = useMemo(() => {
        if (searchType !== 'content') return [];
        const out: Array<{ path: string; lineNum: number; lineText: string; fragments: ContentSearchResult['fragments'] }> = [];
        const pushFile = (path: string, list: ContentSearchResult[]) => {
            const fileId = `file:${path}`;
            if (collapsedNodes[fileId]) return;
            for (const r of list) out.push({ path, lineNum: r.lineNum, lineText: r.lineText, fragments: r.fragments });
        };
        if (viewMode === 'list') {
            for (const { path, list } of groupedContent) pushFile(path, list);
            return out;
        }
        const walk = (node: DirNode) => {
            if (node.id !== 'dir:' && collapsedNodes[node.id]) return;
            for (const c of node.children) {
                if (c.kind === 'dir') walk(c);
                else pushFile(c.path, c.matches);
            }
        };
        walk(treeRootCompressed);
        return out;
    }, [collapsedNodes, groupedContent, searchType, treeRootCompressed, viewMode]);

    const visibleMatchIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        for (let i = 0; i < visibleMatches.length; i++) {
            const r = visibleMatches[i];
            map.set(`${r.path}|${r.lineNum}|${r.lineText}`, i);
        }
        return map;
    }, [visibleMatches]);

    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    const selectedKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (searchType !== 'content') return;
        if (selectedIndex < 0 || selectedIndex >= visibleMatches.length) return;
        const r = visibleMatches[selectedIndex];
        selectedKeyRef.current = `${r.path}|${r.lineNum}|${r.lineText}`;
    }, [searchType, selectedIndex, visibleMatches]);
    useEffect(() => {
        if (!hasSearched) {
            setSelectedIndex(-1);
            return;
        }
        if (searchType === 'content') {
            const key = selectedKeyRef.current;
            if (key) {
                const idx = visibleMatchIndexByKey.get(key);
                if (idx !== undefined) {
                    setSelectedIndex(idx);
                    return;
                }
            }
            setSelectedIndex(visibleMatches.length > 0 ? 0 : -1);
        } else {
            setSelectedIndex(fileResults.length > 0 ? 0 : -1);
        }
    }, [fileResults.length, hasSearched, searchType, visibleMatchIndexByKey, visibleMatches.length]);

    useEffect(() => {
        if (selectedIndex < 0) return;
        const el = resultsRef.current?.querySelector(`[data-result-index="${selectedIndex}"]`);
        if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) {
            setState(prev => ({ ...prev, results: [], hasSearched: false }));
            return;
        }
        setState(prev => ({ ...prev, isLoading: true, error: null, results: [] }));

        try {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            // 构建最终查询字符串
            let finalQuery = query;
            if (!useZoektSyntax && searchType === 'content') {
                // 只有在内容搜索且不使用原生语法时，才使用构建器
                finalQuery = buildZoektQuery(query, {
                    caseSensitive,
                    wholeWord,
                    regex: isRegex,
                });
            }

            let searchResults;
            const engine = 'zoekt';
            if (searchType === 'content') {
                searchResults = await api.searchContent(repoId, finalQuery, engine, { signal: controller.signal });
            } else {
                // 文件名搜索通常比较简单，可能不需要复杂的构建器，或者只需要部分功能
                // 这里暂时保持原样，直接传 query。如果需要也可以应用 buildZoektQuery，
                // 但需要调整 buildZoektQuery 以支持 file: 前缀
                searchResults = await api.searchFiles(repoId, query, engine, { signal: controller.signal });
            }
            setState(prev => ({ ...prev, results: searchResults || [] }));
        } catch (err) {
            if ((err as any)?.name === 'AbortError') {
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }
            setState(prev => ({ ...prev, error: (err as Error).message }));
        }
        setState(prev => ({ ...prev, isLoading: false, hasSearched: true }));
    };

    const switchSearchType = (type: 'content' | 'file') => {
        if (searchType !== type) {
            setState(prev => ({ ...prev, results: [], query: '', error: null, hasSearched: false }));
        }
        setState(prev => ({ ...prev, searchType: type }));
    };

    const handleResultsKeyDown = (e: React.KeyboardEvent) => {
        const total = searchType === 'content' ? visibleMatches.length : fileResults.length;
        if (total <= 0) {
            if (e.key === 'Escape') inputRef.current?.focus();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(total - 1, Math.max(0, i) + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex < 0) return;
            if (searchType === 'content') {
                const r = visibleMatches[selectedIndex];
                onSearchResultClick(r.path, String(r.lineNum));
            } else {
                const path = fileResults[selectedIndex];
                onSearchResultClick(path);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            inputRef.current?.focus();
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            const total = searchType === 'content' ? visibleMatches.length : fileResults.length;
            if (total <= 0) return;
            e.preventDefault();
            resultsRef.current?.focus();
        }
    };

    const summaryText = useMemo(() => {
        if (!hasSearched || isLoading) return '';
        if (searchType === 'content') {
            const fileCount = groupedContent.length;
            const matchCount = contentResults.length;
            return fileCount === 0 ? '0 个结果' : `${matchCount} 个结果（${fileCount} 个文件）`;
        }
        return fileResults.length === 0 ? '0 个结果' : `${fileResults.length} 个文件`;
    }, [contentResults.length, groupedContent.length, hasSearched, isLoading, fileResults.length, searchType]);

    return (
        <div className={`bg-bg-sidebar h-full flex flex-col border-l border-border-default text-text-default min-w-0 overflow-hidden ${className}`}>
            <div className="px-2 h-10 flex items-center justify-between border-b border-border-default">
                <h2 className="text-sm font-semibold uppercase">搜索</h2>
                <div className="flex items-center space-x-1">
                    {searchType === 'content' && (
                        <button
                            title={viewMode === 'tree' ? '切换到列表视图' : '切换到树形视图'}
                            className="p-1 rounded-md text-text-dim hover:bg-bg-hover"
                            onClick={() => setState(prev => ({ ...prev, viewMode: prev.viewMode === 'tree' ? 'list' : 'tree' }))}
                        >
                            {viewMode === 'tree' ? <ListTree size={16} /> : <List size={16} />}
                        </button>
                    )}
                    {searchType === 'content' && (
                        <button
                            title="使用 Zoekt 原生语法"
                            className={`p-1 rounded-md ${useZoektSyntax ? 'bg-bg-hover text-text-default' : 'text-text-dim hover:bg-bg-hover'}`}
                            onClick={() => setState(prev => ({ ...prev, useZoektSyntax: !prev.useZoektSyntax }))}
                        >
                            <CodeXml size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* 搜索表单 */}
            <form className="p-2 space-y-2 border-b border-border-default" onSubmit={handleSearch}>
                <div className="flex space-x-1">
                    <button
                        type="button"
                        className={`w-1/2 p-1 text-sm rounded-l-md border border-border-input ${searchType === 'content' ? 'bg-button text-white' : 'bg-bg-default'}`}
                        onClick={() => switchSearchType('content')}
                    >
                        内容搜索
                    </button>
                    <button
                        type="button"
                        className={`w-1/2 p-1 text-sm rounded-r-md border border-border-input ${searchType === 'file' ? 'bg-button text-white' : 'bg-bg-default'}`}
                        onClick={() => switchSearchType('file')}
                    >
                        文件名搜索
                    </button>
                </div>

                <div className="relative flex items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={useZoektSyntax ? "输入 Zoekt 查询..." : "搜索..."}
                        className="w-full px-2 py-1 pr-24 text-sm bg-bg-input border border-border-input rounded-md" // 增加右侧 padding 给按钮留位置
                        value={query}
                        onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
                        onKeyDown={handleInputKeyDown}
                    />

                    {/* 搜索选项按钮组 (仅在不使用原生语法且为内容搜索时显示) */}
                    {!useZoektSyntax && searchType === 'content' && (
                        <div className="absolute right-8 flex items-center space-x-0.5">
                            <button
                                type="button"
                                title="区分大小写 (Case Sensitive)"
                                className={`p-0.5 rounded-sm ${caseSensitive ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
                                onClick={() => setState(prev => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
                            >
                                <CaseSensitive size={14} />
                            </button>
                            <button
                                type="button"
                                title="全词匹配 (Match Whole Word)"
                                className={`p-0.5 rounded-sm ${wholeWord ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
                                onClick={() => setState(prev => ({ ...prev, wholeWord: !prev.wholeWord }))}
                            >
                                <WholeWord size={14} />
                            </button>
                            <button
                                type="button"
                                title="使用正则表达式 (Use Regular Expression)"
                                className={`p-0.5 rounded-sm ${isRegex ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
                                onClick={() => setState(prev => ({ ...prev, isRegex: !prev.isRegex }))}
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

            <div
                ref={resultsRef}
                tabIndex={0}
                className="flex-1 overflow-y-auto overflow-x-hidden p-2 no-scrollbar outline-none"
                onKeyDown={handleResultsKeyDown}
            >
                {isLoading && <Loading />}
                {error && <ErrorMessage message={error} />}
                {!isLoading && !error && results.length === 0 && hasSearched && (
                    <div className="p-2 text-text-dim text-sm">未找到结果。</div>
                )}
                {!isLoading && !error && hasSearched && results.length > 0 && (
                    <div className="px-2 pb-2 text-xs text-text-dim">{summaryText}</div>
                )}

                {/* 内容搜索结果 */}
                {searchType === 'content' && (
                    <div className="space-y-2">
                        {viewMode === 'list' && (
                            <>
                                {groupedContent.map(({ path, list }) => {
                                    const fileId = `file:${path}`;
                                    const collapsed = !!collapsedNodes[fileId];
                                    return (
                                        <div key={path} className="rounded-md border border-border-default bg-bg-default/0 overflow-visible">
                                            <button
                                                type="button"
                                                className="w-full px-2 py-1 flex items-center justify-between hover:bg-bg-hover"
                                                onClick={() => setCollapsedNodes(prev => ({ ...prev, [fileId]: !prev[fileId] }))}
                                                title={path}
                                            >
                                                <div className="flex items-center space-x-1 min-w-0">
                                                    {collapsed ? <ChevronRight size={14} className="text-text-dim" /> : <ChevronDown size={14} className="text-text-dim" />}
                                                    <span className="text-sm font-medium text-text-default truncate tooltip" data-tooltip={path}>{path}</span>
                                                </div>
                                                <span className="text-xs text-text-dim flex-shrink-0">{list.length}</span>
                                            </button>
                                            {!collapsed && (
                                                <ul className="divide-y divide-border-default">
                                                    {list.map((result, idx) => {
                                                        const key = `${result.path}|${result.lineNum}|${result.lineText}`;
                                                        const visibleIndex = visibleMatchIndexByKey.get(key) ?? -1;
                                                        const isSelected = visibleIndex === selectedIndex;
                                                        return (
                                                            <li
                                                                key={`${result.path}:${result.lineNum}:${idx}`}
                                                                data-result-index={visibleIndex}
                                                                data-tooltip={`${result.path}:${result.lineNum}\n${result.lineText}`}
                                                                className={`px-2 py-1 cursor-pointer tooltip ${isSelected ? 'bg-bg-hover border-l-2 border-button' : 'hover:bg-bg-hover'}`}
                                                                onMouseEnter={() => setSelectedIndex(visibleIndex)}
                                                                onClick={() => onSearchResultClick(result.path, result.lineNum.toString())}
                                                            >
                                                                <div className="flex items-start space-x-2">
                                                                    <span className="text-xs flex-shrink-0 text-text-dim">{result.lineNum}</span>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div
                                                                            className="text-xs text-text-default truncate"
                                                                            dangerouslySetInnerHTML={{ __html: Utils.highlightFragments(result.lineText, result.fragments) }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                        {viewMode === 'tree' && (
                            <>
                                {(() => {
                                    const renderNode = (node: DirNode | FileNode, depth: number) => {
                                        if (node.kind === 'dir') {
                                            const collapsed = !!collapsedNodes[node.id];
                                            if (node.id === 'dir:') {
                                                return (
                                                    <div key={node.id} className="space-y-1">
                                                        {node.children.map(c => renderNode(c, 0))}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={node.id} className="space-y-1">
                                                    <button
                                                        type="button"
                                                        className="w-full px-2 py-1 flex items-center justify-between hover:bg-bg-hover rounded-md"
                                                        style={{ paddingLeft: 8 + depth * 12 }}
                                                        onClick={() => setCollapsedNodes(prev => ({ ...prev, [node.id]: !prev[node.id] }))}
                                                        title={node.path}
                                                    >
                                                        <div className="flex items-center space-x-1 min-w-0">
                                                            {collapsed ? <ChevronRight size={14} className="text-text-dim" /> : <ChevronDown size={14} className="text-text-dim" />}
                                                            <span className="text-sm font-medium text-text-default truncate tooltip" data-tooltip={node.path}>{node.name}</span>
                                                        </div>
                                                    </button>
                                                    {!collapsed && (
                                                        <div className="space-y-1">
                                                            {node.children.map(c => renderNode(c, depth + 1))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        const fileId = node.id;
                                        const collapsed = !!collapsedNodes[fileId];
                                        return (
                                            <div key={node.path} className="rounded-md border border-border-default bg-bg-default/0 overflow-visible">
                                                <button
                                                    type="button"
                                                    className="w-full px-2 py-1 flex items-center justify-between hover:bg-bg-hover"
                                                    style={{ paddingLeft: 8 + depth * 12 }}
                                                    onClick={() => setCollapsedNodes(prev => ({ ...prev, [fileId]: !prev[fileId] }))}
                                                    title={node.path}
                                                >
                                                    <div className="flex items-center space-x-1 min-w-0">
                                                        {collapsed ? <ChevronRight size={14} className="text-text-dim" /> : <ChevronDown size={14} className="text-text-dim" />}
                                                        <span className="text-sm font-medium text-text-default truncate tooltip" data-tooltip={node.path}>{node.name}</span>
                                                    </div>
                                                    <span className="text-xs text-text-dim flex-shrink-0">{node.matches.length}</span>
                                                </button>
                                                {!collapsed && (
                                                    <ul className="divide-y divide-border-default">
                                                        {node.matches.map((result, idx) => {
                                                            const key = `${result.path}|${result.lineNum}|${result.lineText}`;
                                                            const visibleIndex = visibleMatchIndexByKey.get(key) ?? -1;
                                                            const isSelected = visibleIndex === selectedIndex;
                                                            return (
                                                                <li
                                                                    key={`${result.path}:${result.lineNum}:${idx}`}
                                                                    data-result-index={visibleIndex}
                                                                    data-tooltip={`${result.path}:${result.lineNum}\n${result.lineText}`}
                                                                    className={`px-2 py-1 cursor-pointer tooltip ${isSelected ? 'bg-bg-hover border-l-2 border-button' : 'hover:bg-bg-hover'}`}
                                                                    style={{ paddingLeft: 8 + (depth + 1) * 12 }}
                                                                    onMouseEnter={() => setSelectedIndex(visibleIndex)}
                                                                    onClick={() => onSearchResultClick(result.path, result.lineNum.toString())}
                                                                >
                                                                    <div className="flex items-start space-x-2">
                                                                        <span className="text-xs flex-shrink-0 text-text-dim">{result.lineNum}</span>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div
                                                                                className="text-xs text-text-default truncate"
                                                                                dangerouslySetInnerHTML={{ __html: Utils.highlightFragments(result.lineText, result.fragments) }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                        );
                                    };
                                    return renderNode(treeRootCompressed, 0);
                                })()}
                            </>
                        )}
                    </div>
                )}

                {/* 文件名搜索结果 */}
                {searchType === 'file' && (
                    <ul className="space-y-1">
                        {fileResults.map((path, index) => {
                            const isSelected = index === selectedIndex;
                            return (
                                <li
                                    key={path}
                                    data-result-index={index}
                                    className={`flex items-center space-x-2 p-1 cursor-pointer rounded-md ${isSelected ? 'bg-bg-hover border-l-2 border-button' : 'hover:bg-bg-hover'}`}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    onClick={() => onSearchResultClick(path)}
                                    title={path}
                                >
                                    <FileText size={16} className="flex-shrink-0 text-text-dim" />
                                    <span className="truncate text-sm text-text-default tooltip" data-tooltip={path}>{path}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
