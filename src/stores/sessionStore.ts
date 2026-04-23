/**
 * Session store — Zustand wrapper around the pure keystrokeReducer.
 *
 * First store of the codebase; the pattern here will be reused for the
 * upcoming userStore and adaptiveStore:
 *   - Pure reducer lives in domain/ (framework-free, unit-tested).
 *   - Vanilla store via `createStore` holds the state + dispatch.
 *   - `useStore` binds the vanilla store into React at render time only.
 *
 * Split into vanilla + React binding so the store module is safe to import
 * during Tanstack Start's SSR pass. A top-level `create(...)` from
 * "zustand" eagerly touches React hooks at module load and breaks SSR with
 * "Cannot read properties of null (reading 'useCallback')".
 *
 * Test-friendly: tests talk to `sessionStore` directly (setState/getState)
 * without needing a React tree.
 */

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { keystrokeReducer } from "#/domain/session/keystrokeReducer";
import { idleSessionState, type SessionAction, type SessionState } from "#/domain/session/types";

export type SessionStore = SessionState & {
  dispatch: (action: SessionAction) => void;
};

export const sessionStore = createStore<SessionStore>((set, get) => ({
  ...idleSessionState(),
  dispatch: (action) => {
    const { dispatch: _dispatch, ...state } = get();
    set(keystrokeReducer(state, action));
  },
}));

export function useSessionStore<T>(selector: (state: SessionStore) => T): T {
  return useStore(sessionStore, selector);
}
