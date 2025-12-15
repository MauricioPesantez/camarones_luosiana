# 🚀 Guía de Configuración Rápida - Restaurant POS

## ⚠️ IMPORTANTE: Requisito de Node.js

**Este proyecto requiere Node.js versión 20.9.0 o superior.**

Verifica tu versión:

```bash
node --version
```

Si necesitas actualizar:

```bash
# Con nvm (recomendado)
nvm install 20
nvm use 20
```

## 📝 Pasos de Instalación

### 1️⃣ Configurar PostgreSQL

```bash
# Crear base de datos
createdb restaurant_pos

# O con psql:
psql -U postgres
CREATE DATABASE restaurant_pos;
\q
```

### 2️⃣ Configurar Variables de Entorno

Edita el archivo `.env.local` ya creado:

```env
DATABASE_URL="postgresql://tu_usuario:tu_password@localhost:5432/restaurant_pos?schema=public"
PRINTER_IP="192.168.1.100"
PRINTER_PORT="9100"
```

Reemplaza:

- `tu_usuario` con tu usuario de PostgreSQL
- `tu_password` con tu contraseña de PostgreSQL
- `192.168.1.100` con la IP de tu impresora térmica

### 3️⃣ Configurar Base de Datos con Prisma

```bash
# Generar cliente Prisma
npx prisma generate

# Crear tablas en la base de datos
npx prisma migrate dev --name init

# Poblar con datos de ejemplo
npm run seed
```

### 4️⃣ Iniciar el Servidor

```bash
npm run dev
```

Abre tu navegador en: **http://localhost:3000**

## 🖨️ Configuración de Impresora Térmica

### Paso 1: Conectar impresora a la red

- Conecta la impresora 3nStar a tu router con cable Ethernet

### Paso 2: Asignar IP fija

1. Accede a tu router (usualmente 192.168.1.1 o 192.168.0.1)
2. Busca la sección "DHCP" o "Dispositivos conectados"
3. Encuentra tu impresora
4. Asigna una IP fija (ej: 192.168.1.100)

### Paso 3: Probar conexión

```bash
ping 192.168.1.100
```

Deberías ver respuestas. Si no, verifica:

- Que la impresora esté encendida
- Que el cable Ethernet esté bien conectado
- Que estén en la misma red

### Paso 4: Actualizar .env.local

```env
PRINTER_IP="192.168.1.100"  # Tu IP asignada
PRINTER_PORT="9100"          # Puerto estándar
```

## ✅ Probar el Sistema

### Interfaz de Mesero

1. Abre: http://localhost:3000/mesero
2. Ingresa número de mesa: `5`
3. Selecciona algunos productos
4. Click en "Enviar a Cocina"
5. ✅ Verifica que se imprima la comanda

### Monitor de Cocina

1. Abre en otra pantalla/pestaña: http://localhost:3000/cocina
2. Verás las órdenes pendientes
3. Click en "Marcar como Lista" para completar

## 🔧 Comandos Útiles

```bash
# Ver base de datos visualmente
npx prisma studio

# Regenerar cliente si hay cambios en schema
npx prisma generate

# Ver estructura de tablas
npx prisma db pull

# Resetear base de datos (CUIDADO: borra todos los datos)
npx prisma migrate reset
```

## ❌ Solución de Problemas

### Error: "Node.js version >=20.9.0 is required"

```bash
nvm install 20
nvm use 20
cd restaurant-pos
npm install
```

### Error: "Can't reach database server"

Verifica:

```bash
# PostgreSQL está corriendo?
sudo service postgresql status

# Puedes conectar?
psql -U tu_usuario -d restaurant_pos

# Verifica DATABASE_URL en .env.local
```

### Error: "ETIMEDOUT" en impresión

```bash
# Prueba conexión
ping TU_PRINTER_IP

# Verifica que .env.local tenga la IP correcta
cat .env.local | grep PRINTER_IP
```

### Error: "Module not found: '@/lib/db'"

```bash
npx prisma generate
```

## 📊 Datos de Ejemplo

El sistema incluye:

- ✅ 13 productos (ceviches, platos fuertes, bebidas)
- ✅ 15 mesas (capacidad 2-6 personas)
- ✅ 4 usuarios (meseros, cajero, admin)

Para modificar los datos iniciales, edita: `prisma/seed.ts`

## 🎯 Siguiente Paso

Una vez todo funcione:

1. Personaliza los productos en `prisma/seed.ts`
2. Ejecuta `npm run seed` nuevamente
3. Ajusta el diseño en los componentes si lo deseas
4. ¡Empieza a tomar órdenes! 🍤

## 📞 ¿Necesitas Ayuda?

Si algo no funciona, verifica:

1. ✅ Node.js >= 20.9.0
2. ✅ PostgreSQL corriendo
3. ✅ .env.local configurado correctamente
4. ✅ `npm install` ejecutado sin errores
5. ✅ `npx prisma generate` ejecutado
6. ✅ `npx prisma migrate dev` ejecutado

---

**¡Listo para servir! 🦐**
