import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from './api';
import type { Repository, Tab } from './api/types';
import TabBar from './components/TabBar';
import SettingsModal from './components/SettingsModal';
import FeedbackModal from './components/FeedbackModal';
import HomePage from './views/HomePage';
import RepoView from './views/RepoView';

function RepoRouteBinder({ tabs, onEnsureTab }: { tabs: Tab[], onEnsureTab: (repoId: string, currentTabs: Tab[]) => void }) {
    const { repoId = '' } = useParams();
    const location = useLocation();
    
    // 使用 ref 确保在 effect 中总是能访问到最新的 tabs 和回调函数
    // 避免因为闭包陷阱导致使用旧的 tabs 数据
    const tabsRef = useRef(tabs);
    const onEnsureTabRef = useRef(onEnsureTab);
    
    // 每次渲染都更新 ref
    tabsRef.current = tabs;
    onEnsureTabRef.current = onEnsureTab;

    useEffect(() => {
        if (repoId) {
            onEnsureTabRef.current(repoId, tabsRef.current);
        }
    }, [repoId, location.key]);
    return null;
}

function App() {
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState<'home' | 'editor'>('home');
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [repositories, setRepositories] = useState<Repository[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [apiBaseUrl, setApiBaseUrl] = useState(api.getBaseUrl());

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

    const handleOpenRepo = (repoId: string, repoName: string) => {
        const existingTab = tabs.find(tab => tab.repoId === repoId);
        if (existingTab) {
            setActiveTabId(existingTab.id);
        } else {
            const newTab = { id: `tab_${repoId}_${Date.now()}`, repoId, repoName };
            setTabs([...tabs, newTab]);
            setActiveTabId(newTab.id);
        }
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
                    setCurrentView('editor'); // 修复：点击 Tab 时切换回编辑器视图
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
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    className={`h-full w-full absolute top-0 left-0 ${tab.id === activeTabId ? 'visible' : 'invisible'}`}
                                >
                                    <RepoView key={tab.id} repoId={tab.repoId} isActive={tab.id === activeTabId} />
                                </div>
                            ))}
                            <RepoRouteBinder 
                                tabs={tabs}
                                onEnsureTab={(rid, currentTabs) => {
                                    const existingTab = currentTabs.find(t => t.repoId === rid);
                                    if (existingTab) {
                                        setActiveTabId(existingTab.id);
                                    } else {
                                        const repoName = repositories.find(r => r.id === rid)?.name || rid;
                                        const newTab = { id: `tab_${rid}_${Date.now()}`, repoId: rid, repoName };
                                        setTabs([...currentTabs, newTab]);
                                        setActiveTabId(newTab.id);
                                    }
                                    setCurrentView('editor');
                                }} 
                            />
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
