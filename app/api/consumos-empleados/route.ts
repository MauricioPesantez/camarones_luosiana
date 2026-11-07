import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AccountError } from '@/lib/employee-account';
import { createConsumption } from '@/lib/employee-consumption';


export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  try {
    if (new URL(request.url).searchParams.get('catalogo') === '1') {
      if (!['admin', 'mesero'].includes(user.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      const [productos, empleados] = await Promise.all([
        prisma.producto.findMany({ where: { disponible: true, precioEmpleado: { not: null } }, select: { id: true, nombre: true, categoria: true, precioEmpleado: true, precio: true, disponible: true, stock: true, requierePreparacionEmpleado: true }, orderBy: { nombre: 'asc' } }),
        prisma.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true, cuentaActivadaAt: true }, orderBy: { nombre: 'asc' } }),
      ]);
      return NextResponse.json({ productos, empleados });
    }
    const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const consumos = await prisma.orden.findMany({ where: { tipoOperacion: 'CONSUMO_EMPLEADO', ...(user.rol === 'admin' ? {} : { OR: [{ creadorId: user.id }, { empleadoId: user.id }] }), AND: [{ OR: [{ estado: { in: ['pendiente', 'en_preparacion', 'lista'] }, anulada: false }, { createdAt: { gte: recent } }] }] }, include: { items: { include: { producto: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ consumos });
  } catch (error) { console.error('Error al consultar consumos', error); return NextResponse.json({ error: 'No se pudieron consultar los consumos' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (!['admin', 'mesero'].includes(user.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const result = await createConsumption(await request.json(), user);
    const { orden, replay } = result;
    return NextResponse.json({ orden, replay, printJobQueued: false, impresion: null, impresionComanda: null }, { status: replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    console.error('Error al registrar consumo', error); return NextResponse.json({ error: 'No se pudo registrar el consumo' }, { status: 500 });
  }
}
