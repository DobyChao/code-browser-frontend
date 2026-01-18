import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  className?: string;
  size?: number;
  text?: string;
}

export default function Loading({ className = '', size = 24, text }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center p-4 text-text-dim ${className}`}>
      <Loader2 size={size} className="animate-spin" />
      {text ? <span className="ml-2 text-sm">{text}</span> : null}
    </div>
  );
}
