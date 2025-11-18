import React, { useState, useEffect } from 'react';
import { api } from './api';
import type { Repository, Tab } from './api/types';
import TabBar from './components/TabBar';
import SettingsModal from './components/SettingsModal';
import HomePage from './views/HomePage';
import RepoView from './views/RepoView';

function App() {
    const [currentView, setCurrentView] = useState<'home' | 'editor'>('home');
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [repositories, setRepositories] = useState<Repository[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    };

    const handleCloseTab = (tabId: string) => {
        const newTabs = tabs.filter(tab => tab.id !== tabId);
        setTabs(newTabs);

        if (activeTabId === tabId) {
            if (newTabs.length > 0) {
                setActiveTabId(newTabs[newTabs.length - 1].id);
            } else {
                setActiveTabId(null);
                setCurrentView('home');
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
                }}
                onCloseTab={handleCloseTab}
                onGoHome={() => setCurrentView('home')} // "Home" 和 "Plus" 按钮都会激活这个
                onOpenSettings={() => setIsSettingsOpen(true)}
            />
            
            <main className="flex-1 overflow-hidden relative"> {/* 使用 relative 布局 */}
                {/* 1. 主页视图 (始终渲染, 条件隐藏) */}
                <div 
                  className={`h-full w-full ${currentView === 'home' ? 'visible' : 'invisible'}`}
                >
                    <HomePage 
                        repositories={repositories} 
                        onOpenRepo={handleOpenRepo}
                        isLoading={isLoadingRepos}
                    />
                </div>

                {/* 2. 编辑器视图 (为每个 tab 渲染一个, 条件隐藏) */}
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        // 修复：使用 'visible'/'invisible' 代替 'block'/'hidden'
                        // 'absolute' 确保非激活的 Tab 不会占用布局空间
                        className={`h-full w-full absolute top-0 left-0 ${
                            currentView === 'editor' && tab.id === activeTabId 
                              ? 'visible' 
                              : 'invisible'
                        }`}
                    >
                        <RepoView repoId={tab.repoId} />
                    </div>
                ))}
            </main>
            
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                apiBaseUrl={apiBaseUrl}
                onSave={handleSaveSettings}
            />
        </div>
    );
}

export default App;