import type { Role as PrismaRole } from "@prisma/client";

import { UserRepository } from "@/application/ports/UserRepository";
import { User } from "@/domain/user/User";

import { PrismaClientLike } from "../client";
import { toUserDomain } from "../mappers";
import { prisma } from "../prisma";

/**
 * Implementación Prisma del puerto `UserRepository`.
 *
 * Mapea el arreglo de roles (`Role[]`) del esquema al arreglo de roles del
 * dominio (cuyos valores coinciden con el enum de Prisma).
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  async porUsuario(usuario: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { usuario } });
    return row ? toUserDomain(row) : null;
  }

  async obtener(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toUserDomain(row) : null;
  }

  async listar(): Promise<User[]> {
    const rows = await this.db.user.findMany({ orderBy: { nombre: "asc" } });
    return rows.map(toUserDomain);
  }

  async guardar(u: User): Promise<void> {
    const roles = u.roles.map((r) => r as PrismaRole);
    const data = {
      usuario: u.usuario,
      claveHash: u.claveHash,
      nombre: u.nombre,
      roles,
      puedeCobrar: u.puedeCobrar,
      activo: u.activo,
    };
    await this.db.user.upsert({
      where: { id: u.id },
      create: { id: u.id, ...data },
      update: data,
    });
  }
}
