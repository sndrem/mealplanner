import { useEffect, useState } from "react";

import { createDefaultPrototypeState, mergePrototypeState, type PrototypeState } from "./model";

const STORAGE_KEY = "mealplanner-prototype-state-v4";

export function usePrototypeState() {
  let [state, setState] = useState<PrototypeState>(() => createDefaultPrototypeState());
  let [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      let raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState(mergePrototypeState(JSON.parse(raw)));
      }
    } catch (error) {
      console.warn("Klarte ikke a laste prototype fra localStorage", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Klarte ikke a lagre prototype til localStorage", error);
    }
  }, [hydrated, state]);

  return {
    hydrated,
    state,
    setState,
  };
}
