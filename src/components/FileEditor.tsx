import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import Prism from 'prismjs';
import { Utils } from '../utils';

// --- PrismJS ---
import 'prismjs/themes/prism.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers.js';

// 导入语言
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';    // 新增：C 语言支持
import 'prismjs/components/prism-cpp';  // 新增：C++ 支持 (.h, .cpp)
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
// ---

interface FileEditorProps {
  filePath: string | null;
  fileContent: string | null;
  onPathSubmit: (path: string) => void;
  goToLine: string | null;
  isLoading: boolean;
  className?: string;
}

export default function FileEditor({ filePath, fileContent, onPathSubmit, goToLine, isLoading, className = '' }: FileEditorProps) {
    const [pathInput, setPathInput] = useState(filePath || '');
    const codeRef = useRef<HTMLElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        setPathInput(filePath || '');
    }, [filePath]);

    useLayoutEffect(() => {
        if (fileContent !== null && codeRef.current && preRef.current && filePath) {
            const codeEl = codeRef.current;
            const preEl = preRef.current;

            codeEl.textContent = fileContent;
            codeEl.className = `language-${Utils.getLanguageFromPath(filePath)}`;
            // 修复：添加 !overflow-hidden 以防止双滚动条
            preEl.className = `line-numbers !m-0 !p-6 !bg-transparent min-w-full min-h-full inline-block !overflow-hidden language-${Utils.getLanguageFromPath(filePath)}`;
            
            try {
                Prism.highlightElement(codeEl);
            } catch (e) {
                console.error("Prism highlight failed:", e);
                codeEl.textContent = fileContent;
            }
            
            if (goToLine) {
                const lineNum = parseInt(goToLine, 10);
                if (!isNaN(lineNum) && lineNum >= 1) {
                    requestAnimationFrame(() => {
                        if (!codeRef.current || !scrollRef.current) return;
                        
                        const oldHighlight = codeRef.current.querySelector('.line-highlight');
                        if (oldHighlight) {
                             oldHighlight.outerHTML = oldHighlight.innerHTML;
                        }

                        const lines = codeRef.current.innerHTML.split('\n');
                        if (lineNum <= lines.length) {
                            lines[lineNum - 1] = `<span class="line-highlight">${lines[lineNum - 1] || ' '}</span>`;
                            codeRef.current.innerHTML = lines.join('\n');
                            
                            const highlightedLine = codeRef.current.querySelector('.line-highlight') as HTMLElement;
                            if (highlightedLine) {
                                const containerRect = scrollRef.current.getBoundingClientRect();
                                const lineRect = highlightedLine.getBoundingClientRect();
                                const scrollTop = lineRect.top - containerRect.top + scrollRef.current.scrollTop - (containerRect.height / 2);
                                
                                scrollRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
                            }
                        }
                    });
                }
            } else {
                 if (scrollRef.current) {
                    scrollRef.current.scrollTop = 0;
                 }
            }
        }
    }, [fileContent, goToLine, filePath]);

    const handlePathSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onPathSubmit(pathInput);
    };

    const lang = filePath ? Utils.getLanguageFromPath(filePath) : 'plaintext';

    return (
        <div className={`h-full flex flex-col bg-bg-editor text-text-default ${className}`}>
            <form className="p-2 border-b border-border-default flex-shrink-0" onSubmit={handlePathSubmit}>
                <input
                    type="text"
                    placeholder="输入文件路径..."
                    className="w-full px-2 py-1 text-sm bg-bg-input border border-border-input rounded-sm"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                />
            </form>
            
            <div className="flex-1 overflow-auto bg-bg-editor no-scrollbar" ref={scrollRef}>
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-text-dim">
                        <Loader2 size={32} className="animate-spin" />
                    </div>
                ) : fileContent !== null ? (
                    <pre 
                      ref={preRef}
                      key={filePath} 
                      // 修复：添加 !overflow-hidden 以防止双滚动条
                      className={`line-numbers !m-0 !p-6 !bg-transparent min-w-full min-h-full inline-block !overflow-hidden language-${lang}`}
                    >
                      <code ref={codeRef} className={`language-${lang}`}>
                          {fileContent}
                      </code>
                    </pre>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-text-dim bg-bg-editor">
                        <FileText size={64} />
                        <p className="mt-4 text-lg">请从左侧选择一个文件，或在上方输入路径</p>
                    </div>
                )}
            </div>
        </div>
    );
}