import assert from 'node:assert/strict';
import { esperaMotoPorCarga, ordenSigueEnCocina } from './espera-moto';

assert.equal(esperaMotoPorCarga(0, 0), 10);     // sin tiempo, cocina vacía = hoy
assert.equal(esperaMotoPorCarga(null, 0), 10);
assert.equal(esperaMotoPorCarga(0, 1), 13);
assert.equal(esperaMotoPorCarga(20, 0), 15);
assert.equal(esperaMotoPorCarga(20, 2), 21);
assert.equal(esperaMotoPorCarga(20, 10), 45);
assert.equal(esperaMotoPorCarga(30, 10), 45);   // tope
assert.equal(esperaMotoPorCarga(1, 0), 10);     // solo patacones: nunca antes que hoy
assert.equal(esperaMotoPorCarga(25, 5), 35);    // plato fuerte con 5 en cocina

const ahora = new Date('2026-11-16T18:00:00Z');
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000);
assert.equal(ordenSigueEnCocina({ createdAt: hace(24), tiempoEstimado: 0 }, ahora), true);
assert.equal(ordenSigueEnCocina({ createdAt: hace(26), tiempoEstimado: 0 }, ahora), false);
assert.equal(ordenSigueEnCocina({ createdAt: hace(24), tiempoEstimado: 1 }, ahora), true);
assert.equal(ordenSigueEnCocina({ createdAt: hace(29), tiempoEstimado: 20 }, ahora), true);
assert.equal(ordenSigueEnCocina({ createdAt: hace(31), tiempoEstimado: 20 }, ahora), false);
console.log('espera-moto OK');
