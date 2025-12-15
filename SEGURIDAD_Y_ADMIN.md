# 🔐 Sistema de Login con Seguridad y Panel Admin

## ✅ Funcionalidades Implementadas

### 1. **Login con Contraseña para Admin**

- Campo `password` agregado a la tabla `Usuario` (opcional)
- Login detecta automáticamente si el usuario requiere contraseña
- Verificación de contraseña antes de permitir acceso

### 2. **Panel de Administración - Cuadre Diario**

- Ruta: `/admin` (solo accesible con rol admin)
- Filtro por fecha para ver órdenes específicas
- Estadísticas en tiempo real:
  - **Total del día** (suma de todas las órdenes)
  - **Total de órdenes**
  - **Órdenes completadas**
  - **Órdenes pendientes**
- Tabla detallada con:
  - Hora de la orden
  - Mesa
  - Mesero
  - Items ordenados
  - Estado
  - Total

### 3. **Seguridad Mejorada**

- Usuarios sin contraseña: login directo (meseros y cocina)
- Usuario admin: requiere contraseña
- Protección de rutas: solo admin puede acceder a `/admin`
- Sesión persistente con localStorage

## 🔑 Credenciales

**Usuario Admin:**

- Usuario: `Admin (admin)`
- Contraseña: `admin123`

**Usuarios sin contraseña:**

- Juan Pérez (mesero)
- María García (mesero)
- Carlos López (cocina)

## 🚀 Cómo Usar

1. **Login como Admin:**

   - Ve a `http://localhost:3000/login`
   - Selecciona "Admin (admin)"
   - Aparecerá campo de contraseña
   - Ingresa: `admin123`
   - Te redirige a `/admin`

2. **Ver Cuadre:**

   - Selecciona fecha en el filtro
   - Click en "Actualizar"
   - Ve todas las estadísticas y órdenes del día

3. **Login sin contraseña:**
   - Selecciona cualquier mesero o cocinero
   - Entra directamente sin contraseña

## 📊 Estructura de Base de Datos

```prisma
model Usuario {
  id        String   @id @default(cuid())
  nombre    String
  rol       String   // "mesero", "cocina", "admin"
  password  String?  // Solo para usuarios que lo requieren
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

## 🔄 APIs Creadas

- `POST /api/auth/login` - Verificar contraseña
- `GET /api/usuarios/[id]` - Obtener info de usuario
- `GET /api/admin/cuadre?fecha=YYYY-MM-DD` - Obtener órdenes por fecha

## 🎯 Próximas Mejoras (Opcionales)

- [ ] Usar bcrypt para encriptar contraseñas
- [ ] Agregar filtros adicionales (por mesero, estado, etc.)
- [ ] Exportar cuadre a PDF/Excel
- [ ] Gráficos de ventas por categoría
- [ ] Historial de cambios de estado
- [ ] Múltiples roles de admin con permisos

## 📝 Notas Importantes

⚠️ **En producción:**

- Cambiar contraseña del admin
- Usar bcrypt para encriptar contraseñas
- Implementar JWT o NextAuth para sesiones seguras
- Agregar rate limiting al login

✅ **Funcionamiento actual:**

- Perfecto para ambiente local/confianza
- Contraseñas en texto plano (solo para desarrollo)
- localStorage para sesión (no tokens)
