export type LLMClientConfig = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
};

export type ChatMessageForLLM = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCallDelta[];
  tool_call_id?: string;
};

export type ToolCallDelta = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatCompletionResponse = {
  content: string;
  reasoningContent?: string;
  tool_calls?: ToolCallDelta[];
  finish_reason?: string;
};

type SSEDelta = {
  content?: string;
  reasoning_content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
};

export class LLMClient {
  constructor(private config: LLMClientConfig) {}

  updateConfig(config: LLMClientConfig) {
    this.config = config;
  }

  async chatCompletion(options: {
    messages: ChatMessageForLLM[];
    tools?: ToolDefinition[];
    signal?: AbortSignal;
    onToken: (token: string) => void;
    onReasoningToken?: (token: string) => void;
  }): Promise<ChatCompletionResponse> {
    const { messages, tools, signal, onToken, onReasoningToken } = options;

    const body: Record<string, unknown> = {
      model: this.config.modelId,
      messages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const url = `${this.config.baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API Error ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let reasoningContentAccum = '';
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let buffer = '';
    let finishReason: string | undefined;

    try {
      while (true) {
        if (signal?.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          // Handle both "data: {...}" and "data:{...}" (space after colon is optional per SSE spec)
          const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta: SSEDelta | undefined = parsed.choices?.[0]?.delta;

            const chunkFinishReason = parsed.choices?.[0]?.finish_reason;
            if (chunkFinishReason) {
              finishReason = chunkFinishReason;
            }

            if (!delta) continue;

            // Content tokens
            if (delta.content) {
              fullContent += delta.content;
              onToken(delta.content);
            }

            // Reasoning content tokens (DeepSeek and compatible providers)
            if (delta.reasoning_content) {
              reasoningContentAccum += delta.reasoning_content;
              onReasoningToken?.(delta.reasoning_content);
            }

            // Tool call deltas
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCallMap.get(tc.index) || { id: '', name: '', arguments: '' };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                toolCallMap.set(tc.index, existing);
              }
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError' || signal?.aborted) {
        return { content: fullContent, reasoningContent: reasoningContentAccum || undefined, finish_reason: finishReason };
      }
      throw e;
    }

    const tool_calls: ToolCallDelta[] = [];
    for (const [, tc] of toolCallMap) {
      if (tc.id && tc.name) {
        tool_calls.push({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        });
      }
    }

    if (finishReason && finishReason !== 'stop') {
      console.warn(`[LLMClient] Non-standard finish_reason: ${finishReason}`, {
        contentLength: fullContent.length,
        hasToolCalls: tool_calls.length > 0,
      });
    }

    return {
      content: fullContent,
      reasoningContent: reasoningContentAccum || undefined,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      finish_reason: finishReason,
    };
  }
}
