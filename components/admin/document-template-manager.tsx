"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, StatusBadge, SectionHeader, ActionMenu } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { copyBrowserText } from "@/lib/browser-compat";
import {
  documentFieldGroups,
  documentTypeLabels,
  documentTypes,
  imageDocumentFields,
  itemsLoopHelp,
  type DocumentType,
} from "@/lib/documents/document-fields";
import { adminHrefFromPathname, scopedApiPath } from "@/lib/routes";

export type DocumentTemplateItem = {
  id: number;
  documentType: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  active: boolean;
  isDefault: boolean;
  createdAt: string;
};

/**
 * @summary Presenta el tamaño de un archivo en una unidad legible.
 */
function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * @summary Gestiona versiones, activación y descarga de plantillas Word.
 */
export function DocumentTemplateManager({ initialTemplates }: { initialTemplates: DocumentTemplateItem[] }) {
  const pathname = usePathname();
  const [templates, setTemplates] = useState(initialTemplates);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const uploadForm = useRef<HTMLFormElement | null>(null);

  /**
   * @summary Recarga las plantillas documentales después de una modificación.
   */
  async function reload() {
    const response = await scopedFetch("/api/admin/document-templates", { cache: "no-store" });
    const body = (await response.json()) as { templates?: DocumentTemplateItem[] };
    if (response.ok && body.templates) setTemplates(body.templates);
  }

  /**
   * @summary Valida y carga un archivo DOCX como nueva plantilla.
   */
  async function upload(
    file: File,
    options: { documentType: string; name?: string; replaceId?: number; isDefault?: boolean },
  ) {
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    form.set("documentType", options.documentType);
    if (options.name) form.set("name", options.name);
    if (options.replaceId) form.set("replaceId", String(options.replaceId));
    if (options.isDefault) form.set("isDefault", "true");
    try {
      const response = await scopedFetch("/api/admin/document-templates", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as {
        template?: DocumentTemplateItem;
        error?: string;
      };
      if (!response.ok || !body.template) throw new Error(body.error ?? "No se pudo cargar la plantilla");
      await reload();
      setMessage(options.replaceId ? "Nueva versión cargada y activada." : "Plantilla cargada y activada.");
      uploadForm.current?.reset();
    } catch (error) {
      await Swal.fire({
        title: "No se pudo cargar el Word",
        text: error instanceof Error ? error.message : "Revisá el archivo e intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }

  /**
   * @summary Agrega un elemento dentro del administrador de plantillas documentales.
   */
  async function createTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return;
    await upload(file, {
      documentType: String(form.get("documentType")),
      name: String(form.get("name") ?? "").trim(),
      isDefault: form.get("isDefault") === "on",
    });
  }

  /**
   * @summary Actualiza el estado del administrador de plantillas documentales y conserva su consistencia.
   */
  async function update(template: DocumentTemplateItem, payload: { active?: boolean; isDefault?: boolean }) {
    setBusy(true);
    const response = await scopedFetch(`/api/admin/document-templates/${template.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) return;
    await reload();
    setMessage(payload.isDefault ? "Plantilla predeterminada actualizada." : "Plantilla activa actualizada.");
  }

  /**
   * @summary Elimina un elemento del administrador de plantillas documentales tras las comprobaciones necesarias.
   */
  async function remove(template: DocumentTemplateItem) {
    const confirmation = await Swal.fire({
      title: "¿Eliminar esta plantilla?",
      text: "Los comprobantes históricos conservarán el DOCX/PDF ya generado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/document-templates/${template.id}`, { method: "DELETE" });
    if (response.ok) {
      await reload();
      setMessage("Plantilla eliminada. El fallback sigue disponible.");
    }
  }

  /**
   * @summary Copia el valor solicitado desde el administrador de plantillas documentales.
   */
  async function copyField(value: string) {
    const copied = await copyBrowserText(value);
    setMessage(copied ? `Copiado: ${value}` : "No se pudo copiar el campo.");
  }

  const currentByType = new Map<DocumentType, DocumentTemplateItem | undefined>(
    documentTypes.map((type) => [
      type,
      templates.find((template) => template.documentType === type && template.active),
    ]),
  );

  return (
    <section className="min-w-0">
      <PageHeader
        eyebrow="Configuración · Comprobantes"
        title="Plantillas de documentos"
        description="Diseñá libremente en Word, agregá los campos de MenuClick y cargá el .docx."
        section="facturacion"
        actions={
          <Link className="btn btn-secondary" href={adminHrefFromPathname(pathname, "/admin/facturacion")}>
            Volver a comprobantes
          </Link>
        }
      />

      <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100">
        <strong className="block text-amber-300">Tipos visuales ≠ emisión fiscal</strong>
        Factura A/B preparan un diseño documental. MenuClick no emite una factura fiscal válida ni CAE sin una
        integración fiscal autorizada.
      </div>
      {message && (
        <p
          className="mb-6 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          {message}
        </p>
      )}

      <section className="grid min-w-0 gap-4 lg:grid-cols-3">
        {documentTypes.map((type) => {
          const template = currentByType.get(type);
          return (
            <article className="card min-w-0 p-5" key={type}>
              <p className="text-xs font-black uppercase tracking-wider text-[var(--admin-primary)]">
                {documentTypeLabels[type]}
              </p>
              {template ? (
                <>
                  <h2 className="mt-3 break-words text-xl font-black">{template.name}</h2>
                  <p className="mt-1 break-all text-sm text-[var(--admin-muted)]">
                    {template.originalFilename}
                  </p>
                  <p className="mt-2 text-xs text-[var(--admin-muted)]">
                    Versión {template.version} · {sizeLabel(template.sizeBytes)}
                    {template.isDefault ? " · " : ""}
                    {template.isDefault && <StatusBadge status="Predeterminada" tone="success" />}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a
                      className="btn btn-secondary !px-3 !py-2 text-sm"
                      href={scopedApiPath(pathname, `/api/admin/document-templates/${template.id}`)}
                    >
                      Descargar
                    </a>
                    <label className="btn btn-secondary cursor-pointer !px-3 !py-2 text-sm">
                      Reemplazar
                      <input
                        className="sr-only"
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void upload(file, { documentType: type, replaceId: template.id });
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="btn btn-secondary !px-3 !py-2 text-sm"
                      disabled={busy || template.isDefault}
                      onClick={() => void update(template, { isDefault: true })}
                      type="button"
                    >
                      Predeterminada
                    </button>
                    <ActionMenu
                      align="right"
                      items={[{ label: "Eliminar", onClick: () => void remove(template), tone: "danger" }]}
                    />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-[var(--admin-muted)]">
                  Sin plantilla propia. Al crear un documento se usa el modelo clásico de MenuClick.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <form ref={uploadForm} className="card min-w-0 p-5 sm:p-7" onSubmit={createTemplate}>
          <h2 className="text-2xl font-black">+ Nueva plantilla</h2>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">Sólo DOCX válido, hasta 5 MB.</p>
          <div className="mt-5 grid gap-4">
            <label className="text-sm font-bold">
              Tipo de documento
              <select className="input mt-2" name="documentType" defaultValue="internal_receipt">
                {documentTypes.map((type) => (
                  <option value={type} key={type}>
                    {documentTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Nombre
              <input className="input mt-2" name="name" maxLength={160} placeholder="Ej. Clásico Laterne" />
            </label>
            <label className="text-sm font-bold">
              Archivo Word
              <input
                className="input mt-2 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
                name="file"
                type="file"
                required
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm">
              <input className="mt-1 h-5 w-5" name="isDefault" type="checkbox" />
              <span>
                <strong className="block">Usar como predeterminada</strong>
                <small className="text-[var(--admin-muted)]">
                  Sirve de fallback para tipos sin plantilla propia.
                </small>
              </span>
            </label>
          </div>
          <button className="btn mt-5 w-full" disabled={busy} type="submit">
            {busy ? "Validando…" : "Subir y activar"}
          </button>
        </form>

        <article className="card min-w-0 p-5 sm:p-7">
          <h2 className="text-2xl font-black">Plantillas de ejemplo</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--admin-muted)]">
            Abrilas en Word, cambiá tipografías, márgenes, colores, tablas y posiciones sin tocar los campos.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              className="rounded-2xl border border-white/10 bg-white/[.03] p-5 hover:border-[var(--admin-primary)]"
              href={scopedApiPath(pathname, "/api/admin/document-templates/example?variant=classic")}
            >
              <strong className="text-lg">Clásica</strong>
              <span className="mt-2 block text-sm text-[var(--admin-muted)]">
                Tradicional, logo superior, tabla, totales, QR y footer.
              </span>
              <span className="mt-4 block text-sm font-black text-[var(--admin-primary)]">
                Descargar .docx ↓
              </span>
            </a>
            <a
              className="rounded-2xl border border-white/10 bg-white/[.03] p-5 hover:border-[var(--admin-primary)]"
              href={scopedApiPath(pathname, "/api/admin/document-templates/example?variant=modern")}
            >
              <strong className="text-lg">Moderna</strong>
              <span className="mt-2 block text-sm text-[var(--admin-muted)]">
                Encabezado visual, datos compactos, total destacado y QR lateral.
              </span>
              <span className="mt-4 block text-sm font-black text-[var(--admin-primary)]">
                Descargar .docx ↓
              </span>
            </a>
          </div>
        </article>
      </section>

      <section className="card mt-6 min-w-0 p-5 sm:p-7">
        <h2 className="text-2xl font-black">Campos disponibles</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">
          Copiá estos campos en Word exactamente donde quieras que aparezcan.
        </p>
        <div className="mt-6 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {documentFieldGroups.map((group) => (
            <section
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[.025] p-4"
              key={group.label}
            >
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-primary)]">
                {group.label}
              </h3>
              <div className="mt-3 space-y-2">
                {group.fields.map((field) => {
                  const value = `{{${field}}}`;
                  return (
                    <div className="flex min-w-0 items-center gap-2" key={field}>
                      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-black/30 px-2 py-2 text-xs">
                        {value}
                      </code>
                      <button
                        className="shrink-0 rounded-lg border border-white/10 px-2 py-2 text-xs font-bold"
                        onClick={() => void copyField(value)}
                        type="button"
                      >
                        Copiar
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[.025] p-4 md:col-span-2 xl:col-span-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--admin-primary)]">
              Imágenes
            </h3>
            <div className="mt-3 space-y-2">
              {imageDocumentFields.map((field) => (
                <div className="grid min-w-0 gap-1" key={field.placeholder}>
                  <span className="text-xs text-[var(--admin-muted)]">{field.label}</span>
                  <div className="flex min-w-0 gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-black/30 px-2 py-2 text-xs">
                      {field.placeholder}
                    </code>
                    <button
                      className="shrink-0 rounded-lg border border-white/10 px-2 py-2 text-xs font-bold"
                      onClick={() => void copyField(field.placeholder)}
                      type="button"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <h3 className="font-black text-cyan-200">Tabla variable de productos</h3>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            En una tabla de Word, colocá el inicio en una fila, los campos en la fila que se repite y el
            cierre en la fila siguiente.
          </p>
          <div className="mt-3 grid min-w-0 gap-2">
            {[itemsLoopHelp.start, ...itemsLoopHelp.fields, itemsLoopHelp.end].map((value) => (
              <div className="flex min-w-0 gap-2" key={value}>
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-black/30 px-3 py-2 text-xs">
                  {value}
                </code>
                <button
                  className="shrink-0 rounded-lg border border-white/10 px-3 text-xs font-bold"
                  onClick={() => void copyField(value)}
                  type="button"
                >
                  Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {templates.some((template) => !template.active) && (
        <section className="card mt-6 min-w-0 p-5 sm:p-7">
          <SectionHeader title="Versiones disponibles" />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {templates
              .filter((template) => !template.active)
              .map((template) => (
                <article
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4"
                  key={template.id}
                >
                  <div className="min-w-0">
                    <strong className="block break-words">
                      {template.name} · v{template.version}
                    </strong>
                    <span className="block break-all text-xs text-[var(--admin-muted)]">
                      {template.originalFilename}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      className="btn btn-secondary !px-3 !py-2 text-xs"
                      href={scopedApiPath(pathname, `/api/admin/document-templates/${template.id}`)}
                    >
                      Descargar
                    </a>
                    <button
                      className="btn !px-3 !py-2 text-xs"
                      disabled={busy}
                      onClick={() => void update(template, { active: true })}
                      type="button"
                    >
                      Usar esta
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </section>
      )}
    </section>
  );
}
