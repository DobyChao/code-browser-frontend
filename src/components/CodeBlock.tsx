import { useState, useEffect } from 'react';
import Prism from 'prismjs';
import { api } from '../api/index';
import { Utils } from '../utils/index';

type CodeBlockProps = {
  src: string;
  startLine?: number;
  endLine?: number;
  repoId: string;
  onNavigate: (path: string, line: number) => void;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  src,
  startLine,
  endLine,
  repoId,
  onNavigate,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const MAX_LINES = 50;
  const language = Utils.getLanguageFromPath(src);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const fileContent = await api.getBlob(repoId, src);

        const totalLines = fileContent.split('\n').length;
        const start = startLine || 1;
        const end = endLine || totalLines;

        // Validate line range
        if (start < 1 || start > totalLines) {
          setError('行号超出范围');
          setContent('');
          return;
        }

        // Calculate line range to display
        let displayStart = start;
        let displayEnd = Math.min(end, totalLines);

        // Truncate if exceeds MAX_LINES
        if (displayEnd - displayStart + 1 > MAX_LINES) {
          displayEnd = displayStart + MAX_LINES - 1;
          setIsTruncated(true);
        } else {
          setIsTruncated(false);
        }

        // Extract the lines to display
        const lines = fileContent.split('\n');
        const selectedLines = lines.slice(displayStart - 1, displayEnd);
        setContent(selectedLines.join('\n'));

      } catch (err) {
        setError('文件未找到');
        setContent('');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [src, startLine, endLine, repoId]);

  if (loading) {
    return (
      <div className="bg-bg-subtle border border-border-default rounded-lg p-4">
        <div className="text-text-dim">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-subtle border border-border-default rounded-lg p-4">
        <div className="text-text-error">{error}</div>
      </div>
    );
  }

  const lines = content.split('\n');
  const displayStartLine = startLine || 1;
  const languageObj = Prism.languages[language] || Prism.languages.javascript;

  const handleLineClick = (lineNumber: number) => {
    onNavigate(src, lineNumber);
  };

  const handleViewFullFile = () => {
    onNavigate(src, 1);
  };

  return (
    <div className="bg-bg-subtle border border-border-default rounded-lg overflow-hidden">
      {/* Header bar */}
      <div className="bg-bg-default border-b border-border-default px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => onNavigate(src, startLine ?? 1)}
          className="text-sm font-medium text-text-default cursor-pointer hover:text-text-link"
        >
          {src}
          {startLine !== undefined && endLine !== undefined && (
            <span className="text-text-dim ml-2">(Lines {startLine}-{endLine})</span>
          )}
        </button>
        <span className="text-xs text-text-dim ml-2 shrink-0">{language}</span>
      </div>

      {/* Code area */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-xs">
          <code>
            {lines.map((line, index) => {
              const lineNumber = displayStartLine + index;
              return (
                <div key={index} className="flex hover:bg-bg-hover group">
                  <span
                    className="shrink-0 cursor-pointer select-none text-text-dim pr-4 hover:text-text-default w-8 text-right"
                    onClick={() => handleLineClick(lineNumber)}
                  >
                    {lineNumber}
                  </span>
                  <span
                    dangerouslySetInnerHTML={{
                      __html: line ? Prism.highlight(line, languageObj, language) : '&nbsp;',
                    }}
                  />
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* View full file button when truncated */}
      {isTruncated && (
        <div className="border-t border-border-default px-4 py-2">
          <button
            onClick={handleViewFullFile}
            className="text-sm text-text-link hover:text-text-link-hover"
          >
            查看完整文件
          </button>
        </div>
      )}
    </div>
  );
};