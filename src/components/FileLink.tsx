import React from 'react';
import { FileText } from 'lucide-react';
import type { FileLinkTagProps } from '../types/chat-tags';

type FileLinkProps = FileLinkTagProps & {
  onNavigate: (path: string, line: number) => void;
};

export default function FileLink({ path, line, onNavigate }: FileLinkProps) {
  const handleClick = () => {
    onNavigate(path, line ?? 1);
  };

  return (
    <span
      onClick={handleClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-hover text-blue-600 text-xs cursor-pointer hover:bg-blue-50 border border-border-default max-w-full"
    >
      <FileText size={12} className="shrink-0" />
      <span className="break-all">
        {path}{line ? `:${line}` : ''}
      </span>
    </span>
  );
}
