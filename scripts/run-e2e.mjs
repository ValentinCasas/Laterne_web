import { spawn, spawnSync } from "node:child_process";

const applicationUrl = "http://localhost:3000";

/** @summary Comprueba repetidamente que la aplicación esté lista antes de abrir el navegador. */
async function waitForServer(timeoutMilliseconds = 120_000) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(applicationUrl);

      if (response.ok) {
        return;
      }
    } catch {
      // El servidor todavía está iniciando; el siguiente intento vuelve a comprobarlo.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Next.js no quedó disponible dentro del tiempo esperado.");
}

/** @summary Ejecuta Playwright en primer plano y conserva su código de salida. */
function runPlaywright() {
  return new Promise((resolve, reject) => {
    const playwrightProcess = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
      stdio: "inherit",
      windowsHide: true,
    });

    playwrightProcess.once("error", reject);
    playwrightProcess.once("exit", (code) => resolve(code ?? 1));
  });
}

/** @summary Detiene únicamente el servidor temporal y sus procesos auxiliares. */
function stopProcessTree(processId) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(processId), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-processId, "SIGTERM");
  } catch {
    // El servidor ya finalizó y no necesita una segunda señal.
  }
}

/** @summary Inicia un servidor aislado, ejecuta las pruebas y garantiza su cierre al terminar. */
async function run() {
  let serverProcess;

  try {
    serverProcess = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev", "--hostname", "localhost", "--webpack"],
      {
        detached: process.platform !== "win32",
        stdio: "ignore",
        windowsHide: true,
      },
    );
    serverProcess.unref();

    await waitForServer();
    process.exitCode = await runPlaywright();
  } finally {
    if (serverProcess?.pid) {
      stopProcessTree(serverProcess.pid);
    }
  }
}

await run();
