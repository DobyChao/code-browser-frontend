import { useMemo, useSyncExternalStore } from 'react';
import type { SearchPanelState } from '../types/ui';

export type RepoRightPanelKind = 'none' | 'search';
export type RepoBottomPanelState = 'open' | 'closed';

export type RepoUIState = {
  right: {
    active: RepoRightPanelKind;
    size: number;
  };
  bottom: {
    expanded: boolean;
    pinned: boolean;
  };
  searchPanel: SearchPanelState;
};

type Listener = () => void;

type RepoUIControllerDeps = {
  getSearchParams: () => URLSearchParams;
  setSearchParams: (next: URLSearchParams) => void;
  getIsActive: () => boolean;
};

export class RepoUIController {
  private listeners = new Set<Listener>();
  private state: RepoUIState = {
    right: { active: 'search', size: 20 },
    bottom: { expanded: false, pinned: false },
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
    },
  };

  constructor(private deps: RepoUIControllerDeps) {}

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private emit = () => {
    for (const l of this.listeners) l();
  };

  private writeUrl = (patch: { rp?: RepoRightPanelKind; intel?: RepoBottomPanelState }) => {
    if (!this.deps.getIsActive()) return;
    const next = new URLSearchParams(this.deps.getSearchParams());
    if (patch.rp) next.set('rp', patch.rp);
    if (patch.intel) next.set('intel', patch.intel);
    next.set('nav', String(Date.now()));
    this.deps.setSearchParams(next);
  };

  syncFromUrl = () => {
    if (!this.deps.getIsActive()) return;
    const params = this.deps.getSearchParams();
    const rp = params.get('rp');
    const intel = params.get('intel');

    const nextRightActive: RepoRightPanelKind =
      rp === 'none' || rp === 'search' ? rp : this.state.right.active;
    const nextBottomExpanded = intel === 'open' ? true : intel === 'closed' ? false : this.state.bottom.expanded;

    if (nextRightActive === this.state.right.active && nextBottomExpanded === this.state.bottom.expanded) return;

    this.state = {
      ...this.state,
      right: { ...this.state.right, active: nextRightActive },
      bottom: { ...this.state.bottom, expanded: nextBottomExpanded },
    };
    this.emit();
  };

  setRightPanelActive = (active: RepoRightPanelKind, opts?: { writeUrl?: boolean }) => {
    if (active === this.state.right.active) return;
    this.state = { ...this.state, right: { ...this.state.right, active } };
    this.emit();
    if (opts?.writeUrl !== false) this.writeUrl({ rp: active });
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
    if (opts?.writeUrl !== false) this.writeUrl({ intel: expanded ? 'open' : 'closed' });
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
  return useMemo(() => new RepoUIController(deps), [deps]);
}

export function useRepoUIState(controller: RepoUIController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
