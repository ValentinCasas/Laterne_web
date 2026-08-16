import { describe, expect, it } from "vitest";
import {
  effectiveLicenseStatus,
  licenseUserSlots,
  planUserCapacity,
  sumBranchAllowedUsers,
} from "@/lib/license";

describe("capacidad de usuarios por licencia de sucursal", () => {
  it("lee la capacidad de usuarios del plan como referencia", () => {
    expect(planUserCapacity(null)).toBe(0);
    expect(planUserCapacity({})).toBe(0);
    expect(planUserCapacity({ users: 5 })).toBe(5);
    expect(planUserCapacity({ users: "3" })).toBe(3);
    expect(planUserCapacity({ users: -2 })).toBe(0);
  });

  it("usa el cupo propio de la licencia y cae al plan cuando no define cupos", () => {
    expect(licenseUserSlots({ usersAllowed: 0, plan: { capacity: { users: 4 } } })).toBe(4);
    expect(licenseUserSlots({ usersAllowed: 10, plan: { capacity: { users: 4 } } })).toBe(10);
    expect(licenseUserSlots({ usersAllowed: null, plan: null })).toBe(0);
  });

  it("suma los cupos de todas las licencias operativas de la sucursal", () => {
    const licenses = [
      { usersAllowed: 0, plan: { capacity: { users: 2 } } },
      { usersAllowed: 3, plan: null },
    ];
    expect(sumBranchAllowedUsers(licenses)).toBe(5);
    expect(sumBranchAllowedUsers([])).toBe(0);
  });

  it("resuelve el estado efectivo de una licencia", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const past = new Date("2026-01-01T00:00:00Z");
    const future = new Date("2026-02-01T00:00:00Z");

    expect(effectiveLicenseStatus({ status: "ACTIVE", currentPeriodEnd: future }, now)).toBe("ACTIVE");
    expect(effectiveLicenseStatus({ status: "ACTIVE", currentPeriodEnd: past }, now)).toBe("EXPIRED");
    expect(effectiveLicenseStatus({ status: "TRIAL" }, now)).toBe("ACTIVE");
    expect(effectiveLicenseStatus({ status: "PAYMENT_PENDING" }, now)).toBe("ACTIVE");
    expect(effectiveLicenseStatus({ status: "GRACE_PERIOD", graceUntil: future }, now)).toBe("ACTIVE");
    expect(effectiveLicenseStatus({ status: "GRACE_PERIOD", graceUntil: past }, now)).toBe("SUSPENDED");
    expect(effectiveLicenseStatus({ status: "SUSPENDED" }, now)).toBe("SUSPENDED");
    expect(effectiveLicenseStatus({ status: "CANCELLED" }, now)).toBe("SUSPENDED");
    expect(effectiveLicenseStatus({ status: "DRAFT" }, now)).toBe("DRAFT");
    expect(effectiveLicenseStatus({}, now)).toBe("DRAFT");
  });
});