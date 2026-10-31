# 📁 Estructura del Proyecto - Restaurant POS
2SpyKu1O11MH5Gnnxi1Zp1qHj8a97QX6aiYV7ef8ZUk
```
restaurant-pos/
├── app/
│   ├── layout.tsx                    # Layout principal con metadata
│   ├── page.tsx                      # Página inicial (redirige a /mesero)
│   ├── globals.css                   # Estilos globales de Tailwind
│   │
│   ├── mesero/
│   │   └── page.tsx                  # Página de mesero (crear órdenes)
│   │
│   ├── cocina/
│   │   └── page.tsx                  # Monitor de cocina (órdenes pendientes)
│   │
│   ├── caja/                         # 🔜 Por implementar
│   │   └── page.tsx
│   │
│   ├── admin/                        # 🔜 Por implementar
│   │   ├── page.tsx
│   │   └── productos/
│   │       └── page.tsx
│   │
│   └── api/
│       ├── productos/
│       │   ├── route.ts              # GET: listar productos, POST: crear producto
│       │   └── [id]/
│       │       └── route.ts          # PATCH: actualizar, DELETE: eliminar
│       │
│       └── ordenes/
│           ├── route.ts              # GET: listar órdenes, POST: crear orden + imprimir
│           └── [id]/
│               └── route.ts          # PATCH: actualizar estado, DELETE: eliminar
│
├── components/
│   ├── mesero/
│   │   └── CrearOrden.tsx            # ⭐ Componente principal de mesero
│   │                                 #    - Selector de productos por categoría
│   │                                 #    - Carrito de compras
│   │                                 #    - Envío de orden a cocina
│   │
│   ├── cocina/                       # 🔜 Por implementar (actualmente en page)
│   │   ├── ListaOrdenesPendientes.tsx
│   │   └── CardOrden.tsx
│   │
│   ├── shared/                       # 🔜 Componentes compartidos
│   │   ├── Header.tsx
│   │   └── Button.tsx
│   │
│   └── admin/                        # 🔜 Por implementar
│       ├── FormProducto.tsx
│       └── ListaProductos.tsx
│
├── lib/
│   ├── db.ts                         # ⭐ Cliente de Prisma (singleton)
│   ├── printer.ts                    # ⭐ Servicio de impresión térmica
│   │                                 #    - imprimirComanda()
│   │                                 #    - testConexion()
│   └── utils.ts                      # Utilidades generales
│
├── prisma/
│   ├── schema.prisma                 # ⭐ Schema de base de datos
│   │                                 #    - Producto (catálogo)
│   │                                 #    - Orden (pedidos)
│   │                                 #    - Item (items de orden)
│   │                                 #    - Mesa
│   │                                 #    - Usuario
│   │
│   └── seed.ts                       # ⭐ Datos iniciales
│                                     #    - 13 productos de mariscos
│                                     #    - 15 mesas
│                                     #    - 4 usuarios
│
├── .env.local                        # ⭐ Variables de entorno (NO subir a Git)
├── .env.example                      # Ejemplo de variables de entorno
├── package.json                      # Dependencias y scripts
├── tsconfig.json                     # Configuración TypeScript
├── tailwind.config.ts                # Configuración Tailwind CSS
├── next.config.js                    # Configuración Next.js
├── README.md                         # Documentación completa
└── SETUP.md                          # Guía de configuración rápida
```

## 🗂️ Descripción de Archivos Clave

### API Routes

#### `/api/productos/route.ts`

- **GET**: Obtiene todos los productos disponibles ordenados por categoría
- **POST**: Crea un nuevo producto

#### `/api/ordenes/route.ts`

- **GET**: Lista órdenes (puede filtrar por estado)
- **POST**: Crea nueva orden, calcula total, imprime comanda

#### `/api/ordenes/[id]/route.ts`

- **PATCH**: Actualiza estado de orden (pendiente → completada)
- **DELETE**: Elimina una orden

### Componentes

#### `components/mesero/CrearOrden.tsx`

Componente principal del flujo de mesero:

- Estado local para carrito y orden
- Filtrado de productos por categoría
- Gestión de cantidades
- Cálculo de total en tiempo real
- Envío de orden a API

#### `app/cocina/page.tsx`

Monitor de cocina:

- Polling cada 5 segundos para órdenes nuevas
- Vista de tarjetas con información de cada orden
- Botón para marcar como completada
- Auto-refresh

### Servicios (lib/)

#### `lib/printer.ts`

Servicio de impresión térmica:

```typescript
class PrinterService {
  imprimirComanda(orden); // Imprime comanda en impresora
  testConexion(); // Prueba conexión con impresora
}
```

Formato de comanda impresa:

```
================================
      COMANDA DE COCINA
================================

Mesa: 5
Mesero: Juan Pérez
Hora: 14:30:25
Fecha: 01/12/2025
--------------------------------

2x Ceviche de Camarón
   Obs: Sin cebolla

1x Arroz con Mariscos

--------------------------------
OBSERVACIONES GENERALES:
Cliente tiene prisa
--------------------------------

Orden #abc123
================================
```

#### `lib/db.ts`

Cliente singleton de Prisma para prevenir múltiples instancias en desarrollo.

### Base de Datos (prisma/)

#### Modelo de Datos

**Producto**

- id, nombre, categoria, precio, disponible, descripcion
- Categorías: Entradas, Platos Fuertes, Acompañamientos, Bebidas

**Orden**

- id, numeroMesa, mesero, estado, total, observaciones, impresa
- Estados: pendiente, completada, cancelada

**Item**

- id, ordenId, productoId, cantidad, precioUnitario, subtotal, observaciones
- Relación N:M entre Orden y Producto

**Mesa**

- id, numero, capacidad, disponible

**Usuario**

- id, nombre, rol, activo
- Roles: mesero, cajero, admin

## 🔄 Flujo de Datos

### Crear Orden (Mesero → Cocina)

```
1. Mesero selecciona productos
   └─> Estado local en CrearOrden.tsx

2. Click en "Enviar a Cocina"
   └─> POST /api/ordenes
       ├─> Crear orden en DB
       ├─> Calcular total
       ├─> Imprimir comanda (PrinterService)
       └─> Actualizar campo "impresa"

3. Monitor de cocina recibe orden
   └─> GET /api/ordenes?estado=pendiente (cada 5s)
       └─> Mostrar tarjeta de orden
```

### Completar Orden (Cocina)

```
1. Chef marca orden como lista
   └─> PATCH /api/ordenes/[id]
       └─> estado = "completada"

2. Monitor actualiza lista
   └─> GET /api/ordenes?estado=pendiente
       └─> Orden ya no aparece
```

## 🎨 Estilos y Diseño

- **Framework**: Tailwind CSS
- **Tema de colores**:
  - Primario: Blue-600 (botones, categorías activas)
  - Éxito: Green-600 (enviar orden)
  - Peligro: Red-500 (reducir cantidad)
  - Fondo: Gray-100 (mesero), Gray-900 (cocina)

## 📦 Dependencias Principales

```json
{
  "dependencies": {
    "next": "16.0.6", // Framework React
    "react": "19.2.0", // Librería UI
    "@prisma/client": "^7.0.1", // ORM
    "node-thermal-printer": "^4.5.0", // Impresión térmica
    "socket.io": "^4.8.1", // WebSockets (futuro)
    "socket.io-client": "^4.8.1"
  }
}
```

## 🚀 Scripts Disponibles

```bash
npm run dev      # Next.js en modo desarrollo
npm run build    # Build para producción
npm start        # Servidor de producción
npm run seed     # Poblar base de datos
```

## 🔐 Variables de Entorno

```env
# Base de datos PostgreSQL
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Impresora térmica en red
PRINTER_IP="192.168.1.100"
PRINTER_PORT="9100"
```

## 📈 Próximas Implementaciones

- [ ] `/caja` - Panel de facturación
- [ ] `/admin` - Gestión de productos, usuarios, reportes
- [ ] Autenticación con NextAuth.js
- [ ] WebSockets para actualizaciones en tiempo real
- [ ] Módulo de inventario
- [ ] Reportes de ventas
- [ ] App móvil para meseros

---

**Estructura optimizada para escalabilidad y mantenimiento** ✨
