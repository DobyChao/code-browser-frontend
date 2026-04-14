import React from 'react';
import { Search, MessageSquare } from 'lucide-react';

interface ActivityBarProps {
  activeRightPanel: 'none' | 'search' | 'chat';
  onSelectRightPanel: (p: 'none' | 'search' | 'chat') => void;
}

export default function ActivityBar({ activeRightPanel, onSelectRightPanel }: ActivityBarProps) {
  return (
    <div className="flex h-full flex-col items-center space-y-4 p-2 bg-bg-sidebar border-l border-border-default">
      <button
        title="搜索 (Toggle)"
        className={`p-2 rounded-md ${activeRightPanel === 'search' ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
        onClick={() => onSelectRightPanel(activeRightPanel === 'search' ? 'none' : 'search')}
      >
        <Search size={20} />
      </button>
      <button
        title="AI 助手 (Toggle)"
        className={`p-2 rounded-md ${activeRightPanel === 'chat' ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
        onClick={() => onSelectRightPanel(activeRightPanel === 'chat' ? 'none' : 'chat')}
      >
        <MessageSquare size={20} />
      </button>
      {activeRightPanel === 'none' && (
        <div className="w-6 h-6" />
      )}
    </div>
  );
}
