import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from '../llm-client';
import type { LLMClientConfig } from '../llm-client';

function makeConfig(): LLMClientConfig {
  return { apiKey: 'test-key', baseUrl: 'https://api.example.com/v1', modelId: 'test-model' };
}

function makeSSEBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockFetchResponse(body: ReadableStream<Uint8Array>, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    text: () => Promise.resolve(''),
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  };
}

function sseData(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function sseDone(): string {
  return 'data: [DONE]\n\n';
}

describe('LLMClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
      headers: new Headers(),
    } as Response);

    const client = new LLMClient(makeConfig());
    await expect(
      client.chatCompletion({ messages: [], onToken: vi.fn() })
    ).rejects.toThrow('LLM API Error 401');
  });

  it('should parse SSE with space after colon (data: {...})', async () => {
    const sseChunks = [
      sseData({ choices: [{ delta: { content: 'Hello' } }] }),
      sseData({ choices: [{ delta: { content: ' world' } }] }),
      sseDone(),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const tokens: string[] = [];
    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (t) => tokens.push(t),
    });

    expect(result.content).toBe('Hello world');
    expect(tokens).toEqual(['Hello', ' world']);
  });

  it('should parse SSE without space after colon (data:{...})', async () => {
    // Manually craft SSE without space after colon
    const sseChunks = [
      `data:${JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] })}\n\n`,
      `data:${JSON.stringify({ choices: [{ delta: { content: ' there' } }] })}\n\n`,
      sseDone(),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const tokens: string[] = [];
    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (t) => tokens.push(t),
    });

    expect(result.content).toBe('Hi there');
    expect(tokens).toEqual(['Hi', ' there']);
  });

  it('should parse mixed SSE formats (some with space, some without)', async () => {
    const sseChunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'A' } }] })}\n\n`,
      `data:${JSON.stringify({ choices: [{ delta: { content: 'B' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'C' } }] })}\n\n`,
      'data:[DONE]\n\n',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [],
      onToken: vi.fn(),
    });

    expect(result.content).toBe('ABC');
  });

  it('should handle reasoning_content tokens', async () => {
    const sseChunks = [
      sseData({ choices: [{ delta: { reasoning_content: 'thinking...' } }] }),
      sseData({ choices: [{ delta: { content: 'answer' } }] }),
      sseDone(),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const reasoningTokens: string[] = [];
    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [],
      onToken: vi.fn(),
      onReasoningToken: (t) => reasoningTokens.push(t),
    });

    expect(result.content).toBe('answer');
    expect(result.reasoningContent).toBe('thinking...');
    expect(reasoningTokens).toEqual(['thinking...']);
  });

  it('should accumulate tool_call deltas', async () => {
    const sseChunks = [
      sseData({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '' } }] } }] }),
      sseData({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"pa' } }] } }] }),
      sseData({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'th":1}' } }] } }] }),
      sseDone(),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [],
      onToken: vi.fn(),
    });

    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0].id).toBe('call_1');
    expect(result.tool_calls![0].function.name).toBe('read_file');
    expect(result.tool_calls![0].function.arguments).toBe('{"path":1}');
  });

  it('should handle empty content gracefully', async () => {
    const sseChunks = [
      sseData({ choices: [{ delta: {} }] }),
      sseData({ choices: [{ delta: { content: 'text' } }] }),
      sseDone(),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [],
      onToken: vi.fn(),
    });

    expect(result.content).toBe('text');
  });

  it('should skip malformed JSON chunks without crashing', async () => {
    const sseChunks = [
      sseData({ choices: [{ delta: { content: 'ok' } }] }),
      'data: not-json\n\n',
      sseData({ choices: [{ delta: { content: ' more' } }] }),
      sseDone(),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [],
      onToken: vi.fn(),
    });

    expect(result.content).toBe('ok more');
  });

  it('should handle split chunks across SSE boundaries', async () => {
    // First chunk is incomplete SSE line, second chunk completes it
    const fullLine1 = sseData({ choices: [{ delta: { content: 'Hello' } }] });
    const fullLine2 = sseData({ choices: [{ delta: { content: '!' } }] });
    const done = sseDone();

    // Split first SSE event across two reads
    const splitPoint = fullLine1.length - 5; // split near end of first event
    const sseChunks = [
      fullLine1.slice(0, splitPoint),
      fullLine1.slice(splitPoint) + fullLine2 + done,
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [],
      onToken: vi.fn(),
    });

    expect(result.content).toBe('Hello!');
  });

  it('should return partial content when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(); // Abort before calling chatCompletion

    const sseChunks = [
      sseData({ choices: [{ delta: { content: 'should not appear' } }] }),
      sseDone(),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(makeSSEBody(sseChunks)) as Response
    );

    const client = new LLMClient(makeConfig());
    const result = await client.chatCompletion({
      messages: [],
      onToken: vi.fn(),
      signal: controller.signal,
    });

    // Signal was already aborted, so the loop should exit immediately
    expect(result.content).toBe('');
  });

  it('should send correct request body with tools', async () => {
    const sseChunks = [sseData({ choices: [{ delta: { content: 'ok' } }] }), sseDone()];
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return mockFetchResponse(makeSSEBody(sseChunks)) as Response;
    });

    const client = new LLMClient(makeConfig());
    await client.chatCompletion({
      messages: [{ role: 'user', content: 'test' }],
      tools: [{ type: 'function', function: { name: 'read_file', description: 'read', parameters: { type: 'object' } } }],
      onToken: vi.fn(),
    });

    expect(capturedBody.model).toBe('test-model');
    expect(capturedBody.stream).toBe(true);
    expect(capturedBody.tools).toHaveLength(1);
    expect(capturedBody.tools[0].function.name).toBe('read_file');
  });

  it('should not include tools in body when tools array is empty', async () => {
    const sseChunks = [sseData({ choices: [{ delta: { content: 'ok' } }] }), sseDone()];
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return mockFetchResponse(makeSSEBody(sseChunks)) as Response;
    });

    const client = new LLMClient(makeConfig());
    await client.chatCompletion({
      messages: [{ role: 'user', content: 'test' }],
      tools: [],
      onToken: vi.fn(),
    });

    expect(capturedBody.tools).toBeUndefined();
  });
});
