import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tiempos de preparación por producto (en minutos)
const tiemposProductos: Record<string, number> = {
  // Entradas (5-10 minutos)
  'Ceviche de Camarón': 8,
  'Ceviche de Pescado': 8,
  'Ceviche Mixto': 10,

  // Platos Fuertes (15-30 minutos)
  'Arroz con Mariscos': 30,
  'Corvina Frita': 20,
  'Encocado de Camarón': 25,
  'Cazuela de Mariscos': 28,
  'Sudado de Pescado': 22,

  // Acompañamientos (10-20 minutos)
  'Arroz Blanco': 15,
  'Patacones': 10,

  // Bebidas (0-2 minutos)
  'Coca Cola': 1,
  'Agua': 1,
  'Jugo Natural': 2,
};

async function main() {
  console.log('🕐 Actualizando tiempos de preparación de productos...\n');

  const productos = await prisma.producto.findMany();

  for (const producto of productos) {
    const tiempoPreparacion = tiemposProductos[producto.nombre] || 0;

    await prisma.producto.update({
      where: { id: producto.id },
      data: { tiempoPreparacion },
    });

    console.log(`✅ ${producto.nombre.padEnd(25)} → ${tiempoPreparacion} minutos`);
  }

  console.log('\n✨ Todos los productos han sido actualizados con sus tiempos de preparación');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
