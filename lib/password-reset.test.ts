import { describe, expect, it } from "vitest";
import { passwordResetHash, passwordResetToken } from "@/lib/password-reset";

describe("passwordResetToken", () => {
  it("genera credenciales distintas con entropía suficiente", () => {
    const first = passwordResetToken();
    const second = passwordResetToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(second.length).toBeGreaterThanOrEqual(40);
  });
});

describe("passwordResetHash", () => {
  it("es estable para la misma clase y separa usos diferentes", () => {
    expect(passwordResetHash("token", "ejemplo")).toBe(passwordResetHash("token", "ejemplo"));
    expect(passwordResetHash("token", "ejemplo")).not.toBe(passwordResetHash("email", "ejemplo"));
  });
});
