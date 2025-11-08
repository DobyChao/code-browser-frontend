import type { Repository, TreeItem, ContentSearchResult } from './types'; // 修复：使用 import type

// 封装所有 API 调用
export const api = {
    getBaseUrl: (): string => localStorage.getItem('apiBaseUrl') || 'http://localhost:8088/api',
    setBaseUrl: (url: string): void => localStorage.setItem('apiBaseUrl', url),
    
    async get(endpoint: string): Promise<any> {
        const url = `${api.getBaseUrl()}${endpoint}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }
            const contentType = response.headers.get("content-type");
            return contentType && contentType.includes("application/json") ? response.json() : response.text();
        } catch (err) {
            console.error(`API Error fetching ${url}:`, err);
            throw err;
        }
    },
    
    // 添加显式的返回类型
    getRepositories: (): Promise<Repository[]> => api.get('/repositories'),
    getTree: (repoId: string, path: string = ''): Promise<TreeItem[]> => api.get(`/repositories/${repoId}/tree?path=${encodeURIComponent(path)}`),
    getBlob: (repoId: string, path: string): Promise<string> => api.get(`/repositories/${repoId}/blob?path=${encodeURIComponent(path)}`),
    searchContent: (repoId: string, query: string, engine: string): Promise<ContentSearchResult[]> => api.get(`/repositories/${repoId}/search?q=${encodeURIComponent(query)}&engine=${engine}`),
    searchFiles: (repoId: string, query: string, engine: string): Promise<string[]> => api.get(`/repositories/${repoId}/search-files?q=${encodeURIComponent(query)}&engine=${engine}`),
};