/**
 * Instrumentación de arranque de MenuClick.
 *
 * El archivo se compila dos veces por el build: una para Node.js y otra para
 * Edge. Todo lo que depende de APIs exclusivas de Node (process, Prisma) vive
 * en `lib/instrumentation-node.ts` y se carga con `await import()` únicamente
 * cuando el runtime es Node.js, para que el bundle Edge quede limpio.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerNode } = await import("@/lib/instrumentation-node");
  await registerNode();
}