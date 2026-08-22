"use client";

import type { Route } from "next";
import type { AdminNavGroup } from "@/lib/admin-navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/admin/ui/icons";
import { SidebarNavigation } from "./sidebar-navigation";

type AdminShellSidebarProps = {
  groups: AdminNavGroup[];
  activeGroupId: string | null;
  activeLinkHref: string | null;
  adminHref: (href: string) => Route;
  onNavigate: () => void;
  onRestrictedNavigate: () => void;
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
  children: React.ReactNode;
};

/** @summary Layout de barra lateral para el AdminShell. */
export function AdminShellSidebar({
  groups,
  activeGroupId,
  activeLinkHref,
  adminHref,
  onNavigate,
  onRestrictedNavigate,
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
  branches,
  activeBranchId,
  allBranches,
  branchNavigationAvailable,
  onSwitchNavigationMode,
  currentMode,
  children,
}: AdminShellSidebarProps) {
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarMobileOpen(false), []);
  const handleNavigate = useCallback(() => {
    closeSidebar();
    onNavigate();
  }, [closeSidebar, onNavigate]);
  const handleRestrictedNavigate = useCallback(() => {
    closeSidebar();
    onRestrictedNavigate();
  }, [closeSidebar, onRestrictedNavigate]);

  useEffect(() => {
    if (!sidebarMobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sidebarMobileOpen]);

  useEffect(() => {
    if (!sidebarMobileOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarMobileOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [sidebarMobileOpen]);

  return (
    <div className="flex h-dvh">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-white/[.06] bg-zinc-950/95 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition-all duration-200 hover:bg-white/[.06] hover:text-white"
          aria-label="Abrir menú"
          title="Abrir menú"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-white">{tenantName}</span>
        <div className="w-9" />
      </div>

      {/* Sidebar drawer wrapper */}
      <div
        className={`flex h-full shrink-0 border-r border-white/[.04] bg-zinc-950 transition-all duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 ${
          sidebarMobileOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-[200] shadow-2xl shadow-black/50 lg:relative lg:shadow-none`}
      >
        <SidebarNavigation
          groups={groups}
          activeGroupId={activeGroupId}
          activeLinkHref={activeLinkHref}
          adminHref={adminHref}
          onNavigate={handleNavigate}
          onRestrictedNavigate={handleRestrictedNavigate}
          onLogout={onLogout}
          userName={userName}
          userEmail={userEmail}
          userImageUrl={userImageUrl}
          tenantName={tenantName}
          helpHref={helpHref}
          publicSiteUrl={publicSiteUrl}
          compact={compact}
          onToggleCompact={onToggleCompact}
          onOpenCommand={onOpenCommand}
          permissions={permissions}
          branches={branches}
          activeBranchId={activeBranchId}
          allBranches={allBranches}
          branchNavigationAvailable={branchNavigationAvailable}
          onSwitchNavigationMode={onSwitchNavigationMode}
          currentMode={currentMode}
        />
      </div>

      {/* Backdrop */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="admin-main admin-shell-inner flex-1 overflow-auto px-3 py-5 sm:px-4 sm:py-6 lg:px-6 lg:py-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
