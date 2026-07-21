import { Prisma } from "@prisma/client";

import { AuditFiltro, AuditRepository } from "@/application/ports/AuditRepository";
import { AuditEntry } from "@/domain/audit/AuditEntry";

import { PrismaClientLike } from "../client";
import { toAuditEntryDomain } from "../mappers";
import { prisma } from "../prisma";

/**
 * Implementación Prisma del puerto `AuditRepository` (R16).
 *
 * Las entradas son inmutables: solo se crean y se consultan. El campo
 * `detalle` (JSON libre) se persiste como `Prisma.JsonNull` cuando es nulo.
 */
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  async registrar(entry: AuditEntry): Promise<void> {
    await this.db.auditEntry.create({
      data: {
        id: entry.id,
        usuarioId: entry.usuarioId,
        accion: entry.accion,
        entidadTipo: entry.entidadTipo,
        entidadId: entry.entidadId,
        detalle:
          entry.detalle === null
            ? Prisma.JsonNull
            : (entry.detalle as Prisma.InputJsonValue),
        timestamp: entry.timestamp,
      },
    });
  }

  async listar(filtro?: AuditFiltro): Promise<AuditEntry[]> {
    const where: Prisma.AuditEntryWhereInput = {};

    if (filtro?.usuarioId) {
      where.usuarioId = filtro.usuarioId;
    }
    if (filtro?.accion) {
      where.accion = filtro.accion;
    }
    if (filtro?.entidadTipo) {
      where.entidadTipo = filtro.entidadTipo;
    }
    if (filtro?.desde || filtro?.hasta) {
      where.timestamp = {
        ...(filtro.desde ? { gte: filtro.desde } : {}),
        ...(filtro.hasta ? { lte: filtro.hasta } : {}),
      };
    }

    const rows = await this.db.auditEntry.findMany({
      where,
      orderBy: { timestamp: "desc" },
    });
    return rows.map(toAuditEntryDomain);
  }
}
