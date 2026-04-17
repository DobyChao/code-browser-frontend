import { useMemo, useSyncExternalStore } from 'react';
import { LLMClient, type ChatMessageForLLM } from '../api/llm-client';
import { TOOL_DEFINITIONS, ToolExecutor } from '../api/tools';
import type { ChatMessage, ChatPanelState, EditorContext, LLMConfig, ToolCallInfo, ToolResultInfo } from '../types/ui';

type Listener = () => void;

const CONFIG_STORAGE_KEY = 'omc-llm-config';

function loadConfigFromLocalStorage(): LLMConfig | null {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.apiKey && parsed.baseUrl && parsed.modelId) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveConfigToLocalStorage(config: LLMConfig) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ChatController {
  private listeners = new Set<Listener>();
  private state: ChatPanelState;
  private abortController: AbortController | null = null;
  private llmClient: LLMClient | null = null;
  private toolExecutor: ToolExecutor;
  private currentEditorContext: EditorContext | null = null;

  constructor(
    private repoId: string,
    getEditorContext?: () => EditorContext | null
  ) {
    this.toolExecutor = new ToolExecutor(repoId, getEditorContext);
    const config = loadConfigFromLocalStorage();
    if (config) {
      this.llmClient = new LLMClient(config);
    }
    this.state = {
      messages: [],
      isStreaming: false,
      error: null,
      config,
      showConfig: !config, // Show config on first use
    };
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private emit = () => {
    for (const l of this.listeners) l();
  };

  setConfig = (config: LLMConfig) => {
    saveConfigToLocalStorage(config);
    this.llmClient = new LLMClient(config);
    this.state = { ...this.state, config, showConfig: false };
    this.emit();
  };

  toggleConfig = () => {
    this.state = { ...this.state, showConfig: !this.state.showConfig };
    this.emit();
  };

  clearMessages = () => {
    this.state = { ...this.state, messages: [], error: null };
    this.emit();
  };

  sendMessage = async (text: string, editorContext?: EditorContext | null) => {
    this.currentEditorContext = editorContext || null;
    if (!this.llmClient) {
      this.state = { ...this.state, error: '请先配置 LLM API 设置', showConfig: true };
      this.emit();
      return;
    }

    if (this.state.isStreaming) return;

    // Abort any existing stream
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Append user message
    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text };
    const assistantMsg: ChatMessage = { id: generateId(), role: 'assistant', content: '', isStreaming: true };

    this.state = {
      ...this.state,
      messages: [...this.state.messages, userMsg, assistantMsg],
      isStreaming: true,
      error: null,
    };
    this.emit();

    try {
      await this.runAgenticLoop(signal);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        this.state = { ...this.state, error: (e as Error).message };
      }
    } finally {
      // Finalize the last assistant message
      const msgs = [...this.state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant' && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, isStreaming: false };
      }
      this.state = { ...this.state, messages: msgs, isStreaming: false };
      this.abortController = null;
      this.emit();
    }
  };

  private runAgenticLoop = async (signal: AbortSignal) => {
    const MAX_TOOL_ITERATIONS = 5;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      if (signal.aborted) return;

      // Capture the current assistant message ID for tool result attachment
      const currentMsgs = this.state.messages;
      const assistantMsgId = currentMsgs[currentMsgs.length - 1]?.id;

      // Build messages with 20-message sliding window
      const contextMessages = this.buildLLMMessages();

      let fullContent = '';
      let fullReasoning = '';
      const response = await this.llmClient!.chatCompletion({
        messages: contextMessages,
        tools: TOOL_DEFINITIONS,
        signal,
        onToken: (token) => {
          fullContent += token;
          this.updateStreamingAssistant({ content: fullContent });
        },
        onReasoningToken: (token) => {
          fullReasoning += token;
          this.updateStreamingAssistant({ reasoningContent: fullReasoning });
        },
      });

      if (signal.aborted) return;

      // Update final content
      this.updateStreamingAssistant({
        content: response.content,
        ...(response.reasoningContent && { reasoningContent: response.reasoningContent }),
      });

      // No tool calls — done
      if (!response.tool_calls?.length) return;

      // Process tool calls
      const toolCalls: ToolCallInfo[] = response.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      // Add tool calls to the streaming assistant message
      const msgs = [...this.state.messages];
      const currentMsgIdx = this.findMessageById(msgs, assistantMsgId);
      if (currentMsgIdx >= 0) {
        msgs[currentMsgIdx] = { ...msgs[currentMsgIdx], toolCalls };
        this.state = { ...this.state, messages: msgs };
        this.emit();
      }

      // Execute each tool
      for (const tc of response.tool_calls) {
        if (signal.aborted) return;

        let args: Record<string, string>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          this.appendToolResult(assistantMsgId, tc.id, tc.function.name, 'Error: invalid tool arguments');
          continue;
        }

        // Add loading tool result
        const loadingResult: ToolResultInfo = {
          callId: tc.id,
          name: tc.function.name,
          result: '',
          isLoading: true,
          isExpanded: false,
        };
        this.appendToolResultObj(assistantMsgId, loadingResult);

        const result = await this.toolExecutor.execute(tc.function.name, args);

        // Update with actual result
        this.updateToolResult(assistantMsgId, tc.id, result);
      }

      // Add a new assistant message for the next iteration
      const nextAssistant: ChatMessage = { id: generateId(), role: 'assistant', content: '', isStreaming: true };
      this.state = { ...this.state, messages: [...this.state.messages, nextAssistant] };
      this.emit();
    }
  };

  private buildLLMMessages(): ChatMessageForLLM[] {
    const recent = this.state.messages.slice(-20);
    const systemBase = 'You are an AI assistant helping users analyze a code repository. You can read files and search code using the provided tools. Respond in the same language as the user\'s question. Be concise and helpful.';

    let systemContent = systemBase;

    // Add tag usage instructions
    systemContent += `

When referencing code files in your responses, use these custom tags:

1. Code block display (shows highlighted code with line numbers):
   <code-block src="path/to/file.ext" lines="startLine-endLine" />
   Example: <code-block src="src/api/tools.ts" lines="45-62" />

2. File reference link (clickable link to navigate to a file):
   <file-link path="path/to/file.ext" line="42">display text</file-link>
   Example: <file-link path="src/utils/index.ts" line="10">utils.ts:10</file-link>

The line number in <file-link> and the lines attribute in <code-block> are optional.
Use these tags naturally within your response text. Do NOT use them as tool calls.`;

    if (this.currentEditorContext) {
      const ctx = this.currentEditorContext;
      systemContent += `\n\n用户当前正在查看:\n- 文件: ${ctx.filePath}`;
      if (ctx.line) {
        systemContent += `\n- 位置: 第 ${ctx.line} 行`;
        if (ctx.col) systemContent += ` 第 ${ctx.col} 列`;
      }
    }

    const result: ChatMessageForLLM[] = [
      {
        role: 'system',
        content: systemContent,
      },
    ];

    for (const msg of recent) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        const llmMsg: ChatMessageForLLM = { role: 'assistant', content: msg.content || '' };
        if (msg.toolCalls?.length) {
          llmMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));
        }
        result.push(llmMsg);
      }
      // Add tool results as tool messages
      if (msg.toolResults) {
        for (const tr of msg.toolResults) {
          result.push({
            role: 'tool',
            content: tr.result,
            tool_call_id: tr.callId,
          });
        }
      }
    }

    return result;
  }

  private updateStreamingAssistant = (updates: { content?: string; reasoningContent?: string }) => {
    const msgs = [...this.state.messages];
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant' && last.isStreaming) {
      msgs[msgs.length - 1] = {
        ...last,
        ...(updates.content !== undefined && { content: updates.content }),
        ...(updates.reasoningContent !== undefined && { reasoningContent: updates.reasoningContent }),
      };
      this.state = { ...this.state, messages: msgs };
      this.emit();
    }
  };

  private findMessageById = (msgs: ChatMessage[], id: string): number => {
    // Search from end for correct semantics (last matching assistant message)
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].id === id) return i;
    }
    return -1;
  };

  private appendToolResultObj = (messageId: string, result: ToolResultInfo) => {
    const msgs = [...this.state.messages];
    const idx = this.findMessageById(msgs, messageId);
    if (idx >= 0 && msgs[idx].role === 'assistant') {
      const toolResults = [...(msgs[idx].toolResults || []), result];
      msgs[idx] = { ...msgs[idx], toolResults };
      this.state = { ...this.state, messages: msgs };
      this.emit();
    }
  };

  private appendToolResult = (messageId: string, callId: string, name: string, result: string) => {
    this.appendToolResultObj(messageId, { callId, name, result, isLoading: false, isExpanded: false });
  };

  private updateToolResult = (messageId: string, callId: string, result: string) => {
    const msgs = [...this.state.messages];
    const idx = this.findMessageById(msgs, messageId);
    if (idx >= 0 && msgs[idx].toolResults) {
      const toolResults = msgs[idx].toolResults!.map((tr) =>
        tr.callId === callId ? { ...tr, result, isLoading: false } : tr
      );
      msgs[idx] = { ...msgs[idx], toolResults };
      this.state = { ...this.state, messages: msgs };
      this.emit();
    }
  };

  toggleToolResultExpanded = (messageId: string, callId: string) => {
    const msgs = [...this.state.messages];
    const idx = this.findMessageById(msgs, messageId);
    if (idx >= 0 && msgs[idx].toolResults) {
      const toolResults = msgs[idx].toolResults!.map((tr) =>
        tr.callId === callId ? { ...tr, isExpanded: !tr.isExpanded } : tr
      );
      msgs[idx] = { ...msgs[idx], toolResults };
      this.state = { ...this.state, messages: msgs };
      this.emit();
    }
  };

  toggleReasoningExpanded = (messageId: string) => {
    const msgs = [...this.state.messages];
    const idx = this.findMessageById(msgs, messageId);
    if (idx >= 0) {
      msgs[idx] = { ...msgs[idx], reasoningExpanded: !msgs[idx].reasoningExpanded };
      this.state = { ...this.state, messages: msgs };
      this.emit();
    }
  };

  stopStreaming = () => {
    this.abortController?.abort();
  };

  getRepoId = () => this.repoId;

  dispose = () => {
    this.abortController?.abort();
    this.listeners.clear();
  };
}

export function useChatController(deps: { repoId: string; getEditorContext?: () => EditorContext | null }) {
  return useMemo(() => new ChatController(deps.repoId, deps.getEditorContext), [deps.repoId]);
}

export function useChatState(controller: ChatController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
