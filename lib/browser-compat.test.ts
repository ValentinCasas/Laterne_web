// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyBrowserText,
  createBrowserId,
  readBrowserJson,
  readBrowserText,
  removeBrowserText,
  writeBrowserJson,
  writeBrowserText,
} from "./browser-compat";

describe("compatibilidad con navegadores móviles", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("conserva textos y estructuras JSON sin depender de una API externa", () => {
    expect(writeBrowserText("preferencia", "activa")).toBe(true);
    expect(readBrowserText("preferencia")).toBe("activa");
    expect(writeBrowserJson("favoritos", [12, 24])).toBe(true);
    expect(readBrowserJson("favoritos", [])).toEqual([12, 24]);
    removeBrowserText("preferencia");
    expect(readBrowserText("preferencia")).toBeNull();
  });

  it("genera identificadores aun cuando randomUUID no está disponible", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: undefined });
    const identifier = createBrowserId();
    Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: original });
    expect(identifier.length).toBeGreaterThan(16);
  });

  it("utiliza la copia clásica cuando el portapapeles moderno está bloqueado", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => true),
    });
    await expect(copyBrowserText("Pedido de prueba")).resolves.toBe(true);
  });
});
