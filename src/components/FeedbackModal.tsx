import React, { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api';
import type { FeedbackData } from '../api/types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: FeedbackData['context'];
}

export default function FeedbackModal({ isOpen, onClose, context }: FeedbackModalProps) {
    const [type, setType] = useState<'issue' | 'feature'>('issue');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen) return null;

    const resetForm = () => {
        setType('issue');
        setTitle('');
        setDescription('');
        setEmail('');
        setStatus('idle');
        setErrorMessage('');
    };

    const handleClose = () => {
        if (status === 'success') {
            resetForm();
        }
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;

        setIsLoading(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            await api.submitFeedback({
                type,
                title,
                description,
                email: email || undefined,
                context: {
                    ...context,
                    url: window.location.href
                }
            });
            setStatus('success');
            // Don't close immediately so user sees success message
        } catch (err) {
            console.error('Feedback submission failed:', err);
            setStatus('error');
            setErrorMessage((err as Error).message || '提交失败，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-bg-sidebar p-6 rounded-lg shadow-xl w-full max-w-lg border border-border-default text-text-default">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">问题反馈与建议</h2>
                    <button onClick={handleClose} className="text-text-dim hover:text-text-default">
                        <X size={20} />
                    </button>
                </div>

                {status === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                        <CheckCircle size={48} className="text-green-500" />
                        <h3 className="text-lg font-medium">感谢您的反馈！</h3>
                        <p className="text-text-dim">我们会尽快处理您提交的问题或建议。</p>
                        <button
                            className="mt-4 px-4 py-2 text-sm rounded-md bg-button text-white hover:bg-button-hover transition-colors"
                            onClick={handleClose}
                        >
                            关闭
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {status === 'error' && (
                            <div className="flex items-center p-3 bg-red-900/20 text-red-400 rounded-md text-sm border border-red-900/50">
                                <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <div className="flex space-x-4">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    className="mr-2"
                                    checked={type === 'issue'}
                                    onChange={() => setType('issue')}
                                />
                                <span className={type === 'issue' ? 'text-text-default' : 'text-text-dim'}>Bug 反馈</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    className="mr-2"
                                    checked={type === 'feature'}
                                    onChange={() => setType('feature')}
                                />
                                <span className={type === 'feature' ? 'text-text-default' : 'text-text-dim'}>功能建议</span>
                            </label>
                        </div>

                        <div>
                            <label htmlFor="feedback-title" className="block text-sm font-medium mb-1">标题 <span className="text-red-500">*</span></label>
                            <input
                                id="feedback-title"
                                type="text"
                                className="w-full px-3 py-2 text-sm bg-bg-input border border-border-input rounded-md focus:outline-none focus:border-button"
                                placeholder={type === 'issue' ? "简要描述遇到的问题" : "简要描述您的建议"}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="feedback-desc" className="block text-sm font-medium mb-1">详细描述 <span className="text-red-500">*</span></label>
                            <textarea
                                id="feedback-desc"
                                className="w-full px-3 py-2 text-sm bg-bg-input border border-border-input rounded-md h-32 resize-none focus:outline-none focus:border-button"
                                placeholder={type === 'issue' ? "请描述重现步骤、期望结果和实际结果..." : "请描述该功能的使用场景和价值..."}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="feedback-email" className="block text-sm font-medium mb-1">联系邮箱 (选填)</label>
                            <input
                                id="feedback-email"
                                type="email"
                                className="w-full px-3 py-2 text-sm bg-bg-input border border-border-input rounded-md focus:outline-none focus:border-button"
                                placeholder="以便我们进一步联系您"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                className="px-4 py-2 mr-3 text-sm rounded-md bg-bg-default text-text-default hover:bg-bg-hover border border-border-default transition-colors"
                                onClick={handleClose}
                                disabled={isLoading}
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm rounded-md bg-button text-white hover:bg-button-hover transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading}
                            >
                                {isLoading && <Loader2 size={16} className="animate-spin mr-2" />}
                                提交反馈
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
