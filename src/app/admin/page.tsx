import Link from "next/link";

/** Enlaces de las pantallas de administración (solo admin). */
const SECCIONES = [
  { href: "/admin/menu", titulo: "Menú", desc: "Platos, precios y stock" },
  { href: "/admin/usuarios", titulo: "Usuarios", desc: "Roles y permisos" },
  { href: "/admin/auditoria", titulo: "Auditoría", desc: "Acciones sensibles" },
] as const;

/**
 * Índice de administración (R2.5, R3, R16). Punto de entrada a las pantallas de
 * menú, usuarios y auditoría. El middleware restringe el área al rol admin.
 */
export default function AdminPage() {
  return (
    <section className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-xl font-bold text-foreground">Administración</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex min-h-[44px] flex-col gap-1 rounded-lg border border-border p-5 hover:bg-muted"
          >
            <span className="font-medium text-foreground">{s.titulo}</span>
            <span className="text-sm text-muted-foreground">{s.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
