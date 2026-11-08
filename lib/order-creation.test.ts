import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { Prisma } from '@prisma/client';
import * as ordenTypes from '../types/orden';
import * as cajaTypes from '../types/caja';
import * as cobroTypes from '../types/cobro';
import * as fechas from './fecha-ecuador';
import * as dailyNumber from './daily-order-number';
import * as deliveryLocation from './delivery-location';
import { PUBLIC_PRODUCT_SELECT } from './product-select';

function loadModule<T>(file: string, dependencies: Record<string, unknown>): T {
  const js = transpileModule(readFileSync(resolve(file), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2017 },
  }).outputText;
  const routeModule = { exports: {} };
  new Function('require', 'module', 'exports', js)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Dependencia no simulada: ${name}`);
    return dependencies[name];
  }, routeModule, routeModule.exports);
  return routeModule.exports as T;
}

async function run() {
  let rol: string | null = 'mesero';
  let estadoCaja: string | null = null;
  let cajaCierraDuranteCreacion = false;
  let conflictoStock = false;
  let consultasCaja = 0;
  let bloqueosCaja = 0;
  let commits = 0;
  let numeroDiario = 0;
  let colaActiva = false;
  let impresionDirecta = false;
  let fallaImpresora = false;
  let fallaMarcaImpresa = false;
  let fallaSse = false;
  const trabajos: Record<string, unknown>[] = [];
  const eventos: string[] = [];
  const impresas: Record<string, unknown>[] = [];
  const ordenes: Record<string, unknown>[] = [];
  const pagos: Record<string, unknown>[] = [];
  const producto = {
    id: 'combo-duo', nombre: 'Combo Duo', categoria: 'Combos',
    stock: 92, precio: 21, disponible: true, tiempoPreparacion: 20,
  };
  const tx = {
    $queryRaw: async () => {
      bloqueosCaja++;
      const estado = cajaCierraDuranteCreacion ? 'cerrada' : estadoCaja;
      return estado ? [{ estado }] : [];
    },
    contadorOrdenDiaria: { upsert: async () => ({ ultimoNumero: ++numeroDiario }) },
    orden: {
      create: async ({ data }: { data: Record<string, unknown> & {
        items: { create: Array<Record<string, unknown>> };
      } }) => {
        ordenes.push(data);
        return {
          ...data, id: 'orden-prueba', printRevision: 1,
          items: data.items.create.map((item) => ({ ...item, producto })),
        };
      },
    },
    producto: {
      // Igual que el UPDATE condicional de PostgreSQL: nunca deja stock negativo.
      updateMany: async ({ where, data }: {
        where: { stock: { gte: number } };
        data: { stock: { decrement: number } };
      }) => {
        if (conflictoStock || producto.stock < where.stock.gte) return { count: 0 };
        producto.stock -= data.stock.decrement;
        return { count: 1 };
      },
    },
    historialOrden: { create: async () => ({}) },
    cobro: { create: async ({ data }: { data: Record<string, unknown> }) => { pagos.push(data); } },
  };
  const prisma = {
    producto: { findMany: async () => [producto] },
    orden: { update: async ({ data }: { data: Record<string, unknown> }) => {
      if (fallaMarcaImpresa) throw new Error('base caida');
      impresas.push(data);
    } },
    sesionCaja: { findUnique: async () => {
      consultasCaja++;
      return estadoCaja ? { estado: estadoCaja } : null;
    } },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const antes = { ordenes: ordenes.length, pagos: pagos.length };
      try {
        const result = await callback(tx);
        commits++;
        return result;
      } catch (error) {
        ordenes.splice(antes.ordenes);
        pagos.splice(antes.pagos);
        throw error;
      }
    },
  };
  const caja = loadModule('lib/caja.ts', {
    'server-only': {}, '@/lib/db': { prisma },
    '@/lib/fecha-ecuador': fechas, '@/types/caja': cajaTypes,
  });
  const dependencias = {
    'server-only': {}, 'next/server': { NextResponse: { json: Response.json } },
    '@/lib/product-select': { PUBLIC_PRODUCT_SELECT },
    '@prisma/client': { Prisma }, '@/lib/db': { prisma }, '@/lib/caja': caja,
    '@/types/caja': cajaTypes, '@/types/orden': ordenTypes, '@/types/cobro': cobroTypes,
    '@/lib/fecha-ecuador': fechas, '@/lib/daily-order-number': dailyNumber,
    '@/lib/ordenes-anulacion': {}, '@/lib/delivery-location': deliveryLocation, '@/lib/sse': { notificarClientes: (evento: string) => {
      if (fallaSse) throw new Error('sse caido');
      eventos.push(evento);
    } },
    '@/lib/session': {
      getAuthenticatedUser: async () => rol ? { id: 'usuario-autenticado', nombre: 'Prueba', rol } : null,
      canCollectPayments: () => ['mesero', 'digital', 'admin'].includes(rol ?? ''),
    },
    '@/lib/payment-link': { createPaymentLink: () => ({ tokenHash: 'secreto', url: 'http://test.invalid/cobro' }) },
    '@/lib/print-jobs': {
      PRINT_JOB_TYPES: { ORDER: 'ORDER' },
      shouldEnqueuePrintJob: () => colaActiva,
      enqueueOrderPrintJob: async (cliente: unknown, orden: { id: string }, opciones: object) => {
        assert.equal(cliente, tx, 'El trabajo se confirma en la transacción de la orden');
        trabajos.push({ ordenId: orden.id, ...opciones });
      },
    },
    '@/lib/print-config': { isDirectPrintEnabled: () => impresionDirecta },
    '@/lib/printer': { PrinterService: class {
      constructor() { if (!impresionDirecta) throw new Error('No debe imprimir'); }
      imprimirComanda = async () => {
        if (fallaImpresora) throw new Error('impresora caida');
        return { success: true };
      };
    } },
  };
  const creacion = loadModule<typeof import('./order-creation')>('lib/order-creation.ts', dependencias);
  const { POST } = loadModule<{ POST: (request: Request) => Promise<Response> }>('app/api/ordenes/route.ts', {
    ...dependencias, '@/lib/order-creation': creacion,
  });
  const items = [{ productoId: producto.id, cantidad: 1, precioUnitario: 21, nivelPicante: 'picante_1' }];
  const local = { tipoOrden: 'local', numeroMesa: 1, items, creadorId: 'id-falsificado', creadorRol: 'digital' };
  const domicilio = {
    tipoOrden: 'domicilio', telefonoCliente: '0000000000', costoEnvio: 3,
    metodoPagoPrevisto: 'transferencia', transferenciaConfirmada: true, items,
  };

  async function enviar(body: object) {
    return POST(new Request('http://test.invalid/api/ordenes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
  }

  // La identidad autenticada manda, aunque el payload declare otro creador/rol.
  for (const estado of [null, 'cerrada']) {
    estadoCaja = estado;
    const response = await enviar(local);
    assert.equal(response.status, 409);
    const data = await response.json();
    assert.equal(data.code, 'CAJA_NO_DISPONIBLE');
    assert.match(data.error, estado ? /ya fue cerrada/ : /no ha sido iniciada/);
  }
  assert.equal(commits, 0);
  assert.equal(ordenes.length, 0);

  estadoCaja = 'abierta';
  const abierta = await enviar(local);
  assert.equal(abierta.status, 200);
  assert.equal((await abierta.json()).orden.creadorId, 'usuario-autenticado');
  assert.equal(bloqueosCaja, 1, 'El mesero conserva el candado frente a un cierre concurrente');

  cajaCierraDuranteCreacion = true;
  assert.equal((await enviar(local)).status, 409);
  assert.equal(commits, 1);
  cajaCierraDuranteCreacion = false;

  // Digital puede crear sin caja, incluso registrando la transferencia recibida.
  rol = 'digital';
  estadoCaja = null;
  const lecturasAntes = consultasCaja;
  const bloqueosAntes = bloqueosCaja;
  const transferencia = await enviar(domicilio);
  assert.equal(transferencia.status, 200);
  const data = await transferencia.json();
  assert.equal(data.orden.cobrada, true);
  assert.equal(data.orden.metodoPago, 'transferencia');
  assert.equal(data.orden.montoPagado, Number(data.orden.total));
  assert.equal(pagos.length, 1, 'Se conserva el registro del pago confirmado');
  assert.equal(pagos[0].monto, Number(data.orden.total));
  assert.equal('cobroTokenHash' in data.orden, false);
  assert.equal((await enviar({ tipoOrden: 'para_llevar', nombreCliente: 'Prueba', items })).status, 200);
  assert.equal((await enviar({ ...domicilio, metodoPagoPrevisto: 'efectivo', transferenciaConfirmada: false })).status, 200);
  assert.equal(consultasCaja, lecturasAntes);
  assert.equal(bloqueosCaja, bloqueosAntes);

  conflictoStock = true;
  const commitsAntes = commits;
  const pagosAntes = pagos.length;
  const sinStock = await enviar(domicilio);
  assert.equal(sinStock.status, 409);
  assert.match((await sinStock.json()).error, /stock cambio/);
  assert.equal(commits, commitsAntes);
  assert.equal(pagos.length, pagosAntes);

  conflictoStock = false;
  const paraLlevar = { tipoOrden: 'para_llevar', nombreCliente: 'Prueba', items };

  // Permisos de la ruta humana.
  rol = null;
  assert.equal((await enviar(paraLlevar)).status, 401);
  rol = 'cocina';
  assert.equal((await enviar(paraLlevar)).status, 403);
  rol = 'digital';

  // Validaciones y sus mensajes.
  const invalidos: Array<[object, RegExp]> = [
    [{ ...local, tipoOperacion: 'CONSUMO_EMPLEADO' }, /consumos de empleados/],
    [{ ...local, items: [] }, /al menos un producto/],
    [{ ...local, items: [{ productoId: '', cantidad: 1 }] }, /cantidad válida/],
    [{ ...local, items: [{ ...items[0], cantidad: 0 }] }, /cantidad válida/],
    [{ ...local, numeroMesa: undefined }, /número de mesa/],
    [{ ...paraLlevar, nombreCliente: ' ' }, /nombre del cliente/],
    [{ ...domicilio, telefonoCliente: ' ' }, /teléfono/],
    [{ ...domicilio, costoEnvio: -1 }, /costo de envío/],
    [{ ...domicilio, metodoPagoPrevisto: 'tarjeta' }, /modalidad de pago/],
    [{ ...domicilio, transferenciaConfirmada: false }, /transferencia ya fue recibida/],
    [{ ...local, items: [{ ...items[0], productoId: 'otro' }] }, /no existe/],
    [{ ...local, items: [{ ...items[0], nivelPicante: undefined }] }, /nivel de picante/],
  ];
  for (const [cuerpo, mensaje] of invalidos) {
    const respuesta = await enviar(cuerpo);
    assert.equal(respuesta.status, 400);
    assert.match((await respuesta.json()).error, mensaje);
  }

  // Numeración, totales y desglose.
  const primera = await (await enviar(paraLlevar)).json();
  const segunda = await (await enviar(domicilio)).json();
  assert.equal(segunda.orden.numeroDiario, primera.orden.numeroDiario + 1);
  const recargo = ordenTypes.calcularRecargoEnvases('domicilio', [{ cantidad: 1, categoria: 'Combos' }]);
  assert.deepEqual(segunda.desglose, {
    subtotalProductos: 21,
    cantidadEnvases: recargo / ordenTypes.RECARGO_RECIPIENTES,
    recargo,
    costoEnvio: 3,
    total: 24 + recargo,
    metodoPagoPrevisto: 'transferencia',
  });

  // Efectos posteriores según el mecanismo de impresión.
  assert.deepEqual(primera.impresion, { success: false, error: 'No hay ningun mecanismo de impresion activo' });
  assert.equal(eventos.at(-1), 'nueva-orden');
  colaActiva = true;
  const enCola = await (await enviar(paraLlevar)).json();
  assert.equal(enCola.impresionEnCola, true);
  assert.deepEqual(enCola.impresion, { success: true, data: { mode: 'queue' } });
  assert.deepEqual(trabajos, [{ ordenId: 'orden-prueba', type: 'ORDER', revision: 1 }]);
  colaActiva = false;
  impresionDirecta = true;
  assert.equal((await (await enviar(paraLlevar)).json()).impresion.success, true);
  assert.deepEqual(impresas, [{ impresa: true }]);
  impresionDirecta = false;

  // Sin stock con aprobación: no descuenta, no imprime y no avisa a cocina.
  producto.stock = 0;
  const eventosAntes = eventos.length;
  const pendiente = await (await enviar({ ...domicilio, solicitarAprobacion: true })).json();
  assert.equal(pendiente.orden.estado, 'pendiente_aprobacion_stock');
  assert.equal(pendiente.orden.cobrada, true, 'La transferencia confirmada nace pagada');
  assert.equal(pendiente.stockInsuficiente, true);
  assert.equal(pendiente.pendienteAprobacion, true);
  assert.deepEqual(pendiente.itemsSinStock, [{
    productoId: producto.id, productoNombre: producto.nombre, cantidadSolicitada: 1, stockDisponible: 0,
  }]);
  assert.equal(pendiente.impresion.error, 'Orden pendiente de aprobación');
  assert.equal(producto.stock, 0);
  assert.equal(eventos.length, eventosAntes);

  // Carrera por la última unidad: una sola venta y stock nunca negativo.
  producto.stock = 1;
  const carrera = await Promise.all([enviar(paraLlevar), enviar(paraLlevar)]);
  assert.deepEqual(carrera.map((r) => r.status).sort(), [200, 409]);
  assert.equal(producto.stock, 0);

  // Falta real de stock: error definitivo por producto, sumando todas sus líneas.
  producto.stock = 5;
  const lineas = [{ ...items[0], cantidad: 3 }, { ...items[0], cantidad: 3 }];
  const commitsSinStock = commits;
  const insuficiente = await enviar({ ...paraLlevar, items: lineas });
  assert.equal(insuficiente.status, 409);
  const detalle = await insuficiente.json();
  assert.equal(detalle.code, 'STOCK_INSUFICIENTE');
  assert.match(detalle.error, /Combo Duo/);
  assert.doesNotMatch(detalle.error, /stock cambio/);
  const faltante = {
    productoId: producto.id, productoNombre: producto.nombre, cantidadSolicitada: 6, stockDisponible: 5,
  };
  assert.deepEqual(detalle.itemsSinStock, [faltante]);
  assert.equal(commits, commitsSinStock);
  const aprobacionPorSuma = await (await enviar({ ...paraLlevar, items: lineas, solicitarAprobacion: true })).json();
  assert.equal(aprobacionPorSuma.orden.estado, 'pendiente_aprobacion_stock');
  assert.deepEqual(aprobacionPorSuma.itemsSinStock, [faltante]);
  assert.equal(producto.stock, 5);

  // Tras el commit la orden existe: un fallo posterior no debe invitar a repetirla.
  impresionDirecta = true;
  fallaImpresora = true;
  const conImpresoraCaida = await enviar(paraLlevar);
  assert.equal(conImpresoraCaida.status, 200);
  const sinImpresion = await conImpresoraCaida.json();
  assert.equal(sinImpresion.impresion.success, false);
  assert.match(sinImpresion.impresion.error, /impresora caida/);
  assert.equal(sinImpresion.orden.id, 'orden-prueba');
  fallaImpresora = false;
  fallaMarcaImpresa = true;
  const sinMarca = await enviar(paraLlevar);
  assert.equal(sinMarca.status, 200);
  assert.equal((await sinMarca.json()).impresion.success, true, 'La comanda sí salió');
  fallaMarcaImpresa = false;
  impresionDirecta = false;
  assert.deepEqual((await (await enviar(paraLlevar)).json()).notificacion, { success: true });
  fallaSse = true;
  const sinAviso = await enviar(paraLlevar);
  assert.equal(sinAviso.status, 200);
  assert.deepEqual((await sinAviso.json()).notificacion, { success: false, error: 'sse caido' });
  fallaSse = false;

  // Ubicación opcional: solo en domicilio, validada y sin descargar el enlace.
  producto.stock = 20;
  const conUbicacion = await (await enviar({
    ...domicilio, ubicacionUrl: ' https://maps.app.goo.gl/AbC ', referenciaEntrega: ' Casa azul ',
  })).json();
  assert.equal(conUbicacion.orden.ubicacionUrl, 'https://maps.app.goo.gl/AbC');
  assert.equal(conUbicacion.orden.referenciaEntrega, 'Casa azul');
  const sinUbicacion = await (await enviar(domicilio)).json();
  assert.equal(sinUbicacion.orden.ubicacionUrl, null);
  assert.equal(sinUbicacion.orden.referenciaEntrega, null);
  const llevarConUbicacion = await (await enviar({
    ...paraLlevar, ubicacionUrl: 'https://maps.app.goo.gl/AbC', referenciaEntrega: 'Casa azul',
  })).json();
  assert.equal(llevarConUbicacion.orden.ubicacionUrl, null);
  assert.equal(llevarConUbicacion.orden.referenciaEntrega, null);
  const enlaceInvalido = await enviar({ ...domicilio, ubicacionUrl: 'http://evil.test' });
  assert.equal(enlaceInvalido.status, 400);
  assert.match((await enlaceInvalido.json()).error, /Google Maps/);
  const referenciaLarga = await enviar({ ...domicilio, referenciaEntrega: 'a'.repeat(501) });
  assert.equal(referenciaLarga.status, 400);
  assert.match((await referenciaLarga.json()).error, /referencia/i);

  // Para llevar: transferencia confirmada nace pagada; sin ella se cobra al retirar.
  producto.stock = 20;
  const pagosRetiro = pagos.length;
  const retiroPagado = await (await enviar({
    ...paraLlevar, metodoPagoPrevisto: 'transferencia', transferenciaConfirmada: true,
  })).json();
  assert.equal(retiroPagado.orden.cobrada, true);
  assert.equal(retiroPagado.orden.metodoPago, 'transferencia');
  assert.equal(retiroPagado.orden.metodoPagoPrevisto, null);
  assert.equal(retiroPagado.orden.costoEnvio, null);
  assert.equal(retiroPagado.orden.origenCobro, 'creacion_para_llevar_transferencia');
  assert.equal(pagos.length, pagosRetiro + 1);
  assert.equal(pagos.at(-1)?.origen, 'creacion_para_llevar_transferencia');
  assert.equal((await (await enviar(paraLlevar)).json()).orden.cobrada, false);
  assert.equal((await (await enviar({ ...paraLlevar, transferenciaConfirmada: true })).json()).orden.cobrada, false);

  // El servicio recibe el actor del llamador, sin cookie, e ignora el del cuerpo.
  producto.stock = 10;
  const actor = { id: 'operador', nombre: 'Digital', rol: 'digital' };
  const directa = await creacion.crearOrden(
    actor, { ...paraLlevar, creadorId: 'id-falsificado' } as never, 'http://test.invalid/webhook',
  );
  assert.equal(directa.orden.creadorId, actor.id);
  assert.equal(directa.orden.mesero, actor.nombre);
  await assert.rejects(
    creacion.crearOrden(actor, { ...local, items: [] } as never, 'http://test.invalid/webhook'),
    creacion.OrdenInvalidaError,
  );

  // Un llamador puede componerlo dentro de su propia transacción.
  const preparada = await creacion.prepararOrden(actor, paraLlevar as never, 'http://test.invalid/webhook');
  const commitsPrevios = commits;
  const propia = await prisma.$transaction((client) => creacion.registrarOrden(client as never, preparada));
  assert.equal(commits, commitsPrevios + 1);
  assert.equal(propia.orden.creadorId, actor.id);

  // Descuento: solo admin y digital, sobre productos; envases y envío quedan intactos.
  const url = 'http://test.invalid/webhook';
  const conDescuento = (descuento: object, quien = actor) =>
    creacion.prepararOrden(quien, { ...paraLlevar, descuento } as never, url);
  const diezPorCiento = await conDescuento({ tipo: 'porcentaje', valor: 10 });
  assert.equal(diezPorCiento.descuento, Math.round(diezPorCiento.subtotalProductos * 10) / 100);
  assert.equal(
    diezPorCiento.totalFinal,
    diezPorCiento.subtotalProductos - diezPorCiento.descuento + diezPorCiento.recargo + diezPorCiento.costoEnvio,
  );
  assert.equal((await conDescuento({ tipo: 'monto', valor: 2 }, { ...actor, rol: 'admin' })).descuento, 2);
  await assert.rejects(conDescuento({ tipo: 'monto', valor: 2 }, { ...actor, rol: 'mesero' }), /Solo admin o digital/);
  await assert.rejects(conDescuento({ tipo: 'monto', valor: 9999 }), /supera el subtotal/);
  await assert.rejects(conDescuento({ tipo: 'porcentaje', valor: 150 }), /no válido/);
  await assert.rejects(conDescuento({ tipo: 'monto', valor: 1.005 }), /no válido/);

  console.log('order-creation tests: ok (mesero, digital, caja, transferencia, stock, permisos, validaciones, numeracion, impresion)');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
