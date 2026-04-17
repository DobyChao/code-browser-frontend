import { describe, it, expect } from 'vitest';
import { parseLLMContent } from '../parseLLMContent';
import type { ParsedSegment } from '../../types/chat-tags';

describe('parseLLMContent', () => {
  it('should handle plain text with no tags', () => {
    const input = 'Hello world';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([{ type: 'text', content: 'Hello world' }]);
  });

  it('should parse a single code-block tag with lines attribute', () => {
    const input = '<code-block src="src/foo.ts" lines="10-25" />';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'code-block', props: { src: 'src/foo.ts', startLine: 10, endLine: 25 } }
    ]);
  });

  it('should parse a single file-link tag with line attribute and content', () => {
    const input = '<file-link path="src/bar.ts" line="42">bar.ts:42</file-link>';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'file-link', props: { path: 'src/bar.ts', line: 42, children: 'bar.ts:42' } }
    ]);
  });

  it('should parse mixed content with text, file-link, and code-block tags', () => {
    const input = 'See <file-link path="a.ts" line="5">a.ts</file-link> and <code-block src="b.ts" lines="1-10" /> for details.';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'text', content: 'See ' },
      { type: 'file-link', props: { path: 'a.ts', line: 5, children: 'a.ts' } },
      { type: 'text', content: ' and ' },
      { type: 'code-block', props: { src: 'b.ts', startLine: 1, endLine: 10 } },
      { type: 'text', content: ' for details.' }
    ]);
  });

  it('should parse code-block without lines attribute (optional)', () => {
    const input = '<code-block src="README.md" />';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'code-block', props: { src: 'README.md' } }
    ]);
  });

  it('should parse file-link without line attribute (optional)', () => {
    const input = '<file-link path="config.json">config</file-link>';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'file-link', props: { path: 'config.json', children: 'config' } }
    ]);
  });

  it('should handle multiline tags with newlines in attributes', () => {
    const input = `<code-block
      src="src/multiline.ts"
      lines="5-15"
    />`;
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'code-block', props: { src: 'src/multiline.ts', startLine: 5, endLine: 15 } }
    ]);
  });

  it('should handle empty string', () => {
    const input = '';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([]);
  });

  it('should handle whitespace-only content', () => {
    const input = '   ';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([{ type: 'text', content: '   ' }]);
  });

  it('should handle multiple consecutive tags', () => {
    const input = '<code-block src="a.ts" /><code-block src="b.ts" lines="1-5" />';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'code-block', props: { src: 'a.ts' } },
      { type: 'code-block', props: { src: 'b.ts', startLine: 1, endLine: 5 } }
    ]);
  });

  it('should handle file-link with special characters in content', () => {
    const input = '<file-link path="special.ts">Click_here!@#$%</file-link>';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'file-link', props: { path: 'special.ts', children: 'Click_here!@#$%' } }
    ]);
  });

  it('should handle file-link with nested quotes in attributes', () => {
    const input = '<file-link path="file.ts" line="10">line 10</file-link>';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'file-link', props: { path: 'file.ts', line: 10, children: 'line 10' } }
    ]);
  });

  it('should handle code-block with various path formats', () => {
    const input = '<code-block src="./relative/path.ts" lines="1-100" />';
    const output: ParsedSegment[] = parseLLMContent(input);

    expect(output).toEqual([
      { type: 'code-block', props: { src: './relative/path.ts', startLine: 1, endLine: 100 } }
    ]);
  });
});
