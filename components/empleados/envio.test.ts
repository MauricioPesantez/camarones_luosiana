import assert from 'node:assert/strict';
import { crearEnvioIdempotente } from './envio';
async function run() {
  const solicitudes: { url: string; cuerpo: { clientRequestId: string; monto: number } }[] = [];
  let modo = 'network';
  const enviar = crearEnvioIdempotente((async (url, opciones) => {
    solicitudes.push({ url: String(url), cuerpo: JSON.parse(String(opciones?.body)) });
    if (modo === 'network') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(modo === 'success' ? { id: 'registro-1' } : { error: 'Rechazado' }), { status: modo === 'server' ? 500 : modo === 'reject' ? 409 : 200 });
  }) as typeof fetch);
  await assert.rejects(enviar('/api/descuento', { monto: 10 }), /Failed/);
  await assert.rejects(enviar('/api/descuento', { monto: 20 }), /operación sin confirmar/);
  await assert.rejects(enviar('/api/otra-cuenta', { monto: 10 }), /operación sin confirmar/);
  assert.equal(solicitudes.length, 1, 'No envía un nuevo contenido mientras el resultado anterior es desconocido');
  modo = 'server';
  await assert.rejects(enviar('/api/descuento', { monto: 10 }), /Rechazado/);
  assert.equal(solicitudes[1].cuerpo.clientRequestId, solicitudes[0].cuerpo.clientRequestId);
  modo = 'success';
  assert.deepEqual(await enviar('/api/descuento', { monto: 10 }), { id: 'registro-1' });
  assert.equal(solicitudes[2].cuerpo.clientRequestId, solicitudes[0].cuerpo.clientRequestId);
  await enviar('/api/descuento', { monto: 10 });
  assert.notEqual(solicitudes[3].cuerpo.clientRequestId, solicitudes[0].cuerpo.clientRequestId, 'Una operación nueva confirmada recibe otra clave');
  modo = 'reject';
  await assert.rejects(enviar('/api/descuento', { monto: 20 }), /Rechazado/);
  modo = 'success';
  await enviar('/api/descuento', { monto: 30 });
  assert.equal(solicitudes.at(-1)?.cuerpo.monto, 30, 'Un rechazo conocido libera los datos para corregirlos');
  let resolveResponse!: (response: Response) => void;
  const keys: string[] = [];
  const dobleClick = crearEnvioIdempotente((async (_url, opciones) => {
    keys.push(JSON.parse(String(opciones?.body)).clientRequestId);
    return new Promise<Response>(resolve => { resolveResponse = resolve; });
  }) as typeof fetch);
  const primero = dobleClick('/api/consumos-empleados', { empleadoId: 'a' });
  const segundo = dobleClick('/api/consumos-empleados', { empleadoId: 'a' });
  assert.equal(keys.length, 1, 'Doble clic comparte la solicitud activa');
  resolveResponse(Response.json({ orden: { id: 'consumo-1' } }, { status: 201 }));
  assert.deepEqual(await primero, await segundo, 'Doble clic observa el mismo resultado sin crear otra operación');
  console.log('envio idempotente tests passed');
}
void run().catch(e => { console.error(e); process.exitCode = 1; });
