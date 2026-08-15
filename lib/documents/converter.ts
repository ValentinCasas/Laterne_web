import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DOCX_MIME } from "@/lib/documents/template-engine";

const execFileAsync = promisify(execFile);

export type DocumentConversionResult = {
  status: "ready" | "unavailable" | "error";
  pdf?: Uint8Array;
  converter?: string;
  message: string;
};

export interface DocumentConverter {
  convert(docx: Uint8Array): Promise<DocumentConversionResult>;
}

function pdfBytesAreValid(bytes: Uint8Array) {
  return bytes.byteLength > 4 && new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF";
}

function requestBody(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

class RemoteDocumentConverter implements DocumentConverter {
  constructor(private readonly endpoint: string, private readonly token?: string) {}

  async convert(docx: Uint8Array): Promise<DocumentConversionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": DOCX_MIME,
          accept: "application/pdf",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: requestBody(docx),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { status: "error", converter: "remote", message: `El conversor remoto respondió ${response.status}.` };
      }
      const pdf = new Uint8Array(await response.arrayBuffer());
      if (pdf.byteLength > 20 * 1024 * 1024 || !pdfBytesAreValid(pdf)) {
        return { status: "error", converter: "remote", message: "El conversor remoto no devolvió un PDF válido." };
      }
      return { status: "ready", converter: "remote", pdf, message: "PDF generado por el servicio configurado." };
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "El conversor remoto excedió el tiempo de espera."
        : "No se pudo contactar al conversor remoto.";
      return { status: "error", converter: "remote", message };
    } finally {
      clearTimeout(timer);
    }
  }
}

function libreOfficeCandidates() {
  return [
    process.env.LIBREOFFICE_PATH,
    process.env.DOCUMENT_CONVERTER_COMMAND,
    "C:\\Program Files\\LibreOffice\\program\\soffice.com",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
    "soffice",
  ].filter((value, index, values): value is string => Boolean(value && values.indexOf(value) === index));
}

async function commandIsCandidate(command: string) {
  if (command === "soffice") return true;
  try {
    await access(command);
    return true;
  } catch {
    return false;
  }
}

class LibreOfficeDocumentConverter implements DocumentConverter {
  async convert(docx: Uint8Array): Promise<DocumentConversionResult> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "menuclick-doc-"));
    const input = path.join(directory, "document.docx");
    const output = path.join(directory, "document.pdf");
    try {
      await writeFile(input, docx);
      let availableCommand = false;
      for (const command of libreOfficeCandidates()) {
        if (!(await commandIsCandidate(command))) continue;
        try {
          availableCommand = true;
          await execFileAsync(command, ["--headless", "--convert-to", "pdf", "--outdir", directory, input], {
            timeout: 60_000,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
          });
          const pdf = new Uint8Array(await readFile(output));
          if (!pdfBytesAreValid(pdf)) throw new Error("invalid-pdf");
          return { status: "ready", converter: "libreoffice", pdf, message: "PDF generado con LibreOffice headless." };
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ENOENT") {
            availableCommand = false;
            continue;
          }
          return {
            status: "error",
            converter: "libreoffice",
            message: "LibreOffice no pudo convertir el DOCX. El archivo Word sigue disponible para descargar.",
          };
        }
      }
      return {
        status: "unavailable",
        converter: availableCommand ? "libreoffice" : undefined,
        message: "LibreOffice no está instalado. Podés descargar el DOCX; configurá LIBREOFFICE_PATH o DOCUMENT_CONVERTER_URL para obtener PDF.",
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

/** @summary Selecciona un conversor reemplazable sin depender de Word/COM en el servidor. */
export function getDocumentConverter(): DocumentConverter {
  const endpoint = process.env.DOCUMENT_CONVERTER_URL?.trim();
  if (endpoint) return new RemoteDocumentConverter(endpoint, process.env.DOCUMENT_CONVERTER_TOKEN);
  return new LibreOfficeDocumentConverter();
}
