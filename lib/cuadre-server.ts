import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizarNombre } from "@/lib/admin-validaciones";
import { CAJA_SELECT, serializarCaja } from "@/lib/caja";
import { isConfirmedPaymentInRange } from "@/lib/cuadre-date";
import { ZONA_HORARIA, obtenerRangoEcuador } from "@/lib/fecha-ecuador";
import { RETIRO_SELECT, serializarRetiro } from "@/lib/retiros";

/**
 * Fuente unica del cuadre diario. La API administrativa y el cierre de caja
 * consumen exactamente los mismos movimientos y la misma frontera horaria.
 */
type ClienteCuadre = Pick<
  Prisma.TransactionClient,
  "orden" | "usuario" | "retiroCaja" | "sesionCaja"
>;

export async function obtenerDatosCuadre(
  fecha: string,
  db: ClienteCuadre = prisma,
) {
  const rango = obtenerRangoEcuador(fecha);
  if (!rango) return null;

  const [ordenes, usuarios, retiros, caja] = await Promise.all([
    db.orden.findMany({
      where: {
        OR: [
          { createdAt: { gte: rango.inicio, lt: rango.fin } },
          { fechaCobro: { gte: rango.inicio, lt: rango.fin } },
          {
            pagos: {
              some: { createdAt: { gte: rango.inicio, lt: rango.fin } },
            },
          },
        ],
      },
      include: {
        pagos: {
          select: {
            id: true,
            createdAt: true,
            estado: true,
            metodoPago: true,
            monto: true,
            comprobanteTransferenciaKey: true,
            origen: true,
          },
        },
        creador: { select: { id: true, nombre: true, rol: true } },
        items: { include: { producto: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.usuario.findMany({
      select: { id: true, nombre: true, rol: true },
    }),
    db.retiroCaja.findMany({
      where: { createdAt: { gte: rango.inicio, lt: rango.fin } },
      select: RETIRO_SELECT,
      orderBy: { createdAt: "desc" },
    }),
    db.sesionCaja.findUnique({
      where: { fecha },
      select: CAJA_SELECT,
    }),
  ]);

  const usuariosPorNombre = new Map(
    usuarios.map((usuario) => [normalizarNombre(usuario.nombre), usuario]),
  );
  const ordenesConCreador = ordenes.map((orden) => {
    const creadorInferido = usuariosPorNombre.get(
      normalizarNombre(orden.mesero),
    );
    const cobradaEnFecha = isConfirmedPaymentInRange(orden, rango);
    const {
      cobroTokenHash: _privateTokenHash,
      pagos: _privatePayments,
      ...safeOrder
    } = orden;
    void _privateTokenHash;

    return {
      ...safeOrder,
      cobrada: cobradaEnFecha,
      metodoPago: cobradaEnFecha ? orden.metodoPago : null,
      fechaCobro: cobradaEnFecha ? orden.fechaCobro : null,
      estadoCobro:
        _privatePayments.find((pago) => pago.estado !== "CONFIRMADO")?.estado ??
        _privatePayments[0]?.estado ??
        null,
      pagos: _privatePayments
        .filter((pago) => pago.estado !== "REEMBOLSADO")
        .map((pago) => ({
          id: pago.id,
          metodoPago: pago.metodoPago,
          monto: Number(pago.monto),
          comprobanteTransferenciaKey: pago.comprobanteTransferenciaKey,
          origen: pago.origen,
          estado: pago.estado,
          enRango:
            pago.createdAt >= rango.inicio && pago.createdAt < rango.fin,
        })),
      creadorNombre:
        orden.creador?.nombre ?? creadorInferido?.nombre ?? orden.mesero,
      creadorRol:
        orden.creadorRol ??
        orden.creador?.rol ??
        creadorInferido?.rol ??
        "desconocido",
    };
  });

  return {
    fecha,
    zonaHoraria: ZONA_HORARIA,
    ordenes: ordenesConCreador,
    retiros: retiros.map(serializarRetiro),
    caja: caja ? serializarCaja(caja) : null,
  };
}
