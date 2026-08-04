import assert from "node:assert/strict";
import {
  MAX_COMPROBANTE_BYTES,
  buildComprobanteKey,
  esMimeComprobante,
  parseComprobanteKey,
  validarComprobante,
} from "./comprobantes";

const ORDEN = "clz9k2m4x0000abcd1234efgh";
const UUID = "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b";

// --- buildComprobanteKey / parseComprobanteKey ---

const keyJpg = buildComprobanteKey(ORDEN, "image/jpeg", UUID);
assert.equal(keyJpg, `cobros/${ORDEN}/${UUID}.jpg`);
assert.equal(buildComprobanteKey(ORDEN, "image/png", UUID), `cobros/${ORDEN}/${UUID}.png`);
assert.equal(buildComprobanteKey(ORDEN, "image/webp", UUID), `cobros/${ORDEN}/${UUID}.webp`);

// Ida y vuelta.
assert.deepEqual(parseComprobanteKey(keyJpg), { ordenId: ORDEN });

// Formas invalidas: cada una debe devolver null.
const keysInvalidas = [
  "",
  "cobros/",
  `cobros/${ORDEN}`,
  `cobros/${ORDEN}/${UUID}`,
  `cobros/${ORDEN}/${UUID}.gif`,
  `cobros/${ORDEN}/${UUID}.jpg.exe`,
  `otros/${ORDEN}/${UUID}.jpg`,
  `cobros/${ORDEN}/sub/${UUID}.jpg`,
  `cobros/../${ORDEN}/${UUID}.jpg`,
  `cobros/${ORDEN}/../${UUID}.jpg`,
  `/cobros/${ORDEN}/${UUID}.jpg`,
  `cobros/${ORDEN}/${UUID}.jpg/`,
  `cobros/${ORDEN}/no-es-uuid.jpg`,
  `cobros/ORDEN-CON-MAYUSCULAS/${UUID}.jpg`,
];
for (const key of keysInvalidas) {
  assert.equal(parseComprobanteKey(key), null, `deberia rechazar: ${key}`);
}

// La key de otra orden parsea bien, pero con OTRO ordenId: quien llama compara.
const otraOrden = "clz9k2m4x0000zzzz9999wxyz";
assert.deepEqual(parseComprobanteKey(`cobros/${otraOrden}/${UUID}.jpg`), {
  ordenId: otraOrden,
});
assert.notEqual(parseComprobanteKey(`cobros/${otraOrden}/${UUID}.jpg`)?.ordenId, ORDEN);

// --- esMimeComprobante ---

assert.equal(esMimeComprobante("image/jpeg"), true);
assert.equal(esMimeComprobante("image/gif"), false);
assert.equal(esMimeComprobante("application/pdf"), false);

// --- validarComprobante ---

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 1000, magicBytes: JPEG }), {
  ok: true,
  mime: "image/jpeg",
});
assert.deepEqual(validarComprobante({ mime: "image/png", size: 1000, magicBytes: PNG }), {
  ok: true,
  mime: "image/png",
});
assert.deepEqual(validarComprobante({ mime: "image/webp", size: 1000, magicBytes: WEBP }), {
  ok: true,
  mime: "image/webp",
});

// MIME fuera de lista.
assert.deepEqual(validarComprobante({ mime: "image/gif", size: 1000, magicBytes: JPEG }), {
  ok: false,
  codigo: "mime",
});
// El navegador manda a veces el MIME con parametros.
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg; charset=binary", size: 1000, magicBytes: JPEG }),
  { ok: true, mime: "image/jpeg" },
);

// Tamano.
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg", size: MAX_COMPROBANTE_BYTES + 1, magicBytes: JPEG }),
  { ok: false, codigo: "tamano" },
);
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg", size: MAX_COMPROBANTE_BYTES, magicBytes: JPEG }),
  { ok: true, mime: "image/jpeg" },
);
assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 0, magicBytes: JPEG }), {
  ok: false,
  codigo: "tamano",
});

// Non-finite sizes must be rejected.
assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: Number.NaN, magicBytes: JPEG }), {
  ok: false,
  codigo: "tamano",
});
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg", size: Number.POSITIVE_INFINITY, magicBytes: JPEG }),
  { ok: false, codigo: "tamano" },
);

// Contenido que contradice el MIME declarado.
assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 1000, magicBytes: PNG }), {
  ok: false,
  codigo: "contenido",
});
assert.deepEqual(validarComprobante({ mime: "image/png", size: 1000, magicBytes: JPEG }), {
  ok: false,
  codigo: "contenido",
});
// Un PDF disfrazado de imagen.
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00]);
assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 1000, magicBytes: PDF }), {
  ok: false,
  codigo: "contenido",
});
// Archivo truncado: no alcanza para leer la firma.
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg", size: 2, magicBytes: new Uint8Array([0xff, 0xd8]) }),
  { ok: false, codigo: "contenido" },
);
// RIFF sin WEBP.
const RIFF_AVI = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
]);
assert.deepEqual(validarComprobante({ mime: "image/webp", size: 1000, magicBytes: RIFF_AVI }), {
  ok: false,
  codigo: "contenido",
});

console.log("comprobantes: OK");
