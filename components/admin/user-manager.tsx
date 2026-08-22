"use client";

import { useCallback, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  PageHeader,
  DataTable,
  SearchBox,
  StatusBadge,
  ActionMenu,
  EmptyState,
  Drawer,
  FormSection,
  Tabs,
  FactBox,
  UserAvatar,
} from "@/components/admin/ui";
import { avatarUrl } from "@/components/admin/profile-menu";
import { scopedFetch } from "@/lib/client-routing";

/** @summary Datos de un usuario en la lista principal. */
export type UserListItem = {
  id: number;
  membershipId: number;
  name: string;
  email: string;
  imageUrl: string;
  hasPin: boolean;
  role: { id: number; key: string; name: string };
  status: string;
  allBranches: boolean;
  branches: Array<{ id: number; name: string; slug: string }>;
  lastAccessAt: string | null;
  createdAt: string;
};

/** @summary Detalle completo de un usuario (ficha). */
type UserDetail = {
  user: {
    id: number;
    name: string;
    email: string;
    imageUrl: string;
    hasPin: boolean;
    createdAt: string;
    updatedAt: string;
  };
  membership: { id: number; status: string; allBranches: boolean };
  role: { id: number; key: string; name: string; description: string | null };
  permissions: string[];
  branches: Array<{ id: number; name: string; slug: string; active: boolean }>;
  lastAccessAt: string | null;
  activeSessions: number;
  auditLogs: Array<{
    id: number;
    action: string;
    createdAt: string;
    oldValues: Record<string, unknown> | null;
    newValues: Record<string, unknown> | null;
    user: { name: string; email: string };
  }>;
  availableRoles: Array<{
    id: number;
    key: string;
    name: string;
    description: string | null;
    system: boolean;
  }>;
  allBranches: Array<{ id: number; name: string; slug: string }>;
  allPermissions: string[];
};

/** @summary Rol disponible con su conteo de usuarios. */
type RoleSummary = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  system: boolean;
  userCount: number;
  permissions: string[];
};

type PermissionGroup = {
  group: string;
  permissions: Array<{ key: string; name: string; description: string | null }>;
};

type RolesResponse = {
  roles: RoleSummary[];
  groups: PermissionGroup[];
  allPermissions: string[];
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  roleId: number;
  branchIds: number[];
  allBranches: boolean;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  roleId: 0,
  branchIds: [],
  allBranches: false,
};

/** @summary Preset de rol para carga rápida de permisos comunes. */
const ROLE_PRESETS: Array<{ label: string; description: string; roleKey: string }> = [
  { label: "Camarero", description: "Toma pedidos, gestiona mesas y atiende clientes", roleKey: "camarero" },
  { label: "Cocina", description: "Opera el KDS, gestiona comandas y estaciones", roleKey: "cocina" },
  { label: "Caja", description: "Gestiona cobros, pagos y cuenta corriente", roleKey: "caja" },
  { label: "Encargado", description: "Supervisión operativa completa", roleKey: "encargado" },
  { label: "Repartidor", description: "Accede a sus entregas y reporta incidencias", roleKey: "driver" },
];

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Nunca";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @summary Gestor completo de usuarios/empleados del tenant.
 *
 * Incluye lista con DataTable, ficha detallada con tabs, matriz de permisos
 * agrupada por módulo, presets de roles, acceso a branches y gestión de PIN
 * de acceso rápido (bcrypt hash, futuro).
 */
export function UserManager({ initialUsers }: { initialUsers: UserListItem[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rolesData, setRolesData] = useState<RolesResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return q ? users.filter((u) => `${u.name} ${u.email}`.toLocaleLowerCase("es").includes(q)) : users;
  }, [users, query]);

  /** @summary Carga los roles disponibles con la matriz de permisos. */
  const loadRoles = useCallback(async () => {
    if (rolesData) return;
    try {
      const response = await scopedFetch("/api/admin/roles");
      if (response.ok) {
        const data = (await response.json()) as RolesResponse;
        setRolesData(data);
      }
    } catch {
      /* ignore */
    }
  }, [rolesData]);

  /** @summary Abre la ficha de un usuario con todos sus datos. */
  async function openDetail(user: UserListItem) {
    setDetailLoading(true);
    setDrawerOpen(true);
    setActiveTab("general");
    setEditing(false);
    setCreating(false);
    try {
      const response = await scopedFetch(`/api/admin/usuarios/${user.id}`);
      if (!response.ok) throw new Error("No se pudo cargar la ficha");
      const data = (await response.json()) as UserDetail;
      setDetail(data);
      void loadRoles();
    } catch (error) {
      await Swal.fire({
        title: "Error",
        text: error instanceof Error ? error.message : "No se pudo cargar la ficha",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      setDrawerOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  /** @summary Abre el formulario de creación de usuario. */
  async function openCreate() {
    await loadRoles();
    setCreating(true);
    setEditing(false);
    setDetail(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  }

  /** @summary Abre el formulario de edición con los datos actuales del usuario. */
  function openEdit(userDetail: UserDetail) {
    setEditing(true);
    setCreating(false);
    setForm({
      name: userDetail.user.name,
      email: userDetail.user.email,
      password: "",
      roleId: userDetail.role.id,
      branchIds: userDetail.branches.map((b) => b.id),
      allBranches: userDetail.membership.allBranches,
    });
  }

  /** @summary Guarda un usuario nuevo o editado. */
  async function saveUser() {
    if (!form.name.trim() || !form.email.trim()) {
      await Swal.fire({
        title: "Campos requeridos",
        text: "Nombre y email son obligatorios.",
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    if (creating && !form.password) {
      await Swal.fire({
        title: "Contraseña requerida",
        text: "Ingresá una contraseña para el nuevo usuario.",
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    if (form.roleId === 0) {
      await Swal.fire({
        title: "Rol requerido",
        text: "Elegí un rol para el usuario.",
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        roleId: form.roleId,
        branchIds: form.branchIds,
        allBranches: form.allBranches,
      };
      if (form.password) payload.password = form.password;

      const url = creating ? "/api/admin/usuarios" : `/api/admin/usuarios/${detail!.user.id}`;
      const method = creating ? "POST" : "PUT";

      const response = await scopedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No se pudo guardar");
      }

      await Swal.fire({
        title: creating ? "Usuario creado" : "Usuario actualizado",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });

      // Recargar lista
      const listResponse = await scopedFetch("/api/admin/usuarios");
      if (listResponse.ok) {
        const listData = (await listResponse.json()) as { users: UserListItem[] };
        setUsers(listData.users);
      }

      setEditing(false);
      setCreating(false);
      setForm(emptyForm);
      if (!creating && detail) void openDetail({ id: detail.user.id } as UserListItem);
    } catch (error) {
      await Swal.fire({
        title: "Error",
        text: error instanceof Error ? error.message : "No se pudo guardar",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSaving(false);
    }
  }

  /** @summary Cambia el estado de un usuario (activar/desactivar). */
  async function toggleStatus(user: UserListItem) {
    const newStatus = user.status === "active" ? "inactive" : "active";
    const action = newStatus === "active" ? "activar" : "desactivar";

    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} usuario`,
      text: `${user.name} será ${newStatus === "active" ? "activado" : "desactivado"}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed) return;

    try {
      const response = await scopedFetch(`/api/admin/usuarios/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error("No se pudo cambiar el estado");
      setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)));
      await Swal.fire({
        title: `Usuario ${action}do`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "Error",
        text: error instanceof Error ? error.message : "Intentá nuevamente",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }

  /** @summary Elimina un usuario del tenant. */
  async function removeUser(user: UserListItem) {
    const result = await Swal.fire({
      title: `¿Eliminar a ${user.name}?`,
      text: "Se revocarán todas sus sesiones y acceso al panel. Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed) return;

    try {
      const response = await scopedFetch(`/api/admin/usuarios/${user.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No se pudo eliminar");
      }
      setUsers((current) => current.filter((u) => u.id !== user.id));
      if (detail?.user.id === user.id) setDrawerOpen(false);
      await Swal.fire({
        title: "Usuario eliminado",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "Error",
        text: error instanceof Error ? error.message : "Intentá nuevamente",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Equipo"
        title="Usuarios"
        description="Gestioná el equipo de trabajo: roles, permisos, acceso a sucursales y PIN de acceso rápido."
        section="usuarios"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Buscar nombre o email"
              className="min-w-[220px] flex-1"
            />
            <button type="button" className="btn" onClick={() => void openCreate()}>
              + Nuevo usuario
            </button>
          </div>
        }
      />

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FactBox title="Total">
          <p className="text-2xl font-black">{users.length}</p>
        </FactBox>
        <FactBox title="Activos">
          <p className="text-2xl font-black text-emerald-300">
            {users.filter((u) => u.status === "active").length}
          </p>
        </FactBox>
        <FactBox title="Inactivos">
          <p className="text-2xl font-black text-amber-300">
            {users.filter((u) => u.status !== "active").length}
          </p>
        </FactBox>
        <FactBox title="Con PIN">
          <p className="text-2xl font-black text-sky-300">{users.filter((u) => u.hasPin).length}</p>
        </FactBox>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No hay usuarios"
          description="Creá el primer usuario para que tu equipo pueda operar el panel."
          action={
            <button type="button" className="btn" onClick={() => void openCreate()}>
              + Nuevo usuario
            </button>
          }
        />
      ) : (
        <div className="shadow-xl shadow-black/10">
          <DataTable
            viewStorageKey="usuarios"
            columns={[
              { key: "name", label: "Usuario" },
              { key: "role", label: "Rol" },
              { key: "branches", label: "Sucursales", hideOnMobile: true },
              { key: "status", label: "Estado", hideOnMobile: true },
              { key: "lastAccess", label: "Último acceso", hideOnMobile: true },
              { key: "actions", label: "", align: "right" as const },
            ]}
            data={visible.map((user) => ({
              id: user.id,
              name: (
                <div className="flex items-center gap-3">
                  <UserAvatar name={user.name} src={avatarUrl(user.imageUrl)} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{user.name}</p>
                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                  </div>
                </div>
              ),
              role: (
                <StatusBadge
                  status={user.role.name}
                  tone={
                    user.role.key === "owner"
                      ? "success"
                      : user.role.key === "administrator"
                        ? "info"
                        : "default"
                  }
                />
              ),
              branches: user.allBranches ? (
                <span className="text-xs font-semibold text-sky-300">Todas</span>
              ) : (
                <span className="text-xs text-zinc-400">
                  {user.branches.map((b) => b.name).join(", ") || "Sin acceso"}
                </span>
              ),
              status: (
                <StatusBadge
                  status={user.status === "active" ? "Activo" : "Inactivo"}
                  tone={user.status === "active" ? "success" : "warning"}
                />
              ),
              lastAccess: <span className="text-xs text-zinc-500">{formatDate(user.lastAccessAt)}</span>,
              actions: (
                <ActionMenu
                  align="right"
                  items={[
                    { label: "Ver ficha", onClick: () => void openDetail(user) },
                    { label: "Editar", onClick: () => void openDetail(user) },
                    {
                      label: user.status === "active" ? "Desactivar" : "Activar",
                      tone: user.status === "active" ? "danger" : "primary",
                      onClick: () => void toggleStatus(user),
                    },
                    { label: "Eliminar", tone: "danger", onClick: () => void removeUser(user) },
                  ]}
                />
              ),
            }))}
            keyExtractor={(row) => row.id as number}
            emptyMessage="No hay usuarios con esos datos."
            density="normal"
          />
        </div>
      )}

      {/* Drawer: Ficha / Crear / Editar */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(false);
          setCreating(false);
          setDetail(null);
          setForm(emptyForm);
        }}
        title={
          creating
            ? "Nuevo usuario"
            : editing
              ? `Editar · ${detail?.user.name ?? ""}`
              : detail
                ? detail.user.name
                : "Usuario"
        }
        width="800px"
      >
        {creating || editing ? (
          <UserFormEditor
            form={form}
            setForm={setForm}
            roles={rolesData?.roles ?? []}
            allBranches={detail?.allBranches ?? []}
            saving={saving}
            onSave={saveUser}
            onCancel={() => {
              if (editing && detail) {
                setEditing(false);
                void openDetail({ id: detail.user.id } as UserListItem);
              } else {
                setDrawerOpen(false);
                setCreating(false);
              }
            }}
          />
        ) : detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
          </div>
        ) : detail ? (
          <UserDetailView
            detail={detail}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onEdit={() => openEdit(detail)}
            onRefresh={() => void openDetail({ id: detail.user.id } as UserListItem)}
          />
        ) : null}
      </Drawer>
    </section>
  );
}

/**
 * @summary Formulario de creación/edición de usuario con selector de rol, branches y preset rápido.
 */
function UserFormEditor({
  form,
  setForm,
  roles,
  allBranches,
  saving,
  onSave,
  onCancel,
}: {
  form: UserForm;
  setForm: (fn: (prev: UserForm) => UserForm) => void;
  roles: RoleSummary[];
  allBranches: Array<{ id: number; name: string; slug: string }>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const selectedRole = roles.find((r) => r.id === form.roleId);

  /** @summary Aplica un preset de rol rápido. */
  function applyPreset(roleKey: string) {
    const role = roles.find((r) => r.key === roleKey);
    if (role) setForm((prev) => ({ ...prev, roleId: role.id }));
  }

  return (
    <div className="space-y-6">
      {/* Presets rápidos */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Acceso rápido por rol</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_PRESETS.map((preset) => (
            <button
              key={preset.roleKey}
              type="button"
              onClick={() => applyPreset(preset.roleKey)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedRole?.key === preset.roleKey
                  ? "border-[var(--admin-primary-strong)] bg-[var(--admin-primary-strong)]/10 text-[var(--admin-primary-strong)]"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <FormSection title="Datos personales" description="Información básica del usuario.">
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-400">Nombre *</label>
          <input
            className="input w-full"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre completo"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-400">Email *</label>
          <input
            className="input w-full"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="email@ejemplo.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-400">
            Contraseña {form.roleId ? "" : "*"}
          </label>
          <input
            className="input w-full"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
      </FormSection>

      <FormSection
        title="Rol y permisos"
        description="El rol determina qué puede hacer el usuario en el panel."
      >
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-400">Rol *</label>
          <select
            className="input w-full"
            value={form.roleId}
            onChange={(e) => setForm((f) => ({ ...f, roleId: Number(e.target.value) }))}
          >
            <option value={0}>Seleccionar rol…</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
                {role.system ? " (sistema)" : ""}
              </option>
            ))}
          </select>
          {selectedRole && <p className="mt-1 text-xs text-zinc-500">{selectedRole.description}</p>}
        </div>
      </FormSection>

      <FormSection
        title="Acceso a sucursales"
        description="Definí a qué sucursales puede acceder el usuario."
      >
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.allBranches}
              onChange={(e) => setForm((f) => ({ ...f, allBranches: e.target.checked }))}
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold">Acceso a todas las sucursales</span>
          </label>
        </div>
        {!form.allBranches && (
          <div className="grid gap-2 sm:grid-cols-2">
            {allBranches.map((branch) => (
              <label
                key={branch.id}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={form.branchIds.includes(branch.id)}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      branchIds: e.target.checked
                        ? [...f.branchIds, branch.id]
                        : f.branchIds.filter((id) => id !== branch.id),
                    }));
                  }}
                  className="h-4 w-4"
                />
                <span className="text-sm">{branch.name}</span>
              </label>
            ))}
          </div>
        )}
      </FormSection>

      <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn" onClick={onSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

/**
 * @summary Vista detallada de un usuario con tabs: General, Permisos, Sucursales, PIN, Auditoría.
 */
function UserDetailView({
  detail,
  activeTab,
  onTabChange,
  onEdit,
  onRefresh,
}: {
  detail: UserDetail;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          Editar
        </button>
        <StatusBadge
          status={detail.membership.status === "active" ? "Activo" : "Inactivo"}
          tone={detail.membership.status === "active" ? "success" : "warning"}
        />
        <StatusBadge status={detail.role.name} tone={detail.role.key === "owner" ? "success" : "default"} />
        {detail.user.hasPin && <StatusBadge status="PIN configurado" tone="info" />}
      </div>

      <Tabs
        tabs={[
          { key: "general", label: "General" },
          { key: "permisos", label: "Permisos" },
          { key: "sucursales", label: "Sucursales" },
          { key: "pin", label: "PIN" },
          { key: "auditoria", label: "Auditoría" },
        ]}
        defaultTab={activeTab}
        onChange={onTabChange}
      />

      <div className="mt-4">
        {activeTab === "general" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-zinc-500">Nombre</p>
              <p className="text-sm font-semibold">{detail.user.name}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Email</p>
              <p className="text-sm font-semibold">{detail.user.email}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Rol</p>
              <p className="text-sm font-semibold">{detail.role.name}</p>
              {detail.role.description && <p className="text-xs text-zinc-500">{detail.role.description}</p>}
            </div>
            <div>
              <p className="text-xs text-zinc-500">Último acceso</p>
              <p className="text-sm font-semibold">{formatDate(detail.lastAccessAt)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Sesiones activas</p>
              <p className="text-sm font-semibold">{detail.activeSessions}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Miembro desde</p>
              <p className="text-sm font-semibold">{formatDate(detail.user.createdAt)}</p>
            </div>
          </div>
        )}

        {activeTab === "permisos" && (
          <div>
            <p className="mb-3 text-xs text-zinc-500">
              Permisos del rol <strong>{detail.role.name}</strong>: {detail.permissions.length} permisos
              activos.
            </p>
            <div className="space-y-3">
              {Object.entries(PERMISSION_GROUPS).map(([group, keys]) => {
                const groupPerms = detail.allPermissions.filter((p) => keys.includes(p));
                if (!groupPerms.length) return null;
                return (
                  <div key={group} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">{group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {groupPerms.map((perm) => (
                        <span
                          key={perm}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            detail.permissions.includes(perm)
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-white/5 text-zinc-600"
                          }`}
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "sucursales" && (
          <div>
            {detail.membership.allBranches ? (
              <p className="text-sm text-zinc-300">
                Acceso a <strong>todas las sucursales</strong>.
              </p>
            ) : detail.branches.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin acceso a sucursales específicas.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {detail.branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                  >
                    <StatusBadge
                      status={branch.active ? "Activa" : "Inactiva"}
                      tone={branch.active ? "success" : "warning"}
                    />
                    <span className="text-sm font-semibold">{branch.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "pin" && (
          <PinSection
            userId={detail.user.id}
            hasPin={detail.user.hasPin}
            userName={detail.user.name}
            onRefresh={onRefresh}
          />
        )}

        {activeTab === "auditoria" && (
          <div>
            {detail.auditLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin registros de auditoría.</p>
            ) : (
              <div className="space-y-2">
                {detail.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                  >
                    <StatusBadge
                      status={
                        log.action === "create"
                          ? "Creación"
                          : log.action === "update"
                            ? "Edición"
                            : "Eliminación"
                      }
                      tone={log.action === "create" ? "success" : log.action === "update" ? "info" : "danger"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-500">{formatDate(log.createdAt)}</p>
                      {log.oldValues && (
                        <p className="mt-0.5 text-xs text-zinc-600">
                          Antes:{" "}
                          {Object.entries(log.oldValues)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(", ")}
                        </p>
                      )}
                      {log.newValues && (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          Ahora:{" "}
                          {Object.entries(log.newValues)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** @summary Agrupación de permisos por módulo para la vista de permisos. */
const PERMISSION_GROUPS: Record<string, string[]> = {
  Operación: [
    "admin.access",
    "order.manage",
    "table.manage",
    "kitchen.manage",
    "reservation.manage",
    "customer.manage",
  ],
  Productos: ["product.manage", "category.manage", "inventory.manage"],
  Compras: ["purchase.manage"],
  Finanzas: [
    "finance.view",
    "finance.manage",
    "finance.transfer",
    "finance.payment",
    "finance.export",
    "finance.reversal",
  ],
  Delivery: ["driver.view", "driver.self"],
  Reportes: ["analytics.read"],
  Contenido: [
    "event.manage",
    "hours.manage",
    "promotion.manage",
    "brand.manage",
    "content.manage",
    "testimonial.moderate",
  ],
  Configuración: [
    "business.manage",
    "user.manage",
    "notification.manage",
    "media.manage",
    "support.manage",
    "audit.read",
  ],
};

/**
 * @summary Sección de PIN de acceso rápido con creación, cambio y eliminación.
 * El PIN se almacena como bcrypt hash. Nunca se muestra ni se envía en texto plano.
 */
function PinSection({
  userId,
  hasPin,
  userName,
  onRefresh,
}: {
  userId: number;
  hasPin: boolean;
  userName: string;
  onRefresh: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function savePin() {
    if (!/^\d{6}$/.test(pin)) {
      await Swal.fire({
        title: "PIN inválido",
        text: "El PIN debe ser exactamente 6 dígitos numéricos.",
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    if (pin !== confirmPin) {
      await Swal.fire({
        title: "Los PINs no coinciden",
        text: "Ingresá el mismo PIN dos veces.",
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }

    setBusy(true);
    try {
      const response = await scopedFetch(`/api/admin/usuarios/${userId}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) throw new Error("No se pudo guardar el PIN");
      setPin("");
      setConfirmPin("");
      onRefresh();
      await Swal.fire({
        title: "PIN actualizado",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "Error",
        text: error instanceof Error ? error.message : "Intentá nuevamente",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removePin() {
    const result = await Swal.fire({
      title: "¿Eliminar PIN?",
      text: `${userName} ya no podrá usar el acceso rápido por PIN.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed) return;

    setBusy(true);
    try {
      const response = await scopedFetch(`/api/admin/usuarios/${userId}/pin`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar el PIN");
      onRefresh();
      await Swal.fire({
        title: "PIN eliminado",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "Error",
        text: error instanceof Error ? error.message : "Intentá nuevamente",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-sm font-semibold text-amber-200">PIN de acceso rápido</p>
        <p className="mt-1 text-xs text-amber-300/80">
          El PIN permite login rápido desde dispositivos compartidos (caja, cocina). Se almacena como hash
          bcrypt y nunca se guarda en texto plano.
        </p>
      </div>

      {hasPin && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <StatusBadge status="PIN configurado" tone="success" />
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={() => void removePin()}
            disabled={busy}
          >
            Eliminar PIN
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-400">PIN (6 dígitos)</label>
          <input
            className="input w-full"
            type="password"
            maxLength={6}
            pattern="\d{6}"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-400">Confirmar PIN</label>
          <input
            className="input w-full"
            type="password"
            maxLength={6}
            pattern="\d{6}"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
          />
        </div>
      </div>

      <button
        type="button"
        className="btn"
        onClick={() => void savePin()}
        disabled={busy || pin.length !== 6 || confirmPin.length !== 6}
      >
        {busy ? "Guardando…" : hasPin ? "Cambiar PIN" : "Establecer PIN"}
      </button>
    </div>
  );
}
