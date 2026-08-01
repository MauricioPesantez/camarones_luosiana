import assert from 'node:assert/strict';

import {
  validarProductoNuevo,
  validarProductoParcial,
  validarUsuarioNuevo,
  validarUsuarioParcial,
} from './admin-validaciones';

/** Devuelve los datos validados o falla la prueba con el error recibido. */
function datosDe<T>(resultado: { ok: true; data: T } | { ok: false; error: string }): T {
  assert.equal(resultado.ok, true, `esperaba ok, llego: ${JSON.stringify(resultado)}`);
  return (resultado as { ok: true; data: T }).data;
}

function errorDe(resultado: { ok: boolean; error?: string }): string {
  assert.equal(resultado.ok, false, 'esperaba que la validacion fallara');
  return resultado.error ?? '';
}

function run(): void {
  // --- Producto nuevo ---
  const producto = datosDe(
    validarProductoNuevo({
      nombre: '  Ceviche mixto  ',
      categoria: ' Entradas ',
      precio: '12.499',
      descripcion: '   ',
      stock: 20,
    }),
  );

  assert.equal(producto.nombre, 'Ceviche mixto');
  assert.equal(producto.categoria, 'Entradas');
  // El precio se redondea a 2 decimales para calzar con Decimal(10, 2).
  assert.equal(producto.precio, 12.5);
  // Una descripcion en blanco se guarda como null, no como cadena vacia.
  assert.equal(producto.descripcion, null);
  assert.equal(producto.stock, 20);
  // Valores por defecto del esquema de Prisma.
  assert.equal(producto.stockMinimo, 5);
  assert.equal(producto.tiempoPreparacion, 0);
  assert.equal(producto.disponible, true);

  assert.match(errorDe(validarProductoNuevo({ categoria: 'Entradas', precio: 5 })), /nombre/i);
  assert.match(
    errorDe(validarProductoNuevo({ nombre: '   ', categoria: 'Entradas', precio: 5 })),
    /nombre/i,
  );
  assert.match(errorDe(validarProductoNuevo({ nombre: 'X', categoria: '', precio: 5 })), /categor/i);
  assert.match(errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: 0 })), /precio/i);
  assert.match(errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: -3 })), /precio/i);
  assert.match(
    errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: 'gratis' })),
    /precio/i,
  );
  assert.match(
    errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: 5, stock: -1 })),
    /stock/i,
  );
  assert.match(
    errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: 5, stock: 1.5 })),
    /stock/i,
  );
  assert.match(errorDe(validarProductoNuevo('no soy un objeto')), /invalid/i);

  // --- Producto parcial ---
  const parcial = datosDe(validarProductoParcial({ precio: 9.999 }));
  assert.deepEqual(parcial, { precio: 10 });

  // Desactivar un producto es un PATCH de un solo campo booleano.
  assert.deepEqual(datosDe(validarProductoParcial({ disponible: false })), { disponible: false });

  assert.match(errorDe(validarProductoParcial({})), /campos/i);
  assert.match(errorDe(validarProductoParcial({ nombre: '  ' })), /nombre/i);
  assert.match(errorDe(validarProductoParcial({ disponible: 'si' })), /disponible/i);

  // --- Usuario nuevo ---
  const usuario = datosDe(
    validarUsuarioNuevo({ nombre: ' Ana Torres ', rol: 'mesero', password: '' }),
  );
  assert.equal(usuario.nombre, 'Ana Torres');
  assert.equal(usuario.rol, 'mesero');
  // Clave vacia significa "entra sin contrasena", no cadena vacia.
  assert.equal(usuario.password, null);
  assert.equal(usuario.activo, true);

  assert.equal(
    datosDe(validarUsuarioNuevo({ nombre: 'Ana', rol: 'admin', password: '  1234  ' })).password,
    '1234',
  );

  assert.match(errorDe(validarUsuarioNuevo({ nombre: 'Ana', rol: 'gerente' })), /rol/i);
  assert.match(errorDe(validarUsuarioNuevo({ nombre: '', rol: 'admin' })), /nombre/i);

  // --- Usuario parcial ---
  assert.deepEqual(datosDe(validarUsuarioParcial({ activo: false })), { activo: false });
  // null explicito borra la clave; ausente no la toca.
  assert.deepEqual(datosDe(validarUsuarioParcial({ password: null })), { password: null });
  assert.deepEqual(datosDe(validarUsuarioParcial({ nombre: 'Ana' })), { nombre: 'Ana' });
  assert.match(errorDe(validarUsuarioParcial({})), /campos/i);
  assert.match(errorDe(validarUsuarioParcial({ rol: 'chef' })), /rol/i);

  console.log('admin-validaciones tests: ok');
}

run();
