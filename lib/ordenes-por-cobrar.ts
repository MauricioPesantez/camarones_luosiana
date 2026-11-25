import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { AuthenticatedUser } from "./session";
import { canUserModifyOrder } from "./order-payment";
import { sePuedeEditar } from "./edicion-orden";
import { paymentBlockReason } from "./payment-policy";
import { presentarCobro } from "./presentacion-cobro";
import { obtenerFechaEcuador } from "./fecha-ecuador";
import type { OrdenesPorCobrar } from "../types/por-cobrar";

export function alcancePorCobrar(
  usuario: AuthenticatedUser,
): Prisma.OrdenWhereInput {
  return {
    anulada: false,
    tipoOperacion: "VENTA_CLIENTE",
    empleadoId: null,
    total: { gt: prisma.orden.fields.montoPagado },
    estado: {
      in: ["pendiente", "en_preparacion", "lista", "entregada", "cobrada"],
    },
    OR: [
      {
        tipoOrden: { in: ["local", "para_llevar"] },
        OR: [
          { creadorId: usuario.id },
          { creadorId: null, mesero: usuario.nombre },
        ],
      },
      { tipoOrden: "domicilio", metodoPagoPrevisto: "efectivo" },
    ],
  };
}

export function leerCursor(
  valor: string | null,
): { createdAt: Date; id: string } | null {
  if (!valor) return null;
  if (valor.length > 500) throw new Error("Cursor inválido");
  try {
    const cursor = JSON.parse(Buffer.from(valor, "base64url").toString("utf8"));
    const createdAt = new Date(cursor.createdAt);
    if (
      typeof cursor.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(cursor.id) ||
      !Number.isFinite(createdAt.getTime())
    )
      throw new Error();
    return { id: cursor.id, createdAt };
  } catch {
    throw new Error("Cursor inválido");
  }
}

export async function listarPorCobrar(
  usuario: AuthenticatedUser,
  cursor: ReturnType<typeof leerCursor>,
): Promise<OrdenesPorCobrar> {
  const where = alcancePorCobrar(usuario);
  return prisma.$transaction(
    async (tx) => {
      const [totalPendientes, filas, caja] = await Promise.all([
        tx.orden.count({ where }),
        tx.orden.findMany({
          where: {
            AND: [
              where,
              ...(cursor
                ? [
                    {
                      OR: [
                        { createdAt: { gt: cursor.createdAt } },
                        { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: {
            id: true,
            numeroDiario: true,
            fechaNumeroDiario: true,
            tipoOrden: true,
            tipoOperacion: true,
            numeroMesa: true,
            nombreCliente: true,
            telefonoCliente: true,
            mesero: true,
            creadorId: true,
            estado: true,
            cobrada: true,
            anulada: true,
            empleadoId: true,
            cobroUrl: true,
            total: true,
            montoPagado: true,
            costoEnvio: true,
            createdAt: true,
            items: {
              select: {
                cantidad: true,
                subtotal: true,
                nombreProducto: true,
                producto: { select: { nombre: true } },
              },
            },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 51,
        }),
        tx.sesionCaja.findUnique({
          where: { fecha: obtenerFechaEcuador() },
          select: { estado: true },
        }),
      ]);
      const pagina = filas.slice(0, 50);
      const ultima = pagina.at(-1);
      return {
        totalPendientes,
        consultadoAt: new Date().toISOString(),
        siguienteCursor:
          filas.length > 50 && ultima
            ? Buffer.from(
                JSON.stringify({
                  id: ultima.id,
                  createdAt: ultima.createdAt.toISOString(),
                }),
              ).toString("base64url")
            : null,
        ordenes: pagina.map((orden) => {
          const vista = presentarCobro(orden);
          let destino = `/ordenes/${encodeURIComponent(orden.id)}/cobrar`;
          let origen: "qr" | "lista" = "lista";
          if (orden.cobroUrl) {
            try {
              const pathname = new URL(orden.cobroUrl, "https://local.invalid")
                .pathname;
              if (/^\/ordenes\/cobrar\/[a-zA-Z0-9_-]+$/.test(pathname)) {
                destino = `${pathname}?origen=lista`;
                origen = "qr";
              }
            } catch {
              /* Una URL antigua inválida usa el cobro autenticado por ID. */
            }
          }
          const motivo =
            paymentBlockReason(orden, origen) ??
            (caja?.estado === "abierta"
              ? null
              : "La caja de hoy no está abierta");
          return {
            id: orden.id,
            numero: `#${orden.numeroDiario ?? orden.id.slice(-6)}${orden.fechaNumeroDiario ? ` · ${orden.fechaNumeroDiario}` : ""}`,
            titulo:
              orden.tipoOrden === "local"
                ? `Mesa ${orden.numeroMesa ?? "sin número"}`
                : orden.nombreCliente ||
                  (orden.tipoOrden === "domicilio"
                    ? "Domicilio"
                    : "Para llevar"),
            tipoOrden: orden.tipoOrden,
            estado: orden.estado,
            creador: orden.mesero,
            telefonoCliente: orden.telefonoCliente,
            createdAt: orden.createdAt.toISOString(),
            saldoPendiente: vista.saldo,
            importeEfectivo: vista.efectivo,
            explicacionEfectivo: vista.explicacionEfectivo,
            motivoBloqueoCobro: motivo,
            destinoCobro: motivo ? null : destino,
            puedeEditar:
              canUserModifyOrder(usuario, orden) && sePuedeEditar(orden),
            items: orden.items.map((item) => ({
              cantidad: item.cantidad,
              nombre: item.nombreProducto || item.producto.nombre,
            })),
          };
        }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
