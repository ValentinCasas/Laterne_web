import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Session = { userId: number; role: number };
/** @summary Genera la clave binaria utilizada para firmar y validar las sesiones. */
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-only-change-me");

/** @summary Crea un token de sesión firmado con una vigencia máxima de ocho horas. */
export async function createSession(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key());
}

/** @summary Recupera y valida la sesión almacenada en las cookies de la solicitud. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get("laterne_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { userId: Number(payload.userId), role: Number(payload.role) };
  } catch {
    return null;
  }
}

/** @summary Exige una sesión válida y, opcionalmente, permisos de administración. */
export async function requireSession(admin = false) {
  const session = await getSession();
  if (!session || (admin && session.role !== 1)) redirect("/login");
  return session;
}
