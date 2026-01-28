import type { Repository, TreeItem, ContentSearchResult, IntelligenceItem } from './types';

const DEFAULT_API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 封装所有 API 调用
export const api = {
    getBaseUrl: (): string => localStorage.getItem('apiBaseUrl') || DEFAULT_API_URL,
    setBaseUrl: (url: string): void => localStorage.setItem('apiBaseUrl', url),
    
    async get(endpoint: string, options?: { signal?: AbortSignal }): Promise<any> {
        const url = `${api.getBaseUrl()}${endpoint}`;
        try {
            const response = await fetch(url, { signal: options?.signal });
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

    async post(endpoint: string, body: any, options?: { signal?: AbortSignal }): Promise<any> {
        const url = `${api.getBaseUrl()}${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: options?.signal,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            return contentType && contentType.includes('application/json') ? response.json() : response.text();
        } catch (err) {
            console.error(`API Error posting ${url}:`, err);
            throw err;
        }
    },
    
    // 添加显式的返回类型
    getRepositories: (): Promise<Repository[]> => api.get('/repositories'),
    getTree: (repoId: string, path: string = '', options?: { signal?: AbortSignal }): Promise<TreeItem[]> =>
        api.get(`/repositories/${repoId}/tree?path=${encodeURIComponent(path)}`, options),
    getBlob: (repoId: string, path: string, options?: { signal?: AbortSignal }): Promise<string> =>
        api.get(`/repositories/${repoId}/blob?path=${encodeURIComponent(path)}`, options),
    searchContent: (repoId: string, query: string, engine: string, options?: { signal?: AbortSignal }): Promise<ContentSearchResult[]> =>
        api.get(`/repositories/${repoId}/search?q=${encodeURIComponent(query)}&engine=${engine}`, options),
    searchFiles: (repoId: string, query: string, engine: string, options?: { signal?: AbortSignal }): Promise<string[]> =>
        api.get(`/repositories/${repoId}/search-files?q=${encodeURIComponent(query)}&engine=${engine}`, options),

    getDefinitions: (payload: { repoId: string; filePath: string; line: number; character: number }, options?: { signal?: AbortSignal }): Promise<IntelligenceItem[]> =>
        api.post(`/intelligence/definitions`, payload, options),
    getReferences: (payload: { repoId: string; filePath: string; line: number; character: number }, options?: { signal?: AbortSignal }): Promise<IntelligenceItem[]> =>
        api.post(`/intelligence/references`, payload, options),
    
    submitFeedback: (data: import('./types').FeedbackData, options?: { signal?: AbortSignal }): Promise<void> =>
        api.post('/feedback', data, options),
};
