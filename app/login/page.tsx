import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth";

/** @summary Presenta la pantalla de acceso para las herramientas de administración. */
export default async function LoginPage() {
  if (await getSession()) redirect("/admin");
  return (
    <main className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <section className="card w-full max-w-md p-8">
        <p className="font-bold uppercase tracking-widest text-pink-400">Equipo Laterne</p>
        <h1 className="mt-2 text-3xl font-black">Ingresar</h1>
        <LoginForm />
      </section>
    </main>
  );
}
