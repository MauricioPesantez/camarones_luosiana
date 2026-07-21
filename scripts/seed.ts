/**
 * Seed de desarrollo: crea usuarios de prueba (claves hasheadas vía el caso de
 * uso, no en texto plano) y un catálogo mínimo de menú para poder ejercitar los
 * flujos localmente. Idempotente por `usuario` único y `nombre` de categoría.
 *
 * Ejecutar: `npx tsx scripts/seed.ts` (con Node ≥18 y el `.env` cargado).
 */
import { PrismaClient } from "@prisma/client";

import { Money } from "@/domain/order/Money";
import { Role } from "@/domain/user/Role";
import { getGestionarMenu, getGestionarUsuarios } from "@/infrastructure/di/container";

const prisma = new PrismaClient();

const USUARIOS = [
  { usuario: "admin", nombre: "Administrador", clave: "admin123", roles: [Role.ADMIN], puedeCobrar: true },
  { usuario: "mesero", nombre: "Mesero Uno", clave: "mesero123", roles: [Role.MESERO], puedeCobrar: false },
  { usuario: "cocina", nombre: "Cocina Uno", clave: "cocina123", roles: [Role.COCINA], puedeCobrar: false },
  { usuario: "operador", nombre: "Operador Uno", clave: "operador123", roles: [Role.OPERADOR], puedeCobrar: true },
];

async function seedUsuarios() {
  const uc = getGestionarUsuarios();
  for (const u of USUARIOS) {
    const r = await uc.crear(u);
    if (r.ok) {
      console.log(`  ✓ usuario ${u.usuario} (${u.roles.join(",")})`);
    } else if (r.error.code === "USER_USUARIO_DUPLICADO") {
      console.log(`  · usuario ${u.usuario} ya existía`);
    } else {
      console.log(`  ✗ usuario ${u.usuario}: ${r.error.message}`);
    }
  }
}

async function seedMenu() {
  const categoria = await prisma.category.upsert({
    where: { nombre: "Camarones" },
    update: {},
    create: { nombre: "Camarones" },
  });

  const uc = getGestionarMenu();
  const platos = [
    { nombre: "Ceviche de camarón", precio: 8.5, stockDelDia: 20 },
    { nombre: "Arroz con camarón", precio: 9.0, stockDelDia: 15 },
    { nombre: "Camarón apanado", precio: 10.0, stockDelDia: 12 },
  ];

  for (const p of platos) {
    const existe = await prisma.menuItem.findFirst({ where: { nombre: p.nombre } });
    if (existe) {
      console.log(`  · plato ${p.nombre} ya existía`);
      continue;
    }
    const r = await uc.crear({
      nombre: p.nombre,
      categoriaId: categoria.id,
      precio: Money.de(p.precio),
      fotoUrl: null,
      stockDelDia: p.stockDelDia,
      disponible: true,
    });
    console.log(r.ok ? `  ✓ plato ${p.nombre}` : `  ✗ plato ${p.nombre}: ${r.error.message}`);
  }
}

async function main() {
  console.log("Sembrando usuarios…");
  await seedUsuarios();
  console.log("Sembrando menú…");
  await seedMenu();
  console.log("\nListo. Credenciales de desarrollo:");
  for (const u of USUARIOS) console.log(`  ${u.usuario} / ${u.clave}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
