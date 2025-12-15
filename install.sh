#!/bin/bash

# 🚀 Script de Instalación Automática - Restaurant POS
# Este script configura el proyecto completo automáticamente

echo "================================================"
echo "🦐 Restaurant POS - Instalación Automática"
echo "================================================"
echo ""

# Verificar Node.js
echo "📦 Verificando Node.js..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ ERROR: Node.js versión 20 o superior requerida"
    echo "Tu versión: $(node -v)"
    echo "Por favor actualiza Node.js y vuelve a ejecutar este script"
    echo "Visita: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node -v) detectado"
echo ""

# Verificar PostgreSQL
echo "🐘 Verificando PostgreSQL..."
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL encontrado"
else
    echo "⚠️  PostgreSQL no detectado"
    echo "Por favor instala PostgreSQL antes de continuar"
    echo "macOS: brew install postgresql"
    echo "Ubuntu: sudo apt install postgresql"
    exit 1
fi
echo ""

# Verificar si .env.local existe
if [ ! -f ".env.local" ]; then
    echo "❌ ERROR: Archivo .env.local no encontrado"
    echo "Por favor crea el archivo .env.local con:"
    echo "  DATABASE_URL=\"postgresql://usuario:password@localhost:5432/restaurant_pos\""
    echo "  PRINTER_IP=\"192.168.1.100\""
    echo "  PRINTER_PORT=\"9100\""
    exit 1
fi
echo "✅ Archivo .env.local encontrado"
echo ""

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error al instalar dependencias"
    exit 1
fi
echo "✅ Dependencias instaladas"
echo ""

# Generar cliente Prisma
echo "🔨 Generando cliente Prisma..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Error al generar cliente Prisma"
    exit 1
fi
echo "✅ Cliente Prisma generado"
echo ""

# Crear base de datos (si no existe)
echo "🗄️  Configurando base de datos..."
npx prisma migrate dev --name init
if [ $? -ne 0 ]; then
    echo "❌ Error al crear migraciones"
    echo "Verifica que PostgreSQL esté corriendo y que las credenciales en .env.local sean correctas"
    exit 1
fi
echo "✅ Base de datos configurada"
echo ""

# Poblar base de datos
echo "🌱 Poblando base de datos con datos de ejemplo..."
npm run seed
if [ $? -ne 0 ]; then
    echo "❌ Error al poblar base de datos"
    exit 1
fi
echo "✅ Base de datos poblada"
echo ""

# Resumen
echo "================================================"
echo "✅ ¡INSTALACIÓN COMPLETADA!"
echo "================================================"
echo ""
echo "📝 Próximos pasos:"
echo ""
echo "1. Verifica la configuración de impresora en .env.local"
echo "   PRINTER_IP=\"192.168.1.100\""
echo ""
echo "2. Inicia el servidor de desarrollo:"
echo "   npm run dev"
echo ""
echo "3. Abre tu navegador en:"
echo "   http://localhost:3000"
echo ""
echo "📚 Documentación:"
echo "   - README.md - Documentación completa"
echo "   - SETUP.md - Guía de configuración"
echo "   - QUICK_REFERENCE.md - Referencia rápida"
echo ""
echo "🖨️  Para probar la impresora:"
echo "   - Asegúrate de que esté conectada a la red"
echo "   - Ping a la IP: ping 192.168.1.100"
echo "   - Crea una orden de prueba en /mesero"
echo ""
echo "================================================"
echo "¡Disfruta de tu sistema POS! 🦐"
echo "================================================"
