import React, { useRef, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { useSearchParams } from 'react-router-dom';
import FileExplorer from '../components/FileExplorer';
import FileEditor from '../components/FileEditor';
import SearchPanel from '../components/SearchPanel';
import ActivityBar from '../components/ActivityBar';
import IntelligenceResults from '../components/IntelligenceResults';
import type { Tab } from '../api/types';
import { RepoUIController, useRepoUIState } from '../controllers/RepoUIController';

const fallbackController = new RepoUIController({
    repoId: '__fallback__',
    getSearchParams: () => new URLSearchParams(),
    setSearchParams: () => {},
    getIsActive: () => false
});

interface WorkspaceLayoutProps {
    tabs: Tab[];
    activeTabId: string | null;
    controllers: Map<string, RepoUIController>;
}

// 辅助组件：连接 Controller 和 UI 组件
function TabContent({ 
    tab, 
    isActive, 
    controller, 
    type 
}: { 
    tab: Tab; 
    isActive: boolean; 
    controller: RepoUIController; 
    type: 'explorer' | 'editor' | 'search' | 'activity' | 'intelligence' 
}) {
    const ui = useRepoUIState(controller);
    // 当该 tab 激活时，监听 URL 变化并同步到 controller
    const [searchParams] = useSearchParams();
    useEffect(() => {
        if (isActive) {
            controller.syncFromUrl(searchParams);
        }
    }, [isActive, searchParams, controller]);

    if (!isActive) return null; // 简单处理：非激活时不渲染内容？
    // 不，我们需要 Keep-Alive。使用 CSS 隐藏。
    // 但是这里为了方便，我们在外层控制 display: none。
    // 这里只负责传递数据。
    
    switch (type) {
        case 'explorer':
            return (
                <FileExplorer
                    repoId={tab.repoId}
                    onFileSelect={(path) => controller.openFile(path)}
                    activeFilePath={ui.editor.activeFilePath}
                    className="h-full"
                />
            );
        case 'editor':
            return (
                <FileEditor
                    repoId={tab.repoId}
                    filePath={ui.editor.activeFilePath}
                    fileContent={ui.editor.fileContent}
                    onPathSubmit={(path) => controller.openFile(path)}
                    goToLine={ui.editor.goToLine}
                    highlightLine={ui.editor.highlightLine}
                    isLoading={ui.editor.isLoading}
                    className="h-full"
                    onIntelResults={(items) => controller.openBottomIntel(items)}
                    onTriggerDefinitions={(pos) => controller.triggerIntelligence(pos, 'definitions')}
                    onTriggerReferences={(pos) => controller.triggerIntelligence(pos, 'references')}
                    onDismissHighlight={() => controller.dismissHighlight()}
                    onCommitCursorLineToUrl={(line) => controller.commitCursorLineToUrl(String(line))}
                />
            );
        case 'search':
            return (
                <SearchPanel
                    repoId={tab.repoId}
                    onSearchResultClick={(path, line) => controller.openFile(path, line ?? null, { highlight: true })}
                    className="h-full min-w-0"
                    state={ui.searchPanel}
                    onStateChange={(updater) => controller.setSearchPanelState(updater)}
                />
            );
        case 'activity':
            return (
                <ActivityBar
                    activeRightPanel={ui.right.active}
                    onSelectRightPanel={(p) => controller.setRightPanelActive(p)}
                />
            );
        case 'intelligence':
            return (
                <IntelligenceResults
                    items={ui.bottom.items}
                    isPinned={ui.bottom.pinned}
                    onTogglePin={() => controller.togglePinned()}
                    onClear={() => controller.clearIntelItems()}
                    onItemClick={(path, range) => {
                        const line = String(range.startLine + (1 - (range.lineBase ?? 1)));
                        controller.openFile(path, line, { highlight: true });
                    }}
                    isExpanded={ui.bottom.expanded}
                    onToggleExpand={() => controller.setBottomExpanded(true)}
                    onHide={() => controller.setBottomExpanded(false)}
                    intentCategory={ui.bottom.intent.category}
                    intentSignal={ui.bottom.intent.signal}
                />
            );
        default:
            return null;
    }
}

function InitializingWorkspace({ label }: { label: string }) {
    return (
        <div className="h-full w-full flex items-center justify-center text-text-dim text-sm">
            {label}
        </div>
    );
}

export default function WorkspaceLayout({ tabs, activeTabId, controllers }: WorkspaceLayoutProps) {
    const RIGHT_PANEL_MIN_SIZE = 15;
    
    // 获取当前激活 Tab 的 Controller 以控制全局面板大小/状态
    // 注意：这里我们可能需要一个“主”Controller 或者只是简单的使用第一个或者 active 的那个
    // 对于面板大小，如果用户调整了，应该只影响当前 Tab？还是全局？
    // 之前设计是每个 Tab 有自己的 Panel 状态。
    // 为了支持 Keep-Alive 且每个 Tab 状态独立，我们需要在切换 Tab 时，恢复该 Tab 的面板大小。
    // react-resizable-panels 支持 defaultSize，但动态调整需要 imperative API。
    
    const rightPanelRef = useRef<ImperativePanelHandle>(null);
    const bottomPanelRef = useRef<ImperativePanelHandle>(null);
    
    // 当切换 Tab 时，我们需要根据新 Tab 的 Controller 状态来调整面板大小/显隐
    // 这可能比较复杂，因为 PanelGroup 是全局的。
    // 方案：PanelGroup 是全局的，但我们可以根据 Active Tab 的 Controller 状态来 imperative resize。
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    const activeController = activeTab ? controllers.get(activeTab.repoId) : null;
    const controllerForState = activeController || controllers.values().next().value || fallbackController;
    const activeUiState = useRepoUIState(controllerForState);

    // 同步 Panel 状态
    useEffect(() => {
        if (!activeUiState) return;
        
        // Right Panel
        const rightPanel = rightPanelRef.current;
        if (rightPanel) {
            // 如果 active 为 'none'，我们不 resize，而是让条件渲染处理
            if (activeUiState.right.active === 'search') {
                rightPanel.resize(Math.max(activeUiState.right.size, RIGHT_PANEL_MIN_SIZE));
            }
        }

        // Bottom Panel
        const bottomPanel = bottomPanelRef.current;
        if (bottomPanel) {
            if (activeUiState.bottom.expanded) {
                bottomPanel.expand();
            } else {
                bottomPanel.collapse();
            }
        }
    }, [activeUiState, activeTabId]); // 当 activeTabId 变化时，activeUiState 也会变

    const isRightPanelVisible = activeUiState?.right.active === 'search';

    return (
        <PanelGroup direction="horizontal" className="h-full w-full bg-bg-default" id="global-workspace-layout">
            
            {/* Left: File Explorer */}
            <Panel id="left-panel" defaultSize={20} minSize={15} collapsible={true} order={1}>
                {tabs.map(tab => {
                    const controller = controllers.get(tab.repoId);
                    if (!controller) {
                        return (
                            <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                <InitializingWorkspace label="正在初始化仓库..." />
                            </div>
                        );
                    }
                    return (
                        <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                            <TabContent tab={tab} isActive={tab.id === activeTabId} controller={controller} type="explorer" />
                        </div>
                    );
                })}
            </Panel>

            <PanelResizeHandle className="panel-handle-vertical"><div className="panel-handle-bar" /></PanelResizeHandle>

            {/* Center & Right */}
            <Panel id="center-right-group" minSize={30} order={2}>
                <PanelGroup direction="vertical" className="h-full w-full">
                    
                    {/* Top Row: Editor + Search + ActivityBar */}
                    <Panel id="top-row" order={1} minSize={40} defaultSize={80} className="min-w-0">
                        <PanelGroup direction="horizontal" className="h-full w-full min-w-0">
                            
                            {/* Editor */}
                            <Panel id="editor-panel" order={1} minSize={40} className="min-w-0">
                                {tabs.map(tab => {
                                    const controller = controllers.get(tab.repoId);
                                    if (!controller) {
                                        return (
                                            <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                                <InitializingWorkspace label="正在初始化编辑器..." />
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                            <TabContent tab={tab} isActive={tab.id === activeTabId} controller={controller} type="editor" />
                                        </div>
                                    );
                                })}
                            </Panel>

                            <PanelResizeHandle 
                                className="panel-handle-vertical"
                                disabled={!isRightPanelVisible}
                                onDragging={(isDragging) => {
                                    if (!isRightPanelVisible) return;
                                    if (isDragging) return;
                                    const panel = rightPanelRef.current;
                                    if (!panel || !activeController) return;
                                    const size = panel.getSize();
                                    const nextSize = Math.max(size, RIGHT_PANEL_MIN_SIZE);
                                    if (nextSize !== size) panel.resize(nextSize);
                                    activeController.setRightPanelSize(nextSize);
                                }}
                            >
                                <div className="panel-handle-bar" />
                            </PanelResizeHandle>

                            {/* Right Panel (Search) */}
                            {isRightPanelVisible && (
                                <>
                                    <Panel 
                                        id="right-panel" 
                                        ref={rightPanelRef}
                                        order={2}
                                        defaultSize={Math.max(activeUiState?.right.size || 20, RIGHT_PANEL_MIN_SIZE)}
                                        minSize={RIGHT_PANEL_MIN_SIZE}
                                        collapsible={false}
                                        className="min-w-0 overflow-hidden"
                                        onResize={(size) => {
                                            const nextSize = Math.max(size, RIGHT_PANEL_MIN_SIZE);
                                            activeController?.setRightPanelSize(nextSize);
                                        }}
                                    >
                                        {tabs.map(tab => {
                                            const controller = controllers.get(tab.repoId);
                                            if (!controller) {
                                                return (
                                                    <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                                        <InitializingWorkspace label="正在初始化搜索..." />
                                                    </div>
                                                );
                                            }
                                            // 注意：SearchPanel 只有在 active 时才需要显示，但为了保持状态（如搜索结果），我们也需要渲染它
                                            return (
                                                <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                                    <TabContent tab={tab} isActive={tab.id === activeTabId} controller={controller} type="search" />
                                                </div>
                                            );
                                        })}
                                    </Panel>
                                    <PanelResizeHandle className="panel-handle pointer-events-none" disabled />
                                </>
                            )}

                            {/* Activity Bar */}
                            <Panel id="activity-bar" order={3} defaultSize={3} minSize={3} maxSize={3} collapsible={false}>
                                {tabs.map(tab => {
                                    const controller = controllers.get(tab.repoId);
                                    if (!controller) {
                                        return (
                                            <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                                <InitializingWorkspace label="" />
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                            <TabContent tab={tab} isActive={tab.id === activeTabId} controller={controller} type="activity" />
                                        </div>
                                    );
                                })}
                            </Panel>

                        </PanelGroup>
                    </Panel>

                    <PanelResizeHandle className="panel-handle-horizontal"><div className="panel-handle-bar" /></PanelResizeHandle>

                    {/* Bottom: Intelligence */}
                    <Panel id="bottom-panel" ref={bottomPanelRef} order={2} defaultSize={20} minSize={20} collapsible={true} collapsedSize={4}>
                         {tabs.map(tab => {
                            const controller = controllers.get(tab.repoId);
                            if (!controller) {
                                return (
                                    <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                        <InitializingWorkspace label="正在初始化面板..." />
                                    </div>
                                );
                            }
                            return (
                                <div key={tab.id} className="h-full w-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                    <TabContent tab={tab} isActive={tab.id === activeTabId} controller={controller} type="intelligence" />
                                </div>
                            );
                        })}
                    </Panel>

                </PanelGroup>
            </Panel>
        </PanelGroup>
    );
}
