"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

export type NavigationMode = "TOP" | "SIDEBAR";

const STORAGE_KEY = "menuclick:navigation-mode";
const CHANGE_EVENT = "menuclick:navigation-mode-change";
const SERVER_MODE: NavigationMode = "TOP";
let volatileMode: NavigationMode = SERVER_MODE;

/** @summary Lee la preferencia del navegador sin afectar el snapshot estable usado durante SSR e hidratación. */
function readNavigationMode(): NavigationMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    volatileMode = stored === "SIDEBAR" ? "SIDEBAR" : "TOP";
  } catch {
    // El fallback en memoria conserva la navegación funcional si el navegador bloquea localStorage.
  }
  return volatileMode;
}

/** @summary Suscribe la navegación a cambios locales y cambios de localStorage provenientes de otras pestañas. */
function subscribeNavigationMode(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

/** @summary Devuelve siempre TOP en servidor y durante el primer render de hidratación. */
function getServerNavigationMode(): NavigationMode {
  return SERVER_MODE;
}

export function useNavigationMode() {
  const mode = useSyncExternalStore(
    subscribeNavigationMode,
    readNavigationMode,
    getServerNavigationMode,
  );

  const setMode = useCallback<Dispatch<SetStateAction<NavigationMode>>>((nextMode) => {
    const current = readNavigationMode();
    const resolved = typeof nextMode === "function" ? nextMode(current) : nextMode;
    volatileMode = resolved;
    try {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    } catch {
      // El modo sigue disponible en memoria durante esta sesión.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggle = useCallback(
    () => setMode((current) => (current === "TOP" ? "SIDEBAR" : "TOP")),
    [setMode],
  );

  return useMemo(() => ({ mode, setMode, toggle }), [mode, setMode, toggle]);
}
