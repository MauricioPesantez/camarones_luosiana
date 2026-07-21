import { CajaRepository } from "@/application/ports/CajaRepository";
import { CajaEstado } from "@/domain/caja/CajaEstado";
import { CajaSession } from "@/domain/caja/CajaSession";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";

import { PrismaClientLike } from "../client";
import {
  moneyToDecimal,
  moneyToDecimalOrNull,
  toCajaSessionDomain,
  toMovimientoCajaDomain,
} from "../mappers";
import { prisma } from "../prisma";

/**
 * Implementación Prisma del puerto `CajaRepository`.
 *
 * Acepta un cliente Prisma (singleton o transaccional) para participar en una
 * unidad de trabajo: el cobro de una orden crea sus `MovimientoCaja` y cambia
 * el estado de la orden en la misma transacción (Property 7; R11.1, R11.2).
 */
export class PrismaCajaRepository implements CajaRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  async sesionAbierta(): Promise<CajaSession | null> {
    const row = await this.db.cajaSession.findFirst({
      where: { estado: CajaEstado.ABIERTA },
      orderBy: { createdAt: "desc" },
    });
    return row ? toCajaSessionDomain(row) : null;
  }

  async crearSesion(s: CajaSession): Promise<CajaSession> {
    const row = await this.db.cajaSession.create({
      data: {
        id: s.id,
        fecha: s.fecha,
        fondoInicial: moneyToDecimal(s.fondoInicial),
        estado: s.estado,
        efectivoContado: moneyToDecimalOrNull(s.efectivoContado),
        diferencia: moneyToDecimalOrNull(s.diferencia),
        firmadoPorId: s.firmadoPorId,
        closedAt: s.closedAt,
      },
    });
    return toCajaSessionDomain(row);
  }

  /**
   * Agrega un movimiento (evento de dinero inmutable, Property 5). El monto se
   * persiste con su signo: positivo para ingresos, negativo para egresos.
   */
  async agregarMovimiento(m: MovimientoCaja): Promise<void> {
    await this.db.movimientoCaja.create({
      data: {
        id: m.id,
        sesionId: m.sesionId,
        tipo: m.tipo,
        libro: m.libro,
        monto: moneyToDecimal(m.monto),
        orderId: m.orderId,
        categoria: m.categoria,
        esCarreraPassthrough: m.esCarreraPassthrough,
        empleadoId: m.empleadoId,
        nota: m.nota,
        timestamp: m.timestamp,
      },
    });
  }

  async movimientosDeSesion(sesionId: string): Promise<MovimientoCaja[]> {
    const rows = await this.db.movimientoCaja.findMany({
      where: { sesionId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map(toMovimientoCajaDomain);
  }

  /**
   * Marca la sesión como cerrada y persiste los datos de cuadre
   * (`efectivoContado`, `diferencia`, `firmadoPorId`, `closedAt`). Una sesión
   * cerrada bloquea la edición de sus movimientos (Property 5; R13).
   */
  async cerrarSesion(s: CajaSession): Promise<void> {
    await this.db.cajaSession.update({
      where: { id: s.id },
      data: {
        estado: s.estado,
        efectivoContado: moneyToDecimalOrNull(s.efectivoContado),
        diferencia: moneyToDecimalOrNull(s.diferencia),
        firmadoPorId: s.firmadoPorId,
        closedAt: s.closedAt,
      },
    });
  }
}
