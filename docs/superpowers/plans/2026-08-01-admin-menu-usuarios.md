# Gestión de menú y usuarios en el panel admin — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un administrador pueda crear y editar productos del menú y usuarios del sistema desde el panel, sin tocar la base de datos a mano.

**Architecture:** Sin migración de Prisma: `Producto` y `Usuario` ya tienen todos los campos. Se agrega una capa de validación pura y testeable (`lib/admin-validaciones.ts`) que consumen las rutas de API; las rutas se encargan solo de persistir y de detectar duplicados. En el frontend, `/admin/productos` pasa a tener dos pestañas (Stock y Menú) y aparece una ruta nueva `/admin/usuarios`; los formularios de alta y edición son el mismo componente dentro de un modal.

**Tech Stack:** Next.js 16 (App Router, componentes cliente), React 19, Prisma 5 sobre PostgreSQL, Tailwind CSS, `ts-node` + `node:assert/strict` para las pruebas.

Spec: `docs/superpowers/specs/2026-08-01-admin-menu-usuarios-design.md`

## Global Constraints

- **No se toca la autenticación.** Decisión explícita del dueño del proyecto. Las rutas nuevas no llevan comprobación de sesión y las contraseñas se guardan en texto plano, porque `app/api/auth/login/route.ts` compara `usuario.password === password`. No introduzcas bcrypt, cookies ni middleware en este plan.
- **Sin migraciones de Prisma.** Si crees necesitar una, el diseño está mal leído.
- **Sin borrado físico.** Productos y usuarios se desactivan (`disponible: false`, `activo: false`), nunca se borran: `Item` referencia a `Producto` y el historial de órdenes guarda nombres de usuario.
- **No cambiar el contrato existente de `GET /api/productos` ni de `GET /api/usuarios` sin el parámetro `?vista=admin`.** Los consumen las pantallas de mesero, cocina, digital y login.
- **Idioma del código:** identificadores, mensajes de error y comentarios en español, como el resto del repositorio. Los comentarios van sin tildes en los archivos de `lib/` (patrón existente).
- **Prisma serializa `Decimal` como string en JSON.** En el cliente, todo `precio` se lee con `Number(...)` antes de operar o formatear.
- Roles válidos, valor exacto: `admin`, `mesero`, `cocina`, `digital`.
- Verificación al cerrar cada tarea: `npx tsc --noEmit` sin errores y `npm run lint` sin errores nuevos.

---

## Estructura de archivos

**Nuevos**

| Archivo | Responsabilidad |
|---|---|
| `types/usuario.ts` | Catálogo de roles, type guard y forma `UsuarioAdmin` compartida cliente/servidor |
| `lib/admin-validaciones.ts` | Funciones puras que validan y normalizan cuerpos de producto y usuario. No importa Prisma |
| `lib/admin-validaciones.test.ts` | Pruebas de lo anterior |
| `app/api/productos/[id]/route.ts` | `PATCH` de producto |
| `app/admin/usuarios/page.tsx` | Pantalla de usuarios |
| `components/admin/GestionStock.tsx` | La pantalla de stock actual, extraída tal cual |
| `components/admin/GestionMenu.tsx` | Pestaña Menú: lista de productos con alta, edición y activar/desactivar |
| `components/admin/ModalFormulario.tsx` | Envoltorio visual del modal. Sin lógica de negocio |
| `components/admin/FormularioProducto.tsx` | Formulario de producto en modo crear o editar, incluido su `fetch` |
| `components/admin/FormularioUsuario.tsx` | Formulario de usuario en modo crear o editar, incluido su `fetch` |

**Modificados**

| Archivo | Cambio |
|---|---|
| `app/api/productos/route.ts` | `?vista=admin` en el `GET`; `POST` validado con 400/409 |
| `app/api/usuarios/route.ts` | `?vista=admin` en el `GET`; `POST` que sí guarda la contraseña |
| `app/api/usuarios/[id]/route.ts` | Se agrega `PATCH` |
| `app/admin/productos/page.tsx` | Queda como shell con pestañas |
| `app/admin/page.tsx` | Botón `👥 Usuarios` en el header |
| `package.json` | Script `test:admin-validaciones` |

---

## Task 1: Roles y capa de validación

Es la base de las dos tareas de API. Empieza aquí.

**Files:**
- Create: `types/usuario.ts`
- Create: `lib/admin-validaciones.ts`
- Test: `lib/admin-validaciones.test.ts`
- Modify: `package.json` (sección `scripts`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ROLES`, `type Rol`, `esRol(valor: unknown): valor is Rol`, `obtenerEtiquetaRol(rol: string): string`, `interface UsuarioAdmin`, `aUsuarioAdmin(usuario): UsuarioAdmin` desde `@/types/usuario`.
  - `type ResultadoValidacion<T>`, `interface DatosProducto`, `interface DatosUsuario`, `validarProductoNuevo(body: unknown): ResultadoValidacion<DatosProducto>`, `validarProductoParcial(body: unknown): ResultadoValidacion<Partial<DatosProducto>>`, `validarUsuarioNuevo(body: unknown): ResultadoValidacion<DatosUsuario>`, `validarUsuarioParcial(body: unknown): ResultadoValidacion<Partial<DatosUsuario>>` desde `@/lib/admin-validaciones`.

> Nota sobre el spec: éste habla de `validarProducto(body, { parcial })`. Se parte en dos funciones porque así el tipo de retorno del alta garantiza los campos obligatorios y las rutas no necesitan `!` ni casts.

- [ ] **Step 1: Crear el catálogo de roles**

Crea `types/usuario.ts`. Sigue el patrón de `NIVELES_PICANTE` en `types/orden.ts`.

```ts
// Tipos relacionados con usuarios del sistema

export const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'mesero', label: 'Mesero' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'digital', label: 'Canal digital' },
] as const;

export type Rol = (typeof ROLES)[number]['value'];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && ROLES.some((rol) => rol.value === valor);
}

export function obtenerEtiquetaRol(rol: string): string {
  return ROLES.find((opcion) => opcion.value === rol)?.label ?? rol;
}

/** Forma con la que el panel de administracion lee un usuario: nunca la clave. */
export interface UsuarioAdmin {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  tienePassword: boolean;
}

export function aUsuarioAdmin(usuario: {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  password: string | null;
}): UsuarioAdmin {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
    activo: usuario.activo,
    tienePassword: Boolean(usuario.password),
  };
}
```

- [ ] **Step 2: Escribir las pruebas de validación (fallan)**

Crea `lib/admin-validaciones.test.ts`. Mismo estilo que `lib/printer.test.ts`: `node:assert/strict`, una función `run()` y un `console.log` final.

```ts
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
  assert.match(errorDe(validarProductoNuevo({ nombre: '   ', categoria: 'Entradas', precio: 5 })), /nombre/i);
  assert.match(errorDe(validarProductoNuevo({ nombre: 'X', categoria: '', precio: 5 })), /categor/i);
  assert.match(errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: 0 })), /precio/i);
  assert.match(errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: -3 })), /precio/i);
  assert.match(errorDe(validarProductoNuevo({ nombre: 'X', categoria: 'Y', precio: 'gratis' })), /precio/i);
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
```

- [ ] **Step 3: Registrar el script de pruebas**

En `package.json`, dentro de `scripts`, justo después de la línea de `test:printer`:

```json
    "test:admin-validaciones": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/admin-validaciones.test.ts",
```

- [ ] **Step 4: Correr las pruebas para verlas fallar**

Run: `npm run test:admin-validaciones`
Expected: FAIL — `Cannot find module './admin-validaciones'`.

- [ ] **Step 5: Implementar la validación**

Crea `lib/admin-validaciones.ts`. El módulo no importa Prisma: la detección de duplicados vive en las rutas porque necesita la base.

```ts
import { esRol, type Rol } from '../types/usuario';

export type ResultadoValidacion<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface DatosProducto {
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string | null;
  tiempoPreparacion: number;
  stock: number;
  stockMinimo: number;
  disponible: boolean;
}

export interface DatosUsuario {
  nombre: string;
  rol: Rol;
  password: string | null;
  activo: boolean;
}

/** Error interno: lo atrapa `ejecutar` y lo convierte en { ok: false }. */
class ErrorValidacion extends Error {}

function objeto(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ErrorValidacion('El cuerpo de la peticion es invalido');
  }
  return body as Record<string, unknown>;
}

function texto(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorValidacion(`${campo} es obligatorio`);
  }
  return valor.trim();
}

/** Texto que puede venir vacio: se normaliza a null. */
function textoOpcional(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') {
    throw new ErrorValidacion(`${campo} debe ser texto`);
  }
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function precio(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new ErrorValidacion('El precio debe ser un numero mayor que 0');
  }
  // Decimal(10, 2) en la base: mas decimales se perderian en silencio.
  return Math.round(numero * 100) / 100;
}

function entero(valor: unknown, campo: string): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new ErrorValidacion(`${campo} debe ser un numero entero mayor o igual a 0`);
  }
  return numero;
}

function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== 'boolean') {
    throw new ErrorValidacion(`${campo} debe ser verdadero o falso`);
  }
  return valor;
}

function rolValido(valor: unknown): Rol {
  if (!esRol(valor)) {
    throw new ErrorValidacion('El rol seleccionado no es valido');
  }
  return valor;
}

function ejecutar<T>(construir: () => T): ResultadoValidacion<T> {
  try {
    return { ok: true, data: construir() };
  } catch (error) {
    if (error instanceof ErrorValidacion) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

function exigirCampos(parcial: object): void {
  if (Object.keys(parcial).length === 0) {
    throw new ErrorValidacion('No hay campos para actualizar');
  }
}

export function validarProductoNuevo(body: unknown): ResultadoValidacion<DatosProducto> {
  return ejecutar(() => {
    const datos = objeto(body);
    return {
      nombre: texto(datos.nombre, 'El nombre'),
      categoria: texto(datos.categoria, 'La categoria'),
      precio: precio(datos.precio),
      descripcion: textoOpcional(datos.descripcion, 'La descripcion'),
      tiempoPreparacion:
        datos.tiempoPreparacion === undefined
          ? 0
          : entero(datos.tiempoPreparacion, 'El tiempo de preparacion'),
      stock: datos.stock === undefined ? 0 : entero(datos.stock, 'El stock'),
      stockMinimo: datos.stockMinimo === undefined ? 5 : entero(datos.stockMinimo, 'El stock minimo'),
      disponible: datos.disponible === undefined ? true : booleano(datos.disponible, 'Disponible'),
    };
  });
}

export function validarProductoParcial(
  body: unknown,
): ResultadoValidacion<Partial<DatosProducto>> {
  return ejecutar(() => {
    const datos = objeto(body);
    const parcial: Partial<DatosProducto> = {};

    if ('nombre' in datos) parcial.nombre = texto(datos.nombre, 'El nombre');
    if ('categoria' in datos) parcial.categoria = texto(datos.categoria, 'La categoria');
    if ('precio' in datos) parcial.precio = precio(datos.precio);
    if ('descripcion' in datos) {
      parcial.descripcion = textoOpcional(datos.descripcion, 'La descripcion');
    }
    if ('tiempoPreparacion' in datos) {
      parcial.tiempoPreparacion = entero(datos.tiempoPreparacion, 'El tiempo de preparacion');
    }
    if ('stock' in datos) parcial.stock = entero(datos.stock, 'El stock');
    if ('stockMinimo' in datos) parcial.stockMinimo = entero(datos.stockMinimo, 'El stock minimo');
    if ('disponible' in datos) parcial.disponible = booleano(datos.disponible, 'Disponible');

    exigirCampos(parcial);
    return parcial;
  });
}

export function validarUsuarioNuevo(body: unknown): ResultadoValidacion<DatosUsuario> {
  return ejecutar(() => {
    const datos = objeto(body);
    return {
      nombre: texto(datos.nombre, 'El nombre'),
      rol: rolValido(datos.rol),
      password: textoOpcional(datos.password, 'La contrasena'),
      activo: datos.activo === undefined ? true : booleano(datos.activo, 'Activo'),
    };
  });
}

export function validarUsuarioParcial(
  body: unknown,
): ResultadoValidacion<Partial<DatosUsuario>> {
  return ejecutar(() => {
    const datos = objeto(body);
    const parcial: Partial<DatosUsuario> = {};

    if ('nombre' in datos) parcial.nombre = texto(datos.nombre, 'El nombre');
    if ('rol' in datos) parcial.rol = rolValido(datos.rol);
    // password ausente no se toca; null o cadena vacia borran la clave.
    if ('password' in datos) parcial.password = textoOpcional(datos.password, 'La contrasena');
    if ('activo' in datos) parcial.activo = booleano(datos.activo, 'Activo');

    exigirCampos(parcial);
    return parcial;
  });
}
```

- [ ] **Step 6: Correr las pruebas hasta que pasen**

Run: `npm run test:admin-validaciones`
Expected: PASS — `admin-validaciones tests: ok`

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida.

- [ ] **Step 8: Commit**

```bash
git add types/usuario.ts lib/admin-validaciones.ts lib/admin-validaciones.test.ts package.json
git commit -m "feat: validacion compartida de productos y usuarios admin"
```

---

## Task 2: API de productos

**Files:**
- Modify: `app/api/productos/route.ts` (archivo completo, 31 líneas hoy)
- Create: `app/api/productos/[id]/route.ts`

**Interfaces:**
- Consumes: `validarProductoNuevo`, `validarProductoParcial` de Task 1.
- Produces:
  - `GET /api/productos?vista=admin` → array de productos incluyendo los no disponibles.
  - `POST /api/productos` → 201 con el producto creado; 400 `{ error }`; 409 `{ error }`.
  - `PATCH /api/productos/:id` → 200 con el producto actualizado; 400, 404, 409 `{ error }`.

- [ ] **Step 1: Reescribir `app/api/productos/route.ts`**

Contenido completo del archivo:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validarProductoNuevo } from '@/lib/admin-validaciones';

export async function GET(request: Request) {
  try {
    // Sin ?vista=admin la respuesta es la de siempre: solo lo que se puede vender.
    const vistaAdmin = new URL(request.url).searchParams.get('vista') === 'admin';

    const productos = await prisma.producto.findMany({
      where: vistaAdmin ? undefined : { disponible: true },
      orderBy: [{ createdAt: 'asc' }],
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const validacion = validarProductoNuevo(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    const duplicado = await prisma.producto.findFirst({
      where: { nombre: { equals: datos.nombre, mode: 'insensitive' } },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: `Ya existe un producto llamado "${duplicado.nombre}"` },
        { status: 409 },
      );
    }

    const producto = await prisma.producto.create({ data: datos });
    return NextResponse.json(producto, { status: 201 });
  } catch (error) {
    console.error('Error al crear producto:', error);
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear `app/api/productos/[id]/route.ts`**

`params` es una promesa: es el patrón de Next 16 que ya usa `app/api/usuarios/[id]/route.ts`.

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validarProductoParcial } from '@/lib/admin-validaciones';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const validacion = validarProductoParcial(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    const producto = await prisma.producto.findUnique({ where: { id } });

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (datos.nombre) {
      const duplicado = await prisma.producto.findFirst({
        where: {
          id: { not: id },
          nombre: { equals: datos.nombre, mode: 'insensitive' },
        },
      });

      if (duplicado) {
        return NextResponse.json(
          { error: `Ya existe un producto llamado "${duplicado.nombre}"` },
          { status: 409 },
        );
      }
    }

    const actualizado = await prisma.producto.update({ where: { id }, data: datos });
    return NextResponse.json(actualizado);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida.

- [ ] **Step 4: Probar la API contra la base**

No hay infraestructura de pruebas de integración en el repositorio, así que esta verificación es manual. En una terminal:

```bash
npm run dev
```

En otra, uno por uno:

```bash
curl -s -X POST localhost:3000/api/productos -H 'Content-Type: application/json' -d '{"nombre":"Prueba plan","categoria":"Pruebas","precio":9.999,"stock":3}'
```
Expected: 201 con `"precio":"10"` y `"stockMinimo":5`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/productos -H 'Content-Type: application/json' -d '{"nombre":"prueba PLAN","categoria":"Pruebas","precio":5}'
```
Expected: `409` — el duplicado ignora mayúsculas.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/productos -H 'Content-Type: application/json' -d '{"nombre":"Otro","categoria":"Pruebas","precio":0}'
```
Expected: `400`.

Toma el `id` devuelto en el primer curl y guárdalo como `ID`:

```bash
curl -s -X PATCH localhost:3000/api/productos/$ID -H 'Content-Type: application/json' -d '{"disponible":false}'
```
Expected: 200 con `"disponible":false`.

```bash
curl -s localhost:3000/api/productos | grep -c 'Prueba plan'
```
Expected: `0` — desactivado, ya no sale en el menú.

```bash
curl -s 'localhost:3000/api/productos?vista=admin' | grep -c 'Prueba plan'
```
Expected: `1`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH localhost:3000/api/productos/no-existe -H 'Content-Type: application/json' -d '{"precio":5}'
```
Expected: `404`.

Deja el producto de prueba desactivado; la Task 5 lo usa para ver un producto inactivo en la lista. Bórralo de la base al terminar todo el plan si molesta.

- [ ] **Step 5: Commit**

```bash
git add app/api/productos/route.ts app/api/productos/\[id\]/route.ts
git commit -m "feat: alta y edicion de productos por API"
```

---

## Task 3: API de usuarios

**Files:**
- Modify: `app/api/usuarios/route.ts`
- Modify: `app/api/usuarios/[id]/route.ts` (se agrega `PATCH`, el `GET` no se toca)

**Interfaces:**
- Consumes: `validarUsuarioNuevo`, `validarUsuarioParcial` de Task 1; `aUsuarioAdmin`, `UsuarioAdmin` de Task 1.
- Produces:
  - `GET /api/usuarios?vista=admin` → `UsuarioAdmin[]`, activos e inactivos.
  - `POST /api/usuarios` → 201 con `UsuarioAdmin`; 400; 409.
  - `PATCH /api/usuarios/:id` → 200 con `UsuarioAdmin`; 400, 404, 409.

- [ ] **Step 1: Reescribir `app/api/usuarios/route.ts`**

Ojo con el `GET` sin parámetro: lo consume `app/login/page.tsx` y su forma no puede cambiar. Se aprovecha para quitar los `console.log` de depuración que quedaron en el archivo.

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validarUsuarioNuevo } from '@/lib/admin-validaciones';
import { aUsuarioAdmin } from '@/types/usuario';

export async function GET(request: Request) {
  try {
    const vistaAdmin = new URL(request.url).searchParams.get('vista') === 'admin';

    const usuarios = await prisma.usuario.findMany({
      where: vistaAdmin ? undefined : { activo: true },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        password: vistaAdmin,
      },
      orderBy: { nombre: 'asc' },
    });

    // La pantalla de login recibe exactamente la forma de siempre.
    if (!vistaAdmin) return NextResponse.json(usuarios);

    return NextResponse.json(
      (usuarios as { id: string; nombre: string; rol: string; activo: boolean; password: string | null }[])
        .map(aUsuarioAdmin),
    );
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener usuarios',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const validacion = validarUsuarioNuevo(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    const duplicado = await prisma.usuario.findFirst({
      where: { activo: true, nombre: { equals: datos.nombre, mode: 'insensitive' } },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: `Ya existe un usuario activo llamado "${duplicado.nombre}"` },
        { status: 409 },
      );
    }

    const usuario = await prisma.usuario.create({ data: datos });
    return NextResponse.json(aUsuarioAdmin(usuario), { status: 201 });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Agregar `PATCH` a `app/api/usuarios/[id]/route.ts`**

Deja el `GET` existente intacto — el login depende de él — y agrega al final del archivo, junto con los imports nuevos arriba:

```ts
import { validarUsuarioParcial } from '@/lib/admin-validaciones';
import { aUsuarioAdmin } from '@/types/usuario';
```

```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validacion = validarUsuarioParcial(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    const usuario = await prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (datos.nombre) {
      const duplicado = await prisma.usuario.findFirst({
        where: {
          id: { not: id },
          activo: true,
          nombre: { equals: datos.nombre, mode: 'insensitive' },
        },
      });

      if (duplicado) {
        return NextResponse.json(
          { error: `Ya existe un usuario activo llamado "${duplicado.nombre}"` },
          { status: 409 }
        );
      }
    }

    const actualizado = await prisma.usuario.update({ where: { id }, data: datos });
    return NextResponse.json(aUsuarioAdmin(actualizado));
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida.

- [ ] **Step 4: Probar la API contra la base**

Con `npm run dev` corriendo:

```bash
curl -s -X POST localhost:3000/api/usuarios -H 'Content-Type: application/json' -d '{"nombre":"Prueba Plan","rol":"mesero","password":"1234"}'
```
Expected: 201 con `"tienePassword":true` y **sin** campo `password`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/usuarios -H 'Content-Type: application/json' -d '{"nombre":"Nadie","rol":"gerente"}'
```
Expected: `400`.

Guarda el `id` devuelto como `ID`:

```bash
curl -s -X PATCH localhost:3000/api/usuarios/$ID -H 'Content-Type: application/json' -d '{"password":null}'
```
Expected: 200 con `"tienePassword":false`.

```bash
curl -s -X PATCH localhost:3000/api/usuarios/$ID -H 'Content-Type: application/json' -d '{"activo":false}'
curl -s localhost:3000/api/usuarios | grep -c 'Prueba Plan'
```
Expected: `0` — desactivado, desaparece del login.

```bash
curl -s 'localhost:3000/api/usuarios?vista=admin' | grep -c 'Prueba Plan'
```
Expected: `1`.

Confirma además que el login sigue funcionando: abre `localhost:3000/login`, elige el usuario admin del seed y entra con su contraseña.

- [ ] **Step 5: Commit**

```bash
git add app/api/usuarios/route.ts app/api/usuarios/\[id\]/route.ts
git commit -m "feat: alta y edicion de usuarios por API"
```

---

## Task 4: Pestañas en `/admin/productos`

Refactor puro: la pantalla de stock no cambia de comportamiento, solo de archivo. Se hace en su propia tarea para que el diff de la Task 5 sea legible.

**Files:**
- Create: `components/admin/GestionStock.tsx`
- Modify: `app/admin/productos/page.tsx`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `export default function GestionStock(): JSX.Element` en `components/admin/GestionStock.tsx` — se monta solo, carga sus productos y no recibe props.

- [ ] **Step 1: Extraer la gestión de stock a su componente**

Crea `components/admin/GestionStock.tsx` con la lógica que hoy vive en `app/admin/productos/page.tsx`:

- Mueve **verbatim** desde el archivo actual: el `import { ProductoConStock }`, los estados `productos`, `loading`, `productoEditando`, `nuevoStock`, `operacion`, las funciones `cargarProductos`, `actualizarStock`, `getStockColor`, `getStockBgColor`, `getBadge`, y todo el JSX desde el `<div className="max-w-5xl mx-auto px-4 py-4">` hasta su cierre (líneas 148–368 del archivo original).
- **No** muevas: el `useAuth`, el header sticky, los bloques de `authLoading` y de "Acceso denegado". Eso se queda en la página.
- El `useEffect` deja de depender de `usuario`: la página ya garantiza que solo se monta para un admin.

Estructura resultante:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ProductoConStock } from "@/types/stock";

export default function GestionStock() {
  const [productos, setProductos] = useState<ProductoConStock[]>([]);
  // ...resto de estados movidos sin cambios...

  const cargarProductos = async () => {
    // ...movido sin cambios...
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  // ...actualizarStock, getStockColor, getStockBgColor, getBadge movidos sin cambios...

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      {/* selector de operacion, lista movil y tabla de escritorio, movidos sin cambios */}
    </div>
  );
}
```

- [ ] **Step 2: Convertir la página en shell con pestañas**

Reemplaza `app/admin/productos/page.tsx` por:

```tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import GestionStock from "@/components/admin/GestionStock";

type Pestana = "stock" | "menu";

export default function ProductosPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [pestana, setPestana] = useState<Pestana>("stock");

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  const claseTab = (valor: Pestana) =>
    `flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${
      pestana === valor ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 leading-tight">Productos</h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              Inventario y catálogo del menú
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => (window.location.href = "/admin")}
              className="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 whitespace-nowrap"
            >
              ← Admin
            </button>
            <button
              onClick={logout}
              className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 whitespace-nowrap"
            >
              Salir
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-3 flex gap-2 bg-gray-50 p-1 rounded-xl">
          <button onClick={() => setPestana("stock")} className={claseTab("stock")}>
            📦 Stock
          </button>
          <button onClick={() => setPestana("menu")} className={claseTab("menu")}>
            🍽️ Menú
          </button>
        </div>
      </div>

      {pestana === "stock" ? <GestionStock /> : null}
    </div>
  );
}
```

La pestaña Menú queda sin contenido hasta la Task 5; el `null` es intencional y se reemplaza allí.

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificar en el navegador**

Con `npm run dev`, entra como admin a `localhost:3000/admin/productos`. La pestaña Stock debe verse y comportarse exactamente igual que antes: ajustar stock de un producto sigue funcionando y la lista se recarga.

- [ ] **Step 5: Commit**

```bash
git add components/admin/GestionStock.tsx app/admin/productos/page.tsx
git commit -m "refactor: extraer gestion de stock y agregar pestanas en productos"
```

---

## Task 5: Pestaña Menú con alta y edición de productos

**Files:**
- Create: `components/admin/ModalFormulario.tsx`
- Create: `components/admin/FormularioProducto.tsx`
- Create: `components/admin/GestionMenu.tsx`
- Modify: `app/admin/productos/page.tsx` (reemplazar el `null` de la pestaña Menú)

**Interfaces:**
- Consumes: `GET /api/productos?vista=admin`, `POST /api/productos`, `PATCH /api/productos/:id` de Task 2; el shell de pestañas de Task 4.
- Produces:
  - `ModalFormulario({ titulo, onCerrar, children })` — reutilizado por Task 6.
  - `GestionMenu()` sin props.

- [ ] **Step 1: Crear el envoltorio del modal**

`components/admin/ModalFormulario.tsx`. Las clases siguen el modal existente en `components/admin/DetalleOrdenModal.tsx:160`.

```tsx
"use client";

import { ReactNode } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}

export default function ModalFormulario({ titulo, onCerrar, children }: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 flex justify-between items-center bg-gray-50 sticky top-0">
          <h2 className="text-xl font-bold text-gray-800">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear el formulario de producto**

`components/admin/FormularioProducto.tsx`. Un solo componente para crear y editar: la diferencia es si recibe `producto` o `null`. El campo de stock inicial solo aparece al crear, porque editar stock es trabajo de la otra pestaña.

```tsx
"use client";

import { FormEvent, useState } from "react";
import { ProductoConStock } from "@/types/stock";

interface Props {
  producto: ProductoConStock | null;
  categorias: string[];
  onCancelar: () => void;
  onGuardado: () => void;
}

const claseCampo =
  "w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-black text-sm focus:outline-none focus:border-blue-500";
const claseEtiqueta = "block text-sm font-semibold text-gray-700 mb-1";

export default function FormularioProducto({
  producto,
  categorias,
  onCancelar,
  onGuardado,
}: Props) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [categoria, setCategoria] = useState(producto?.categoria ?? "");
  // Prisma serializa Decimal como string: Number() antes de mostrarlo.
  const [precio, setPrecio] = useState(producto ? String(Number(producto.precio)) : "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [tiempoPreparacion, setTiempoPreparacion] = useState(
    String(producto?.tiempoPreparacion ?? 0),
  );
  const [stock, setStock] = useState("0");
  const [stockMinimo, setStockMinimo] = useState(String(producto?.stockMinimo ?? 5));
  const [disponible, setDisponible] = useState(producto?.disponible ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);

    const cuerpo: Record<string, unknown> = {
      nombre,
      categoria,
      precio: Number(precio),
      descripcion,
      tiempoPreparacion: Number(tiempoPreparacion),
      stockMinimo: Number(stockMinimo),
      disponible,
    };

    // El stock solo se fija al crear: despues se ajusta en la pestana Stock.
    if (!producto) cuerpo.stock = Number(stock);

    try {
      const res = await fetch(
        producto ? `/api/productos/${producto.id}` : "/api/productos",
        {
          method: producto ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el producto");
        return;
      }

      onGuardado();
    } catch (error) {
      console.error("Error al guardar producto:", error);
      setError("Error de conexión al guardar el producto");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div>
        <label className={claseEtiqueta} htmlFor="producto-nombre">
          Nombre
        </label>
        <input
          id="producto-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={claseCampo}
          autoFocus
        />
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="producto-categoria">
          Categoría
        </label>
        <input
          id="producto-categoria"
          list="categorias-existentes"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className={claseCampo}
          placeholder="Ej: Entradas"
        />
        {/* Sugerir las categorias que ya existen evita "Bebidas" y "bebidas". */}
        <datalist id="categorias-existentes">
          {categorias.map((valor) => (
            <option key={valor} value={valor} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={claseEtiqueta} htmlFor="producto-precio">
            Precio ($)
          </label>
          <input
            id="producto-precio"
            type="number"
            step="0.01"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={claseCampo}
          />
        </div>
        <div>
          <label className={claseEtiqueta} htmlFor="producto-tiempo">
            Tiempo prep. (min)
          </label>
          <input
            id="producto-tiempo"
            type="number"
            min="0"
            value={tiempoPreparacion}
            onChange={(e) => setTiempoPreparacion(e.target.value)}
            className={claseCampo}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!producto && (
          <div>
            <label className={claseEtiqueta} htmlFor="producto-stock">
              Stock inicial
            </label>
            <input
              id="producto-stock"
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={claseCampo}
            />
          </div>
        )}
        <div>
          <label className={claseEtiqueta} htmlFor="producto-stock-minimo">
            Stock mínimo
          </label>
          <input
            id="producto-stock-minimo"
            type="number"
            min="0"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className={claseCampo}
          />
        </div>
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="producto-descripcion">
          Descripción (opcional)
        </label>
        <textarea
          id="producto-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className={claseCampo}
          rows={2}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={disponible}
          onChange={(e) => setDisponible(e.target.checked)}
          className="w-4 h-4"
        />
        Disponible en el menú
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-semibold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50"
        >
          {guardando ? "Guardando..." : producto ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Crear la pestaña Menú**

`components/admin/GestionMenu.tsx`. Mismo patrón responsive del resto del panel: tarjetas en móvil, tabla en escritorio.

```tsx
"use client";

import { useEffect, useState } from "react";
import { ProductoConStock } from "@/types/stock";
import ModalFormulario from "./ModalFormulario";
import FormularioProducto from "./FormularioProducto";

export default function GestionMenu() {
  const [productos, setProductos] = useState<ProductoConStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<ProductoConStock | null>(null);

  const cargarProductos = async () => {
    setLoading(true);
    try {
      // vista=admin es la unica forma de ver tambien los desactivados.
      const res = await fetch("/api/productos?vista=admin");
      const data = await res.json();
      setProductos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  const categorias = Array.from(new Set(productos.map((p) => p.categoria))).sort();

  const abrirCreacion = () => {
    setProductoEditando(null);
    setModalAbierto(true);
  };

  const abrirEdicion = (producto: ProductoConStock) => {
    setProductoEditando(producto);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setProductoEditando(null);
  };

  const alGuardar = async () => {
    cerrarModal();
    await cargarProductos();
  };

  const alternarDisponible = async (producto: ProductoConStock) => {
    try {
      const res = await fetch(`/api/productos/${producto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponible: !producto.disponible }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo cambiar el estado del producto");
        return;
      }

      await cargarProductos();
    } catch (error) {
      console.error("Error al cambiar disponibilidad:", error);
      alert("Error de conexión al cambiar el estado del producto");
    }
  };

  const badgeEstado = (producto: ProductoConStock) =>
    producto.disponible ? (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Activo
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-600">
        Inactivo
      </span>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {productos.length} producto{productos.length === 1 ? "" : "s"} en el catálogo
        </span>
        <button
          onClick={abrirCreacion}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-semibold"
        >
          + Nuevo producto
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando productos...</div>
      ) : (
        <>
          {/* === MOBILE: tarjetas === */}
          <div className="flex flex-col gap-3 sm:hidden">
            {productos.map((producto) => (
              <div
                key={producto.id}
                className={`bg-white rounded-xl shadow p-4 ${producto.disponible ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{producto.nombre}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{producto.categoria}</div>
                  </div>
                  {badgeEstado(producto)}
                </div>
                <div className="text-lg font-bold text-gray-800 mb-3">
                  ${Number(producto.precio).toFixed(2)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirEdicion(producto)}
                    className="flex-1 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarDisponible(producto)}
                    className="flex-1 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 font-semibold"
                  >
                    {producto.disponible ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* === DESKTOP: tabla === */}
          <div className="hidden sm:block bg-white rounded-xl shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Producto
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Categoría
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                    Precio
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productos.map((producto) => (
                  <tr key={producto.id} className={producto.disponible ? "" : "bg-gray-50"}>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {producto.nombre}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{producto.categoria}</td>
                    <td className="px-5 py-4 text-sm text-right font-semibold text-gray-800">
                      ${Number(producto.precio).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-center">{badgeEstado(producto)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => abrirEdicion(producto)}
                          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => alternarDisponible(producto)}
                          className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
                        >
                          {producto.disponible ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalAbierto && (
        <ModalFormulario
          titulo={productoEditando ? "Editar producto" : "Nuevo producto"}
          onCerrar={cerrarModal}
        >
          <FormularioProducto
            producto={productoEditando}
            categorias={categorias}
            onCancelar={cerrarModal}
            onGuardado={alGuardar}
          />
        </ModalFormulario>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Conectar la pestaña**

En `app/admin/productos/page.tsx`, agrega el import y reemplaza el `null`:

```tsx
import GestionMenu from "@/components/admin/GestionMenu";
```

```tsx
      {pestana === "stock" ? <GestionStock /> : <GestionMenu />}
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador**

Con `npm run dev`, entra como admin a `localhost:3000/admin/productos`, pestaña Menú:

1. El producto desactivado en la Task 2 aparece con badge Inactivo.
2. **+ Nuevo producto** → crear uno con precio `8.50` y categoría nueva. Aparece en la lista.
3. Abrir el mesero en `localhost:3000/mesero`: el producto nuevo está disponible para pedir.
4. Volver al menú, **Desactivar** ese producto, recargar el mesero: ya no aparece, pero sigue en la pestaña Menú.
5. **Editar** el producto, cambiar el precio, guardar: la lista muestra el precio nuevo.
6. **Editar** y ponerle el nombre de otro producto existente: el modal muestra el mensaje de duplicado y no cierra.
7. Crear un producto con precio `0`: el modal muestra el error de precio.
8. Al editar, el campo Stock inicial no aparece.

- [ ] **Step 7: Commit**

```bash
git add components/admin/ModalFormulario.tsx components/admin/FormularioProducto.tsx components/admin/GestionMenu.tsx app/admin/productos/page.tsx
git commit -m "feat: gestion del menu desde el panel admin"
```

---

## Task 6: Pantalla de usuarios

**Files:**
- Create: `components/admin/FormularioUsuario.tsx`
- Create: `app/admin/usuarios/page.tsx`
- Modify: `app/admin/page.tsx:328-338` (bloque de botones del header)

**Interfaces:**
- Consumes: `UsuarioAdmin`, `ROLES`, `obtenerEtiquetaRol` de Task 1; los endpoints de Task 3; `ModalFormulario` de Task 5.
- Produces: la ruta `/admin/usuarios`.

- [ ] **Step 1: Crear el formulario de usuario**

`components/admin/FormularioUsuario.tsx`. La clave vacía al editar significa "no cambiar"; borrarla es un botón aparte.

```tsx
"use client";

import { FormEvent, useState } from "react";
import { ROLES, UsuarioAdmin } from "@/types/usuario";

interface Props {
  usuario: UsuarioAdmin | null;
  /** true cuando el admin se esta editando a si mismo: no puede cambiarse el rol. */
  esUsuarioActual: boolean;
  onCancelar: () => void;
  onGuardado: () => void;
}

const claseCampo =
  "w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-black text-sm focus:outline-none focus:border-blue-500";
const claseEtiqueta = "block text-sm font-semibold text-gray-700 mb-1";

export default function FormularioUsuario({
  usuario,
  esUsuarioActual,
  onCancelar,
  onGuardado,
}: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [rol, setRol] = useState(usuario?.rol ?? "mesero");
  const [password, setPassword] = useState("");
  const [quitarPassword, setQuitarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const tendraPassword = quitarPassword
    ? false
    : password.trim() !== "" || (usuario?.tienePassword ?? false);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);

    const cuerpo: Record<string, unknown> = { nombre, rol };

    // Al editar, un campo de clave vacio no toca la clave existente.
    if (quitarPassword) cuerpo.password = null;
    else if (!usuario || password.trim() !== "") cuerpo.password = password;

    try {
      const res = await fetch(usuario ? `/api/usuarios/${usuario.id}` : "/api/usuarios", {
        method: usuario ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el usuario");
        return;
      }

      onGuardado();
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      setError("Error de conexión al guardar el usuario");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div>
        <label className={claseEtiqueta} htmlFor="usuario-nombre">
          Nombre
        </label>
        <input
          id="usuario-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={claseCampo}
          autoFocus
        />
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="usuario-rol">
          Rol
        </label>
        <select
          id="usuario-rol"
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          className={`${claseCampo} disabled:bg-gray-100 disabled:text-gray-500`}
          disabled={esUsuarioActual}
        >
          {ROLES.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
        {esUsuarioActual && (
          <p className="mt-1 text-xs text-gray-500">
            No puedes cambiar tu propio rol: perderías el acceso al panel.
          </p>
        )}
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="usuario-password">
          Contraseña {usuario ? "(dejar vacío para no cambiarla)" : "(opcional)"}
        </label>
        <input
          id="usuario-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (e.target.value !== "") setQuitarPassword(false);
          }}
          className={claseCampo}
          autoComplete="new-password"
        />
        {usuario?.tienePassword && (
          <button
            type="button"
            onClick={() => {
              setQuitarPassword(true);
              setPassword("");
            }}
            className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Quitar contraseña
          </button>
        )}
      </div>

      {!tendraPassword && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-3 py-2">
          Sin contraseña, este usuario entra al sistema con solo elegir su nombre en el login.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-semibold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50"
        >
          {guardando ? "Guardando..." : usuario ? "Guardar cambios" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Crear la pantalla de usuarios**

`app/admin/usuarios/page.tsx`. El guard es el mismo patrón de las otras pantallas admin. Nadie puede desactivarse a sí mismo: es la forma fácil de quedar fuera del panel.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { obtenerEtiquetaRol, UsuarioAdmin } from "@/types/usuario";
import ModalFormulario from "@/components/admin/ModalFormulario";
import FormularioUsuario from "@/components/admin/FormularioUsuario";

export default function UsuariosPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioAdmin | null>(null);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/usuarios?vista=admin");
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      cargarUsuarios();
    }
  }, [usuario]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  const abrirCreacion = () => {
    setUsuarioEditando(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setUsuarioEditando(null);
  };

  const alGuardar = async () => {
    cerrarModal();
    await cargarUsuarios();
  };

  const alternarActivo = async (registro: UsuarioAdmin) => {
    // Desactivarse a uno mismo deja el panel sin forma de volver a entrar.
    if (registro.id === usuario.id) {
      alert("No puedes desactivar tu propio usuario");
      return;
    }

    try {
      const res = await fetch(`/api/usuarios/${registro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !registro.activo }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo cambiar el estado del usuario");
        return;
      }

      await cargarUsuarios();
    } catch (error) {
      console.error("Error al cambiar estado del usuario:", error);
      alert("Error de conexión al cambiar el estado del usuario");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 leading-tight">Usuarios</h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              Personal con acceso al sistema
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => (window.location.href = "/admin")}
              className="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 whitespace-nowrap"
            >
              ← Admin
            </button>
            <button
              onClick={logout}
              className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 whitespace-nowrap"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">
            {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={abrirCreacion}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-semibold"
          >
            + Nuevo usuario
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando usuarios...</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {usuarios.map((registro) => (
                <li
                  key={registro.id}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">
                      {registro.nombre}
                      {registro.id === usuario.id && (
                        <span className="ml-2 text-xs font-normal text-gray-400">(tú)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {obtenerEtiquetaRol(registro.rol)} ·{" "}
                      {registro.tienePassword ? "con contraseña" : "sin contraseña"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {registro.activo ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-600">
                        Inactivo
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setUsuarioEditando(registro);
                        setModalAbierto(true);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => alternarActivo(registro)}
                      disabled={registro.id === usuario.id}
                      className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-40"
                    >
                      {registro.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalFormulario
          titulo={usuarioEditando ? "Editar usuario" : "Nuevo usuario"}
          onCerrar={cerrarModal}
        >
          <FormularioUsuario
            usuario={usuarioEditando}
            esUsuarioActual={usuarioEditando?.id === usuario.id}
            onCancelar={cerrarModal}
            onGuardado={alGuardar}
          />
        </ModalFormulario>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Enlazar desde el panel**

En `app/admin/page.tsx`, dentro del `div` de botones del header, después del enlace a `/admin/productos` (línea 335):

```tsx
            <a
              href="/admin/usuarios"
              className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 font-semibold"
            >
              👥 Usuarios
            </a>
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificar en el navegador**

Con `npm run dev`, entra como admin:

1. `/admin` muestra el botón **👥 Usuarios** y lleva a la pantalla.
2. La lista incluye al usuario desactivado en la Task 3, con badge Inactivo.
3. **+ Nuevo usuario** con rol Mesero y contraseña `1234`. Aparece como "con contraseña".
4. Cerrar sesión y entrar con ese usuario: pide la clave y entra al `/mesero`.
5. Volver a `/admin/usuarios` como admin, editar ese usuario, **Quitar contraseña**, guardar. El aviso amarillo aparece antes de guardar y la lista queda en "sin contraseña".
6. Cerrar sesión: ese usuario ahora entra sin clave.
7. Intentar crear un usuario con el nombre de otro activo: mensaje de duplicado en el modal.
8. El botón Desactivar de tu propia fila está deshabilitado, y al editarte a ti mismo el selector de rol está bloqueado.
9. Desactivar a otro usuario y confirmar que desaparece de la pantalla de login.

- [ ] **Step 6: Correr toda la batería de pruebas**

```bash
npm run test:admin-validaciones && npm run test:printer && npm run test:print-jobs && npm run test:print-agent && npm run test:print-config && npm run test:daily-order-number
```
Expected: todas terminan en `ok`.

- [ ] **Step 7: Commit**

```bash
git add components/admin/FormularioUsuario.tsx app/admin/usuarios/page.tsx app/admin/page.tsx
git commit -m "feat: gestion de usuarios desde el panel admin"
```

---

## Task 7: Sanear los errores de lint de react-hooks

Deuda encontrada mientras se ejecutaba este plan, no causada por él: `npm run
lint` termina con 8 errores en pantallas que ya existían. Al extraer
`GestionStock.tsx` en la Task 4 el problema se mudó de archivo pero no
desapareció, así que conviene cerrarlo. Va al final a propósito: toca pantallas
de mesero, cocina y admin, y no debe mezclarse con la feature.

**Files:**
- Modify: `app/admin/page.tsx:206`
- Modify: `app/admin/reportes/page.tsx:57` y `:89`
- Modify: `app/digital/page.tsx:114`
- Modify: `app/mesero/page.tsx:117`
- Modify: `components/admin/DetalleOrdenModal.tsx:156`
- Modify: `components/admin/GestionStock.tsx:29`
- Modify: `components/mesero/CrearOrden.tsx:74`

**Interfaces:**
- Consumes: nada.
- Produces: nada. Es refactor sin cambio de comportamiento observable.

Son dos reglas distintas, con dos arreglos distintos.

**`react-hooks/set-state-in-effect`** (7 de los 8): el efecto de carga inicial
llama a una función que hace `setLoading(true)` de forma síncrona, lo que
provoca un render en cascada. El arreglo es arrancar el estado ya en `true` y
que la función solo lo apague al terminar:

```tsx
// Antes
const [loading, setLoading] = useState(false);

const cargarProductos = async () => {
  setLoading(true);
  try {
    const res = await fetch("/api/productos");
    setProductos(await res.json());
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  cargarProductos();
}, []);
```

No basta con evitar el `setLoading(true)`: la regla marca cualquier función
invocada de forma sincrona en el efecto que por dentro escriba estado, sin
importar las guardas. Lo que sí acepta es escribir estado dentro del callback de
la promesa. El arreglo es partir la carga en dos: una función que solo trae
datos, y el estado se escribe fuera de ella.

```tsx
// Despues. Verificado contra el linter en components/admin/GestionMenu.tsx.
async function obtenerProductos(): Promise<ProductoConStock[]> {
  try {
    const res = await fetch("/api/productos");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error al cargar productos:", error);
    return [];
  }
}

// Dentro del componente:
const [loading, setLoading] = useState(true);

// Para las recargas manuales (tras guardar, tras un PATCH...).
const cargarProductos = async () => {
  setLoading(true);
  try {
    setProductos(await obtenerProductos());
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  let vigente = true;

  obtenerProductos().then((data) => {
    if (!vigente) return;
    setProductos(data);
    setLoading(false);
  });

  return () => {
    vigente = false;
  };
}, []);
```

El `vigente` evita escribir estado si el componente se desmonta antes de que
responda la petición.

**`react-hooks/purity`** (`app/admin/reportes/page.tsx:57`): se llama a
`new Date()` durante el render, que no es puro. El arreglo es el inicializador
perezoso de `useState`, que corre una sola vez:

```tsx
// Antes
const [fechaFin, setFechaFin] = useState(new Date().toISOString().split("T")[0]);

// Despues
const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split("T")[0]);
```

- [ ] **Step 1: Arreglar los siete `set-state-in-effect`**

Aplica la transformación de arriba archivo por archivo, en el orden de la lista.
Cada pantalla tiene su propio nombre de función de carga (`cargarProductos`,
`cargarOrdenes`, `cargarReportes`...); respeta el que ya exista.

- [ ] **Step 2: Arreglar los dos `purity` de reportes**

Ambos `useState` de fecha en `app/admin/reportes/page.tsx:56-62` pasan a
inicializador perezoso.

- [ ] **Step 3: Verificar que el lint queda limpio**

Run: `npm run lint`
Expected: `0 errors`. Los avisos de `react-hooks/exhaustive-deps` pueden
quedarse: son warnings, no errores, y arreglarlos cambia el comportamiento de
las recargas.

- [ ] **Step 4: Verificar que las pantallas siguen funcionando**

Con `npm run dev`, abre `/mesero`, `/cocina`, `/digital`, `/admin`,
`/admin/reportes` y `/admin/productos`. Cada una debe cargar sus datos como
antes; el único cambio visible es que el indicador de carga aparece desde el
primer render en vez de un instante después.

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/admin/reportes/page.tsx app/digital/page.tsx app/mesero/page.tsx components/admin/DetalleOrdenModal.tsx components/admin/GestionStock.tsx components/mesero/CrearOrden.tsx
git commit -m "refactor: evitar setState sincrono en efectos de carga"
```

---

## Limpieza final

- [ ] Borrar de la base los registros de prueba creados por los curl de las Tasks 2 y 3 (`Prueba plan`, `Prueba Plan`), o dejarlos desactivados si el entorno es de preproducción.
- [ ] Confirmar que `git status` no deja archivos sueltos.
