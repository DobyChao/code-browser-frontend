import React from 'react';
import { Search } from 'lucide-react';

interface ActivityBarProps {
  activeRightPanel: 'none' | 'search';
  onSelectRightPanel: (p: 'none' | 'search') => void;
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
      {activeRightPanel === 'none' && (
        <div className="w-6 h-6" />
      )}
    </div>
  );
}
