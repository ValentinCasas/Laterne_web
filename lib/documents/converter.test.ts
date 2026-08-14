import { afterEach, describe, expect, it, vi } from "vitest";
import { getDocumentConverter } from "@/lib/documents/converter";

const originalEndpoint = process.env.DOCUMENT_CONVERTER_URL;
const originalToken = process.env.DOCUMENT_CONVERTER_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalEndpoint === undefined) delete process.env.DOCUMENT_CONVERTER_URL;
  else process.env.DOCUMENT_CONVERTER_URL = originalEndpoint;
  if (originalToken === undefined) delete process.env.DOCUMENT_CONVERTER_TOKEN;
  else process.env.DOCUMENT_CONVERTER_TOKEN = originalToken;
});

describe("conversor reemplazable de documentos", () => {
  it("acepta el PDF producido por un servicio remoto configurado", async () => {
    process.env.DOCUMENT_CONVERTER_URL = "https://converter.invalid/docx-to-pdf";
    process.env.DOCUMENT_CONVERTER_TOKEN = "test-token";
    const pdf = new TextEncoder().encode("%PDF-1.7\ncontenido de prueba");
    const fetchMock = vi.fn().mockResolvedValue(new Response(pdf, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDocumentConverter().convert(new Uint8Array([0x50, 0x4b]));

    expect(result.status).toBe("ready");
    expect(result.converter).toBe("remote");
    expect(result.pdf).toEqual(pdf);
    expect(fetchMock).toHaveBeenCalledWith(
      process.env.DOCUMENT_CONVERTER_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer test-token" }),
      }),
    );
  });

  it("no guarda una respuesta remota que no sea PDF", async () => {
    process.env.DOCUMENT_CONVERTER_URL = "https://converter.invalid/docx-to-pdf";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("html inesperado", { status: 200 })));

    const result = await getDocumentConverter().convert(new Uint8Array([0x50, 0x4b]));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/PDF válido/i);
    expect(result.pdf).toBeUndefined();
  });
});
