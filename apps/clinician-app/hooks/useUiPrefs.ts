"use client";
import { useEffect, useReducer } from "react";

type TabKey = 'soap' | 'erx' | 'devices' | 'insight';
type Pip = { x: number; y: number };

type State = {
  dense: boolean;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  chatVisible: boolean;
  presentation: boolean;
  rightTab: TabKey;
  pip: Pip;
};

type Action =
  | { type: 'set'; key: keyof State; value: any }
  | { type: 'merge'; value: Partial<State> };

const KEY = 'sfu-ui-prefs';

function reducer(state: State, action: Action): State {
  if (action.type === 'set') return { ...state, [action.key]: action.value };
  if (action.type === 'merge') return { ...state, ...action.value };
  return state;
}

const initial: State = {
  dense: false,
  leftCollapsed: false,
  rightCollapsed: false,
  chatVisible: true,
  presentation: false,
  rightTab: 'soap',
  pip: { x: 3, y: 3 },
};

export function useUiPrefs() {
  const [state, dispatch] = useReducer(reducer, initial);

  // load once
  useEffect(() => {
    try {
      const p = localStorage.getItem(KEY);
      if (p) {
        const js = JSON.parse(p);
        dispatch({ type: 'merge', value: js });
      }
    } catch {}
  }, []);

  // persist on change
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  return {
    state,
    set: <K extends keyof State>(key: K, value: State[K]) => dispatch({ type: 'set', key, value }),
    merge: (value: Partial<State>) => dispatch({ type: 'merge', value }),
  };
}
