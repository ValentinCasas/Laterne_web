import { describe, expect, it } from "vitest";
import { parseCsv, stringifyCsv } from "@/lib/csv";

describe("CSV", () => {
  it("interpreta comas y comillas escapadas", () => {
    expect(parseCsv('nombre,descripcion\n"IPA, roja","Dijo ""hola"""')).toEqual([
      ["nombre", "descripcion"],
      ["IPA, roja", 'Dijo "hola"'],
    ]);
  });

  it("neutraliza fórmulas al exportar", () => {
    expect(stringifyCsv([["=SUM(A1:A2)"]])).toContain("'=SUM");
  });
});
