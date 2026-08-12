import Link from "next/link";

/** @summary Reúne accesos legales, ayuda y productos comerciales al final de cada página. */
export function SiteFooter({ businessName }: { businessName: string }) {
  return (
    <footer className="border-t border-white/10 bg-black py-10 print:hidden">
      <div className="shell flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-2xl font-black text-pink-400">{businessName}&.</p>
          <p className="mt-2 text-sm text-zinc-500">Carta, pedidos, reservas y experiencias digitales.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400" aria-label="Información">
          <Link className="hover:text-pink-300" href="/legal">
            Información legal
          </Link>
          <Link className="hover:text-pink-300" href="/ayuda">
            Ayuda
          </Link>
        </nav>
      </div>
    </footer>
  );
}
