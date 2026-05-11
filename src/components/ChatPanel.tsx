import React, { useRef, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, Send, Settings, Trash2, Square, Loader2 } from 'lucide-react';
import { ChatController, useChatState } from '../controllers/ChatController';
import type { RepoUIController } from '../controllers/RepoUIController';
import type { ChatMessage, EditorContext, LLMConfig, ToolResultInfo } from '../types/ui';
import type { ParsedSegment } from '../types/chat-tags';
import { parseLLMContent } from '../utils/parseLLMContent';
import { CodeBlock } from './CodeBlock';
import FileLink from './FileLink';

// --- Sub-components ---

function ReasoningBlock({ content, isExpanded, onToggle }: {
  content: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded border border-border-default overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-bg-hover text-text-dim hover:bg-bg-sidebar"
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="italic">思考过程</span>
      </button>
      {isExpanded && (
        <div className="px-2.5 py-2 text-xs text-text-dim bg-bg-sidebar italic max-h-48 overflow-auto whitespace-pre-wrap break-words">
          {content}
        </div>
      )}
    </div>
  );
}

function ConfigSection({ controller }: { controller: ChatController }) {
  const state = controller.getSnapshot();
  const [config, setConfig] = useState<LLMConfig>({
    apiKey: state.config?.apiKey || '',
    baseUrl: state.config?.baseUrl || 'https://api.openai.com/v1',
    modelId: state.config?.modelId || 'gpt-4o',
  });

  const handleSave = () => {
    if (!config.apiKey || !config.baseUrl || !config.modelId) return;
    controller.setConfig(config);
  };

  return (
    <div className="p-3 border-b border-border-default space-y-2">
      <div className="text-xs font-semibold text-text-dim uppercase tracking-wide">LLM 配置</div>
      <input
        type="password"
        placeholder="API Key"
        value={config.apiKey}
        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
        className="w-full px-2 py-1.5 text-xs bg-bg-default border border-border-default rounded text-text-default placeholder-text-dim focus:outline-none focus:border-blue-500"
      />
      <input
        type="text"
        placeholder="Base URL"
        value={config.baseUrl}
        onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
        className="w-full px-2 py-1.5 text-xs bg-bg-default border border-border-default rounded text-text-default placeholder-text-dim focus:outline-none focus:border-blue-500"
      />
      <input
        type="text"
        placeholder="Model ID"
        value={config.modelId}
        onChange={(e) => setConfig({ ...config, modelId: e.target.value })}
        className="w-full px-2 py-1.5 text-xs bg-bg-default border border-border-default rounded text-text-default placeholder-text-dim focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={handleSave}
        disabled={!config.apiKey || !config.baseUrl || !config.modelId}
        className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        保存配置
      </button>
    </div>
  );
}

function ToolCallBlock({
  name,
  result,
  isLoading,
  isExpanded,
  onToggle,
}: ToolResultInfo & { onToggle: () => void }) {
  const TOOL_DISPLAY_NAMES: Record<string, string> = {
    read_file: '读取文件',
    search_code: '搜索代码',
    get_current_context: '获取上下文',
    list_directory: '浏览目录',
    search_files: '搜索文件',
    list_repositories: '仓库列表',
  };
  const displayName = TOOL_DISPLAY_NAMES[name] || name;

  return (
    <div className="my-1.5 rounded border border-border-default overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-bg-sidebar hover:bg-bg-hover text-text-dim"
      >
        {isLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isExpanded ? (
          <ChevronDown size={12} />
        ) : (
          <ChevronRight size={12} />
        )}
        <span className="font-medium">{displayName}</span>
        {isLoading && <span className="text-text-dim">...</span>}
        {!isExpanded && !isLoading && result && (
          <span className="ml-auto text-text-dim truncate max-w-[200px] text-right text-[10px]">
            {result.slice(0, 50)}{result.length > 50 ? '...' : ''}
          </span>
        )}
      </button>
      {isExpanded && !isLoading && result && (
        <pre className="px-2.5 py-2 text-xs bg-bg-default text-text-default max-h-48 overflow-auto whitespace-pre-wrap break-all">
          {result.length > 3000 ? result.slice(0, 3000) + '\n... (truncated)' : result}
        </pre>
      )}
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] px-3 py-2 rounded-lg bg-blue-600 text-white text-sm whitespace-pre-wrap break-words">
        {message.content}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  controller,
  repoController,
}: {
  message: ChatMessage;
  controller: ChatController;
  repoController?: RepoUIController;
}) {
  const hasContent = message.content && message.content.trim().length > 0;
  const hasReasoning = message.reasoningContent && message.reasoningContent.trim().length > 0;

  const handleNavigate = (path: string, line: number) => {
    repoController?.openFile(path, { line: String(line), col: null }, { highlight: true });
  };

  // Group segments: consecutive text+file-link → one bubble, code-block → independent card
  const renderContent = () => {
    const segments = parseLLMContent(message.content);
    if (segments.length === 0) return null;

    type SegmentGroup = { type: 'bubble'; segments: ParsedSegment[] } | { type: 'code-block'; segment: ParsedSegment };
    const groups: SegmentGroup[] = [];
    let currentBubble: ParsedSegment[] = [];

    for (const seg of segments) {
      if (seg.type === 'code-block') {
        if (currentBubble.length > 0) {
          groups.push({ type: 'bubble', segments: currentBubble });
          currentBubble = [];
        }
        groups.push({ type: 'code-block', segment: seg });
      } else {
        currentBubble.push(seg);
      }
    }
    if (currentBubble.length > 0) {
      groups.push({ type: 'bubble', segments: currentBubble });
    }

    const lastBubbleIndex = groups.reduce((acc, g, i) => g.type === 'bubble' ? i : acc, -1);

    return groups.map((group, gi) => {
      if (group.type === 'code-block') {
        return (
          <CodeBlock
            key={gi}
            src={group.segment.props.src}
            startLine={group.segment.props.startLine}
            endLine={group.segment.props.endLine}
            repoId={controller.getRepoId()}
            onNavigate={handleNavigate}
          />
        );
      }

      // Bubble group: text + file-link segments
      const isLastBubble = gi === lastBubbleIndex;
      return (
        <div
          key={gi}
          className="px-3 py-2 rounded-lg bg-bg-sidebar text-text-default text-sm [&_pre]:bg-bg-default [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_pre]:overflow-auto [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:border [&_pre]:border-border-default [&_code]:text-xs [&_code]:bg-bg-default [&_code]:px-1 [&_code]:rounded [&_code]:break-all [&_a]:text-blue-600 [&_a]:underline"
        >
          {group.segments.map((seg, si) => {
            if (seg.type === 'text') {
              return (
                <span key={si} className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                  <Markdown remarkPlugins={[remarkGfm]}>{seg.content}</Markdown>
                </span>
              );
            }
            if (seg.type === 'file-link') {
              return (
                <FileLink
                  key={si}
                  path={seg.props.path}
                  line={seg.props.line}
                  onNavigate={handleNavigate}
                >
                  {seg.props.children}
                </FileLink>
              );
            }
            return null;
          })}
          {isLastBubble && message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      );
    });
  };

  return (
    <div className="max-w-[90%] space-y-1">
      {hasReasoning && (
        <ReasoningBlock
          content={message.reasoningContent!}
          isExpanded={message.reasoningExpanded || false}
          onToggle={() => controller.toggleReasoningExpanded(message.id)}
        />
      )}
      {hasContent && renderContent()}
      {message.toolResults?.map((tr) => (
        <ToolCallBlock
          key={tr.callId}
          {...tr}
          onToggle={() => controller.toggleToolResultExpanded(message.id, tr.callId)}
        />
      ))}
    </div>
  );
}

// --- Main ChatPanel ---

export default function ChatPanel({ controller, repoController }: {
  controller: ChatController;
  repoController?: RepoUIController;
}) {
  const state = useChatState(controller);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  // Auto-scroll to bottom — only on new messages or streaming content changes, not on toggle expand/collapse
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages.length, state.messages[state.messages.length - 1]?.content]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || state.isStreaming) return;
    setInputText('');
    const editor = repoController?.getSnapshot().editor;
    const editorContext: EditorContext | undefined = editor?.activeFilePath
      ? { filePath: editor.activeFilePath, line: editor.urlLine ?? null, col: editor.urlCol ?? null }
      : undefined;
    controller.sendMessage(text, editorContext);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-default">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-sidebar border-b border-border-default">
        <span className="text-xs font-semibold text-text-dim uppercase tracking-wide">AI 助手</span>
        <div className="flex items-center gap-1">
          {state.messages.length > 0 && (
            <button
              onClick={() => controller.clearMessages()}
              title="清空对话"
              className="p-1 rounded text-text-dim hover:bg-bg-hover"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => controller.toggleConfig()}
            title="LLM 设置"
            className={`p-1 rounded ${state.showConfig ? 'bg-bg-selected text-text-selected' : 'text-text-dim hover:bg-bg-hover'}`}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Config Section */}
      {state.showConfig && <ConfigSection controller={controller} />}

      {/* No config prompt */}
      {!state.config && !state.showConfig && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <p className="text-text-dim text-sm">配置 LLM API 以开始对话</p>
            <button
              onClick={() => controller.toggleConfig()}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              配置 API
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {state.config && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {state.messages.length === 0 && (
            <div className="text-center text-text-dim text-sm py-8">
              向 AI 助手提问关于代码库的问题
            </div>
          )}
          {state.messages.map((msg) =>
            msg.role === 'user' ? (
              <UserMessage key={msg.id} message={msg} />
            ) : msg.role === 'assistant' ? (
              <AssistantMessage key={msg.id} message={msg} controller={controller} repoController={repoController} />
            ) : null
          )}
          {state.error && (
            <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
              {state.error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area */}
      {state.config && (
        <div className="border-t border-border-default p-2">
          <div className="flex items-center gap-2">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息...&#10;(Enter 发送, Shift+Enter 换行)"
              rows={2}
              disabled={state.isStreaming}
              className="flex-1 resize-none px-2.5 py-1.5 text-sm bg-bg-default border border-border-default rounded text-text-default placeholder-text-dim focus:outline-none focus:border-blue-500 disabled:opacity-50 min-h-[48px] max-h-[120px] overflow-hidden"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                target.style.overflowY = target.scrollHeight > 120 ? 'auto' : 'hidden';
              }}
            />
            {state.isStreaming ? (
              <button
                onClick={() => controller.stopStreaming()}
                title="停止生成"
                className="p-2 rounded bg-red-600 text-white hover:bg-red-700 shrink-0"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                title="发送"
                className="p-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={14} />
              </button>
            )}
          </div>
          {state.isStreaming && state.toolIterationCount != null && state.maxToolIterations != null && (
            <div className="text-xs text-text-dim mt-1">工具轮次 {state.toolIterationCount}/{state.maxToolIterations}</div>
          )}
        </div>
      )}
    </div>
  );
}
