# 🎯 Guía Rápida de Referencia - Restaurant POS

## 🚀 Comandos Rápidos

### Iniciar el proyecto

```bash
npm run dev
```

Abre: http://localhost:3000

### Ver base de datos visualmente

```bash
npx prisma studio
```

Abre: http://localhost:5555

### Repoblar base de datos

```bash
npm run seed
```

### Ver logs en tiempo real

```bash
# En otra terminal mientras npm run dev está corriendo
tail -f .next/trace
```

## 📊 Operaciones Comunes en Base de Datos

### Agregar un producto nuevo

**Opción 1: Prisma Studio**

```bash
npx prisma studio
# Navega a Producto → Add Record
```

**Opción 2: SQL Directo**

```sql
INSERT INTO "Producto" (id, nombre, categoria, precio, disponible)
VALUES (gen_random_uuid(), 'Langostinos al Ajillo', 'Platos Fuertes', 16.50, true);
```

**Opción 3: Modificar seed**

```typescript
// En prisma/seed.ts, agrega al array de productos:
{ nombre: 'Nuevo Plato', categoria: 'Platos Fuertes', precio: 15.0 }
```

### Ver todas las órdenes

```sql
SELECT
  o.id,
  o."numeroMesa",
  o.mesero,
  o.estado,
  o.total,
  o."createdAt"
FROM "Orden" o
ORDER BY o."createdAt" DESC
LIMIT 10;
```

### Ver productos más vendidos

```sql
SELECT
  p.nombre,
  SUM(i.cantidad) as total_vendido
FROM "Producto" p
JOIN "Item" i ON p.id = i."productoId"
GROUP BY p.id, p.nombre
ORDER BY total_vendido DESC
LIMIT 10;
```

### Cambiar precio de un producto

```sql
UPDATE "Producto"
SET precio = 12.50
WHERE nombre = 'Ceviche de Camarón';
```

### Deshabilitar un producto

```sql
UPDATE "Producto"
SET disponible = false
WHERE nombre = 'Producto Agotado';
```

## 🖨️ Solución de Problemas de Impresión

### Probar conexión con impresora

```bash
# Test de ping
ping 192.168.1.100

# Ver si el puerto está abierto (macOS/Linux)
nc -zv 192.168.1.100 9100

# En Windows PowerShell
Test-NetConnection -ComputerName 192.168.1.100 -Port 9100
```

### Cambiar configuración de impresora

Edita `lib/printer.ts`:

```typescript
// Cambiar tipo de impresora
type: ThermalPrinter.types.STAR,  // En lugar de EPSON

// Cambiar codificación de caracteres
characterSet: 'SLOVENIA',  // Prueba: PC437, PC850, PC860, etc.

// Aumentar timeout
options: {
  timeout: 10000,  // 10 segundos
}
```

### Imprimir comanda de prueba

Crea `test-printer.ts` en la raíz:

```typescript
import { PrinterService } from "./lib/printer";

const testOrder = {
  id: "test123",
  numeroMesa: 1,
  mesero: "Test",
  createdAt: new Date(),
  items: [
    {
      cantidad: 2,
      producto: { nombre: "Test Product" },
      observaciones: "Sin sal",
    },
  ],
  observaciones: "Orden de prueba",
};

const printer = new PrinterService();
printer.imprimirComanda(testOrder);
```

Ejecuta:

```bash
npx ts-node test-printer.ts
```

## 🔧 Modificaciones Comunes

### Cambiar puerto del servidor

```bash
# En package.json, modifica:
"dev": "next dev -p 3001"
```

### Agregar nueva categoría de productos

1. En `prisma/seed.ts`:

```typescript
{ nombre: 'Postre Especial', categoria: 'Postres', precio: 5.0 }
```

2. Ejecuta:

```bash
npm run seed
```

### Personalizar colores de Tailwind

Edita `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      primary: '#0066CC',
      secondary: '#FF6B35',
    }
  }
}
```

### Cambiar tiempo de auto-refresh en cocina

En `app/cocina/page.tsx`:

```typescript
const interval = setInterval(cargarOrdenes, 10000); // 10 segundos
```

### Agregar campo de "propina" a las órdenes

1. Actualiza `prisma/schema.prisma`:

```prisma
model Orden {
  // ... campos existentes ...
  propina Decimal @db.Decimal(10, 2) @default(0)
}
```

2. Crea migración:

```bash
npx prisma migrate dev --name add_propina
```

3. Actualiza componentes para incluir propina

## 📱 URLs Importantes

| URL                          | Descripción        |
| ---------------------------- | ------------------ |
| http://localhost:3000        | Redirige a mesero  |
| http://localhost:3000/mesero | Interfaz de mesero |
| http://localhost:3000/cocina | Monitor de cocina  |
| http://localhost:5555        | Prisma Studio      |

## 🗂️ Archivos Importantes para Editar

| Archivo                            | Para modificar       |
| ---------------------------------- | -------------------- |
| `prisma/seed.ts`                   | Productos iniciales  |
| `lib/printer.ts`                   | Formato de impresión |
| `components/mesero/CrearOrden.tsx` | Interfaz de mesero   |
| `app/cocina/page.tsx`              | Monitor de cocina    |
| `app/api/ordenes/route.ts`         | Lógica de órdenes    |
| `.env.local`                       | Configuración        |

## 🎨 Personalizar Interfaz

### Cambiar logo/nombre del restaurante

En `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Mi Restaurante",
  description: "El mejor ceviche del Ecuador",
};
```

### Agregar logo en header

Crea `components/shared/Header.tsx`:

```typescript
export default function Header() {
  return (
    <header className="bg-blue-600 text-white p-4">
      <h1 className="text-2xl font-bold">🦐 MariscosPOS</h1>
    </header>
  );
}
```

Úsalo en páginas:

```typescript
import Header from "@/components/shared/Header";
```

## 🔐 Agregar Autenticación Básica (Futuro)

```bash
npm install next-auth
```

Crea `app/api/auth/[...nextauth]/route.ts`

## 📊 Generar Reporte de Ventas

```sql
-- Ventas del día
SELECT
  DATE(o."createdAt") as fecha,
  COUNT(*) as total_ordenes,
  SUM(o.total) as ventas_totales
FROM "Orden" o
WHERE o."createdAt" >= CURRENT_DATE
GROUP BY DATE(o."createdAt");

-- Ventas por mesero
SELECT
  o.mesero,
  COUNT(*) as ordenes,
  SUM(o.total) as total_ventas
FROM "Orden" o
WHERE o."createdAt" >= CURRENT_DATE
GROUP BY o.mesero
ORDER BY total_ventas DESC;
```

## 🐛 Logs y Debugging

### Ver errores de Next.js

Los errores aparecen en la terminal donde corriste `npm run dev`

### Ver errores de API

```typescript
// En cualquier route.ts
console.log("Debug info:", data);
console.error("Error:", error);
```

### Inspeccionar requests

Abre DevTools del navegador:

- Network tab → XHR
- Console tab → Ver logs del cliente

## 🔄 Resetear Todo y Empezar de Nuevo

```bash
# CUIDADO: Esto borra TODOS los datos
npx prisma migrate reset

# Repoblar base de datos
npm run seed

# Reiniciar servidor
npm run dev
```

## 📞 Atajos de Teclado en Prisma Studio

- `Cmd/Ctrl + K`: Búsqueda rápida
- `Cmd/Ctrl + S`: Guardar cambios
- `Cmd/Ctrl + Z`: Deshacer

## ✅ Checklist Pre-Producción

- [ ] Cambiar credenciales de base de datos
- [ ] Usar variables de entorno seguras
- [ ] Configurar HTTPS
- [ ] Implementar autenticación
- [ ] Configurar backups de base de datos
- [ ] Probar impresión en producción
- [ ] Configurar manejo de errores
- [ ] Agregar logs de auditoría
- [ ] Optimizar imágenes (si hay)
- [ ] Configurar CORS si es necesario

---

**¡Consulta rápida para el día a día!** 📋
