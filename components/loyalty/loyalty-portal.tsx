"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { readBrowserText, removeBrowserText, writeBrowserText } from "@/lib/browser-compat";

type LoyaltyProfile = {
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  points: number;
  tier: string;
  transactions: Array<{ id: number; points: number; reason: string; createdAt: string }>;
  orders: Array<{
    reference: string;
    status: string;
    total: string | number;
    currency: string;
    createdAt: string;
  }>;
};

/** @summary Presenta el registro, saldo, movimientos y control de privacidad del cliente frecuente. */
export function LoyaltyPortal() {
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");

  /** @summary Consulta el perfil utilizando exclusivamente el token privado guardado en el dispositivo. */
  async function loadProfile(accessToken: string) {
    const response = await fetch("/api/loyalty", { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = (await response.json().catch(() => ({}))) as { customer?: LoyaltyProfile; error?: string };
    if (!response.ok || !result.customer) throw new Error(result.error ?? "No se pudo abrir el perfil");
    setProfile(result.customer);
  }

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const shared = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
      const accessToken = shared || readBrowserText("laterne_cliente_token") || "";
      setToken(accessToken);
      if (accessToken) {
        writeBrowserText("laterne_cliente_token", accessToken);
        try {
          await loadProfile(accessToken);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "No se pudo abrir el perfil");
        }
      }
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!token || !profile) return;
    let active = true;
    QRCode.toDataURL(`${window.location.origin}/fidelidad?token=${encodeURIComponent(token)}`, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: "H",
    }).then((value) => {
      if (active) setQr(value);
    });
    return () => {
      active = false;
    };
  }, [profile, token]);

  /** @summary Registra al visitante y conserva localmente su credencial de fidelización. */
  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        birthday: form.get("birthday"),
        consent: form.get("consent") === "on",
        website: form.get("website"),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      token?: string;
      customer?: LoyaltyProfile;
      error?: string;
    };
    if (!response.ok || !result.token) {
      setError(result.error ?? "No se pudo crear el perfil");
      return;
    }
    writeBrowserText("laterne_cliente_token", result.token);
    setToken(result.token);
    await loadProfile(result.token);
  }

  /** @summary Solicita confirmación y ejerce el derecho de eliminación de datos personales. */
  async function removeProfile() {
    const confirmation = await Swal.fire({
      title: "¿Eliminar tu perfil?",
      text: "Se anonimizarán tus datos y se eliminarán los puntos. Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar mis datos",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await fetch("/api/loyalty", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo eliminar",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    removeBrowserText("laterne_cliente_token");
    setToken("");
    setProfile(null);
  }

  if (loading) return <div className="card p-12 text-center text-zinc-400">Abriendo tu perfil…</div>;
  if (profile)
    return (
      <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="card h-fit p-6 text-center">
          <p className="section-eyebrow">Nivel {profile.tier}</p>
          <strong className="mt-3 block text-6xl text-pink-300">{profile.points}</strong>
          <p className="text-sm text-zinc-500">puntos disponibles</p>
          {qr && (
            <div className="relative mx-auto mt-5 aspect-square max-w-48 overflow-hidden rounded-2xl bg-white">
              <Image
                src={qr}
                alt="Código QR del perfil frecuente"
                fill
                unoptimized
                className="object-contain p-2"
              />
            </div>
          )}
          <h1 className="mt-4 text-2xl font-black">{profile.name}</h1>
          <p className="text-sm text-zinc-500">Mostrá esta pantalla cuando el local lo solicite.</p>
          <button className="mt-6 text-sm text-red-300 underline" onClick={removeProfile}>
            Eliminar mis datos
          </button>
        </aside>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-2xl font-black">Movimientos</h2>
            <div className="mt-4 space-y-2">
              {profile.transactions.map((transaction) => (
                <article className="flex justify-between rounded-2xl bg-white/5 p-4" key={transaction.id}>
                  <div>
                    <strong>{transaction.reason}</strong>
                    <time className="block text-xs text-zinc-500">
                      {new Date(transaction.createdAt).toLocaleDateString("es-AR")}
                    </time>
                  </div>
                  <strong className={transaction.points >= 0 ? "text-emerald-300" : "text-red-300"}>
                    {transaction.points > 0 ? "+" : ""}
                    {transaction.points}
                  </strong>
                </article>
              ))}
              {!profile.transactions.length && (
                <p className="text-zinc-500">Tus puntos aparecerán cuando completes pedidos.</p>
              )}
            </div>
          </section>
          <section className="card p-6">
            <h2 className="text-2xl font-black">Pedidos vinculados</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {profile.orders.map((order) => (
                <article className="rounded-2xl bg-white/5 p-4" key={order.reference}>
                  <strong>{order.reference}</strong>
                  <p className="text-sm text-zinc-500">
                    {order.status} ·{" "}
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: order.currency }).format(
                      Number(order.total),
                    )}
                  </p>
                </article>
              ))}
              {!profile.orders.length && <p className="text-zinc-500">Todavía no vinculaste pedidos.</p>}
            </div>
          </section>
        </div>
      </section>
    );

  return (
    <form className="card mx-auto max-w-2xl p-6 sm:p-9" onSubmit={register}>
      <p className="section-eyebrow">Comunidad Laterne</p>
      <h1 className="mt-3 text-4xl font-black">Sumá puntos en cada visita</h1>
      <p className="mt-3 text-zinc-400">
        Registrate con email o teléfono. El acceso queda guardado solo en este dispositivo.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Nombre</span>
          <input className="input" name="name" required minLength={2} />
        </label>
        <label>
          <span className="label">Cumpleaños opcional</span>
          <input className="input" name="birthday" type="date" />
        </label>
        <label>
          <span className="label">Email</span>
          <input className="input" name="email" type="email" />
        </label>
        <label>
          <span className="label">Teléfono</span>
          <input className="input" name="phone" type="tel" />
        </label>
      </div>
      <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm">
        <input className="mt-1" name="consent" type="checkbox" required />
        <span>
          Acepto que se usen estos datos para gestionar puntos y beneficios. Podré eliminar mi perfil cuando
          quiera.
        </span>
      </label>
      <input className="hidden" name="website" tabIndex={-1} autoComplete="off" />
      {error && (
        <p className="mt-4 text-red-300" role="alert">
          {error}
        </p>
      )}
      <button className="btn mt-6 w-full">Crear perfil frecuente</button>
    </form>
  );
}
