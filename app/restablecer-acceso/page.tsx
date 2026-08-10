import { Suspense } from "react";
import { PasswordRecovery } from "@/components/auth/password-recovery";

/** @summary Presenta el formulario final protegido por la credencial temporal recibida. */
export default function ResetAccessPage() {
  return (
    <main className="shell py-16">
      <Suspense fallback={<div className="card p-8">Validando enlace…</div>}>
        <PasswordRecovery reset />
      </Suspense>
    </main>
  );
}
