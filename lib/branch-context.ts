import type { AuthorizationContext } from "@/lib/auth";
import { canAccessBranch } from "@/lib/auth";

export type BranchChoice = { id: number; name: string; active: boolean; isPrimary: boolean };

/** @summary Resuelve una sucursal explícita sin aceptar IDs fuera de la membresía actual. */
export function selectedBranchId(requested: string | undefined, branches: BranchChoice[], allowAll = false) {
  if (allowAll && requested === "all") return null;
  const numeric = Number(requested);
  if (Number.isInteger(numeric) && branches.some((branch) => branch.id === numeric && branch.active)) return numeric;
  return branches.find((branch) => branch.isPrimary && branch.active)?.id ?? branches.find((branch) => branch.active)?.id ?? null;
}

/** @summary Construye el filtro branch-scoped para Prisma, sin incluir registros legacy ambiguos. */
export function branchWhere(branchId: number | null, branches: BranchChoice[]) {
  const ids = branches.filter((branch) => branch.active).map((branch) => branch.id);
  return branchId === null ? { branchId: { in: ids } } : { branchId };
}

/** @summary Valida que una acción operativa pertenezca a una sucursal permitida. */
export function assertBranchAccess(context: AuthorizationContext, branchId: number) {
  if (!canAccessBranch(context, branchId)) throw new Error("No tenés acceso a esa sucursal");
}
