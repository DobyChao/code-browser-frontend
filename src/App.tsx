import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from './api';
import type { Repository, Tab } from './api/types';
import TabBar from './components/TabBar';
import SettingsModal from './components/SettingsModal';
import FeedbackModal from './components/FeedbackModal';
import HomePage from './views/HomePage';
import WorkspaceLayout from './views/WorkspaceLayout';
import { RepoUIController } from './controllers/RepoUIController';

function RepoRouteBinder({ onEnsureTab }: { onEnsureTab: (repoId: string, searchParams: URLSearchParams) => void }) {
    const { repoId = '' } = useParams();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    
    // 使用 ref 避免闭包陷阱
    const onEnsureTabRef = useRef(onEnsureTab);
    onEnsureTabRef.current = onEnsureTab;

    useEffect(() => {
        if (repoId) {
            onEnsureTabRef.current(repoId, searchParams);
        }
    }, [repoId, location.key, searchParams]);
    return null;
}

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentView, setCurrentView] = useState<'home' | 'editor'>('home');
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [repositories, setRepositories] = useState<Repository[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [apiBaseUrl, setApiBaseUrl] = useState(api.getBaseUrl());
    
    // Controllers Map: repoId -> RepoUIController
    // 我们使用 useMemo 来保持引用，但实际存储在 Ref 中以避免不必要的重渲染，
    // 或者使用 useState 但需要小心闭包。
    // 更好的方式是使用 Map Ref，并在需要更新视图时触发强制渲染，
    // 但这里我们将 Map 作为 Prop 传递给 WorkspaceLayout，所以它应该是 State 或者是 Ref + ForceUpdate。
    // 鉴于 React 推荐不可变数据，我们可以用 State<Map> 但 Map 本身是可变的。
    // 让我们用一个简单的 Ref 来存储 Controllers，因为 Controller 内部是 Observable 的，
    // 组件会订阅 Controller 的变化，而不是 App 的变化。
    // 只要 tabs 列表变化，App 就会重渲染，controllers 也会被传递下去。
    const controllersRef = useRef(new Map<string, RepoUIController>());
    // 用于强制刷新 App (当添加新 Controller 时)
    const [, forceUpdate] = useState({});

    // 保持 activeTabId 的 Ref 用于 Controller 闭包
    const activeTabIdRef = useRef(activeTabId);
    activeTabIdRef.current = activeTabId;
    
    // 保持 tabs 的 Ref 用于 Controller 闭包
    const tabsRef = useRef(tabs);
    tabsRef.current = tabs;

    const locationRef = useRef(location);
    locationRef.current = location;

    // 同时也需要 tabId 的映射，因为 getIsActive 需要知道当前 Controller 对应哪个 Tab ID
    // 简单起见，我们假设 repoId <-> Tab ID 是一一对应的（虽然目前 Tab ID 是生成的）
    // 我们的 Tabs 逻辑里，find(t => t.repoId === repoId) 来决定 Active。
    // 所以 getIsActive 可以简化为: activeTabIdRef.current 对应的 repoId === 当前 controller.repoId
    // 重新实现 getOrCreateController 以使用正确的闭包
    const ensureController = (repoId: string, initialSearchParams?: URLSearchParams) => {
         if (!controllersRef.current.has(repoId)) {
             const controller = new RepoUIController({
                 repoId,
                 getSearchParams: () => new URLSearchParams(locationRef.current.search),
                 setSearchParams: (next, opts) =>
                    navigate(
                        { pathname: `/repo/${repoId}`, search: `?${next.toString()}` },
                        { replace: opts?.replace ?? true }
                    ),
                 // 修复：使用 ref 获取最新的 activeTabId 和 tabs
                 getIsActive: () => {
                    const currentActiveRepoId = tabsRef.current.find(t => t.id === activeTabIdRef.current)?.repoId;
                    // 如果 activeTabId 还未设置（例如首次加载），我们假设如果 URL 匹配则为 active
                    if (!currentActiveRepoId) {
                         // Fallback: 检查当前 URL 是否匹配此 repoId
                         const match = locationRef.current.pathname.match(/\/repo\/([^/]+)/);
                         return match ? match[1] === repoId : false;
                    }
                    return currentActiveRepoId === repoId;
                 }
             });
             
             if (initialSearchParams) {
                 // 初始化同步
                 // 直接在真正的 controller 上调用 syncFromUrl，这样 openFile 的副作用会直接作用于此 controller
                 controller.syncFromUrl(initialSearchParams);
             }
             
             controllersRef.current.set(repoId, controller);
             forceUpdate({});
         }
    };

    // 清理关闭的 Tab 的 Controller
    useEffect(() => {
        const activeRepoIds = new Set(tabs.map(t => t.repoId));
        const match = location.pathname.match(/^\/repo\/([^/]+)$/);
        if (match) activeRepoIds.add(match[1]);
        let changed = false;
        for (const [repoId, controller] of controllersRef.current.entries()) {
            if (!activeRepoIds.has(repoId)) {
                // 可以添加 controller.dispose() 如果有的话
                controllersRef.current.delete(repoId);
                changed = true;
            }
        }
        if (changed) forceUpdate({});
    }, [tabs, location.pathname]);

    const fetchRepositories = () => {
        setIsLoadingRepos(true);
        setError(null);
        api.getRepositories()
            .then(setRepositories)
            .catch(err => {
                setError(`加载仓库列表失败: ${(err as Error).message}。请点击 ⚙️ 检查服务地址。`);
            })
            .finally(() => setIsLoadingRepos(false));
    };

    useEffect(fetchRepositories, [apiBaseUrl]);

    useEffect(() => {
        if (activeTabId) return;
        const match = location.pathname.match(/^\/repo\/([^/]+)$/);
        if (!match) return;
        const rid = match[1];
        const tab = tabs.find(t => t.repoId === rid);
        if (!tab) return;
        setActiveTabId(tab.id);
        setCurrentView('editor');
    }, [activeTabId, tabs, location.pathname]);

    const handleOpenRepo = (repoId: string, repoName: string) => {
        const tabId = `tab_${repoId}`;
        setTabs(prev => {
            if (prev.some(t => t.repoId === repoId)) return prev;
            return [...prev, { id: tabId, repoId, repoName }];
        });
        setActiveTabId(tabId);
        ensureController(repoId);
        setCurrentView('editor');
        navigate(`/repo/${repoId}`);
    };

    const handleCloseTab = (tabId: string) => {
        const newTabs = tabs.filter(tab => tab.id !== tabId);
        setTabs(newTabs);

        if (activeTabId === tabId) {
            if (newTabs.length > 0) {
                const nextActive = newTabs[newTabs.length - 1];
                setActiveTabId(nextActive.id);
                navigate(`/repo/${nextActive.repoId}`);
            } else {
                setActiveTabId(null);
                setCurrentView('home');
                navigate(`/`);
            }
        }
    };
    
    const handleSaveSettings = (newUrl: string) => {
        api.setBaseUrl(newUrl);
        setApiBaseUrl(newUrl);
        // Reset app state
        setTabs([]);
        setActiveTabId(null);
        setCurrentView('home');
        controllersRef.current.clear();
    };

    const activeTab = tabs.find(tab => tab.id === activeTabId);

    return (
        <div className="h-screen w-screen flex flex-col bg-bg-default">
            {error && (
                <div className="p-2 bg-red-800 text-white text-center text-sm">{error}</div>
            )}
            
            <TabBar
                tabs={tabs}
                activeTabId={activeTabId}
                onSelectTab={(id) => {
                    setActiveTabId(id);
                    setCurrentView('editor'); 
                    const tab = tabs.find(t => t.id === id);
                    if (tab) navigate(`/repo/${tab.repoId}`);
                }}
                onCloseTab={handleCloseTab}
                onGoHome={() => { setCurrentView('home'); navigate(`/`); }}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenFeedback={() => setIsFeedbackOpen(true)}
            />
            
            <main className="flex-1 overflow-hidden relative">
                <Routes>
                    <Route path="/" element={
                        <div className="h-full w-full visible">
                            <HomePage 
                                repositories={repositories} 
                                onOpenRepo={handleOpenRepo}
                                isLoading={isLoadingRepos}
                            />
                        </div>
                    } />
                    <Route path="/repo/:repoId" element={
                        <div className="h-full w-full absolute top-0 left-0 visible">
                            <WorkspaceLayout 
                                tabs={tabs} 
                                activeTabId={activeTabId} 
                                controllers={controllersRef.current} 
                            />
                            <RepoRouteBinder onEnsureTab={(rid, params) => {
                                const tabId = `tab_${rid}`;
                                ensureController(rid, params); // 确保 Controller 存在并初始化状态
                                setTabs(prev => {
                                    if (prev.some(t => t.repoId === rid)) return prev;
                                    const repoName = repositories.find(r => r.id === rid)?.name || rid;
                                    return [...prev, { id: tabId, repoId: rid, repoName }];
                                });
                                setActiveTabId(tabId);
                                setCurrentView('editor');
                            }} />
                        </div>
                    } />
                </Routes>
            </main>
            
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                apiBaseUrl={apiBaseUrl}
                onSave={handleSaveSettings}
            />
            
            <FeedbackModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                context={{
                    repoId: activeTab?.repoId
                }}
            />
        </div>
    );
}

export default App;
