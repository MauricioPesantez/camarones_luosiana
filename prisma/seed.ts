import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Limpiando datos anteriores...');

  // Limpiar en orden por dependencias FK
  await prisma.historialOrden.deleteMany();
  await prisma.item.deleteMany();
  await prisma.orden.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.mesa.deleteMany();
  await prisma.usuario.deleteMany();

  console.log('✅ Datos anteriores eliminados\n');

  // --- PRODUCTOS: Seafood Boil ---
  const productos = [
    // Combos
    { nombre: 'Combo Simple', categoria: 'Combos', precio: 11.00, descripcion: 'Incluye camaron, camaron jumbo, huevo, papa, maiz dulce, limon y salsa louisiana.', stock: 99, stockMinimo: 0 },
    { nombre: 'Combo Duo', categoria: 'Combos', precio: 21.00, descripcion: 'Incluye camaron, camaron jumbo, huevo, papa, maiz dulce, limon y salsa louisiana.', stock: 99, stockMinimo: 0 },
    { nombre: 'Combo Triple', categoria: 'Combos', precio: 26.00, descripcion: 'Incluye camaron, camaron jumbo, huevo, papa, maiz dulce, limon y salsa louisiana.', stock: 99, stockMinimo: 0 },
    { nombre: 'Combo Mixto Small', categoria: 'Combos', precio: 13.50, descripcion: 'Incluye camaron, camaron jumbo, almeja, mejillon, langostino, chorizo, huevo, papas, y maiz dulce.', stock: 99, stockMinimo: 0 },
    { nombre: 'Combo Mixto Duo', categoria: 'Combos', precio: 27.00, descripcion: 'Incluye camaron, camaron jumbo, almeja, mejillon, langostino, chorizo, huevo, papas, y maiz dulce.', stock: 99, stockMinimo: 0 },
    { nombre: 'Combo Mixto Triple', categoria: 'Combos', precio: 37.00, descripcion: 'Incluye camaron, camaron jumbo, almeja, mejillon, langostino, chorizo, huevo, papas, y maiz dulce.', stock: 99, stockMinimo: 0 },
    // Extras
    { nombre: '1/2 Libra Langostinos', categoria: 'Extras', precio: 4.00, stock: 99, stockMinimo: 0 },
    { nombre: 'Libra de Langostinos', categoria: 'Extras', precio: 7.00, stock: 99, stockMinimo: 0 },
    { nombre: '1/2 Libra Mejillones/Almeja', categoria: 'Extras', precio: 2.50, stock: 99, stockMinimo: 0 },
    { nombre: 'Libra Mejillones/Almeja', categoria: 'Extras', precio: 3.50, stock: 99, stockMinimo: 0 },
    { nombre: 'Cangrejo', categoria: 'Extras', precio: 2.50, stock: 99, stockMinimo: 0 },
    { nombre: '3 Cangrejos', categoria: 'Extras', precio: 7.00, stock: 99, stockMinimo: 0 },
    { nombre: 'Tentaculos 120 Gramos', categoria: 'Extras', precio: 2.50, stock: 99, stockMinimo: 0 },
    { nombre: 'Chorizo', categoria: 'Extras', precio: 1.75, stock: 99, stockMinimo: 0 },
    { nombre: '3 Huevos', categoria: 'Extras', precio: 1.25, stock: 99, stockMinimo: 0 },
    { nombre: 'Calamar 120 Gramos', categoria: 'Extras', precio: 1.75, stock: 99, stockMinimo: 0 },
    { nombre: 'Papas Fritas', categoria: 'Extras', precio: 2.00, stock: 99, stockMinimo: 0 },
    { nombre: 'Patacones', categoria: 'Extras', precio: 2.00, stock: 99, stockMinimo: 0 },
    { nombre: 'Arroz', categoria: 'Extras', precio: 1.50, stock: 99, stockMinimo: 0 },
    { nombre: 'Maiz Dulce', categoria: 'Extras', precio: 2.00, stock: 99, stockMinimo: 0 },
  ];

  for (const p of productos) {
    await prisma.producto.create({ data: { ...p, disponible: true } });
    console.log(`✅ Producto: [${p.categoria}] ${p.nombre} - $${p.precio}`);
  }

  // --- MESAS ---
  for (let i = 1; i <= 15; i++) {
    await prisma.mesa.create({
      data: { numero: i, capacidad: i <= 5 ? 2 : i <= 10 ? 4 : 6 },
    });
  }
  console.log('\n✅ 15 mesas creadas');

  // --- USUARIOS ---
  const usuarios = [
    { nombre: 'Juan Pérez', rol: 'mesero', password: null },
    { nombre: 'María García', rol: 'mesero', password: null },
    { nombre: 'Carlos López', rol: 'cocina', password: null },
    { nombre: 'Admin', rol: 'admin', password: 'admin123' },
  ];

  for (const u of usuarios) {
    await prisma.usuario.create({ data: u });
  }
  console.log('✅ Usuarios creados');

  console.log('\n🎉 Seed completado exitosamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
