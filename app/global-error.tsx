"use client";

/** @summary Ofrece una recuperación mínima incluso cuando falla la estructura global del sitio. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#09090b", color: "#fafafa", fontFamily: "system-ui" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ maxWidth: "560px", textAlign: "center" }}>
            <p style={{ color: "#f472b6", fontWeight: 800 }}>ERROR 500</p>
            <h1 style={{ fontSize: "clamp(2rem, 8vw, 4rem)", margin: "12px 0" }}>
              El servicio necesita un momento.
            </h1>
            <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>
              No se perdieron tus datos. Podés reintentar la operación de forma segura.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: "24px",
                border: 0,
                borderRadius: "12px",
                padding: "12px 20px",
                background: "#ec4899",
                color: "white",
                fontWeight: 800,
              }}
            >
              Reintentar
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
