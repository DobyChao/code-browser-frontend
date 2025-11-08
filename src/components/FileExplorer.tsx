import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { TreeItem } from '../api/types'; // 修复：使用 import type
import GoToFileSearch from './GoToFileSearch'; // 引入新的搜索组件

// --- 文件树节点 ---
interface FileNodeProps {
  name: string;
  path: string;
  onFileSelect: (path: string) => void;
  activeFilePath: string | null;
}

function FileNode({ name, path, onFileSelect, activeFilePath }: FileNodeProps) {
    const isSelected = activeFilePath === path;
    return (
        <li
            className={`flex items-center space-x-2 p-1 pl-6 cursor-pointer rounded-md text-text-default ${
              isSelected ? 'bg-bg-selected text-text-selected' : 'hover:bg-bg-hover'
            }`}
            onClick={() => onFileSelect(path)}
            title={path}
        >
            <FileText size={16} className="flex-shrink-0 text-text-dim" />
            <span className="truncate text-sm">{name}</span>
        </li>
    );
}

// --- 目录树节点 ---
interface DirectoryNodeProps {
  repoId: string;
  name: string;
  path: string;
  onFileSelect: (path: string) => void;
  activeFilePath: string | null;
  initialFilter?: string; // 用于自动展开
}

function DirectoryNode({ repoId, name, path, onFileSelect, activeFilePath, initialFilter }: DirectoryNodeProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<TreeItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadChildren = async () => {
        setIsLoading(true);
        try {
            const items = await api.getTree(repoId, path);
            items.sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'directory' ? -1 : 1));
            setChildren(items);
        } catch (error) {
            console.error(`Failed to load tree for ${path}:`, error);
        }
        setIsLoading(false);
    };

    const toggleOpen = () => {
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);
        if (nextOpen && children.length === 0) {
            loadChildren();
        }
    };
    
    // 自动展开逻辑（如果用 filter）
    useEffect(() => {
        if (initialFilter && !isOpen && children.length === 0) {
            loadChildren().then(() => setIsOpen(true));
        }
    }, [initialFilter, isOpen, children.length]);


    const filteredChildren = useMemo(() => {
        if (!initialFilter) return children;
        return children.filter(child => 
            child.name.toLowerCase().includes(initialFilter.toLowerCase()) || child.type === 'directory'
        );
    }, [children, initialFilter]);

    if (initialFilter && filteredChildren.length === 0 && !name.toLowerCase().includes(initialFilter.toLowerCase())) {
        return null;
    }

    return (
        <li>
            <div
                className="flex items-center space-x-2 p-1 cursor-pointer rounded-md hover:bg-bg-hover text-text-default"
                onClick={toggleOpen}
                title={path}
            >
                {isLoading ? (
                    <Loader2 size={16} className="animate-spin text-text-dim" />
                ) : (
                    isOpen ? <ChevronDown size={16} className="text-text-dim" /> : <ChevronRight size={16} className="text-text-dim" />
                )}
                {isOpen ? <FolderOpen size={16} className="text-text-dim" /> : <Folder size={16} className="text-text-dim" />}
                <span className="truncate text-sm font-medium">{name}</span>
            </div>
            {isOpen && (
                <ul className="pl-4">
                    {filteredChildren.map(item => (
                        item.type === 'directory' ? (
                            <DirectoryNode
                                key={item.path}
                                repoId={repoId}
                                name={item.name}
                                path={item.path}
                                onFileSelect={onFileSelect}
                                activeFilePath={activeFilePath}
                                initialFilter={initialFilter}
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
}

// --- 文件浏览器 (主组件) ---
interface FileExplorerProps {
  repoId: string;
  onFileSelect: (path: string) => void;
  activeFilePath: string | null;
}

export default function FileExplorer({ repoId, onFileSelect, activeFilePath }: FileExplorerProps) {
    const [rootItems, setRootItems] = useState<TreeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState(''); // 这个 filter 现在只用于树的自动展开

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

    const filteredRootItems = useMemo(() => {
        if (!filter) return rootItems;
        return rootItems.filter(child => 
            child.name.toLowerCase().includes(filter.toLowerCase()) || child.type === 'directory'
        );
    }, [rootItems, filter]);

    return (
        <div className="w-72 bg-bg-sidebar h-full flex flex-col border-r border-border-default">
            {/* 顶部标题 */}
            <div className="p-2 h-10 flex items-center border-b border-border-default">
                <h2 className="text-sm font-semibold uppercase text-text-default truncate">文件资源管理器</h2>
            </div>
            {/* Go To File 搜索框 */}
            <div className="p-2 border-b border-border-default">
                <GoToFileSearch repoId={repoId} onFileSelect={onFileSelect} />
            </div>
            {/* 原始文件过滤器 (可选，可以保留用于高亮和自动展开) */}
            <div className="p-2 border-b border-border-default">
                <input
                    type="text"
                    placeholder="筛选树..."
                    className="w-full px-2 py-1 text-sm bg-bg-input border border-border-input rounded-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>
           
            
            {/* 文件树 */}
            <div className="flex-1 overflow-y-auto p-2 relative z-10">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-text-dim">
                        <Loader2 size={24} className="animate-spin" />
                    </div>
                ) : (
                    <ul className="space-y-1">
                        {filteredRootItems.map(item => (
                            item.type === 'directory' ? (
                                <DirectoryNode
                                    key={item.path}
                                    repoId={repoId}
                                    name={item.name}
                                    path={item.path}
                                    onFileSelect={onFileSelect}
                                    activeFilePath={activeFilePath}
                                    initialFilter={filter}
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
    );
}