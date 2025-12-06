import React, { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Utils } from '../utils';
import Editor, { type OnMount } from '@monaco-editor/react';
import { api } from '../api';
import type { IntelligenceItem } from '../api/types';
import type { editor } from 'monaco-editor';

type Monaco = typeof import('monaco-editor');

interface FileEditorProps {
  repoId: string;
  filePath: string | null;
  fileContent: string | null;
  onPathSubmit: (path: string) => void;
  goToLine: string | null;
  isLoading: boolean;
  className?: string;
  onIntelResults?: (items: IntelligenceItem[]) => void;
  onTriggerDefinitions?: (pos: { line: number; column: number }) => void;
  onTriggerReferences?: (pos: { line: number; column: number }) => void;
}

export default function FileEditor({ repoId, filePath, fileContent, onPathSubmit, goToLine, isLoading, className = '', onIntelResults, onTriggerDefinitions, onTriggerReferences }: FileEditorProps) {
    const [pathInput, setPathInput] = useState(filePath || '');
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    
    // 修复 1：将 decorationRef 的类型更改为存储 collection 实例
    const decorationRef = useRef<editor.IEditorDecorationsCollection | null>(null);

    useEffect(() => {
        setPathInput(filePath || '');
    }, [filePath]);

    // Monaco 编辑器加载完成后的回调
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        
        // 修复 1：创建一次 Decorations Collection
        decorationRef.current = editor.createDecorationsCollection();
       
        // 修复 2：添加 mousedown 事件监听器以清除高亮
        editor.onMouseDown(() => {
            decorationRef.current?.clear();
        });

        // 右键菜单触发
        editor.addAction({
          id: 'go-to-definition',
          label: '转到定义',
          contextMenuGroupId: 'navigation',
          run: async () => {
            if (!filePath) return;
            const pos = editor.getPosition();
            if (!pos) return;
            onTriggerDefinitions?.({ line: pos.lineNumber, column: pos.column });
          }
        });
        editor.addAction({
          id: 'find-references',
          label: '查找引用',
          contextMenuGroupId: 'navigation',
          run: async () => {
            if (!filePath) return;
            const pos = editor.getPosition();
            if (!pos) return;
            onTriggerReferences?.({ line: pos.lineNumber, column: pos.column });
          }
        });

       // 初始加载时应用高亮
       applyLineHighlight(editor, monaco);
    };

    // 封装一个函数来应用行高亮
    const applyLineHighlight = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        // 修复 1：使用 collection 实例
        const collection = decorationRef.current;
        if (!collection) return; // 如果 collection 还没创建，则跳过

        if (goToLine) {
            const lineNum = parseInt(goToLine, 10);
            if (!isNaN(lineNum) && lineNum >= 1) {
                
                // 修复 1：使用 collection.set() 来应用高亮
                collection.set([
                    {
                        range: new monaco.Range(lineNum, 1, lineNum, 1),
                        options: {
                            isWholeLine: true,
                            className: 'line-highlight',
                        }
                    }
                ]);
                
                // 滚动到指定行
                editor.revealLineInCenter(lineNum);
            }
        } else {
             // 修复 1：如果没有行号，确保清除 collection
             collection.clear();
        }
    };

    // 当 goToLine 变化时（例如，从搜索结果点击），
    // 并且编辑器实例已存在时，应用高亮
    useEffect(() => {
        if (editorRef.current && monacoRef.current) {
            applyLineHighlight(editorRef.current, monacoRef.current);
        }
    }, [goToLine]);

    // 当文件路径改变时，重置行高亮
    useEffect(() => {
        // 修复 1：清除上一个文件的 decorations
        decorationRef.current?.clear();
        // 滚动到顶部
        if (editorRef.current) {
            editorRef.current.setScrollTop(0);
        }
    }, [filePath]);

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
            
            <div className="flex-1 overflow-hidden relative no-scrollbar">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-text-dim">
                        <Loader2 size={32} className="animate-spin" />
                    </div>
                ) : fileContent !== null ? (
                    <Editor
                        key={filePath} 
                        width="100%"
                        height="100%"
                        language={lang}
                        value={fileContent}
                        theme="vs" 
                        onMount={handleEditorDidMount}
                        options={{
                            readOnly: true, 
                            domReadOnly: true,
                            minimap: { enabled: true }, 
                            lineNumbers: "on", 
                            scrollBeyondLastLine: false,
                            contextmenu: true, 
                            fontFamily: "monospace", 
                            fontSize: 14,
                            wordWrap: "off", 
                        }}
                    />
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
