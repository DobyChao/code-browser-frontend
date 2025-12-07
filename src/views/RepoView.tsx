import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { PanelGroup, Panel, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import FileExplorer from '../components/FileExplorer';
import FileEditor from '../components/FileEditor';
import SearchPanel from '../components/SearchPanel';
import ActivityBar from '../components/ActivityBar';
import IntelligenceResults from '../components/IntelligenceResults';
// 移除右侧 Intelligence 面板
import type { IntelligenceItem } from '../api/types';
import { api } from '../api';

interface RepoViewProps {
    repoId: string;
    isActive?: boolean;
}

export default function RepoView({ repoId, isActive = true }: RepoViewProps) {
    const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [goToLine, setGoToLine] = useState<string | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // 初始状态为 true
    const [activeRightPanel, setActiveRightPanel] = useState<'none' | 'search'>('search');
    const [bottomIntelOpen, setBottomIntelOpen] = useState(false);
    // 统一下方展示
    const [intelItems, setIntelItems] = useState<IntelligenceItem[]>([]);

    const rightPanelRef = useRef<ImperativePanelHandle>(null);
    const bottomIntelRef = useRef<ImperativePanelHandle>(null);
    const [isBottomExpanded, setIsBottomExpanded] = useState(false);
    const latestFilePathRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            latestFilePathRef.current = null;
        };
    }, []);
    const location = useLocation();

    const handleFileSelect = async (path: string, lineNum: string | null = null, skipUrlUpdate: boolean = false) => {
        if (path === activeFilePath && fileContent !== null) {
            setGoToLine(null);
            setTimeout(() => {
                setGoToLine(lineNum);
            }, 0);
            if (isActive && !skipUrlUpdate) {
                const next: Record<string, string> = { path };
                if (lineNum) next.line = lineNum;
                next.nav = String(Date.now());
                setSearchParams(next);
            }
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
                if (isActive && !skipUrlUpdate) {
                    const next: Record<string, string> = { path };
                    if (lineNum) next.line = lineNum;
                    next.nav = String(Date.now());
                    setSearchParams(next);
                }
            }
        } catch (error) {
            console.error(`Failed to load blob for ${path}:`, error);
            if (path === latestFilePathRef.current) {
                setFileContent(`加载文件失败: ${(error as Error).message}`);
                setIsLoadingFile(false);
            }
        }
    };

    useEffect(() => {
        if (!isActive) return;
        const p = searchParams.get('path');
        const l = searchParams.get('line');
        if (!p) return;
        if (p === activeFilePath && fileContent !== null) {
            setGoToLine(null);
            setTimeout(() => {
                setGoToLine(l);
            }, 0);
            return;
        }
        handleFileSelect(p, l, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, location.key]);

    const handleSelectRightPanel = (p: 'none' | 'search') => {
        setActiveRightPanel(p);
        const panel = rightPanelRef.current;
        if (!panel) return;
        if (p === 'none') {
            panel.collapse();
        } else {
            panel.expand();
        }
    };

    const openBottomIntel = (items: IntelligenceItem[]) => {
        setIntelItems(items);
        setBottomIntelOpen(true);
        const panel = bottomIntelRef.current;
        if (panel) {
            panel.expand();
            setIsBottomExpanded(true);
        }
    };

    const triggerDefinitions = async ({ line, column }: { line: number; column: number }) => {
        if (!activeFilePath) return;
        const items = await api.getDefinitions({ repoId, filePath: activeFilePath, line: line - 1, character: column - 1 });
        openBottomIntel(items);
    };

    const triggerReferences = async ({ line, column }: { line: number; column: number }) => {
        if (!activeFilePath) return;
        const items = await api.getReferences({ repoId, filePath: activeFilePath, line: line - 1, character: column - 1 });
        openBottomIntel(items);
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

            <PanelResizeHandle className="panel-handle-vertical"><div className="panel-handle-bar" /></PanelResizeHandle>

            {/* Right Workspace: vertical group */}
            <Panel id="right-workspace" minSize={30} order={2}>
                <PanelGroup direction="vertical" className="h-full w-full">
                    <Panel id="top-row" order={1} minSize={40} defaultSize={80}>
                        <PanelGroup direction="horizontal" className="h-full w-full">
                            <Panel id="file-editor-panel" order={1} minSize={40}>
                                <FileEditor
                                    repoId={repoId}
                                    filePath={activeFilePath}
                                    fileContent={fileContent}
                                    onPathSubmit={handleFileSelect}
                                    goToLine={goToLine}
                                    isLoading={isLoadingFile}
                                    className="h-full"
                                    onIntelResults={(items) => {
                                        openBottomIntel(items);
                                    }}
                                    onTriggerDefinitions={triggerDefinitions}
                                    onTriggerReferences={triggerReferences}
                                />
                            </Panel>

                            {/* RightPanel: only Search panel retained */}
                            {activeRightPanel === 'search' && (
                                <>
                            <PanelResizeHandle className="panel-handle-vertical"><div className="panel-handle-bar" /></PanelResizeHandle>
                                    <Panel id="right-panel" ref={rightPanelRef} order={2} defaultSize={20} minSize={15} collapsible={true}>
                                        <SearchPanel
                                            repoId={repoId}
                                            onSearchResultClick={handleFileSelect}
                                            className="h-full"
                                        />
                                    </Panel>
                                </>
                            )}

                            <PanelResizeHandle className="panel-handle pointer-events-none" disabled />

                            <Panel id="activity-bar-panel" order={3} defaultSize={3} minSize={3} maxSize={3} collapsible={false}>
                                <ActivityBar
                                    activeRightPanel={activeRightPanel}
                                    onSelectRightPanel={handleSelectRightPanel}
                                />
                            </Panel>
                        </PanelGroup>
                    </Panel>

                    {/* Bottom Explore: collapsed shows only header (32px) */}
                    <PanelResizeHandle className="panel-handle-horizontal"><div className="panel-handle-bar" /></PanelResizeHandle>
                    <Panel id="intelligence-results" ref={bottomIntelRef} order={2} defaultSize={20} minSize={20} collapsible={true} collapsedSize={4}>
                        <IntelligenceResults
                            items={intelItems}
                            onItemClick={(path, range) => {
                                const line = String(range.startLine + (1 - (range.lineBase ?? 1)));
                                handleFileSelect(path, line);
                            }}
                            isExpanded={isBottomExpanded}
                            onToggleExpand={() => {
                                const panel = bottomIntelRef.current;
                                if (!panel) return;
                                if (isBottomExpanded) {
                                    panel.collapse();
                                } else {
                                    panel.expand();
                                }
                                setIsBottomExpanded(!isBottomExpanded);
                            }}
                        />
                    </Panel>
                </PanelGroup>
            </Panel>
            
        </PanelGroup>
    );
}

// 同步路由查询参数到当前视图
 
