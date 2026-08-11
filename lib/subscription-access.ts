import type { Prisma } from "@prisma/client";

/** @summary Define los estados y vencimientos que permiten publicar un tenant sin suspenderlo. */
export function publicTenantWhere(now = new Date()): Prisma.TenantWhereInput {
  const activePeriod = [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }];
  return {
    status: "active",
    OR: [
      { subscription: { is: null } },
      {
        subscription: {
          is: {
            OR: [
              { status: "ACTIVE", OR: activePeriod },
              { status: "PAYMENT_PENDING", OR: activePeriod },
              {
                status: "TRIAL",
                OR: [{ trialEndsAt: null }, { trialEndsAt: { gt: now } }],
              },
              {
                status: "GRACE_PERIOD",
                OR: [{ gracePeriodEndsAt: null }, { gracePeriodEndsAt: { gt: now } }],
              },
            ],
          },
        },
      },
    ],
  };
}
