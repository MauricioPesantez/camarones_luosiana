# Reset unico de preproduccion

Este procedimiento elimina **todos los datos** del esquema `public` indicado por
`DATABASE_URL`, reconstruye el modelo Prisma actual, registra el baseline como
aplicado y carga el seed.

No debe utilizarse en produccion.

## 1. Revisar el destino

```bash
npm run db:reset:preprod -- --show-target
```

El comando solo muestra el host, el nombre de la base y la confirmacion requerida;
no muestra usuario ni contraseña y no modifica la base.

## 2. Ejecutar una sola vez

Usa exactamente el valor que imprimio el paso anterior:

```bash
RESET_PREPROD_CONFIRM='BORRAR:host/base' npm run db:reset:preprod
```

El proceso se detiene ante cualquier error y ejecuta, en orden:

1. `prisma migrate reset --force --skip-seed --skip-generate`.
2. El baseline completo `20260731235900_baseline_current`.
3. `prisma/seed.ts`.
4. Regeneracion de Prisma Client.

## Resultado esperado

- Esquema completo, incluidos `PrintJob`, `PrintAgent` y `Orden.printRevision`.
- Productos, bebidas, 15 mesas y usuarios de prueba.
- Sin ordenes, historial, trabajos de impresion ni agentes previos.
- Historial de Prisma limpio y listo para futuras migraciones incrementales.

El baseline reemplaza el historial parcial de preproduccion. No debe desplegarse
sobre una base productiva que ya tenga migraciones registradas sin preparar un plan
de baselining especifico.
