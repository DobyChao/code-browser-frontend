import React, { useState, useMemo } from 'react';
import { Loader2, GitBranch, Settings } from 'lucide-react';
import type { Repository } from '../api/types';

interface HomePageProps {
    repositories: Repository[];
    onOpenRepo: (repoId: string, repoName: string) => void;
    isLoading: boolean;
}

export default function HomePage({ repositories, onOpenRepo, isLoading }: HomePageProps) {
    const [filter, setFilter] = useState('');

    const filteredRepos = useMemo(() => {
        if (!filter) {
            return repositories;
        }
        return repositories.filter(repo =>
            repo.name.toLowerCase().includes(filter.toLowerCase())
        );
    }, [repositories, filter]);

    return (
        <div className="p-8 h-full overflow-y-auto bg-bg-default">
            <div className="max-w-xl mx-auto">
                <h1 className="text-4xl font-bold mb-8 text-text-default">代码仓库浏览器</h1>
                <h2 className="text-2xl font-semibold mb-4 text-text-default">选择一个仓库以开始：</h2>

                <input
                    type="text"
                    placeholder="筛选仓库..."
                    className="w-full mb-6 px-3 py-2 text-sm bg-bg-input border border-border-input rounded-md"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />

                {isLoading ? (
                    <div className="flex items-center text-text-dim">
                        <Loader2 size={24} className="animate-spin mr-2" />
                        <span>正在加载仓库列表...</span>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {filteredRepos.map(repo => (
                            <li key={repo.id}>
                                <button
                                    className="flex items-center space-x-3 p-4 bg-bg-sidebar rounded-lg w-full text-left hover:bg-bg-hover transition-colors"
                                    onClick={() => onOpenRepo(repo.id, repo.name)}
                                >
                                    <GitBranch size={20} className="text-button" />
                                    <span className="text-lg font-medium text-text-default">{repo.name}</span>
                                </button>
                            </li>
                        ))}
                        {filteredRepos.length === 0 && repositories.length > 0 && (
                            <p className="text-text-dim">未找到匹配的仓库。</p>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}