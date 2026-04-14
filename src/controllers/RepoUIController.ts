import { useMemo, useSyncExternalStore } from 'react';
import type { SearchPanelState } from '../types/ui';
import type { IntelligenceItem } from '../api/types';
import { api } from '../api';

export type RepoRightPanelKind = 'none' | 'search' | 'chat';
export type RepoBottomPanelState = 'open' | 'closed';

export type RepoUIState = {
  right: {
    active: RepoRightPanelKind;
    size: number;
  };
  bottom: {
    expanded: boolean;
    pinned: boolean;
    items: IntelligenceItem[];
    intent: { category: 'definitions' | 'references', signal: number };
  };
  searchPanel: SearchPanelState;
  editor: {
    activeFilePath: string | null;
    fileContent: string | null;
    isLoading: boolean;
    goToLine: string | null;
    goToCol: string | null;
    urlLine: string | null;
    urlCol: string | null;
    highlightLine: string | null;
    error: string | null;
  };
};

type Listener = () => void;

type RepoUIControllerDeps = {
  repoId: string;
  getSearchParams: () => URLSearchParams;
  setSearchParams: (next: URLSearchParams, opts?: { replace?: boolean }) => void;
  getIsActive: () => boolean;
};

export class RepoUIController {
  private listeners = new Set<Listener>();
  private state: RepoUIState = {
    right: { active: 'search', size: 20 },
    bottom: { 
      expanded: false, 
      pinned: false,
      items: [],
      intent: { category: 'definitions', signal: 0 }
    },
    searchPanel: {
      query: '',
      searchType: 'content',
      viewMode: 'tree',
      results: [],
      isLoading: false,
      error: null,
      hasSearched: false,
      useZoektSyntax: false,
      caseSensitive: false,
      wholeWord: false,
      isRegex: false,
      includePattern: '',
      excludePattern: '',
      showAdvanced: false,
    },
    editor: {
      activeFilePath: null,
      fileContent: null,
      isLoading: false,
      goToLine: null,
      goToCol: null,
      urlLine: null,
      urlCol: null,
      highlightLine: null,
      error: null,
    },
  };

  private fileAbortController: AbortController | null = null;
  private intelAbortController: AbortController | null = null;
  private lastIntelAt = 0;
  private latestFilePath: string | null = null;
  private ignoreNextLineSyncKey: string | null = null;

  constructor(private deps: RepoUIControllerDeps) {}

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private emit = () => {
    for (const l of this.listeners) l();
  };

  private writeUrl = (
    patch: { rp?: RepoRightPanelKind; intel?: RepoBottomPanelState; path?: string; line?: string; col?: string },
    opts?: { replace?: boolean }
  ) => {
    if (!this.deps.getIsActive()) return;
    const next = new URLSearchParams(this.deps.getSearchParams());
    if (patch.rp) next.set('rp', patch.rp);
    if (patch.intel) next.set('intel', patch.intel);
    if (patch.path !== undefined) {
      if (patch.path) next.set('path', patch.path);
      else next.delete('path');
    }
    if (patch.line !== undefined) {
      if (patch.line) next.set('line', patch.line);
      else next.delete('line');
    }
    if (patch.col !== undefined) {
      if (patch.col) next.set('col', patch.col);
      else next.delete('col');
    }
    next.delete('nav');
    this.deps.setSearchParams(next, opts);
  };

  private normalizeCol = (line: string | null, col: string | null) => {
    if (!line) return null;
    if (!col) return '1';
    const n = parseInt(col, 10);
    return Number.isNaN(n) || n < 1 ? '1' : String(n);
  };

  syncFromUrl = (params?: URLSearchParams) => {
    // 即使不活跃也可能需要初始化状态，但只有活跃时才写回 URL
    const p = params || this.deps.getSearchParams();
    const rp = p.get('rp');
    const intel = p.get('intel');
    const path = p.get('path');
    const line = p.get('line');
    const col = p.get('col');
    const normalizedCol = this.normalizeCol(line, col);

    let nextState = { ...this.state };
    let hasChanges = false;

    // UI State Sync
    const nextRightActive: RepoRightPanelKind =
      rp === 'none' || rp === 'search' || rp === 'chat' ? rp : this.state.right.active;
    const nextBottomExpanded = intel === 'open' ? true : intel === 'closed' ? false : this.state.bottom.expanded;

    if (nextRightActive !== this.state.right.active) {
      nextState.right = { ...nextState.right, active: nextRightActive };
      hasChanges = true;
    }
    if (nextBottomExpanded !== this.state.bottom.expanded) {
      nextState.bottom = { ...nextState.bottom, expanded: nextBottomExpanded };
      hasChanges = true;
    }

    // Editor State Sync - Only trigger load if path changed
    if (path && path !== this.state.editor.activeFilePath) {
      this.openFile(path, { line, col: normalizedCol }, { skipUrlUpdate: true, highlight: false });
      // openFile will emit its own updates
    } else if (
      path &&
      path === this.state.editor.activeFilePath &&
      (line !== this.state.editor.urlLine || normalizedCol !== this.state.editor.urlCol)
    ) {
      const key = `${path}|${line || ''}|${normalizedCol || ''}`;
      if (this.ignoreNextLineSyncKey === key) {
        this.ignoreNextLineSyncKey = null;
      } else {
        nextState.editor = {
          ...nextState.editor,
          goToLine: line,
          goToCol: normalizedCol,
          urlLine: line,
          urlCol: normalizedCol,
          highlightLine: null
        };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.state = nextState;
      this.emit();
    }
  };

  dismissHighlight = () => {
    if (this.state.editor.highlightLine === null) return;
    this.state = { ...this.state, editor: { ...this.state.editor, highlightLine: null } };
    this.emit();
  };

  commitCursorPosToUrl = (lineNum: string | null, colNum: string | null) => {
    const path = this.state.editor.activeFilePath;
    if (!path) return;
    const normalizedCol = this.normalizeCol(lineNum, colNum);
    if (lineNum === this.state.editor.urlLine && normalizedCol === this.state.editor.urlCol) return;
    const key = `${path}|${lineNum || ''}|${normalizedCol || ''}`;
    this.ignoreNextLineSyncKey = key;
    this.state = {
      ...this.state,
      editor: { ...this.state.editor, goToLine: lineNum, goToCol: normalizedCol, urlLine: lineNum, urlCol: normalizedCol }
    };
    this.emit();
    this.writeUrl({ line: lineNum || '', col: normalizedCol || '' }, { replace: false });
  };

  openFile = async (
    path: string,
    pos: { line: string | null; col: string | null } = { line: null, col: null },
    opts: { skipUrlUpdate?: boolean; highlight?: boolean } = {}
  ) => {
    const shouldHighlight = opts.highlight === true;
    const lineNum = pos.line;
    const colNum = this.normalizeCol(lineNum, pos.col);
    if (path === this.state.editor.activeFilePath && this.state.editor.fileContent !== null) {
      this.state = {
        ...this.state,
        editor: { ...this.state.editor, goToLine: null, goToCol: null, highlightLine: null } // Reset first to trigger effect if needed
      };
      this.emit();
      
      setTimeout(() => {
        this.state = {
          ...this.state,
          editor: {
            ...this.state.editor,
            goToLine: lineNum,
            goToCol: colNum,
            urlLine: lineNum,
            urlCol: colNum,
            highlightLine: shouldHighlight ? lineNum : null
          }
        };
        this.emit();
        if (!opts.skipUrlUpdate) {
          this.writeUrl({ path, line: lineNum || '', col: colNum || '' }, { replace: false });
        }
      }, 0);

      return;
    }

    this.latestFilePath = path;
    this.state = {
      ...this.state,
      editor: {
        ...this.state.editor,
        activeFilePath: path,
        isLoading: true,
        goToLine: lineNum,
        goToCol: colNum,
        urlLine: lineNum,
        urlCol: colNum,
        highlightLine: shouldHighlight ? lineNum : null,
        error: null
      }
    };
    this.emit();

    try {
      this.fileAbortController?.abort();
      const controller = new AbortController();
      this.fileAbortController = controller;

      const content = await api.getBlob(this.deps.repoId, path, { signal: controller.signal });
      
      if (path === this.latestFilePath) {
        this.state = {
          ...this.state,
          editor: { ...this.state.editor, fileContent: content, isLoading: false }
        };
        this.emit();

        if (!opts.skipUrlUpdate) {
          this.writeUrl({ path, line: lineNum || '', col: colNum || '' }, { replace: false });
        }
      }
    } catch (error) {
       if ((error as any)?.name === 'AbortError') return;
       console.error(`Failed to load blob for ${path}:`, error);
       if (path === this.latestFilePath) {
         this.state = {
           ...this.state,
           editor: { ...this.state.editor, fileContent: null, isLoading: false, error: (error as Error).message }
         };
         this.emit();
       }
    }
  };

  triggerIntelligence = async ({ line, column }: { line: number; column: number }, type: 'definitions' | 'references') => {
      const activeFilePath = this.state.editor.activeFilePath;
      if (!activeFilePath) return;
      
      const now = Date.now();
      if (now - this.lastIntelAt < 250) return;
      this.lastIntelAt = now;

      this.intelAbortController?.abort();
      const controller = new AbortController();
      this.intelAbortController = controller;

      try {
          const [defsResult, refsResult] = await Promise.allSettled([
              api.getDefinitions({ repoId: this.deps.repoId, filePath: activeFilePath, line: line - 1, character: column - 1 }, { signal: controller.signal }),
              api.getReferences({ repoId: this.deps.repoId, filePath: activeFilePath, line: line - 1, character: column - 1 }, { signal: controller.signal })
          ]);

          if (controller.signal.aborted) return;

          const items: IntelligenceItem[] = [];
          if (defsResult.status === 'fulfilled') items.push(...defsResult.value);
          if (refsResult.status === 'fulfilled') items.push(...refsResult.value);
          
          if (defsResult.status === 'rejected' && (defsResult.reason as any)?.name !== 'AbortError') {
              console.error('Definitions fetch failed', defsResult.reason);
          }
          if (refsResult.status === 'rejected' && (refsResult.reason as any)?.name !== 'AbortError') {
              console.error('References fetch failed', refsResult.reason);
          }

          this.openBottomIntel(items);
          this.state = {
              ...this.state,
              bottom: { ...this.state.bottom, intent: { category: type, signal: Date.now() } }
          };
          this.emit();
      } catch (e) {
          console.error(e);
      }
  };

  openBottomIntel = (items: IntelligenceItem[]) => {
      let nextItems = items;
      if (this.state.bottom.pinned) {
          nextItems = [...this.state.bottom.items, ...items].slice(-200);
      }
      this.state = {
          ...this.state,
          bottom: { ...this.state.bottom, items: nextItems, expanded: true }
      };
      this.emit();
      this.writeUrl({ intel: 'open' }, { replace: true });
  };
  
  clearIntelItems = () => {
      this.state = {
          ...this.state,
          bottom: { ...this.state.bottom, items: [] }
      };
      this.emit();
  };

  setRightPanelActive = (active: RepoRightPanelKind, opts?: { writeUrl?: boolean }) => {
    if (active === this.state.right.active) return;
    this.state = { ...this.state, right: { ...this.state.right, active } };
    this.emit();
    if (opts?.writeUrl !== false) this.writeUrl({ rp: active }, { replace: true });
  };

  setRightPanelSize = (size: number) => {
    if (size === this.state.right.size) return;
    this.state = { ...this.state, right: { ...this.state.right, size } };
    this.emit();
  };

  setBottomExpanded = (expanded: boolean, opts?: { writeUrl?: boolean }) => {
    if (expanded === this.state.bottom.expanded) return;
    this.state = { ...this.state, bottom: { ...this.state.bottom, expanded } };
    this.emit();
    if (opts?.writeUrl !== false) this.writeUrl({ intel: expanded ? 'open' : 'closed' }, { replace: true });
  };

  togglePinned = () => {
    this.state = { ...this.state, bottom: { ...this.state.bottom, pinned: !this.state.bottom.pinned } };
    this.emit();
  };

  setSearchPanelState = (updater: SearchPanelState | ((prev: SearchPanelState) => SearchPanelState)) => {
    const next = typeof updater === 'function' ? (updater as (p: SearchPanelState) => SearchPanelState)(this.state.searchPanel) : updater;
    this.state = { ...this.state, searchPanel: next };
    this.emit();
  };
}

export function useRepoUIController(deps: RepoUIControllerDeps) {
  return useMemo(() => new RepoUIController(deps), [deps.repoId]); // Re-create only if repoId changes (unlikely for same tab)
}

export function useRepoUIState(controller: RepoUIController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
