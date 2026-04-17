import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const bebidas = [
  { nombre: 'Agua con Gas Personal', categoria: 'Bebidas', precio: 1.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 0 },
  { nombre: 'Jugo Natural de Mora', categoria: 'Bebidas', precio: 1.50, stock: 99, stockMinimo: 0, tiempoPreparacion: 3 },
  { nombre: 'Jugo Natural de Frutos Rojos', categoria: 'Bebidas', precio: 1.50, stock: 99, stockMinimo: 0, tiempoPreparacion: 3 },
  { nombre: 'Jugo Natural de Piña', categoria: 'Bebidas', precio: 1.50, stock: 99, stockMinimo: 0, tiempoPreparacion: 3 },
  { nombre: 'Jugo Natural de Fresa', categoria: 'Bebidas', precio: 1.50, stock: 99, stockMinimo: 0, tiempoPreparacion: 3 },
  { nombre: 'Jarra de Jugo de Mora', categoria: 'Bebidas', precio: 4.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 5 },
  { nombre: 'Jarra de Jugo de Frutos Rojos', categoria: 'Bebidas', precio: 4.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 5 },
  { nombre: 'Jarra de Jugo de Piña', categoria: 'Bebidas', precio: 4.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 5 },
  { nombre: 'Jarra de Jugo de Fresa', categoria: 'Bebidas', precio: 4.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 5 },
  { nombre: 'Gaseosa Personal Coca', categoria: 'Bebidas', precio: 0.75, stock: 99, stockMinimo: 0, tiempoPreparacion: 0 },
  { nombre: 'Gaseosa Personal Sprite', categoria: 'Bebidas', precio: 0.75, stock: 99, stockMinimo: 0, tiempoPreparacion: 0 },
  { nombre: 'Gaseosa Mediana', categoria: 'Bebidas', precio: 1.50, stock: 99, stockMinimo: 0, tiempoPreparacion: 0 },
  { nombre: 'Gaseosa 1.35L', categoria: 'Bebidas', precio: 2.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 0 },
  { nombre: 'Jarra de Vino Hervido', categoria: 'Bebidas', precio: 8.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 5 },
  { nombre: 'Media Jarra de Canelazo', categoria: 'Bebidas', precio: 3.00, stock: 99, stockMinimo: 0, tiempoPreparacion: 5 },
];

async function main() {
  console.log('🥤 Agregando bebidas...\n');

  for (const b of bebidas) {
    // Si ya existe con ese nombre, saltar
    const existente = await prisma.producto.findFirst({ where: { nombre: b.nombre } });
    if (existente) {
      console.log(`⏭️  Ya existe: ${b.nombre}`);
      continue;
    }
    await prisma.producto.create({ data: { ...b, disponible: true } });
    console.log(`✅ Creado: ${b.nombre} - $${b.precio}`);
  }

  console.log('\n🎉 Bebidas agregadas exitosamente');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
