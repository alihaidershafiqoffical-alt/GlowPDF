import type { EditorState } from './editorTypes';

const MAX_HISTORY_LENGTH = 50;

export interface HistoryState {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
}

export function createInitialHistory(initialState: EditorState): HistoryState {
  return {
    past: [],
    present: structuredClone(initialState),
    future: [],
  };
}

export function pushHistoryState(
  history: HistoryState,
  newState: EditorState
): HistoryState {
  const newPast = [...history.past, structuredClone(history.present)];
  if (newPast.length > MAX_HISTORY_LENGTH) {
    newPast.shift();
  }
  return {
    past: newPast,
    present: structuredClone(newState),
    future: [],
  };
}

export function undoHistory(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);
  return {
    past: newPast,
    present: structuredClone(previous),
    future: [structuredClone(history.present), ...history.future],
  };
}

export function redoHistory(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  return {
    past: [...history.past, structuredClone(history.present)],
    present: structuredClone(next),
    future: newFuture,
  };
}
