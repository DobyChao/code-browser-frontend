import React, { useState, useRef, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
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

    // 初始状态为 true
    const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(true);

    const searchPanelRef = useRef<ImperativePanelHandle>(null);
    const latestFilePathRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            latestFilePathRef.current = null;
        };
    }, []);
    const handleFileSelect = async (path: string, lineNum: string | null = null) => {
        if (path === activeFilePath && fileContent !== null) {
            setGoToLine(null);
            setTimeout(() => {
                setGoToLine(lineNum);
            }, 0);
            return;
        }

        latestFilePathRef.current = path;
        setIsLoadingFile(true);
        setActiveFilePath(path);
        setGoToLine(lineNum);

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

    const handleToggleSearchPanel = () => {
        setIsSearchPanelOpen(prev => !prev);
    };

    return (
        <PanelGroup direction="horizontal" className="h-full w-full bg-bg-default">

            {/* Panel 1: File Explorer */}
            <Panel id="file-explorer-panel" defaultSize={20} minSize={15} collapsible={true} order={1}>
                <FileExplorer
                    repoId={repoId}
                    onFileSelect={handleFileSelect}
                    activeFilePath={activeFilePath}
                    className="h-full"
                />
            </Panel>

            <PanelResizeHandle className="panel-handle" />

            {/* Panel 2: Editor */}
            <Panel id="file-editor-panel" minSize={30} order={2}>
                <FileEditor
                    filePath={activeFilePath}
                    fileContent={fileContent}
                    onPathSubmit={handleFileSelect}
                    goToLine={goToLine}
                    isLoading={isLoadingFile}
                    className="h-full"
                />
            </Panel>

            <PanelResizeHandle className="panel-handle" />

            {/* Panel 3: Search Panel */}
            {isSearchPanelOpen && (
                <>
                    <Panel
                        id="search-panel"
                        ref={searchPanelRef}
                        defaultSize={20}
                        minSize={15}
                        order={3}
                    >
                        <SearchPanel
                            repoId={repoId}
                            onSearchResultClick={handleFileSelect}
                            className="h-full"
                        />
                    </Panel>
                    <PanelResizeHandle className="panel-handle" disabled />
                </>
            )}

            {/* Panel 4: Activity Bar */}
            <Panel
                id="activity-bar-panel"
                defaultSize={3}
                minSize={3}
                maxSize={3}
                collapsible={false}
                order={isSearchPanelOpen ? 4 : 3}
            >
                <ActivityBar
                    isSearchPanelOpen={isSearchPanelOpen}
                    onToggleSearchPanel={handleToggleSearchPanel}
                />
            </Panel>

        </PanelGroup>
    );
}