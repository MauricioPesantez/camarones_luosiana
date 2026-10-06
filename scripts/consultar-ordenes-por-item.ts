import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function formatoFecha(fecha: Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  }).format(fecha);
}

async function main() {
  const nombreItem = process.argv.slice(2).join(' ').trim();

  if (!nombreItem) {
    throw new Error('Uso: npm run consultar:ordenes-por-item -- "nombre del item"');
  }

  const ordenes = await prisma.orden.findMany({
    where: {
      tipoOrden: 'local',
      items: {
        some: {
          producto: {
            nombre: {
              contains: nombreItem,
              mode: 'insensitive',
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      numeroDiario: true,
      fechaNumeroDiario: true,
      tipoOrden: true,
      nombreCliente: true,
      mesero: true,
      estado: true,
      anulada: true,
      total: true,
      createdAt: true,
      items: {
        where: {
          producto: {
            nombre: {
              contains: nombreItem,
              mode: 'insensitive',
            },
          },
        },
        select: {
          cantidad: true,
          subtotal: true,
          producto: { select: { nombre: true } },
        },
      },
    },
  });

  if (ordenes.length === 0) {
    console.log(`No se encontraron órdenes locales con ítems que contengan: "${nombreItem}".`);
    return;
  }

  console.log(`Órdenes locales encontradas: ${ordenes.length}\n`);

  for (const orden of ordenes) {
    const numero = orden.numeroDiario && orden.fechaNumeroDiario
      ? `#${orden.numeroDiario} (${orden.fechaNumeroDiario})`
      : orden.id;
    const anulada = orden.anulada ? ' · ANULADA' : '';

    console.log(`${numero}${anulada}`);
    console.log(`  Creada: ${formatoFecha(orden.createdAt)} · ${orden.tipoOrden} · ${orden.estado}`);
    console.log(`  Cliente: ${orden.nombreCliente ?? '—'} · Mesero: ${orden.mesero}`);
    console.log(`  Total orden: $${orden.total.toFixed(2)}`);

    for (const item of orden.items) {
      console.log(`  - ${item.cantidad} × ${item.producto.nombre} ($${item.subtotal.toFixed(2)})`);
    }

    console.log();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
