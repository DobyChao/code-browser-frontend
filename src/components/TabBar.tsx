import React from 'react';
import { X, Home, Settings, Plus } from 'lucide-react';
import type { Tab } from '../api/types'; // 修复：使用 import type

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onGoHome: () => void;
  onOpenSettings: () => void;
}

export default function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onGoHome, onOpenSettings }: TabBarProps) {
    return (
        <div className="flex items-center bg-bg-header h-10 border-b border-border-default text-text-default">
            {/* 主页按钮 */}
            <button
                title="返回主页"
                className="p-2 h-full flex items-center justify-center text-text-dim hover:bg-bg-hover"
                onClick={onGoHome}
            >
                <Home size={18} />
            </button>
            
            {/* 标签页 */}
            <nav className="flex-1 flex items-center h-full overflow-x-auto">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`flex items-center justify-between h-full px-4 border-r border-border-default cursor-pointer ${
                          tab.id === activeTabId ? 'bg-bg-tab-active' : 'bg-bg-tab'
                        }`}
                        onClick={() => onSelectTab(tab.id)}
                    >
                        <span className="text-sm mr-2 truncate">{tab.repoName}</span>
                        <button
                            className="p-0.5 rounded-full text-text-dim hover:bg-bg-hover"
                            onClick={(e) => {
                                e.stopPropagation(); // 防止触发 onSelectTab
                                onCloseTab(tab.id);
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </nav>

            {/* 新建标签页按钮 */}
            <button
                title="打开新仓库"
                className="p-2 h-full flex items-center justify-center text-text-dim hover:bg-bg-hover"
                onClick={onGoHome}
            >
                <Plus size={18} />
            </button>
            
            {/* 设置按钮 */}
            <button
                title="设置"
                className="p-2 h-full flex items-center justify-center border-l border-border-default text-text-dim hover:bg-bg-hover"
                onClick={onOpenSettings}
            >
                <Settings size={18} />
            </button>
        </div>
    );
}