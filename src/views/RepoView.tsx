import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { RepoUIController, useRepoUIState } from '../controllers/RepoUIController';

interface RepoViewProps {
    repoId: string;
    isActive?: boolean;
}

export default function RepoView({ repoId, isActive = true }: RepoViewProps) {
    const RIGHT_PANEL_MIN_SIZE = 15;
    const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [goToLine, setGoToLine] = useState<string | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // 初始状态为 true
    // 统一下方展示
    const [intelItems, setIntelItems] = useState<IntelligenceItem[]>([]);

    const rightPanelRef = useRef<ImperativePanelHandle>(null);
    const bottomIntelRef = useRef<ImperativePanelHandle>(null);
    const latestFilePathRef = useRef<string | null>(null);
    const intelAbortRef = useRef<AbortController | null>(null);
    const fileAbortRef = useRef<AbortController | null>(null);
    const lastIntelAtRef = useRef<number>(0);
    const lastRightPanelSizeRef = useRef<number>(20);
    const searchParamsRef = useRef(searchParams);
    const isActiveRef = useRef(isActive);
    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);
    useEffect(() => {
        searchParamsRef.current = searchParams;
    }, [searchParams]);
    const controllerRef = useRef<RepoUIController | null>(null);
    if (!controllerRef.current) {
        controllerRef.current = new RepoUIController({
            getSearchParams: () => searchParamsRef.current,
            setSearchParams: (next) => setSearchParams(next),
            getIsActive: () => isActiveRef.current,
        });
    }
    const ui = useRepoUIState(controllerRef.current);
    const uiRef = useRef(ui);
    useEffect(() => {
        uiRef.current = ui;
    }, [ui]);

    useEffect(() => {
        return () => {
            latestFilePathRef.current = null;
        };
    }, []);
    const location = useLocation();

    const handleFileSelect = useCallback(async (path: string, lineNum: string | null = null, skipUrlUpdate: boolean = false) => {
        if (path === activeFilePath && fileContent !== null) {
            setGoToLine(null);
            setTimeout(() => {
                setGoToLine(lineNum);
            }, 0);
            if (isActive && !skipUrlUpdate) {
                const next: Record<string, string> = { path };
                if (lineNum) next.line = lineNum;
                next.nav = String(Date.now());
                const rp = searchParams.get('rp');
                const intel = searchParams.get('intel');
                if (rp) next.rp = rp;
                if (intel) next.intel = intel;
                setSearchParams(next);
            }
            return;
        }

        latestFilePathRef.current = path;
        setIsLoadingFile(true);
        setActiveFilePath(path);
        setGoToLine(lineNum);

        try {
            fileAbortRef.current?.abort();
            const controller = new AbortController();
            fileAbortRef.current = controller;
            const content = await api.getBlob(repoId, path, { signal: controller.signal });
            if (path === latestFilePathRef.current) {
                setFileContent(content);
                setIsLoadingFile(false);
                if (isActive && !skipUrlUpdate) {
                    const next: Record<string, string> = { path };
                    if (lineNum) next.line = lineNum;
                    next.nav = String(Date.now());
                    const rp = searchParams.get('rp');
                    const intel = searchParams.get('intel');
                    if (rp) next.rp = rp;
                    if (intel) next.intel = intel;
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
    }, [activeFilePath, fileContent, isActive, repoId, searchParams, setSearchParams]);

    useEffect(() => {
        if (!isActive) return;
        controllerRef.current?.syncFromUrl();
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
        const controller = controllerRef.current;
        if (!controller) return;
        if (p === 'search') {
            const nextSize = Math.max(lastRightPanelSizeRef.current, RIGHT_PANEL_MIN_SIZE);
            controller.setRightPanelSize(nextSize);
            lastRightPanelSizeRef.current = nextSize;
            controller.setRightPanelActive('search');
        } else {
            controller.setRightPanelActive('none');
        }
    };

    const isRightPanelVisible = ui.right.active === 'search';

    useEffect(() => {
        if (!isActive) return;
        const panel = bottomIntelRef.current;
        if (!panel) return;
        if (ui.bottom.expanded) panel.expand();
        else panel.collapse();
    }, [isActive, ui.bottom.expanded]);

    const openBottomIntel = (items: IntelligenceItem[]) => {
        setIntelItems(prev => {
            if (ui.bottom.pinned) {
                const combined = [...prev, ...items];
                return combined.slice(-200);
            }
            return items;
        });
        const panel = bottomIntelRef.current;
        if (panel) {
            panel.expand();
            controllerRef.current?.setBottomExpanded(true);
        }
    };

    const triggerDefinitions = async ({ line, column }: { line: number; column: number }) => {
        if (!activeFilePath) return;
        const now = Date.now();
        if (now - lastIntelAtRef.current < 250) return;
        lastIntelAtRef.current = now;
        intelAbortRef.current?.abort();
        const controller = new AbortController();
        intelAbortRef.current = controller;
        try {
            const items = await api.getDefinitions({ repoId, filePath: activeFilePath, line: line - 1, character: column - 1 }, { signal: controller.signal });
            openBottomIntel(items);
        } catch (e) {
            if ((e as any)?.name === 'AbortError') return;
            console.error(e);
        }
    };

    const triggerReferences = async ({ line, column }: { line: number; column: number }) => {
        if (!activeFilePath) return;
        const now = Date.now();
        if (now - lastIntelAtRef.current < 250) return;
        lastIntelAtRef.current = now;
        intelAbortRef.current?.abort();
        const controller = new AbortController();
        intelAbortRef.current = controller;
        try {
            const items = await api.getReferences({ repoId, filePath: activeFilePath, line: line - 1, character: column - 1 }, { signal: controller.signal });
            openBottomIntel(items);
        } catch (e) {
            if ((e as any)?.name === 'AbortError') return;
            console.error(e);
        }
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
                    <Panel id="top-row" order={1} minSize={40} defaultSize={80} className="min-w-0">
                        <PanelGroup direction="horizontal" className="h-full w-full min-w-0">
                            <Panel id="file-editor-panel" order={1} minSize={40} className="min-w-0">
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

                            <PanelResizeHandle
                                className="panel-handle-vertical"
                                disabled={!isRightPanelVisible}
                                onDragging={(isDragging) => {
                                    if (!isRightPanelVisible) return;
                                    if (isDragging) return;
                                    const panel = rightPanelRef.current;
                                    if (!panel) return;
                                    const size = panel.getSize();
                                    const nextSize = Math.max(size, RIGHT_PANEL_MIN_SIZE);
                                    if (nextSize !== size) panel.resize(nextSize);
                                    lastRightPanelSizeRef.current = nextSize;
                                    controllerRef.current?.setRightPanelSize(nextSize);
                                }}
                            >
                                <div className="panel-handle-bar" />
                            </PanelResizeHandle>
                            {isRightPanelVisible && (
                                <>
                                    <Panel
                                        id="right-panel"
                                        ref={rightPanelRef}
                                        order={2}
                                        defaultSize={Math.max(ui.right.size, RIGHT_PANEL_MIN_SIZE)}
                                        minSize={RIGHT_PANEL_MIN_SIZE}
                                        collapsible={false}
                                        className="min-w-0 overflow-hidden"
                                        onResize={(size) => {
                                            const nextSize = Math.max(size, RIGHT_PANEL_MIN_SIZE);
                                            lastRightPanelSizeRef.current = nextSize;
                                            controllerRef.current?.setRightPanelSize(nextSize);
                                        }}
                                    >
                                    <SearchPanel
                                        repoId={repoId}
                                        onSearchResultClick={handleFileSelect}
                                        className="h-full min-w-0"
                                        state={ui.searchPanel}
                                        onStateChange={(updater) => controllerRef.current?.setSearchPanelState(updater)}
                                    />
                                </Panel>
                                    <PanelResizeHandle className="panel-handle pointer-events-none" disabled />
                                </>
                            )}

                            <Panel id="activity-bar-panel" order={3} defaultSize={3} minSize={3} maxSize={3} collapsible={false}>
                                <ActivityBar
                                    activeRightPanel={ui.right.active}
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
                            isPinned={ui.bottom.pinned}
                            onTogglePin={() => controllerRef.current?.togglePinned()}
                            onClear={() => setIntelItems([])}
                            onItemClick={(path, range) => {
                                const line = String(range.startLine + (1 - (range.lineBase ?? 1)));
                                handleFileSelect(path, line);
                            }}
                            isExpanded={ui.bottom.expanded}
                            onToggleExpand={() => {
                                const panel = bottomIntelRef.current;
                                if (!panel) return;
                                panel.expand();
                                controllerRef.current?.setBottomExpanded(true);
                            }}
                            onHide={() => {
                                const panel = bottomIntelRef.current;
                                if (!panel) return;
                                panel.collapse();
                                controllerRef.current?.setBottomExpanded(false);
                            }}
                        />
                    </Panel>
                </PanelGroup>
            </Panel>
            
        </PanelGroup>
    );
}

// 同步路由查询参数到当前视图
 
