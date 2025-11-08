import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onSave: (url: string) => void;
}

export default function SettingsModal({ isOpen, onClose, apiBaseUrl, onSave }: SettingsModalProps) {
    const [url, setUrl] = useState(apiBaseUrl);

    useEffect(() => {
        setUrl(apiBaseUrl);
    }, [apiBaseUrl, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(url);
        onClose();
    };

    return (
        // 修复：使用 bg-black/50 代替 bg-opacity-30，确保透明度正确应用
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-bg-sidebar p-6 rounded-lg shadow-xl w-full max-w-md border border-border-default text-text-default">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">设置</h2>
                    <button onClick={onClose} className="text-text-dim hover:text-text-default"><X size={20} /></button>
                </div>
                <div className="space-y-2">
                    <label htmlFor="api-url" className="block text-sm font-medium">后端 API 服务地址</label>
                    <input
                        id="api-url"
                        type="text"
                        className="w-full px-3 py-2 text-sm bg-bg-input border border-border-input rounded-md"
                        value={url}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                    />
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        className="px-4 py-2 text-sm rounded-md bg-bg-default text-text-default hover:bg-bg-hover border border-border-default transition-colors"
                        onClick={onClose}
                    >
                        取消
                    </button>
                    <button
                        className="px-4 py-2 text-sm rounded-md bg-button text-white hover:bg-button-hover transition-colors"
                        onClick={handleSave}
                    >
                        保存并刷新
                    </button>
                </div>
            </div>
        </div>
    );
}