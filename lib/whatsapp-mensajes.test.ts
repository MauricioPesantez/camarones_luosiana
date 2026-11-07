import assert from 'node:assert/strict';
import {
  enlaceDePin, textoActualizacionItems, textoActualizacionMoto, textoActualizacionUbicacion, textoAnulacion, textoConfirmacion, textoConflicto, textoOrdenesSinUbicacion,
  textoPendienteAprobacion, textoPublicacion, textoRechazo, textoRecordatorio, textoReenvio, textoUbicacionGuardada,
} from './whatsapp-mensajes';

const orden = {
  numeroDiario: 42, fechaNumeroDiario: '2026-11-04', tipoOrden: 'domicilio', estado: 'pendiente', anulada: false,
  nombreCliente: 'Ana', telefonoCliente: '+593991234567', ubicacionUrl: 'https://www.google.com/maps?q=-2.17,-79.92',
  referenciaEntrega: 'portón negro', observaciones: 'cubiertos aparte', total: '45.5', costoEnvio: '2.75', montoPagado: '45.5',
  metodoPagoPrevisto: 'transferencia', cobrada: true, mesero: 'Digital',
  items: [
    { cantidad: 2, nivelPicante: 'natural', observaciones: null, producto: { nombre: 'Combo Duo' } },
    { cantidad: 1, nivelPicante: 'picante_1', observaciones: 'sin cebolla', producto: { nombre: 'Combo Duo' } },
    { cantidad: 1, nivelPicante: null, observaciones: null, producto: { nombre: '3 Cangrejos' } },
  ],
};

assert.equal(enlaceDePin({ latitud: -2.17, longitud: -79.92 }), 'https://www.google.com/maps?q=-2.17,-79.92');

assert.equal(textoPublicacion(orden), `ORDEN #42 · 04/11/2026
Domicilio · Ana · +593991234567
2 x Combo Duo | Natural
1 x Combo Duo | Picante 1 | sin cebolla
1 x 3 Cangrejos
Total: $45.50
Pago: transferencia confirmada
Ubicación: https://www.google.com/maps?q=-2.17,-79.92
Referencia: portón negro
Observaciones: cubiertos aparte`);

const pendiente = { ...orden, ubicacionUrl: null, referenciaEntrega: null, observaciones: null, metodoPagoPrevisto: 'efectivo', cobrada: false, montoPagado: '0' };
assert.match(textoPublicacion(pendiente), /Pago: efectivo\nUbicación: pendiente$/);

const llevar = { ...pendiente, tipoOrden: 'para_llevar', telefonoCliente: null, metodoPagoPrevisto: null, ubicacionUrl: null };
const publicacionLlevar = textoPublicacion(llevar);
assert.match(publicacionLlevar, /^ORDEN #42 · 04\/11\/2026\nPara llevar · Ana\n/);
assert.doesNotMatch(publicacionLlevar, /Ubicación/);
assert.match(publicacionLlevar, /Pago: en el local/);
assert.match(textoPublicacion({ ...llevar, cobrada: true }), /Pago: transferencia confirmada/);
assert.match(textoConfirmacion(llevar, { impresionEnCola: true, avisoDelivery: null }), /Pago: en el local/);

// La confirmación distingue guardada, publicada e impresa.
const aviso = new Date('2026-11-04T20:10:00.000Z');
assert.equal(textoConfirmacion(orden, { impresionEnCola: true, avisoDelivery: aviso }), `Orden #42 registrada · 04/11/2026
Estado: pendiente de preparación
Cliente: Ana
Ubicación: https://www.google.com/maps?q=-2.17,-79.92
Pago: transferencia confirmada por Digital
Total: $45.50
Publicación al grupo: pendiente
Impresión: en cola
Moto se pedirá al grupo: 15:10`);
const sinCola = textoConfirmacion(pendiente, { impresionEnCola: false, avisoDelivery: null });
assert.match(sinCola, /Ubicación: pendiente\. Complétala desde el POS\./);
assert.match(sinCola, /Pago: efectivo/);
assert.match(sinCola, /Impresión: no está en cola; revisa el POS/);
assert.doesNotMatch(sinCola, /Aviso/);

assert.match(textoPendienteAprobacion(orden), /Orden #42.*\nEstado: pendiente de aprobación/);
assert.doesNotMatch(textoPendienteAprobacion(orden), /preparación|Publicación/);

const recordatorio = textoRecordatorio(pendiente);
// Efectivo: cobra todo al cliente y en el local deja el pedido sin su carrera.
assert.equal(recordatorio, `MOTO para orden #42 · 04/11/2026
Cliente: Ana · +593991234567
Ubicación: pendiente
Total pedido: $42.75
Carrera: $2.75
Total a cobrar: $45.50`);
// Transferencia: no cobra al cliente; el local le paga la carrera.
assert.equal(textoRecordatorio(orden), `MOTO para orden #42 · 04/11/2026
Cliente: Ana · +593991234567
Ubicación: https://www.google.com/maps?q=-2.17,-79.92
Referencia: portón negro
Cobras al cliente: nada, transferencia.
Cobrar carrera: $2.75`);
// Mixto: el saldo no alcanza la carrera; el local completa la diferencia.
assert.match(textoRecordatorio({ ...orden, montoPagado: '44' }), /\nTotal a cobrar: \$1\.50\nCobrar carrera: \$1\.25$/);
// Mixto con saldo mayor a la carrera: no lo presenta como pedido completo.
assert.match(textoRecordatorio({ ...orden, montoPagado: '20' }), /\nTotal a cobrar: \$25\.50\nPagas en el local: \$22\.75$/);
// Centavos que en binario no suman exacto.
assert.match(textoRecordatorio({ ...pendiente, total: '13.25', costoEnvio: '2.15' }), /Total pedido: \$11\.10\nCarrera: \$2\.15\nTotal a cobrar: \$13\.25$/);
// Sin envío registrado no inventa carrera.
assert.match(textoRecordatorio({ ...orden, costoEnvio: null }), /transferencia\.$/);
assert.equal(textoActualizacionMoto(pendiente), `ACTUALIZACIÓN orden #42 · 04/11/2026
Total pedido: $42.75
Carrera: $2.75
Total a cobrar: $45.50`);

assert.match(textoRechazo(orden, 'sin mariscos'), /Orden #42 rechazada.*\nMotivo: sin mariscos/);
assert.doesNotMatch(textoRechazo(orden, null), /Motivo/);

assert.match(textoReenvio(orden), /ya está registrado.*Orden #42/);
assert.match(textoReenvio({ ...orden, anulada: true }), /anulada/);
assert.match(textoConflicto(orden), /Orden #42/);
assert.match(textoConflicto(orden), /línea Nuevo pedido/);
assert.equal(textoUbicacionGuardada(orden), 'Ubicación guardada en Orden #42 · Ana\nhttps://www.google.com/maps?q=-2.17,-79.92');
assert.equal(textoActualizacionUbicacion(orden),
  'ACTUALIZACIÓN orden #42 · 04/11/2026\nUbicación: https://www.google.com/maps?q=-2.17,-79.92\nReferencia: portón negro');
assert.equal(textoActualizacionUbicacion(pendiente), 'ACTUALIZACIÓN orden #42 · 04/11/2026\nUbicación: pendiente');
assert.equal(textoActualizacionItems(pendiente), `ACTUALIZACIÓN orden #42 · 04/11/2026
Productos ahora:
2 x Combo Duo | Natural
1 x Combo Duo | Picante 1 | sin cebolla
1 x 3 Cangrejos
Total: $45.50
Pago: efectivo`);
assert.equal(textoAnulacion(orden), 'ANULADA orden #42 · 04/11/2026\nNo preparar ni enviar.');
assert.match(textoOrdenesSinUbicacion([orden, { ...orden, numeroDiario: 43 }]), /2 órdenes.*#42, #43.*POS/);

console.log('whatsapp-mensajes tests: ok');
