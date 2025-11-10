import type { TreeItem, SearchFragment } from '../api/types';

export const Utils = {
    getLanguageFromPath: (path: string): string => {
        const extension = path.split('.').pop()?.toLowerCase();
        const langMap: Record<string, string> = {
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python',
            'go': 'go',
            'java': 'java',
            'c': 'c',
            'h': 'cpp',   // 新增：将 .h 映射为 cpp 以获得更好的高亮
            'hpp': 'cpp', // 新增：.hpp 也映射为 cpp
            'cpp': 'cpp',
            'cc': 'cpp',  // 新增：.cc 也映射为 cpp
            'cs': 'csharp',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'json': 'json',
            'md': 'markdown',
            'sh': 'bash',
            'yaml': 'yaml',
            'yml': 'yaml',
            'rb': 'ruby',
            'php': 'php',
            'rs': 'rust',
            'kt': 'kotlin'
        };
        return langMap[extension || ''] || 'plaintext';
    },
    // ... (rest of the file remains unchanged)
    escapeHtml: (unsafe: string | null | undefined): string => {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },

    highlightFragments: (lineText: string, fragments: SearchFragment[]): string => {
        const esc = Utils.escapeHtml;
        if (!fragments || fragments.length === 0) return esc(lineText);
        
        // 按偏移量排序
        fragments.sort((a, b) => a.offset - b.offset);
        
        let resultHtml = '';
        let lastIndex = 0;
        
        for (const frag of fragments) {
            // 添加匹配前的安全文本
            resultHtml += esc(lineText.substring(lastIndex, frag.offset));
            // 添加高亮的匹配文本
            resultHtml += `<span class="search-highlight">${esc(lineText.substring(frag.offset, frag.offset + frag.length))}</span>`;
            lastIndex = frag.offset + frag.length;
        }
        // 添加最后一个匹配后的剩余文本
        resultHtml += esc(lineText.substring(lastIndex));
        
        return resultHtml;
    },

    // 新增：Debounce (防抖) 函数
    debounce<F extends (...args: any[]) => any>(func: F, delay: number): (...args: Parameters<F>) => void {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        return (...args: Parameters<F>) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                func(...args);
            }, delay);
        };
    }
};