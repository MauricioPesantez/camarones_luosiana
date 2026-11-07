import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AccountError, appendEmployeeMovement, lockEmployeeAccount, requestHash } from '@/lib/employee-account';
import type { AuthenticatedUser } from '@/lib/session';
import { allocateDailyOrderNumber } from '@/lib/daily-order-number';
import { buildEmployeeConsumptionLines } from '@/lib/employee-print';
import { hasOnlyConsumptionActionFields, remainingConsumptionQuantities } from '@/lib/employee-consumption-validation';
import { calcularRecargoEnvases, esCategoriaCombo, esNivelPicante, RECARGO_RECIPIENTES } from '@/types/orden';

const include = { items: { include: { producto: true } } } satisfies Prisma.OrdenInclude;
const validKey = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 150;
const fail = (message: string, status = 400): never => { throw new AccountError(message, status); };
const decimal = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);
const txOptions = { timeout: 20000 };

type CreateBody = { clientRequestId: string; empleadoId: string; tipoOrden: 'local' | 'para_llevar'; items: { productoId: string; cantidad: number; nivelPicante?: string; precioEsperado: number }[]; observaciones?: string };
type Correction = { itemId: string; cantidad: number; reponerStock: boolean; devolverEnvase: boolean };
type ChangeBody = { clientRequestId: string; razon?: string; reponerStock?: boolean; expectedRevision?: number; items?: Correction[]; nuevoEmpleadoId?: string };
type ChangeType = 'entregar' | 'anular' | 'corregir';

export async function createConsumption(body: CreateBody, actor: AuthenticatedUser) {
  if (!['admin', 'mesero'].includes(actor.rol)) fail('No autorizado', 403);
  if (!validKey(body?.clientRequestId) || !validKey(body.empleadoId) || !['local', 'para_llevar'].includes(body.tipoOrden) || !Array.isArray(body.items) || !body.items.length || body.items.length > 100 || (body.observaciones != null && (typeof body.observaciones !== 'string' || body.observaciones.length > 1000))) fail('Datos de consumo inválidos');
  if (body.items.some(i => !i || typeof i !== 'object' || !validKey(i.productoId) || !Number.isSafeInteger(i.cantidad) || i.cantidad < 1 || i.cantidad > 10000 || typeof i.precioEsperado !== 'number' || !Number.isFinite(i.precioEsperado) || i.precioEsperado <= 0 || !decimal(i.precioEsperado).mul(100).isInteger())) fail('Productos o precios inválidos');
  const hash = requestHash(body);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consumo-create:${body.clientRequestId}`}))`;
    const existing = await tx.orden.findUnique({ where: { consumoRequestId: body.clientRequestId }, include });
    if (existing) {
      if (existing.consumoRequestHash !== hash || existing.creadorId !== actor.id) fail('La clave de solicitud ya fue utilizada', 409);
      return { orden: existing, replay: true, printJobQueued: false, receiptLines: null };
    }
    const empleado = await lockEmployeeAccount(tx, body.empleadoId);
    const now = new Date();
    const daily = await allocateDailyOrderNumber(tx, now);
    const ids = [...new Set(body.items.map(i => i.productoId))].sort();
    // Deterministic product locking makes stock checks and prices one atomic snapshot.
    for (const id of ids) await tx.$queryRaw`SELECT id FROM "Producto" WHERE id = ${id} FOR UPDATE`;
    const products = await tx.producto.findMany({ where: { id: { in: ids } } });
    const map = new Map(products.map(p => [p.id, p]));
    const counts = new Map<string, number>();
    let subtotal = decimal(0);
    const data = body.items.map(i => {
      const p = map.get(i.productoId);
      if (!p || !p.disponible || p.precioEmpleado == null) return fail('Producto no habilitado para consumo', 409);
      if (p.precioEmpleado.lte(0) || p.precioEmpleado.gt(p.precio)) return fail(`El precio para empleados de ${p.nombre} no es válido`, 409);
      if (!p.precioEmpleado.equals(i.precioEsperado)) return fail(`El precio de ${p.nombre} cambió; actualice el catálogo`, 409);
      if (esCategoriaCombo(p.categoria) && !esNivelPicante(i.nivelPicante)) return fail(`Seleccione el picante de ${p.nombre}`);
      counts.set(p.id, (counts.get(p.id) ?? 0) + i.cantidad);
      const itemSubtotal = p.precioEmpleado.mul(i.cantidad);
      subtotal = subtotal.add(itemSubtotal);
      return { productoId: p.id, nombreProducto: p.nombre, precioCarta: p.precio, cantidad: i.cantidad, precioUnitario: p.precioEmpleado, subtotal: itemSubtotal, nivelPicante: esCategoriaCombo(p.categoria) ? i.nivelPicante : null };
    });
    for (const [id, quantity] of counts) {
      const result = await tx.producto.updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
      if (result.count !== 1) fail('Stock insuficiente o modificado; actualice el catálogo', 409);
    }
    const recargo = calcularRecargoEnvases(body.tipoOrden, body.items.map(i => ({ cantidad: i.cantidad, categoria: map.get(i.productoId)!.categoria })));
    const total = subtotal.add(recargo);
    if (total.gte(100000000)) fail('El total del consumo excede el límite permitido');
    const orden = await tx.orden.create({ data: {
      numeroDiario: daily.number, fechaNumeroDiario: daily.dateKey, createdAt: now,
      tipoOperacion: 'CONSUMO_EMPLEADO', consumoRequestId: body.clientRequestId, consumoRequestHash: hash,
      empleadoId: empleado.id, empleadoNombre: empleado.nombre, tipoOrden: body.tipoOrden,
      nombreCliente: empleado.nombre, mesero: actor.nombre, creadorId: actor.id, creadorRol: actor.rol,
      observaciones: body.observaciones?.trim() || null, estado: 'entregada',
      total, recargo: recargo || null, items: { create: data },
    }, include });
    const receiptLines = buildEmployeeConsumptionLines(orden);
    await tx.historialOrden.create({ data: { ordenId: orden.id, tipoAccion: 'consumo_creado', descripcion: 'Consumo de empleado registrado', usuarioNombre: actor.nombre, usuarioRol: actor.rol, datosDespues: { empleadoId: empleado.id, empleadoNombre: empleado.nombre, receiptLines, items: orden.items.map(i => ({ itemId: i.id, envase: body.tipoOrden === 'para_llevar' && esCategoriaCombo(map.get(i.productoId)!.categoria) })) } } });
    await appendEmployeeMovement(tx, { empleadoId: empleado.id, tipo: 'CONSUMO', monto: total, motivo: 'Consumo entregado', autor: actor, origenClave: `consumo:${orden.id}`, idempotencyKey: `consumo:${orden.id}`, ordenId: orden.id });
    return { orden, replay: false, printJobQueued: false, receiptLines };
  }, txOptions);
}

export async function changeConsumption(id: string, action: ChangeType, body: ChangeBody, actor: AuthenticatedUser) {
  if (action === 'entregar' ? !['admin', 'mesero'].includes(actor.rol) : actor.rol !== 'admin') fail('No autorizado', 403);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !validKey(id) || !validKey(body.clientRequestId)) fail('Solicitud inválida');
  if (!hasOnlyConsumptionActionFields(action, body)) fail('La solicitud contiene campos no permitidos');
  if (action !== 'entregar' && (typeof body.razon !== 'string' || !body.razon.trim() || body.razon.length > 1000)) fail('La razón es obligatoria');
  if (action === 'entregar' && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision! < 0)) fail('La revisión es obligatoria');
  if (action === 'anular' && typeof body.reponerStock !== 'boolean') fail('Indique si se repone el stock');
  if (action === 'corregir' && ((body.items !== undefined && !Array.isArray(body.items)) || (body.nuevoEmpleadoId !== undefined && !validKey(body.nuevoEmpleadoId)))) fail('Correcciones inválidas');
  if (action === 'corregir' && ((!Array.isArray(body.items) || !body.items.length) && !validKey(body.nuevoEmpleadoId))) fail('Indique productos o un nuevo empleado');
  if (body.items && (body.items.length > 100 || body.items.some(i => !i || typeof i !== 'object' || !validKey(i.itemId) || !Number.isSafeInteger(i.cantidad) || i.cantidad < 1 || typeof i.reponerStock !== 'boolean' || typeof i.devolverEnvase !== 'boolean') || new Set(body.items.map(i => i.itemId)).size !== body.items.length)) fail('Correcciones inválidas');
  const hash = requestHash({ id, action, body, actorId: actor.id });
  const key = `consumo-action:${body.clientRequestId}`;
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const previous = await tx.historialOrden.findFirst({ where: { datosDespues: { path: ['requestKey'], equals: key } } });
    if (previous) {
      const data = previous.datosDespues as { requestHash?: string };
      if (data.requestHash !== hash) fail('La clave de solicitud ya fue utilizada', 409);
      const order = await tx.orden.findUnique({ where: { id }, include });
      return { orden: order, replay: true, receiptLines: null };
    }
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Orden" WHERE id = ${id} FOR UPDATE`;
    if (!locked.length) fail('Consumo no encontrado', 404);
    const order = await tx.orden.findUniqueOrThrow({ where: { id }, include: { ...include, historial: { orderBy: { createdAt: 'asc' } } } });
    if (order.tipoOperacion !== 'CONSUMO_EMPLEADO') fail('Consumo no encontrado', 404);
    if (action === 'entregar' && actor.rol !== 'admin' && order.creadorId !== actor.id) fail('No autorizado para entregar este consumo', 403);
    if (order.anulada) fail('El consumo ya está anulado', 409);
    if (action === 'anular' && order.estado === 'entregada') fail('El consumo ya fue entregado; use una corrección para indicar productos y envases devueltos', 409);
    if (action === 'corregir' && order.estado !== 'entregada') fail('Antes de la entrega, anule y registre nuevamente el consumo', 409);
    if (!order.empleadoId) fail('El consumo no tiene beneficiario', 409);
    if (action === 'entregar') {
      if (order.printRevision !== body.expectedRevision) fail('El consumo cambió; actualice la revisión', 409);
      if (order.estado !== 'entregada') fail('El consumo anterior requiere regularización administrativa', 409);
      await tx.historialOrden.create({ data: { ordenId: id, tipoAccion: 'consumo_entrega_confirmada', descripcion: 'Entrega ya registrada confirmada sin nuevos efectos', usuarioNombre: actor.nombre, usuarioRol: actor.rol, datosDespues: { requestKey: key, requestHash: hash } } });
      return { orden: order, replay: false, receiptLines: null };
    }
    const employeeId = order.empleadoId!;
    const creation = order.historial.find(h => h.tipoAccion === 'consumo_creado')?.datosDespues as { items?: { itemId: string; envase: boolean }[] } | null;
    if (!creation?.items) fail('Faltan datos históricos del consumo', 409);
    const prior = order.historial.filter(h => h.tipoAccion === 'consumo_corregido').flatMap(h => ((h.datosDespues as { items?: Correction[] } | null)?.items ?? []));
    const remaining = order.items.map(item => {
      const corrections = prior.filter(c => c.itemId === item.id);
      const { quantity, containers } = remainingConsumptionQuantities(item.cantidad, Boolean(creation!.items!.find(i => i.itemId === item.id)?.envase), corrections);
      return { item, qty: quantity, envases: containers };
    });
    const selected: Correction[] = action === 'anular' ? remaining.filter(x => x.qty > 0).map(x => ({ itemId: x.item.id, cantidad: x.qty, reponerStock: body.reponerStock!, devolverEnvase: false })) : (body.items ?? []);
    let credit = decimal(0);
    for (const c of selected) {
      const row = remaining.find(x => x.item.id === c.itemId);
      if (!row || c.cantidad > row.qty || (c.devolverEnvase && c.cantidad > row.envases)) fail('La devolución supera las cantidades disponibles', 409);
      credit = credit.add(row!.item.precioUnitario.mul(c.cantidad)).add(c.devolverEnvase ? decimal(RECARGO_RECIPIENTES).mul(c.cantidad) : 0);
    }
    // Containers returned independently of products remain chargeable until cancellation.
    const remainingValue = remaining.reduce((n, row) => n.add(row.item.precioUnitario.mul(row.qty)).add(decimal(RECARGO_RECIPIENTES).mul(row.envases)), decimal(0));
    const accountIds = [...new Set([employeeId, ...(body.nuevoEmpleadoId ? [body.nuevoEmpleadoId] : [])])].sort();
    for (const employeeId of accountIds) await lockEmployeeAccount(tx, employeeId, employeeId === body.nuevoEmpleadoId);
    const delivered = order.estado === 'entregada';
    const target = body.nuevoEmpleadoId && body.nuevoEmpleadoId !== order.empleadoId ? body.nuevoEmpleadoId : null;
    const transfer = remainingValue.sub(credit);
    const needsOrigin = delivered && (credit.gt(0) || (target && transfer.gt(0)));
    const original = needsOrigin ? await tx.movimientoCuentaEmpleado.findFirst({ where: { ordenId: id, empleadoId: employeeId, tipo: 'CONSUMO' }, orderBy: { secuencia: 'desc' } }) : null;
    if (needsOrigin && !original) fail('Falta el cargo original del beneficiario actual', 409);
    const base = { autor: actor, ordenId: id, motivo: body.razon?.trim() || 'Consumo entregado' };
    if (delivered && credit.gt(0)) await appendEmployeeMovement(tx, { ...base, empleadoId: employeeId, tipo: 'REVERSO_CONSUMO', monto: credit.neg(), origenClave: `${key}:reverso`, idempotencyKey: `${key}:reverso`, requireActive: false, movimientoOrigenId: original?.id, detalle: { items: selected } });
    if (action === 'corregir' && target && delivered && transfer.gt(0)) {
      await appendEmployeeMovement(tx, { ...base, empleadoId: employeeId, tipo: 'REVERSO_CONSUMO', monto: transfer.neg(), origenClave: `${key}:traslado-salida`, idempotencyKey: `${key}:traslado-salida`, requireActive: false, movimientoOrigenId: original?.id });
      await appendEmployeeMovement(tx, { ...base, empleadoId: target, tipo: 'CONSUMO', monto: transfer, origenClave: `${key}:traslado-entrada`, idempotencyKey: `${key}:traslado-entrada` });
    }
    for (const c of selected) if (c.reponerStock) { const item = order.items.find(i => i.id === c.itemId)!; await tx.producto.update({ where: { id: item.productoId }, data: { stock: { increment: c.cantidad } } }); }
    if (action === 'anular') await tx.printJob.updateMany({ where: { ordenId: id, type: { in: ['ORDER', 'AMENDMENT', 'REPRINT'] }, status: { in: ['PENDING', 'RETRY', 'NEEDS_REVIEW'] } }, data: { status: 'DISCARDED', reviewedAt: new Date(), reviewedBy: actor.nombre, reviewReason: `Consumo anulado: ${body.razon!.trim()}` } });
    const targetEmployee = target ? await tx.usuario.findUniqueOrThrow({ where: { id: target } }) : null;
    const updated = await tx.orden.update({ where: { id }, data: {
      ...(action === 'anular' ? { anulada: true, anuladaAt: new Date(), anuladaPorId: actor.id, anuladaPorNombre: actor.nombre, razonAnulacion: body.razon!.trim(), stockRestituido: body.reponerStock && prior.every(c => c.reponerStock) } : {}),
      ...(targetEmployee ? { empleadoId: targetEmployee.id, empleadoNombre: targetEmployee.nombre } : {}),
      printRevision: { increment: 1 },
    }, include });
    const receiptLines = null;
    await tx.historialOrden.create({ data: { ordenId: id, tipoAccion: action === 'anular' ? 'consumo_anulado' : 'consumo_corregido', descripcion: `Consumo ${action}`, razon: body.razon?.trim(), usuarioNombre: actor.nombre, usuarioRol: actor.rol, datosDespues: { requestKey: key, requestHash: hash, receiptLines, items: selected, empleadoAnteriorId: order.empleadoId, empleadoNuevoId: target }, diferenciaTotal: credit.neg() } });
    return { orden: updated, replay: false, receiptLines };
  }, txOptions);
}
