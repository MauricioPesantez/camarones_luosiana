import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Crear productos
  const productos = [
    { nombre: 'Ceviche de Camarón', categoria: 'Entradas', precio: 8.5 },
    { nombre: 'Ceviche de Pescado', categoria: 'Entradas', precio: 7.0 },
    { nombre: 'Ceviche Mixto', categoria: 'Entradas', precio: 9.5 },
    { nombre: 'Arroz con Mariscos', categoria: 'Platos Fuertes', precio: 12.0 },
    { nombre: 'Corvina Frita', categoria: 'Platos Fuertes', precio: 14.0 },
    { nombre: 'Encocado de Camarón', categoria: 'Platos Fuertes', precio: 13.5 },
    { nombre: 'Cazuela de Mariscos', categoria: 'Platos Fuertes', precio: 15.0 },
    { nombre: 'Sudado de Pescado', categoria: 'Platos Fuertes', precio: 11.0 },
    { nombre: 'Arroz Blanco', categoria: 'Acompañamientos', precio: 2.0 },
    { nombre: 'Patacones', categoria: 'Acompañamientos', precio: 2.5 },
    { nombre: 'Coca Cola', categoria: 'Bebidas', precio: 1.5 },
    { nombre: 'Agua', categoria: 'Bebidas', precio: 1.0 },
    { nombre: 'Jugo Natural', categoria: 'Bebidas', precio: 2.5 },
  ];

  for (const producto of productos) {
    await prisma.producto.create({ data: producto });
  }

  // Crear mesas
  for (let i = 1; i <= 15; i++) {
    await prisma.mesa.create({
      data: {
        numero: i,
        capacidad: i <= 5 ? 2 : i <= 10 ? 4 : 6,
      },
    });
  }

  // Crear usuarios
  const usuarios = [
    { nombre: 'Juan Pérez', rol: 'mesero', password: null },
    { nombre: 'María García', rol: 'mesero', password: null },
    { nombre: 'Carlos López', rol: 'cocina', password: null },
    { nombre: 'Admin', rol: 'admin', password: 'admin123' }, // Contraseña por defecto
  ];

  for (const usuario of usuarios) {
    await prisma.usuario.create({ data: usuario });
  }

  console.log('Seed completado exitosamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
