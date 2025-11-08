import React, { useState, useRef, useEffect } from 'react';
import FileExplorer from '../components/FileExplorer';
import FileEditor from '../components/FileEditor';
import SearchPanel from '../components/SearchPanel';
import ActivityBar from '../components/ActivityBar';
import { api } from '../api';

interface RepoViewProps {
  repoId: string;
}

export default function RepoView({ repoId }: RepoViewProps) {
    const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [goToLine, setGoToLine] = useState<string | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(true);

    const latestFilePathRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            latestFilePathRef.current = null;
        };
    }, []);

    const handleFileSelect = async (path: string, lineNum: string | null = null) => {
        // 1. 如果路径相同，只更新行号，不重新加载文件
        if (path === activeFilePath && fileContent !== null) {
            setGoToLine(lineNum);
            return;
        }

        // 2. 如果是新路径，执行正常的加载流程
        latestFilePathRef.current = path;
        setIsLoadingFile(true);
        setActiveFilePath(path);
        setGoToLine(lineNum);
        
        // 可选：清空内容以显示加载状态，或者保留旧内容以实现平滑切换
        // setFileContent(null); 

        try {
            const content = await api.getBlob(repoId, path);
            if (path === latestFilePathRef.current) {
                setFileContent(content);
                setIsLoadingFile(false);
            }
        } catch (error) {
            console.error(`Failed to load blob for ${path}:`, error);
            if (path === latestFilePathRef.current) {
                setFileContent(`加载文件失败: ${(error as Error).message}`);
                setIsLoadingFile(false);
            }
        }
    };

    return (
        <div className="flex h-full w-full bg-bg-default">
            <FileExplorer 
                repoId={repoId}
                onFileSelect={handleFileSelect}
                activeFilePath={activeFilePath}
            />
            <main className="flex-1 flex overflow-x-hidden">
                <FileEditor 
                    filePath={activeFilePath}
                    fileContent={fileContent}
                    onPathSubmit={handleFileSelect}
                    goToLine={goToLine}
                    isLoading={isLoadingFile}
                    className="flex-1 min-w-0"
                />
                {isSearchPanelOpen && (
                  <SearchPanel 
                      repoId={repoId}
                      onSearchResultClick={handleFileSelect}
                  />
                )}
            </main>
            <ActivityBar
              isSearchPanelOpen={isSearchPanelOpen}
              onToggleSearchPanel={() => setIsSearchPanelOpen(!isSearchPanelOpen)}
            />
        </div>
    );
}