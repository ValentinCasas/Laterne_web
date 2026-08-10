import { PasswordRecovery } from "@/components/auth/password-recovery";

/** @summary Presenta el inicio seguro del proceso de recuperación administrativa. */
export default function RecoverAccessPage() {
  return (
    <main className="shell py-16">
      <PasswordRecovery />
    </main>
  );
}
