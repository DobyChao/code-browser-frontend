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

    // 使用 useLayoutEffect 确保在浏览器绘制前完成 DOM 操作，减少闪烁
    useLayoutEffect(() => {
        if (fileContent !== null && codeRef.current && preRef.current && filePath) {
            const codeEl = codeRef.current;
            const preEl = preRef.current;

            // 1. 重置：先确保它是纯文本，清除之前可能残留的 Prism 类
            // 这一步非常关键！强制 React 重新渲染内容。
            codeEl.textContent = fileContent;
            codeEl.className = `language-${Utils.getLanguageFromPath(filePath)}`;
            preEl.className = `line-numbers !m-0 !p-6 !bg-transparent min-w-full min-h-full inline-block language-${Utils.getLanguageFromPath(filePath)}`;
            
            // 2. 高亮：调用 Prism
            try {
                Prism.highlightElement(codeEl);
            } catch (e) {
                console.error("Prism highlight failed:", e);
                // 降级处理：如果高亮失败，至少显示纯文本
                codeEl.textContent = fileContent;
            }
            
            // 3. 行跳转
            if (goToLine) {
                const lineNum = parseInt(goToLine, 10);
                if (!isNaN(lineNum) && lineNum >= 1) {
                    requestAnimationFrame(() => {
                        // 再次检查元素是否存在
                        if (!codeRef.current || !scrollRef.current) return;
                        
                        // 移除旧高亮
                        const oldHighlight = codeRef.current.querySelector('.line-highlight');
                        if (oldHighlight) {
                             oldHighlight.outerHTML = oldHighlight.innerHTML;
                        }

                        const lines = codeRef.current.innerHTML.split('\n');
                        if (lineNum <= lines.length) {
                            lines[lineNum - 1] = `<span class="line-highlight">${lines[lineNum - 1] || ' '}</span>`;
                            codeRef.current.innerHTML = lines.join('\n');
                            
                            // 滚动
                            const highlightedLine = codeRef.current.querySelector('.line-highlight') as HTMLElement;
                            if (highlightedLine) {
                                // 计算相对位置进行精确滚动
                                const containerRect = scrollRef.current.getBoundingClientRect();
                                const lineRect = highlightedLine.getBoundingClientRect();
                                const scrollTop = lineRect.top - containerRect.top + scrollRef.current.scrollTop - (containerRect.height / 2);
                                
                                scrollRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
                            }
                        }
                    });
                }
            } else {
                 // 如果没有指定行，滚动到顶部
                 if (scrollRef.current) {
                    scrollRef.current.scrollTop = 0;
                 }
            }
        }
    }, [fileContent, goToLine, filePath]); // 必须依赖 filePath 以便在切换文件时重置

    const handlePathSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onPathSubmit(pathInput);
    };

    // 获取语言，用于初始渲染的 className
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
            
            <div className="flex-1 overflow-auto bg-bg-editor" ref={scrollRef}>
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-text-dim">
                        <Loader2 size={32} className="animate-spin" />
                    </div>
                ) : fileContent !== null ? (
                    <pre 
                      ref={preRef}
                      // 关键：使用 key={filePath} 强制 React 在切换文件时销毁并重建这个 DOM 树
                      // 这彻底解决了 PrismJS 状态污染导致的渲染空白问题
                      key={filePath} 
                      className={`line-numbers !m-0 !p-6 !bg-transparent min-w-full min-h-full inline-block language-${lang}`}
                    >
                      <code ref={codeRef} className={`language-${lang}`}>
                          {/* 初始内容交由 React 管理，随后的高亮由 useLayoutEffect 接管 */}
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