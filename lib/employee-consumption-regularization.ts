import { Prisma, PrismaClient } from '@prisma/client';
import { appendEmployeeMovement, requestHash, type AccountActor } from './employee-account';
import { buildHistoricalConsumptionLines } from './employee-print';

const states = ['pendiente', 'en_preparacion', 'lista'];
const include = { items: { orderBy: { id: 'asc' as const } }, historial: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] }, movimientosCuenta: { orderBy: { id: 'asc' as const } }, printJobs: { orderBy: { id: 'asc' as const } } } satisfies Prisma.OrdenInclude;
type HistoricalOrder = Prisma.OrdenGetPayload<{ include: typeof include }>;
type Candidate = { ordenId: string; expectedRevision: number; fingerprint: string };
type Input = { clientRequestId: string; motivo: string; corte: string; candidatos: Candidate[] };
const money = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const json = (value: unknown) => value as Prisma.InputJsonValue;
type HistoricalData = { items?: { itemId: string; envase?: boolean; cantidad: number; devolverEnvase: boolean }[]; empleadoId?: string; empleadoAnteriorId?: string; empleadoNuevoId?: string; requestKey?: string; requestHash?: string; receiptLines?: unknown };
const details = (value: Prisma.JsonValue | null): HistoricalData => value && typeof value === 'object' && !Array.isArray(value) ? value as HistoricalData : {};

export function analyzeRegularizationOrder(order: HistoricalOrder) {
  const incidencias: string[] = [];
  const excluded = order.tipoOperacion !== 'CONSUMO_EMPLEADO' || order.anulada || !states.includes(order.estado);
  const invalid = (s: string) => { if (!incidencias.includes(s)) incidencias.push(s); };
  if (!order.empleadoId || !order.empleadoNombre) invalid('Beneficiario histórico ausente');
  if (!order.items.length || order.items.some(i => !i.nombreProducto || !Number.isInteger(i.cantidad) || i.cantidad <= 0 || i.precioUnitario.lte(0) || !i.precioUnitario.mul(100).isInteger() || !i.precioUnitario.mul(i.cantidad).equals(i.subtotal))) invalid('Líneas históricas incompletas o inconsistentes');
  const subtotal = order.items.reduce((sum, i) => sum.add(i.subtotal), money(0));
  const surcharge = order.recargo ?? money(0);
  if (surcharge.lt(0) || !subtotal.add(surcharge).equals(order.total) || order.total.lt(0)) invalid('Importe histórico inconsistente');
  const creation = order.historial.find(h => h.tipoAccion === 'consumo_creado');
  const data = details(creation?.datosDespues ?? null);
  const itemData = Array.isArray(data.items) ? data.items.filter(d => d && typeof d === 'object' && !Array.isArray(d)) : [];
  if (Array.isArray(data.items) && itemData.length !== data.items.length) invalid('Falta evidencia histórica de envases');
  const corrections = order.historial.filter(h => h.tipoAccion === 'consumo_corregido');
  let remaining = order.total;
  const counts = new Map(order.items.map(i => [i.id, { quantity: i.cantidad, containers: itemData.find((d) => d.itemId === i.id)?.envase ? i.cantidad : 0 }]));
  if (itemData.length !== order.items.length || order.items.some(i => !itemData.some((d) => d.itemId === i.id && typeof d.envase === 'boolean'))) invalid('Falta evidencia histórica de envases');
  let currentBeneficiary = data.empleadoId ?? order.empleadoId;
  const correctionAmounts = new Map<string, { credit: Prisma.Decimal; remaining: Prisma.Decimal }>();
  const containers = order.items.reduce((n, i) => n + (itemData.find((d) => d.itemId === i.id)?.envase ? i.cantidad : 0), 0);
  const containerPrice = containers ? surcharge.div(containers) : money(0);
  if ((!containers && !surcharge.isZero()) || !containerPrice.mul(100).isInteger()) invalid('Recargo histórico no demostrable');
  if (corrections.length) {
    for (const correction of corrections) {
      const c = details(correction.datosDespues);
      if (!Array.isArray(c.items)) { invalid('Corrección histórica incompleta'); continue; }
      if (c.empleadoAnteriorId && c.empleadoAnteriorId !== currentBeneficiary) invalid('La cadena de beneficiarios es inconsistente');
      if (c.empleadoNuevoId) currentBeneficiary = c.empleadoNuevoId;
      const beforeCorrection = remaining;
      for (const item of c.items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) { invalid('Corrección histórica inconsistente'); continue; }
        const original = order.items.find(i => i.id === item.itemId); const left = counts.get(item.itemId);
        if (!original || !left || !Number.isInteger(item.cantidad) || item.cantidad < 0 || typeof item.devolverEnvase !== 'boolean' || item.cantidad > left.quantity || (item.devolverEnvase && item.cantidad > left.containers)) { invalid('Corrección histórica inconsistente'); continue; }
        left.quantity -= item.cantidad; if (item.devolverEnvase) left.containers -= item.cantidad;
        remaining = remaining.sub(original.precioUnitario.mul(item.cantidad)).sub(item.devolverEnvase ? containerPrice.mul(item.cantidad) : 0);
      }
      if (c.requestKey) correctionAmounts.set(c.requestKey, { credit: beforeCorrection.sub(remaining), remaining });
    }
  }
  if (currentBeneficiary !== order.empleadoId) invalid('La cadena de beneficiarios es inconsistente');
  const remainingItems = order.items.map(i => ({ ...i, cantidad: counts.get(i.id)!.quantity, subtotal: i.precioUnitario.mul(counts.get(i.id)!.quantity) })).filter(i => i.cantidad > 0);
  const remainingSurcharge = remaining.sub(remainingItems.reduce((sum, i) => sum.add(i.subtotal), money(0)));
  const movements = order.movimientosCuenta;
  const canonical = movements.filter(m => m.origenClave === `consumo:${order.id}`);
  if (canonical.length > 1) invalid('Cargo canónico ambiguo');
  if (!canonical.length && movements.length) invalid('Existen movimientos sin cargo canónico demostrable');
  if (canonical.length) {
    const first = canonical[0];
    if ((data.empleadoId && first.empleadoId !== data.empleadoId) || first.tipo !== 'CONSUMO' || first.monto.lte(0) || first.monto.gt(order.total)) invalid('Cargo canónico inconsistente');
    // Every adjustment must refer to a proven charge and a recorded correction.
    const chargeIds = new Set(movements.filter(m => m.tipo === 'CONSUMO').map(m => m.id));
    const correctionKeys = new Set(corrections.map(h => details(h.datosDespues).requestKey).filter(Boolean));
    for (const m of movements) {
      if (m.id === first.id) continue;
      const key = m.origenClave.replace(/:(reverso|traslado-salida|traslado-entrada)$/, '');
      if (!correctionKeys.has(key) || !['CONSUMO', 'REVERSO_CONSUMO'].includes(m.tipo) || (m.tipo === 'REVERSO_CONSUMO' && (!m.movimientoOrigenId || !chargeIds.has(m.movimientoOrigenId)))) invalid('Cadena de movimientos ambigua');
    }
    for (const correction of corrections) {
      const c = details(correction.datosDespues);
      if (!c.requestKey) { invalid('Corrección sin clave histórica'); continue; }
      const salida = movements.find(m => m.origenClave === `${c.requestKey}:traslado-salida`);
      const entrada = movements.find(m => m.origenClave === `${c.requestKey}:traslado-entrada`);
      const reversal = movements.find(m => m.origenClave === `${c.requestKey}:reverso`);
      const amounts = correctionAmounts.get(c.requestKey);
      const originFor = (id: string | null) => movements.find(m => m.id === id);
      if (!!salida !== !!entrada || (salida && entrada && (!amounts || !entrada.monto.equals(amounts.remaining) || originFor(salida.movimientoOrigenId)?.empleadoId !== salida.empleadoId || salida.tipo !== 'REVERSO_CONSUMO' || entrada.tipo !== 'CONSUMO' || salida.empleadoId !== c.empleadoAnteriorId || entrada.empleadoId !== c.empleadoNuevoId || !salida.monto.isNegative() || !entrada.monto.equals(salida.monto.neg())))) invalid('Traslado histórico inconsistente');
      if (reversal && (!amounts || !reversal.monto.neg().equals(amounts.credit) || originFor(reversal.movimientoOrigenId)?.empleadoId !== reversal.empleadoId || reversal.tipo !== 'REVERSO_CONSUMO' || reversal.empleadoId !== c.empleadoAnteriorId || !reversal.monto.isNegative())) invalid('Devolución histórica inconsistente');
    }
    const balance = movements.reduce((sum, m) => sum.add(m.monto), money(0));
    if (!balance.equals(remaining)) invalid('Los movimientos no concilian con el remanente histórico');
    const byEmployee = new Map<string, Prisma.Decimal>();
    for (const m of movements) byEmployee.set(m.empleadoId, (byEmployee.get(m.empleadoId) ?? money(0)).add(m.monto));
    if ([...byEmployee].some(([id, amount]) => id === order.empleadoId ? !amount.equals(remaining) : !amount.isZero())) invalid('La cadena de beneficiarios no concilia');
  }
  if (remaining.lt(0) || !remaining.mul(100).isInteger()) invalid('Remanente histórico inválido');
  const receiptValues = order.historial.map(h => details(h.datosDespues).receiptLines).filter(v => v != null);
  if (receiptValues.some(v => !Array.isArray(v))) invalid('Comprobante histórico inválido');
  const receipt = receiptValues.find(v => Array.isArray(v));
  if (receipt && (receipt.length === 0 || receipt.some((line: unknown) => typeof line !== 'string' || line.length > 42 || /[^\x20-\x7e]/.test(line)))) invalid('Comprobante histórico inválido');
  const fingerprint = requestHash(order);
  return { ordenId: order.id, expectedRevision: order.printRevision, fingerprint, estado: order.estado, empleadoId: order.empleadoId, importeHistorico: remaining.toNumber(), cargoExistente: canonical.length > 0, cargoFaltante: canonical.length ? 0 : remaining.toNumber(), incidencias, excluido: excluded, remainingItems, remainingSurcharge };
}

export async function analyzeRegularization(db: PrismaClient, input: { corte: string; cursor?: string | null }) {
  const rows = await db.orden.findMany({ where: { tipoOperacion: 'CONSUMO_EMPLEADO', createdAt: { lte: new Date(input.corte) }, estado: { in: states }, anulada: false, ...(input.cursor ? { id: { gt: input.cursor } } : {}) }, orderBy: { id: 'asc' }, take: 51, include });
  const candidatos = rows.slice(0, 50).map(row => { const { remainingItems: _items, remainingSurcharge: _surcharge, ...candidate } = analyzeRegularizationOrder(row); void _items; void _surcharge; return candidate; });
  return { corte: input.corte, candidatos, siguienteCursor: rows.length > 50 ? candidatos[candidatos.length - 1].ordenId : null, resumen: { elegibles: candidatos.filter(c => !c.incidencias.length).length, descartados: candidatos.filter(c => c.incidencias.length).length, cargosExistentes: candidatos.filter(c => c.cargoExistente).length, cargosFaltantes: candidatos.filter(c => c.cargoFaltante > 0 && !c.incidencias.length).length, totalCargoFaltante: candidatos.filter(c => !c.incidencias.length).reduce((sum, c) => sum.add(c.cargoFaltante), money(0)).toNumber() } };
}

export async function executeRegularization(db: PrismaClient, input: Input, actor: AccountActor) {
  const hash = requestHash(input); const key = `regularizacion:${input.clientRequestId}`;
  const resultados: { ordenId: string; estado: 'regularizado' | 'ya_regularizado' | 'excluido' | 'conflicto'; motivo?: string; cargoAgregado: number }[] = [];
  for (const candidate of input.candidatos) {
    try {
      const result = await db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        const prior = await tx.historialOrden.findFirst({ where: { tipoAccion: 'consumo_regularizado_entregado', datosDespues: { path: ['requestKey'], equals: key } } });
        if (prior && details(prior.datosDespues).requestHash !== hash) throw new Error('CLAVE_REUTILIZADA');
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Orden" WHERE id = ${candidate.ordenId} FOR UPDATE`;
        if (!locked.length) return { ordenId: candidate.ordenId, estado: 'excluido' as const, motivo: 'Documento no encontrado', cargoAgregado: 0 };
        const order = await tx.orden.findUniqueOrThrow({ where: { id: candidate.ordenId }, include });
        const already = order.historial.find(h => h.tipoAccion === 'consumo_regularizado_entregado');
        if (already && order.estado === 'entregada') return { ordenId: order.id, estado: 'ya_regularizado' as const, cargoAgregado: 0 };
        const analysis = analyzeRegularizationOrder(order);
        if (analysis.excluido || order.createdAt > new Date(input.corte)) return { ordenId: order.id, estado: 'excluido' as const, motivo: 'Fuera del corte o no elegible', cargoAgregado: 0 };
        if (candidate.expectedRevision !== order.printRevision || candidate.fingerprint !== analysis.fingerprint) return { ordenId: order.id, estado: 'conflicto' as const, motivo: 'El documento cambió; vuelva a analizarlo', cargoAgregado: 0 };
        if (analysis.incidencias.length || !order.empleadoId) return { ordenId: order.id, estado: 'conflicto' as const, motivo: analysis.incidencias.join('; '), cargoAgregado: 0 };
        const employee = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Usuario" WHERE id = ${order.empleadoId} FOR UPDATE`;
        if (!employee.length) return { ordenId: order.id, estado: 'conflicto' as const, motivo: 'Beneficiario no encontrado', cargoAgregado: 0 };
        const now = new Date();
        const receipt = order.historial.map(h => details(h.datosDespues).receiptLines).find(v => Array.isArray(v)) ?? buildHistoricalConsumptionLines({ ...order, items: analysis.remainingItems, recargo: analysis.remainingSurcharge, total: money(analysis.importeHistorico) }, actor.nombre, now);
        let cargoCanonicoId = order.movimientosCuenta.find(m => m.origenClave === `consumo:${order.id}`)?.id ?? null;
        if (analysis.cargoFaltante > 0) {
          const movement = await appendEmployeeMovement(tx, { empleadoId: order.empleadoId, tipo: 'CONSUMO', monto: analysis.cargoFaltante, motivo: input.motivo, autor: actor, origenClave: `consumo:${order.id}`, idempotencyKey: `consumo:${order.id}`, ordenId: order.id, fechaHecho: order.createdAt, requireActive: false, detalle: { regularizacion: true, corte: input.corte, requestKey: key } });
          cargoCanonicoId = movement.id;
        }
        await tx.printJob.updateMany({ where: { ordenId: order.id, type: { in: ['ORDER', 'AMENDMENT', 'REPRINT'] }, status: { in: ['PENDING', 'RETRY', 'NEEDS_REVIEW'] } }, data: { status: 'DISCARDED', reviewedAt: now, reviewedBy: actor.nombre, reviewReason: `Regularización: ${input.motivo}` } });
        const processing = !!(await tx.printJob.findFirst({ where: { ordenId: order.id, type: { in: ['ORDER', 'AMENDMENT', 'REPRINT'] }, status: 'PROCESSING' }, select: { id: true } }));
        await tx.orden.update({ where: { id: order.id }, data: { estado: 'entregada', printRevision: { increment: 1 } } });
        await tx.historialOrden.create({ data: { ordenId: order.id, tipoAccion: 'consumo_regularizado_entregado', descripcion: 'Consumo histórico regularizado', usuarioNombre: actor.nombre, usuarioRol: actor.rol, razon: input.motivo, datosAntes: json({ estado: order.estado, revision: order.printRevision, fingerprint: analysis.fingerprint }), datosDespues: json({ version: 1, corte: input.corte, requestKey: key, requestHash: hash, beneficiarioId: order.empleadoId, cargoCanonicoId, cargoOrigenClave: cargoCanonicoId ? `consumo:${order.id}` : null, cargoExistente: analysis.cargoExistente, cargoAgregado: analysis.cargoFaltante, importeHistorico: analysis.importeHistorico, fechaOriginal: order.createdAt.toISOString(), fechaRegularizacion: now.toISOString(), actorId: actor.id, receiptLines: receipt, impresionEnProceso: processing }) } });
        return { ordenId: order.id, estado: 'regularizado' as const, cargoAgregado: analysis.cargoFaltante, ...(processing ? { motivo: 'Existe una impresión en proceso con resultado físico incierto' } : {}) };
      });
      resultados.push(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'CLAVE_REUTILIZADA') throw error;
      console.error('Error regularizando documento:', error);
      resultados.push({ ordenId: candidate.ordenId, estado: 'conflicto', motivo: 'No se pudo procesar el documento', cargoAgregado: 0 });
    }
  }
  const pendientes = await db.orden.count({ where: { tipoOperacion: 'CONSUMO_EMPLEADO', estado: { in: states }, anulada: false, createdAt: { lte: new Date(input.corte) } } });
  return { resultados, totalCargosAgregados: resultados.reduce((s, r) => s.add(r.cargoAgregado), money(0)).toNumber(), pendientes };
}
