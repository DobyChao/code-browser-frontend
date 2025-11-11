import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Loader2, LocateFixed } from 'lucide-react';
import { api } from '../api';
import type { TreeItem } from '../api/types';
import GoToFileSearch from './GoToFileSearch';

// --- 子组件定义 (恢复递归结构) ---

interface FileNodeProps {
    name: string;
    path: string;
    onFileSelect: (path: string) => void;
    activeFilePath: string | null;
}

// 使用 React.memo 优化性能，避免不必要的重渲染
const FileNode = React.memo(({ name, path, onFileSelect, activeFilePath }: FileNodeProps) => {
    const isSelected = activeFilePath === path;
    return (
        <li
            // data-path 用于 scrollIntoView 定位
            data-path={path}
            className={`flex items-center space-x-2 py-1 px-2 cursor-pointer rounded-sm truncate
                ${isSelected ? 'bg-bg-selected text-text-selected' : 'hover:bg-bg-hover'}
            `}
            onClick={() => onFileSelect(path)}
            title={path}
        >
            {/* 缩进占位，与 DirectoryNode 的图标对齐 */}
            <span className="w-4 flex-shrink-0"></span>
            <FileText size={16} className="flex-shrink-0 text-text-dim" />
            <span className="truncate">{name}</span>
        </li>
    );
});

interface DirectoryNodeProps {
    repoId: string;
    name: string;
    path: string;
    onFileSelect: (path: string) => void;
    activeFilePath: string | null;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
}

const DirectoryNode = React.memo(({ repoId, name, path, onFileSelect, activeFilePath, expandedPaths, onToggle }: DirectoryNodeProps) => {
    const [children, setChildren] = useState<TreeItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // 使用传入的 expandedPaths 状态，实现受控组件
    const isOpen = expandedPaths.has(path);

    // 加载子节点
    const loadChildren = useCallback(async () => {
        if (children.length > 0) return; // 已加载则跳过
        setIsLoading(true);
        try {
            const items = await api.getTree(repoId, path);
            items.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
            });
            setChildren(items);
        } catch (error) {
            console.error(`Failed to load tree for ${path}:`, error);
        } finally {
            setIsLoading(false);
        }
    }, [repoId, path, children.length]);

    // 当外部控制展开且未加载时，自动加载
    useEffect(() => {
        if (isOpen && children.length === 0 && !isLoading) {
            loadChildren();
        }
    }, [isOpen, children.length, isLoading, loadChildren]);

    return (
        <li>
            <div
                className="flex items-center space-x-2 py-1 px-2 cursor-pointer rounded-sm hover:bg-bg-hover truncate"
                onClick={() => onToggle(path)}
                title={path}
            >
                <span className="flex-shrink-0">
                    {isLoading ? (
                    <Loader2 size={16} className="animate-spin text-text-dim" />
                    ) : (
                        isOpen ? <ChevronDown size={16} className="text-text-dim" /> : <ChevronRight size={16} className="text-text-dim"/>
                    )}
                </span>
                <span className="flex-shrink-0 text-text-dim">
                    {isOpen ? <FolderOpen size={16}/> : <Folder size={16}/>}
                </span>
                <span className="truncate font-medium">{name}</span>
            </div>
            {isOpen && (
                // 恢复缩进：ml-4 或 pl-4
                <ul className="ml-4 border-l border-border-default pl-2">
                    {children.map(item => (
                        item.type === 'directory' ? (
                            <DirectoryNode
                                key={item.path}
                                repoId={repoId}
                                name={item.name}
                                path={item.path}
                                onFileSelect={onFileSelect}
                                activeFilePath={activeFilePath}
                                expandedPaths={expandedPaths}
                                onToggle={onToggle}
                            />
                        ) : (
                            <FileNode
                                key={item.path}
                                name={item.name}
                                path={item.path}
                                onFileSelect={onFileSelect}
                                activeFilePath={activeFilePath}
                            />
                        )
                    ))}
                </ul>
            )}
        </li>
    );
});


// --- 主组件 ---

interface FileExplorerProps {
    repoId: string;
    onFileSelect: (path: string) => void;
    activeFilePath: string | null;
    className?: string;
}

export default function FileExplorer({ repoId, onFileSelect, activeFilePath, className = '' }: FileExplorerProps) {
    const [rootItems, setRootItems] = useState<TreeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // 将展开状态提升到主组件管理，以便实现“聚焦”功能
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    // 加载根目录
    useEffect(() => {
        setIsLoading(true);
        api.getTree(repoId, '')
            .then(items => {
                items.sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'directory' ? -1 : 1));
                setRootItems(items);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [repoId]);

    const handleToggle = useCallback((path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    // 聚焦当前文件
    const focusActiveFile = useCallback(async () => {
        if (!activeFilePath) return;

        // 1. 计算所有需要展开的父路径
        const parts = activeFilePath.split('/');
        const pathsToExpand = new Set(expandedPaths);
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath += (i > 0 ? '/' : '') + parts[i];
            pathsToExpand.add(currentPath);
        }
        setExpandedPaths(pathsToExpand);

        // 2. 滚动到可视区域 (等待 DOM 渲染)
        setTimeout(() => {
            if (containerRef.current) {
                const activeElement = containerRef.current.querySelector(`[data-path="${activeFilePath}"]`);
                if (activeElement) {
                    activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }
        }, 300); // 给递归组件足够的渲染时间
    }, [activeFilePath, expandedPaths]);

    return (
        <div className={`h-full flex flex-col bg-bg-sidebar border-r border-border-default text-text-default ${className} max-w-84 flex-shrink-0`}>
            <div className="p-2 border-b border-border-default font-semibold flex justify-between items-center flex-shrink-0">
                <span>文件资源管理器</span>
            </div>

            {/* 搜索和工具栏 */}
            <div className="p-2 border-b border-border-default flex-shrink-0 relative z-20 flex items-center gap-1">
                <div className="flex-1">
                    <GoToFileSearch repoId={repoId} onFileSelect={onFileSelect} />
                </div>
                <button
                    onClick={focusActiveFile}
                    className={`p-1.5 rounded-sm hover:bg-bg-hover ${!activeFilePath ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="在文件树中定位当前文件"
                    disabled={!activeFilePath}
                >
                    <LocateFixed size={16} />
                </button>
            </div>
            
            {/* 文件树区域：添加 overflow-x-auto 以支持横向滚动 */}
            <div className="flex-1 overflow-auto no-scrollbar relative z-10 " ref={containerRef}>
                <div className="p-2 min-w-fit"> {/* min-w-fit 确保内容不会被压缩 */}
                    {isLoading ? (
                        <div className="flex items-center justify-center p-4 text-text-dim">
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    ) : (
                        <ul className="space-y-0.5 text-sm">
                            {rootItems.map(item => (
                                item.type === 'directory' ? (
                                    <DirectoryNode
                                        key={item.path}
                                        repoId={repoId}
                                        name={item.name}
                                        path={item.path}
                                        onFileSelect={onFileSelect}
                                        activeFilePath={activeFilePath}
                                        expandedPaths={expandedPaths}
                                        onToggle={handleToggle}
                                    />
                                ) : (
                                    <FileNode
                                        key={item.path}
                                        name={item.name}
                                        path={item.path}
                                        onFileSelect={onFileSelect}
                                        activeFilePath={activeFilePath}
                                    />
                                )
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}