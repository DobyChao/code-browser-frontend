import type { ParsedSegment, CodeBlockTagProps, FileLinkTagProps } from '../types/chat-tags';

/**
 * Parse LLM response content that may contain custom tags:
 * - <code-block src="..." lines="..." />  (self-closing)
 * - <file-link path="..." line="...">content</file-link> (with closing tag)
 *
 * Returns an array of parsed segments that can be rendered by React components.
 */
export function parseLLMContent(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const remainingText = text;

  // Skip processing for empty strings
  if (!remainingText) {
    return segments;
  }

  // Regex patterns for matching tags
  const codeBlockPattern = /<code-block\s+([^>]*?)\s*\/>/gs;
  const fileLinkPattern = /<file-link\s+([^>]*?)>(.*?)<\/file-link>/gs;

  // Find all tag positions
  const matches: Array<{
    type: 'code-block' | 'file-link';
    fullMatch: string;
    props: CodeBlockTagProps | FileLinkTagProps;
    index: number;
    length: number;
  }> = [];

  // Find code-block tags
  let codeBlockMatch: RegExpExecArray | null;
  while ((codeBlockMatch = codeBlockPattern.exec(remainingText)) !== null) {
    const props = parseCodeBlockProps(codeBlockMatch[1]);
    matches.push({
      type: 'code-block',
      fullMatch: codeBlockMatch[0],
      props,
      index: codeBlockMatch.index,
      length: codeBlockMatch[0].length
    });
  }

  // Find file-link tags
  let fileLinkMatch: RegExpExecArray | null;
  while ((fileLinkMatch = fileLinkPattern.exec(remainingText)) !== null) {
    const props = parseFileLinkProps(fileLinkMatch[1], fileLinkMatch[2]);
    matches.push({
      type: 'file-link',
      fullMatch: fileLinkMatch[0],
      props,
      index: fileLinkMatch.index,
      length: fileLinkMatch[0].length
    });
  }

  // Sort matches by position
  matches.sort((a, b) => a.index - b.index);

  // Build segments
  let lastIndex = 0;
  for (const match of matches) {
    // Add text segment before this tag
    if (match.index > lastIndex) {
      const textContent = remainingText.slice(lastIndex, match.index);
      segments.push({ type: 'text', content: textContent });
    }

    // Add the tag segment
    if (match.type === 'code-block') {
      segments.push({ type: 'code-block', props: match.props as CodeBlockTagProps });
    } else {
      segments.push({ type: 'file-link', props: match.props as FileLinkTagProps });
    }

    lastIndex = match.index + match.length;
  }

  // Add remaining text after last tag
  if (lastIndex < remainingText.length) {
    const textContent = remainingText.slice(lastIndex);
    segments.push({ type: 'text', content: textContent });
  }

  // If no tags were found, return single text segment
  if (segments.length === 0 && remainingText) {
    segments.push({ type: 'text', content: remainingText });
  }

  return segments;
}

/**
 * Parse attributes from a code-block tag
 * Example: src="file.ts" lines="10-20"
 */
function parseCodeBlockProps(attributesString: string): CodeBlockTagProps {
  const props: CodeBlockTagProps = { src: '' };

  // Extract src attribute
  const srcMatch = attributesString.match(/src=["']([^"']+)["']/);
  if (srcMatch) {
    props.src = srcMatch[1];
  }

  // Extract lines attribute (format: "N-M")
  const linesMatch = attributesString.match(/lines=["'](\d+)-(\d+)["']/);
  if (linesMatch) {
    props.startLine = parseInt(linesMatch[1], 10);
    props.endLine = parseInt(linesMatch[2], 10);
  }

  return props;
}

/**
 * Parse attributes from a file-link tag
 * Example: path="file.ts" line="42"
 */
function parseFileLinkProps(attributesString: string, children: string): FileLinkTagProps {
  const props: FileLinkTagProps = { path: '', children };

  // Extract path attribute
  const pathMatch = attributesString.match(/path=["']([^"']+)["']/);
  if (pathMatch) {
    props.path = pathMatch[1];
  }

  // Extract line attribute (optional)
  const lineMatch = attributesString.match(/line=["'](\d+)["']/);
  if (lineMatch) {
    props.line = parseInt(lineMatch[1], 10);
  }

  return props;
}
