"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { readBrowserText, removeBrowserText, writeBrowserText } from "@/lib/browser-compat";
import { scopedFetch } from "@/lib/client-routing";

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

type LoyaltyReward = {
  id: number;
  name: string;
  pointsNeeded: number;
  description: string | null;
  benefitType: string;
  value: string | null;
  progress: number;
  reached: boolean;
};

const rewardLabels: Record<string, string> = {
  discount: "Descuento",
  product: "Producto",
  free: "Gratis",
  other: "Beneficio",
};

/** @summary Presenta el registro, saldo, movimientos y control de privacidad del cliente frecuente. */
export function LoyaltyPortal() {
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [nextReward, setNextReward] = useState<LoyaltyReward | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");

  /** @summary Consulta el perfil utilizando exclusivamente el token privado guardado en el dispositivo. */
  async function loadProfile(accessToken: string) {
    const response = await scopedFetch("/api/loyalty", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json().catch(() => ({}))) as {
      customer?: LoyaltyProfile;
      rewards?: LoyaltyReward[];
      nextReward?: LoyaltyReward | null;
      error?: string;
    };
    if (!response.ok || !result.customer) throw new Error(result.error ?? "No se pudo abrir el perfil");
    setProfile(result.customer);
    setRewards(result.rewards ?? []);
    setNextReward(result.nextReward ?? null);
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
    const response = await scopedFetch("/api/loyalty", {
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
    const response = await scopedFetch("/api/loyalty", {
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
          {nextReward && !nextReward.reached && (
            <div className="mt-5 rounded-2xl bg-white/5 p-4 text-left">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                A {nextReward.pointsNeeded - profile.points} puntos de tu próxima recompensa
              </p>
              <p className="mt-1 text-sm font-bold">{nextReward.name}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-pink-500 transition-all"
                  style={{ width: `${nextReward.progress}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-zinc-500 tabular-nums">
                {profile.points} / {nextReward.pointsNeeded}
              </p>
            </div>
          )}
          {nextReward?.reached && (
            <div className="mt-5 rounded-2xl bg-emerald-500/15 p-4 text-left">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-300">
                ¡Tenías una recompensa lista!
              </p>
              <p className="mt-1 text-sm font-bold">{nextReward.name}</p>
            </div>
          )}
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
            <h2 className="text-2xl font-black">Recompensas</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Mostrá tu QR cuando completes el pedido para canjear tu beneficio.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rewards.map((reward) => (
                <article
                  className={`rounded-2xl border p-4 ${
                    reward.reached
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-white/10 bg-white/[.03]"
                  }`}
                  key={reward.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                        {rewardLabels[reward.benefitType] ?? reward.benefitType}
                      </p>
                      <h3 className="mt-1 font-black">{reward.name}</h3>
                      {reward.description && (
                        <p className="mt-0.5 text-xs text-zinc-500">{reward.description}</p>
                      )}
                    </div>
                    {reward.value && (
                      <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-black">
                        {reward.value}
                      </span>
                    )}
                  </div>
                  {reward.reached ? (
                    <p className="mt-3 text-sm font-black text-emerald-300">✓ Alcanzada</p>
                  ) : (
                    <>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-pink-500"
                          style={{ width: `${reward.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs text-zinc-500 tabular-nums">
                        {profile.points} / {reward.pointsNeeded} pts
                      </p>
                    </>
                  )}
                </article>
              ))}
              {!rewards.length && (
                <p className="text-sm text-zinc-500">El negocio todavía no publicó recompensas.</p>
              )}
            </div>
          </section>
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
