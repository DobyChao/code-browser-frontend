import React from 'react';
import { Search } from 'lucide-react';

interface ActivityBarProps {
  isSearchPanelOpen: boolean;
  onToggleSearchPanel: () => void;
}

export default function ActivityBar({ isSearchPanelOpen, onToggleSearchPanel }: ActivityBarProps) {
  return (
    <div className="flex h-full flex-col items-center space-y-4 p-2 bg-bg-sidebar border-l border-border-default">
      <button
        title="搜索 (Toggle)"
        className={`p-2 rounded-md ${
          isSearchPanelOpen
            ? 'bg-bg-selected text-text-selected' // 修复：使用主题中的选中颜色
            : 'text-text-dim hover:bg-bg-hover'
        }`}
        onClick={onToggleSearchPanel}
      >
        <Search size={20} />
      </button>
      {/* 在这里可以添加其他活动栏图标 */}
    </div>
  );
}