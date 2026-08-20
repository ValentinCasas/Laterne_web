"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/admin/ui/icons";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BranchSwitcher } from "@/components/admin/branch-switcher";
import { NotificationCenter } from "@/components/admin/notification-center";
import { ProfileMenu } from "@/components/admin/profile-menu";
import {
  type AdminNavGroup,
} from "@/lib/admin-navigation";

type SidebarProps = {
  groups: AdminNavGroup[];
  activeGroupId: string | null;
  activeLinkHref: string | null;
  adminHref: (href: string) => Route;
  onNavigate: () => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
  tenantName: string;
  helpHref?: Route;
  publicSiteUrl: string;
  compact: boolean;
  onToggleCompact: () => void;
  onOpenCommand: () => void;
  permissions: string[];
  branches: Array<{ id: number; name: string; slug: string; isPrimary: boolean }>;
  activeBranchId?: number;
  allBranches?: boolean;
  branchNavigationAvailable: boolean;
  onSwitchNavigationMode: () => void;
  currentMode: "TOP" | "SIDEBAR";
};

const RAIL_WIDTH = "w-[68px]";
const PANEL_WIDTH = "w-64";

/** @summary Iconos SVG específicos para el rail lateral del sidebar. */
function RailIcon({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-5 w-5 shrink-0 transition-all duration-200 ${active ? "text-white" : "text-zinc-500"}`}
      aria-hidden="true"
    >
      {name === "inicio" && (
        <>
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 21V12h6v9" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "atencion" && (
        <>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "salon" && (
        <>
          <path d="M3 9l9-7 9 7v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "catalogo" && (
        <>
          <path d="M20 7h-5V5l-1-1H9L8 5v2H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h17a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 5h8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "compras" && (
        <>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "finanzas" && (
        <>
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "reportes" && (
        <>
          <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {name === "administracion" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-.58 1.82v.09a2 2 0 0 1-2 2h-.09a2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-.58-1.82 1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82v.09a2 2 0 0 1-2 2h-.09a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.82-.58 1.65 1.65 0 0 0 .33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 .58-1.82v-.09a2 2 0 0 1 2-2h.09a2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 .58 1.82 1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a2 2 0 0 1-2 2h-.09a2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 .58-1.82v-.09a2 2 0 0 1 2-2h.09z" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** @summary Tooltip accesible para items del rail en modo compacto. */
function RailTooltip({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {label}
    </div>
  );
}

/**
 * @summary Navegación lateral dual-tier: rail fijo + panel contextual integrado.
 *
 * El panel solo se muestra cuando el usuario clickea un ícono del rail.
 * El botón de cerrar (flecha) oculta el panel hasta el próximo click.
 */
export function SidebarNavigation({
  groups,
  activeGroupId,
  activeLinkHref,
  adminHref,
  onNavigate,
  onLogout,
  userName,
  userEmail,
  userImageUrl,
  tenantName,
  helpHref,
  publicSiteUrl,
  compact,
  onToggleCompact,
  onOpenCommand,
  permissions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  branches,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeBranchId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allBranches,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  branchNavigationAvailable,
  onSwitchNavigationMode,
  currentMode,
}: SidebarProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [panelExplicitlyClosed, setPanelExplicitlyClosed] = useState(false);
  const [hoveredRailId, setHoveredRailId] = useState<string | null>(null);
  const railRef = useRef<HTMLElement | null>(null);

  /**
   * @summary Resuelve qué grupo mostrar en el panel.
   * Prioridad: selección explícita > cierre explícito (nada) > grupo activo de la URL > hover > nada.
   */
  const displayGroupId = useMemo(() => {
    if (selectedGroupId && groups.some((g) => g.id === selectedGroupId)) return selectedGroupId;
    if (panelExplicitlyClosed) return null;
    if (hoveredRailId && compact && groups.some((g) => g.id === hoveredRailId)) return hoveredRailId;
    return null;
  }, [groups, selectedGroupId, hoveredRailId, compact, panelExplicitlyClosed]);

  const displayGroup = useMemo(
    () => groups.find((g) => g.id === displayGroupId) ?? null,
    [groups, displayGroupId],
  );

  /** @summary Click en un ícono del rail: alterna el panel para ese grupo. */
  const handleGroupClick = useCallback(
    (groupId: string) => {
      setPanelExplicitlyClosed(false);
      setSelectedGroupId((current) => (current === groupId ? null : groupId));
    },
    [],
  );

  /** @summary Click en el botón de cerrar del panel. */
  const handleClosePanel = useCallback(() => {
    setSelectedGroupId(null);
    setPanelExplicitlyClosed(true);
  }, []);

  /** @summary Click en un item del panel: navega y cierra. */
  const handleItemClick = useCallback(() => {
    onNavigate();
    setSelectedGroupId(null);
  }, [onNavigate]);

  useEffect(() => {
    if (!selectedGroupId || compact) return;
    function handlePointer(event: PointerEvent) {
      const target = event.target as Node;
      if (railRef.current?.contains(target)) return;
      if (target instanceof HTMLElement && target.closest("[data-sidebar-panel]")) return;
      setSelectedGroupId(null);
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [selectedGroupId, compact]);

  const initials = useMemo(() => {
    const parts = tenantName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "MC";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [tenantName]);

  return (
    <div className="flex h-full">
      {/* Rail lateral */}
      <nav
        ref={railRef}
        className={`flex shrink-0 flex-col bg-zinc-950 transition-all duration-300 ${RAIL_WIDTH}`}
        aria-label="Navegación principal"
      >
        <div className="flex h-16 shrink-0 items-center justify-center">
          <Link
            href={adminHref("/admin")}
            onClick={onNavigate}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--admin-primary-strong)] text-sm font-black text-white transition-all duration-200 hover:bg-[var(--admin-primary-strong)]/90"
            title={tenantName}
          >
            {initials}
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-0.5 p-1.5">
          {groups.map((group) => {
            const isActive = activeGroupId === group.id;
            const isSelected = selectedGroupId === group.id;
            const isHoveredCompact = hoveredRailId === group.id;
            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => setHoveredRailId(group.id)}
                onMouseLeave={() => setHoveredRailId(null)}
              >
                <button
                  type="button"
                  onClick={() => handleGroupClick(group.id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                    isActive || isSelected
                      ? "bg-white/[.07] text-white"
                      : "text-zinc-500 hover:bg-white/[.04] hover:text-zinc-300"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  title={group.label}
                  aria-label={group.label}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-black transition-all duration-200 ${
                      isActive || isSelected
                        ? "bg-[var(--admin-primary-strong)]/12 text-[var(--admin-primary-strong)]"
                        : "bg-transparent text-zinc-500"
                    }`}
                  >
                    <RailIcon name={group.id} active={isActive || isSelected} />
                  </span>
                </button>

                {compact && (
                  <RailTooltip label={group.label} visible={isHoveredCompact} />
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-0.5 p-1.5">
          <button
            type="button"
            onClick={onOpenCommand}
            className="flex h-9 w-full items-center justify-center rounded-lg text-zinc-500 transition-colors duration-200 hover:bg-white/[.04] hover:text-zinc-300"
            aria-label="Buscar (Ctrl K)"
            title="Buscar (Ctrl K)"
          >
            <Icon name="search" className="h-4 w-4" />
          </button>
          {permissions.includes("notification.manage") && (
            <div className="flex justify-center">
              <NotificationCenter compact sidebarMode />
            </div>
          )}
          {compact && (
            <button
              type="button"
              onClick={onToggleCompact}
              className="flex h-9 w-full items-center justify-center rounded-lg text-zinc-500 transition-colors duration-200 hover:bg-white/[.04] hover:text-zinc-300"
              aria-label="Expandir menú"
              title="Expandir menú"
            >
              <Icon name="panels" className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onSwitchNavigationMode}
            className="flex h-9 w-full items-center justify-center rounded-lg text-zinc-500 transition-colors duration-200 hover:bg-white/[.04] hover:text-zinc-300"
            aria-label={currentMode === "TOP" ? "Cambiar a barra lateral" : "Cambiar a barra superior"}
            title={currentMode === "TOP" ? "Cambiar a barra lateral" : "Cambiar a barra superior"}
          >
            <Icon name={currentMode === "TOP" ? "menu" : "panels"} className="h-4 w-4" />
          </button>
          <div className="flex justify-center">
            <ProfileMenu
              userName={userName}
              userEmail={userEmail}
              userImageUrl={userImageUrl}
              tenantName={tenantName}
              adminHref={adminHref}
              onLogout={onLogout}
              helpHref={helpHref}
              onSwitchNavigationMode={onSwitchNavigationMode}
              currentMode={currentMode}
              sidebarMode
            />
          </div>
        </div>
      </nav>

      {/* Panel contextual secundario */}
      {displayGroup && !compact && (
        <nav
          data-sidebar-panel
          className={`hidden md:flex shrink-0 flex-col border-l border-white/[.04] bg-zinc-950/40 ${PANEL_WIDTH}`}
          aria-label={`Secciones de ${displayGroup.label}`}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-white">{displayGroup.label}</h2>
              {displayGroup.description && (
                <p className="truncate text-xs text-zinc-500">{displayGroup.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClosePanel}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-200 hover:bg-white/[.04] hover:text-zinc-300"
              aria-label="Cerrar panel"
              title="Cerrar panel"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {displayGroup.sections.map((section, sectionIndex) => (
              <div key={section.id} className={sectionIndex > 0 ? "mt-5" : ""}>
                <div className="px-4 pb-1.5 pt-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    {section.label}
                  </h3>
                </div>
                <div className="space-y-0.5 px-2">
                  {section.items.map((item) => {
                    const itemActive = activeLinkHref === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={adminHref(item.href)}
                        onClick={handleItemClick}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 ${
                          itemActive
                            ? "bg-white/[.05] text-white"
                            : "text-zinc-400 hover:bg-white/[.03] hover:text-zinc-200"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-black transition-all duration-200 ${
                            itemActive
                              ? "bg-[var(--admin-primary-strong)]/12 text-[var(--admin-primary-strong)]"
                              : "bg-white/[.03] text-zinc-500"
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          {item.description && (
                            <span className="block truncate text-[11px] text-zinc-500">{item.description}</span>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/[.04] p-2">
            <a
              href={publicSiteUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-zinc-500 transition-colors duration-200 hover:bg-white/[.04] hover:text-zinc-300"
              aria-label="Ver sitio"
              title="Ver sitio"
            >
              <Icon name="external-link" className="h-3.5 w-3.5" />
              <span>Ver sitio</span>
            </a>
          </div>
        </nav>
      )}
    </div>
  );
}
