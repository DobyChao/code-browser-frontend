export type CodeBlockTagProps = {
  src: string;          // file path relative to repo root
  startLine?: number;   // 1-based, inclusive
  endLine?: number;     // 1-based, inclusive
};

export type FileLinkTagProps = {
  path: string;         // file path
  line?: number;        // optional line number
  children: string;     // display text
};

export type ParsedSegment =
  | { type: 'text'; content: string }
  | { type: 'code-block'; props: CodeBlockTagProps }
  | { type: 'file-link'; props: FileLinkTagProps };
