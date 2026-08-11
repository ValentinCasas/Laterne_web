"use client";

import { useEffect } from "react";
import { menuClickCssVariables, type MenuClickTheme } from "@/lib/menuclick-theme";

function applyTheme(theme: MenuClickTheme) {
  const variables = menuClickCssVariables(theme) as Record<string, string>;
  for (const [name, value] of Object.entries(variables)) document.documentElement.style.setProperty(name, value);
  document.documentElement.style.colorScheme = theme.baseMode;
}

/** @summary Mantiene la identidad de MenuClick sincronizada sin recargar ni tocar temas de tenants. */
export function MenuClickThemeProvider({ initialTheme, children }: { initialTheme: MenuClickTheme; children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(initialTheme);
    function handleTheme(event: Event) {
      const theme = (event as CustomEvent<MenuClickTheme>).detail;
      if (theme?.primary && theme?.background) applyTheme(theme);
    }
    window.addEventListener("menuclick-theme-updated", handleTheme);
    return () => window.removeEventListener("menuclick-theme-updated", handleTheme);
  }, [initialTheme]);
  return children;
}
