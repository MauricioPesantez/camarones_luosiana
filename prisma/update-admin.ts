import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Buscar usuario admin
  const admin = await prisma.usuario.findFirst({
    where: { rol: 'admin' }
  });

  if (admin) {
    // Actualizar con contraseña
    await prisma.usuario.update({
      where: { id: admin.id },
      data: {
        password: 'admin123',
        nombre: 'Admin'
      }
    });
    console.log('✅ Usuario admin actualizado con contraseña: admin123');
  } else {
    // Crear usuario admin si no existe
    await prisma.usuario.create({
      data: {
        nombre: 'Admin',
        rol: 'admin',
        password: 'admin123',
        activo: true
      }
    });
    console.log('✅ Usuario admin creado con contraseña: admin123');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
